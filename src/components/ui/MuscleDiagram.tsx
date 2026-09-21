import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../../models/exercise'

interface Shape {
  cx: number
  cy: number
  rx: number
  ry: number
  rotate?: number
}

/** Approximate, stylised body regions — not anatomically precise, just enough to
 *  show at a glance where an exercise lands. Two shapes per group (left/right)
 *  where the muscle is paired. */
const FRONT_REGIONS: Partial<Record<MuscleGroup, Shape[]>> = {
  shoulders: [
    { cx: 34, cy: 58, rx: 11, ry: 13 },
    { cx: 106, cy: 58, rx: 11, ry: 13 },
  ],
  chest: [{ cx: 70, cy: 72, rx: 30, ry: 18 }],
  biceps: [
    { cx: 26, cy: 92, rx: 8, ry: 16, rotate: -8 },
    { cx: 114, cy: 92, rx: 8, ry: 16, rotate: 8 },
  ],
  forearms: [
    { cx: 20, cy: 128, rx: 7, ry: 16, rotate: -6 },
    { cx: 120, cy: 128, rx: 7, ry: 16, rotate: 6 },
  ],
  core: [{ cx: 70, cy: 106, rx: 20, ry: 24 }],
  hip_flexors: [{ cx: 70, cy: 140, rx: 24, ry: 10 }],
  quads: [
    { cx: 54, cy: 182, rx: 13, ry: 28 },
    { cx: 86, cy: 182, rx: 13, ry: 28 },
  ],
  calves: [
    { cx: 55, cy: 240, rx: 9, ry: 20 },
    { cx: 85, cy: 240, rx: 9, ry: 20 },
  ],
}

const BACK_REGIONS: Partial<Record<MuscleGroup, Shape[]>> = {
  shoulders: [
    { cx: 34, cy: 58, rx: 11, ry: 13 },
    { cx: 106, cy: 58, rx: 11, ry: 13 },
  ],
  back: [{ cx: 70, cy: 88, rx: 30, ry: 30 }],
  triceps: [
    { cx: 26, cy: 92, rx: 8, ry: 16, rotate: -8 },
    { cx: 114, cy: 92, rx: 8, ry: 16, rotate: 8 },
  ],
  forearms: [
    { cx: 20, cy: 128, rx: 7, ry: 16, rotate: -6 },
    { cx: 120, cy: 128, rx: 7, ry: 16, rotate: 6 },
  ],
  lower_back: [{ cx: 70, cy: 124, rx: 18, ry: 12 }],
  glutes: [{ cx: 70, cy: 148, rx: 24, ry: 15 }],
  hamstrings: [
    { cx: 54, cy: 182, rx: 13, ry: 28 },
    { cx: 86, cy: 182, rx: 13, ry: 28 },
  ],
  calves: [
    { cx: 55, cy: 240, rx: 9, ry: 20 },
    { cx: 85, cy: 240, rx: 9, ry: 20 },
  ],
}

const ALL_REGION_MUSCLES = Array.from(
  new Set([...Object.keys(FRONT_REGIONS), ...Object.keys(BACK_REGIONS)]),
) as MuscleGroup[]

type Tier = 'primary' | 'secondary' | 'none'

function tierFor(muscle: MuscleGroup, primary: Set<MuscleGroup>, secondary: Set<MuscleGroup>): Tier {
  if (primary.has(muscle)) return 'primary'
  if (secondary.has(muscle)) return 'secondary'
  // "Full body" exercises wash every mapped region at whichever tier full_body itself has.
  if (primary.has('full_body')) return 'secondary'
  if (secondary.has('full_body')) return 'secondary'
  return 'none'
}

const FILL: Record<Tier, string> = {
  primary: 'var(--color-secondary)',
  secondary: 'var(--color-secondary-subtle)',
  none: 'var(--color-primary-tint)',
}

function Silhouette({ regions, tierOf, label }: { regions: Partial<Record<MuscleGroup, Shape[]>>; tierOf: (m: MuscleGroup) => Tier; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 140 270" width={120} height={231} role="img" aria-label={`${label} view muscle diagram`}>
        {/* Body outline for context */}
        <circle cx="70" cy="24" r="16" fill="none" stroke="var(--color-primary-border)" strokeWidth="1.5" />
        <path
          d="M40 44 Q70 36 100 44 L112 96 L102 100 L96 146 L92 198 L88 254 L78 254 L80 190 L70 150 L60 190 L62 254 L52 254 L48 198 L44 146 L38 100 L28 96 Z"
          fill="none"
          stroke="var(--color-primary-border)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {Object.entries(regions).map(([muscle, shapes]) =>
          shapes!.map((s, i) => (
            <ellipse
              key={`${muscle}-${i}`}
              cx={s.cx}
              cy={s.cy}
              rx={s.rx}
              ry={s.ry}
              transform={s.rotate ? `rotate(${s.rotate} ${s.cx} ${s.cy})` : undefined}
              fill={FILL[tierOf(muscle as MuscleGroup)]}
              stroke="var(--color-surface)"
              strokeWidth="1"
              opacity={0.92}
            />
          )),
        )}
      </svg>
      <span className="text-xs font-medium text-primary-muted">{label}</span>
    </div>
  )
}

export function MuscleDiagram({ primaryMuscles, secondaryMuscles }: { primaryMuscles: MuscleGroup[]; secondaryMuscles: MuscleGroup[] }) {
  const primary = new Set(primaryMuscles)
  const secondary = new Set(secondaryMuscles)
  const tierOf = (m: MuscleGroup) => tierFor(m, primary, secondary)

  const mappedMuscles = ALL_REGION_MUSCLES.filter((m) => tierOf(m) !== 'none')
  const hasCardio = primary.has('cardiovascular') || secondary.has('cardiovascular')
  const hasAnyRegion = mappedMuscles.length > 0

  if (!hasAnyRegion && !hasCardio) return null

  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-primary-border bg-surface-muted p-4">
      <div className="flex gap-6">
        <Silhouette regions={FRONT_REGIONS} tierOf={tierOf} label="Front" />
        <Silhouette regions={BACK_REGIONS} tierOf={tierOf} label="Back" />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-primary-muted">
        <LegendDot color="var(--color-secondary)" label="Primary" />
        <LegendDot color="var(--color-secondary-subtle)" label="Secondary" />
      </div>
      {hasCardio && (
        <p className="text-xs text-primary-muted">
          Also targets: <span className="font-medium text-primary">{MUSCLE_GROUP_LABELS.cardiovascular}</span>
        </p>
      )}
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  )
}
