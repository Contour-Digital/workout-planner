import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { IconTrash, IconX } from '../../components/ui/icons'
import { deleteCardioActivity, getCardioActivity } from '../../db/cardioActivityRepo'
import { formatPace, paceSplitMetersFor } from '../../models/units'
import { CARDIO_ACTIVITY_TYPE_LABELS, type CardioActivity } from '../../models/cardioActivity'
import { ActivityCharts } from './ActivityCharts'

const ROUTE_COLOR = '#8b5cf6'

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function ActivityDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activity, setActivity] = useState<CardioActivity | null | undefined>(undefined)
  const mapElRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!id) return
    getCardioActivity(id).then((a) => setActivity(a ?? null))
  }, [id])

  useEffect(() => {
    if (!activity || !mapElRef.current) return
    const map = L.map(mapElRef.current, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    if (activity.route.length > 0) {
      const latlngs = activity.route.map((p): [number, number] => [p.lat, p.lng])
      const line = L.polyline(latlngs, { color: ROUTE_COLOR, weight: 4 }).addTo(map)
      const first = activity.route[0]
      const last = activity.route[activity.route.length - 1]
      L.circleMarker([first.lat, first.lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#22c55e', fillOpacity: 1 }).addTo(map)
      L.circleMarker([last.lat, last.lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#ef4444', fillOpacity: 1 }).addTo(map)
      map.fitBounds(line.getBounds(), { padding: [24, 24] })
    } else {
      map.setView([0, 0], 2)
    }

    return () => {
      map.remove()
    }
  }, [activity])

  if (activity === undefined) return <div className="p-6 text-sm text-primary-muted">Loading…</div>
  if (activity === null) return <div className="p-6 text-sm text-primary-muted">Activity not found.</div>

  const pace = formatPace(activity.distanceMeters, activity.durationSeconds, paceSplitMetersFor(activity.activityType))

  async function handleDelete() {
    if (!activity) return
    await deleteCardioActivity(activity.id)
    navigate('/history', { replace: true })
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title={activity.name}
        subtitle={`${CARDIO_ACTIVITY_TYPE_LABELS[activity.activityType]} · ${new Date(activity.startedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}
        action={
          <button
            onClick={() => navigate(-1)}
            aria-label="Close"
            className="rounded-full p-2 text-primary-muted hover:bg-primary-tint"
          >
            <IconX width={22} height={22} />
          </button>
        }
      />

      <div ref={mapElRef} className="mb-4 h-64 w-full overflow-hidden rounded-[var(--radius-card)] border border-primary-border" />

      <Card className="mb-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-bold text-primary-strong">{(activity.distanceMeters / 1000).toFixed(2)}</p>
            <p className="text-xs text-primary-muted">Distance (km)</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary-strong">{formatDuration(activity.durationSeconds)}</p>
            <p className="text-xs text-primary-muted">Time</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary-strong">{pace ?? '–'}</p>
            <p className="text-xs text-primary-muted">Avg pace</p>
          </div>
        </div>
      </Card>

      <ActivityCharts route={activity.route} activityType={activity.activityType} />

      {activity.loggedAgainst && (
        <Card className="mb-4">
          <p className="text-sm text-primary-muted">
            Logged to: <span className="font-semibold text-primary-strong">{activity.loggedAgainst.label}</span>
          </p>
        </Card>
      )}

      {activity.notes && (
        <Card className="mb-4">
          <p className="text-sm text-primary-muted">{activity.notes}</p>
        </Card>
      )}

      <Button variant="danger" icon={<IconTrash width={18} height={18} />} onClick={handleDelete}>
        Delete activity
      </Button>
    </div>
  )
}
