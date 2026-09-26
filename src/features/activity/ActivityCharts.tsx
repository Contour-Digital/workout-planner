import { useEffect, useRef, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { elevationGainMeters, elevationSeries, paceSeries, type DistanceSample } from '../../lib/geo'
import { paceSplitMetersFor } from '../../models/units'
import type { GeoPoint } from '../../models/cardioActivity'

const CHART_HEIGHT = 180
const PAD_LEFT = 40
const PAD_RIGHT = 10
const PAD_TOP = 12
const PAD_BOTTOM = 20

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

interface AreaChartProps {
  data: DistanceSample[]
  /** Elevation: a bigger number reads as literally higher on the chart. Pace: a
   *  smaller number (faster) reads as higher, matching how a runner reads "the line
   *  went up" as "I sped up" — Strava's pace charts use this same inverted axis. */
  biggerIsHigher: boolean
  formatValue: (v: number) => string
  formatAxisValue: (v: number) => string
}

function AreaChart({ data, biggerIsHigher, formatValue, formatAxisValue }: AreaChartProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(320)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!wrapRef.current) return
    const el = wrapRef.current
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (data.length < 2) return null

  const values = data.map((d) => d.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values) === minValue ? minValue + 1 : Math.max(...values)
  const maxDistanceKm = data[data.length - 1].distanceKm || 1

  const plotWidth = width - PAD_LEFT - PAD_RIGHT
  const plotHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM

  function xFor(distanceKm: number): number {
    return PAD_LEFT + (distanceKm / maxDistanceKm) * plotWidth
  }
  function yFor(value: number): number {
    const t = (value - minValue) / (maxValue - minValue)
    return biggerIsHigher ? PAD_TOP + (1 - t) * plotHeight : PAD_TOP + t * plotHeight
  }

  const linePoints = data.map((d) => `${xFor(d.distanceKm)},${yFor(d.value)}`).join(' L ')
  const baselineY = PAD_TOP + plotHeight
  const areaPath = `M ${xFor(data[0].distanceKm)},${baselineY} L ${linePoints} L ${xFor(data[data.length - 1].distanceKm)},${baselineY} Z`
  const linePath = `M ${linePoints}`

  const gridValues = [minValue, (minValue + maxValue) / 2, maxValue]
  const distanceTicks = [0, maxDistanceKm / 2, maxDistanceKm]

  function handlePointer(clientX: number) {
    if (!wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const targetKm = ((x - PAD_LEFT) / plotWidth) * maxDistanceKm
    let nearest = 0
    let nearestDist = Infinity
    for (let i = 0; i < data.length; i++) {
      const d = Math.abs(data[i].distanceKm - targetKm)
      if (d < nearestDist) {
        nearestDist = d
        nearest = i
      }
    }
    setHoverIndex(nearest)
  }

  const hovered = hoverIndex != null ? data[hoverIndex] : null
  const tooltipX = hovered ? Math.min(Math.max(xFor(hovered.distanceKm), PAD_LEFT + 45), width - PAD_RIGHT - 45) : 0

  return (
    <div ref={wrapRef} className="w-full">
      <svg
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        width="100%"
        height={CHART_HEIGHT}
        onPointerMove={(e) => handlePointer(e.clientX)}
        onPointerDown={(e) => handlePointer(e.clientX)}
        onPointerLeave={() => setHoverIndex(null)}
        style={{ touchAction: 'none' }}
      >
        {gridValues.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD_LEFT}
              x2={width - PAD_RIGHT}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke="var(--color-primary-border)"
              strokeWidth={1}
            />
            <text x={PAD_LEFT - 6} y={yFor(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--color-primary-muted)">
              {formatAxisValue(v)}
            </text>
          </g>
        ))}

        {distanceTicks.map((km, i) => (
          <text key={i} x={xFor(km)} y={CHART_HEIGHT - 4} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fontSize={10} fill="var(--color-primary-muted)">
            {km.toFixed(1)} km
          </text>
        ))}

        <path d={areaPath} fill="var(--color-accent)" opacity={0.1} stroke="none" />
        <path d={linePath} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

        {hovered && (
          <>
            <line x1={xFor(hovered.distanceKm)} x2={xFor(hovered.distanceKm)} y1={PAD_TOP} y2={baselineY} stroke="var(--color-primary-border)" strokeWidth={1} />
            <circle cx={xFor(hovered.distanceKm)} cy={yFor(hovered.value)} r={5} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={2} />
            <g transform={`translate(${tooltipX}, ${PAD_TOP})`}>
              <rect x={-45} y={-2} width={90} height={34} rx={6} fill="var(--color-surface-muted)" stroke="var(--color-primary-border)" />
              <text x={0} y={12} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--color-primary-strong)">
                {formatValue(hovered.value)}
              </text>
              <text x={0} y={24} textAnchor="middle" fontSize={9} fill="var(--color-primary-muted)">
                {hovered.distanceKm.toFixed(2)} km
              </text>
            </g>
          </>
        )}
      </svg>
    </div>
  )
}

interface ActivityChartsProps {
  route: GeoPoint[]
  activityType: string
}

/** A toggle between an elevation profile and a pace-per-segment chart, both plotted
 *  against cumulative distance — the same review Strava shows after an activity.
 *  Elevation is hidden entirely when the device never reported an altitude. */
export function ActivityCharts({ route, activityType }: ActivityChartsProps) {
  const elevation = elevationSeries(route)
  const pace = paceSeries(route)
  const [tab, setTab] = useState<'elevation' | 'pace'>(elevation ? 'elevation' : 'pace')

  if (!elevation && pace.length < 2) return null
  const activeTab = tab === 'elevation' && !elevation ? 'pace' : tab

  const splitMeters = paceSplitMetersFor(activityType)
  const splitLabel = splitMeters === 500 ? '/500m' : '/km'

  return (
    <Card className="mb-4">
      <div className="mb-3 grid grid-cols-2 gap-2">
        {elevation && (
          <button
            onClick={() => setTab('elevation')}
            className={`rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium ${activeTab === 'elevation' ? 'bg-accent text-white' : 'bg-surface-muted text-primary-muted'}`}
          >
            Elevation
          </button>
        )}
        <button
          onClick={() => setTab('pace')}
          className={`rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium ${activeTab === 'pace' ? 'bg-accent text-white' : 'bg-surface-muted text-primary-muted'} ${elevation ? '' : 'col-span-2'}`}
        >
          Pace
        </button>
      </div>

      {activeTab === 'elevation' && elevation && (
        <>
          <AreaChart data={elevation} biggerIsHigher formatValue={(v) => `${Math.round(v)} m`} formatAxisValue={(v) => `${Math.round(v)}`} />
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-primary-strong">{Math.round(elevationGainMeters(route))} m</p>
              <p className="text-xs text-primary-muted">Elevation gain</p>
            </div>
            <div>
              <p className="text-lg font-bold text-primary-strong">{Math.round(Math.max(...elevation.map((d) => d.value)))} m</p>
              <p className="text-xs text-primary-muted">Max elevation</p>
            </div>
          </div>
        </>
      )}

      {activeTab === 'pace' && pace.length >= 2 && (
        <>
          <AreaChart
            data={pace}
            biggerIsHigher={false}
            formatValue={(v) => `${formatClock(v * (splitMeters / 1000))} ${splitLabel}`}
            formatAxisValue={(v) => formatClock(v * (splitMeters / 1000))}
          />
          <div className="mt-3 text-center">
            <p className="text-lg font-bold text-primary-strong">
              {formatClock(Math.min(...pace.map((d) => d.value)) * (splitMeters / 1000))} {splitLabel}
            </p>
            <p className="text-xs text-primary-muted">Fastest split</p>
          </div>
        </>
      )}
    </Card>
  )
}
