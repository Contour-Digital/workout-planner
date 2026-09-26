import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { IconMapPin, IconPause, IconPlay, IconStop } from '../../components/ui/icons'
import { saveCardioActivity } from '../../db/cardioActivityRepo'
import { applyCardioActivityToTarget, findLoggableTargets, type LoggableTarget } from '../../lib/cardioActivityMatch'
import { haversineDistance } from '../../lib/geo'
import { formatPace, paceSplitMetersFor } from '../../models/units'
import { CARDIO_ACTIVITY_TYPE_LABELS, type CardioActivity, type CardioActivityType, type GeoPoint } from '../../models/cardioActivity'
import { ActivityCharts } from './ActivityCharts'

type Phase = 'idle' | 'recording' | 'paused' | 'summary'

const ROUTE_COLOR = '#8b5cf6'
// A running average over a tiny "whole so far" is dominated by whatever the last GPS
// point happened to be — it looks like it's flashing an instant reading rather than
// settling into a stable average, exactly like Strava/Garmin hide pace for the first
// few seconds too. Hold off showing a number until there's enough of the activity
// behind it for the average to actually mean something.
const MIN_SECONDS_FOR_LIVE_PACE = 20
const MIN_METERS_FOR_LIVE_PACE = 20
// A phone's reported accuracy commonly sits in the 20-70m range outdoors (worse near
// buildings/tree cover), so 50m silently dropped a large fraction of real fixes —
// leaving distance built from a handful of sparse points while the timer kept running
// regardless, understating distance (and so overstating pace) for the whole activity.
// 100m keeps effectively all real fixes and only rejects clearly bad ones.
const ACCURACY_THRESHOLD_METERS = 100
// Rejects a fix only when the implied speed to it is physically implausible for a
// walk/run (faster than an ~29km/h sprint) — a GPS jump artifact, not real movement.
const MAX_PLAUSIBLE_SPEED_MPS = 8

interface WakeLockSentinelLike {
  release: () => Promise<void>
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function defaultActivityName(type: CardioActivityType): string {
  const hour = new Date().getHours()
  const timeOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'
  return `${timeOfDay} ${CARDIO_ACTIVITY_TYPE_LABELS[type]}`
}

export function RecordActivityPage() {
  const navigate = useNavigate()
  const [activityType, setActivityType] = useState<CardioActivityType>('walk')
  const [phase, setPhase] = useState<Phase>('idle')
  const [route, setRoute] = useState<GeoPoint[]>([])
  const [distanceMeters, setDistanceMeters] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [targets, setTargets] = useState<LoggableTarget[]>([])
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [selectedTargetIndex, setSelectedTargetIndex] = useState<number | null>(null)
  const [finishedActivity, setFinishedActivity] = useState<CardioActivity | null>(null)

  const mapRef = useRef<L.Map | null>(null)
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const polylineRef = useRef<L.Polyline | null>(null)
  const currentMarkerRef = useRef<L.CircleMarker | null>(null)
  const startMarkerRef = useRef<L.CircleMarker | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)
  const startedAtMsRef = useRef(0)
  const pausedMsRef = useRef(0)
  const pauseStartMsRef = useRef<number | null>(null)
  const tickRef = useRef<number | null>(null)

  // Map is created once and kept for the whole idle → recording → summary flow.
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return
    const map = L.map(mapElRef.current, { zoomControl: false }).setView([0, 0], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    polylineRef.current = L.polyline([], { color: ROUTE_COLOR, weight: 4 }).addTo(map)
    mapRef.current = map

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 16),
        () => {},
        { enableHighAccuracy: true, timeout: 8000 },
      )
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // The map container's height changes with phase (a taller box while recording), but
  // Leaflet caches its pixel origin/tile layout at init and has no way to notice a
  // CSS-driven resize on its own — without this it renders blank until some other
  // event (like a drag) happens to trigger a recalculation.
  useEffect(() => {
    const raf = requestAnimationFrame(() => mapRef.current?.invalidateSize())
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // Keep the polyline and markers in sync with the recorded route.
  useEffect(() => {
    if (!mapRef.current || !polylineRef.current) return
    const latlngs = route.map((p): [number, number] => [p.lat, p.lng])
    polylineRef.current.setLatLngs(latlngs)
    if (route.length === 0) return

    const first = route[0]
    if (!startMarkerRef.current) {
      startMarkerRef.current = L.circleMarker([first.lat, first.lng], {
        radius: 6,
        color: '#fff',
        weight: 2,
        fillColor: '#22c55e',
        fillOpacity: 1,
      }).addTo(mapRef.current)
    }

    const last = route[route.length - 1]
    if (!currentMarkerRef.current) {
      currentMarkerRef.current = L.circleMarker([last.lat, last.lng], {
        radius: 7,
        color: '#fff',
        weight: 2,
        fillColor: ROUTE_COLOR,
        fillOpacity: 1,
      }).addTo(mapRef.current)
    } else {
      currentMarkerRef.current.setLatLng([last.lat, last.lng])
    }
    if (phase === 'recording' || phase === 'paused') mapRef.current.panTo([last.lat, last.lng])
    if (phase === 'summary') mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [24, 24] })
  }, [route, phase])

  // Elapsed-time ticker, driven by wall-clock timestamps so it stays correct
  // even if the tab was briefly throttled between ticks.
  useEffect(() => {
    if (phase !== 'recording') return
    tickRef.current = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtMsRef.current - pausedMsRef.current) / 1000))
    }, 1000)
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [phase])

  useEffect(() => {
    return () => {
      stopWatch()
      releaseWakeLock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePoint(pos: GeolocationPosition) {
    if (pos.coords.accuracy && pos.coords.accuracy > ACCURACY_THRESHOLD_METERS) return
    const point: GeoPoint = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      timestamp: new Date().toISOString(),
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude ?? undefined,
    }
    setRoute((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1]
        const segmentMeters = haversineDistance(last, point)
        const segmentSeconds = (new Date(point.timestamp).getTime() - new Date(last.timestamp).getTime()) / 1000
        if (segmentSeconds > 0 && segmentMeters / segmentSeconds > MAX_PLAUSIBLE_SPEED_MPS) return prev
        setDistanceMeters((d) => d + segmentMeters)
      }
      return [...prev, point]
    })
  }

  function startWatch() {
    if (!('geolocation' in navigator)) {
      setGeoError('Location is not available on this device/browser.')
      return
    }
    watchIdRef.current = navigator.geolocation.watchPosition(handlePoint, (err) => setGeoError(err.message), {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 20000,
    })
  }
  function stopWatch() {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    watchIdRef.current = null
  }

  async function requestWakeLock() {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }
      if (nav.wakeLock) wakeLockRef.current = await nav.wakeLock.request('screen')
    } catch {
      // Best-effort only — recording still works, the screen just might lock on its own.
    }
  }
  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  function handleStart() {
    setRoute([])
    setDistanceMeters(0)
    setElapsedSeconds(0)
    setGeoError(null)
    startMarkerRef.current = null
    currentMarkerRef.current = null
    startedAtMsRef.current = Date.now()
    pausedMsRef.current = 0
    pauseStartMsRef.current = null
    setPhase('recording')
    startWatch()
    requestWakeLock()
  }

  function handlePause() {
    pauseStartMsRef.current = Date.now()
    stopWatch()
    setPhase('paused')
  }

  function handleResume() {
    if (pauseStartMsRef.current) pausedMsRef.current += Date.now() - pauseStartMsRef.current
    pauseStartMsRef.current = null
    setPhase('recording')
    startWatch()
  }

  async function handleStop() {
    stopWatch()
    releaseWakeLock()
    const finishedAt = new Date().toISOString()
    const activity: CardioActivity = {
      id: crypto.randomUUID(),
      activityType,
      name: defaultActivityName(activityType),
      startedAt: new Date(startedAtMsRef.current).toISOString(),
      finishedAt,
      route,
      distanceMeters,
      durationSeconds: elapsedSeconds,
      createdAt: finishedAt,
      updatedAt: finishedAt,
    }
    setName(activity.name)
    setFinishedActivity(activity)
    setPhase('summary')
    setLoadingTargets(true)
    try {
      const found = await findLoggableTargets(activityType)
      setTargets(found)
      setSelectedTargetIndex(found.length > 0 ? 0 : null)
    } finally {
      setLoadingTargets(false)
    }
  }

  async function handleSave() {
    if (!finishedActivity) return
    setSaving(true)
    try {
      let loggedAgainst: CardioActivity['loggedAgainst']
      if (selectedTargetIndex != null && targets[selectedTargetIndex]) {
        loggedAgainst = await applyCardioActivityToTarget(finishedActivity, targets[selectedTargetIndex])
      }
      const toSave: CardioActivity = { ...finishedActivity, name: name.trim() || finishedActivity.name, loggedAgainst }
      await saveCardioActivity(toSave)
      navigate(`/activity/${toSave.id}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  const rawPace = formatPace(distanceMeters, elapsedSeconds, paceSplitMetersFor(activityType))
  // Once finished, distance/time are the activity's real final totals, so its average
  // pace is always meaningful — only gate the number while it's still building up live.
  const enoughForLivePace = elapsedSeconds >= MIN_SECONDS_FOR_LIVE_PACE && distanceMeters >= MIN_METERS_FOR_LIVE_PACE
  const pace = phase === 'summary' || enoughForLivePace ? rawPace : null
  const mapHeight = phase === 'recording' || phase === 'paused' ? 'h-[45vh]' : 'h-64'

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title={phase === 'summary' ? 'Activity summary' : 'Record activity'} />

      {geoError && (
        <Card className="mb-3 border-warning bg-warning-bg">
          <p className="text-sm text-warning">{geoError}</p>
        </Card>
      )}

      <div ref={mapElRef} className={`mb-4 w-full overflow-hidden rounded-[var(--radius-card)] border border-primary-border ${mapHeight}`} />

      <Card className="mb-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-bold text-primary-strong">{formatDuration(elapsedSeconds)}</p>
            <p className="text-xs text-primary-muted">Time</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary-strong">{(distanceMeters / 1000).toFixed(2)}</p>
            <p className="text-xs text-primary-muted">Distance (km)</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary-strong">{pace ?? '–'}</p>
            <p className="text-xs text-primary-muted">Avg pace</p>
          </div>
        </div>
      </Card>

      {phase === 'idle' && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {(['walk', 'run'] as CardioActivityType[]).map((type) => (
              <Button
                key={type}
                variant={activityType === type ? 'primary' : 'ghost'}
                onClick={() => setActivityType(type)}
                className={activityType !== type ? 'border border-primary-border' : ''}
              >
                {CARDIO_ACTIVITY_TYPE_LABELS[type]}
              </Button>
            ))}
          </div>
          <Button fullWidth size="lg" icon={<IconPlay width={20} height={20} />} onClick={handleStart}>
            Start
          </Button>
        </>
      )}

      {phase === 'recording' && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" className="border border-primary-border" size="lg" icon={<IconPause width={20} height={20} />} onClick={handlePause}>
            Pause
          </Button>
          <Button variant="danger" size="lg" icon={<IconStop width={20} height={20} />} onClick={handleStop}>
            Finish
          </Button>
        </div>
      )}

      {phase === 'paused' && (
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" icon={<IconPlay width={20} height={20} />} onClick={handleResume}>
            Resume
          </Button>
          <Button variant="danger" size="lg" icon={<IconStop width={20} height={20} />} onClick={handleStop}>
            Finish
          </Button>
        </div>
      )}

      {phase === 'summary' && (
        <div className="flex flex-col gap-4">
          <ActivityCharts route={route} activityType={activityType} />

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-primary-muted">Title</span>
            <input
              className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-primary-strong">Log this activity to</h3>
            {loadingTargets ? (
              <p className="text-sm text-primary-muted">Checking today's schedule…</p>
            ) : (
              <div className="flex flex-col gap-2">
                {targets.map((t, i) => (
                  <label
                    key={i}
                    className="flex items-center gap-2 rounded-[var(--radius-control)] border border-primary-border bg-surface px-3 py-2 text-sm"
                  >
                    <input type="radio" name="log-target" checked={selectedTargetIndex === i} onChange={() => setSelectedTargetIndex(i)} />
                    {t.label}
                  </label>
                ))}
                <label className="flex items-center gap-2 rounded-[var(--radius-control)] border border-primary-border bg-surface px-3 py-2 text-sm">
                  <input type="radio" name="log-target" checked={selectedTargetIndex === null} onChange={() => setSelectedTargetIndex(null)} />
                  Save as a standalone activity
                </label>
              </div>
            )}
          </div>

          <Button fullWidth size="lg" icon={<IconMapPin width={20} height={20} />} onClick={handleSave} loading={saving}>
            Save
          </Button>
          <Button fullWidth variant="ghost" onClick={() => navigate('/', { replace: true })}>
            Discard
          </Button>
        </div>
      )}
    </div>
  )
}
