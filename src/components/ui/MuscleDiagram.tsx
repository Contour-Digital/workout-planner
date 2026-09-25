import { MUSCLE_GROUP_LABELS, SPECIFIC_MUSCLE_GROUP, type MuscleGroup, type SpecificMuscle } from '../../models/exercise'
import { BACK_BODY_PATHS, BACK_VIEW_BOX, FRONT_BODY_PATHS, FRONT_VIEW_BOX, type BodyPathShape } from './bodyMusclePaths'

/** Maps each vendored shape id to the app's MuscleGroup, where one exists. Shapes
 *  with no mapping (head, hands, feet, knees, elbows, …) still render — in the
 *  neutral "unworked" tone — so the body reads as a complete silhouette; they just
 *  never highlight, since no exercise in this app targets them specifically. */
const MUSCLE_ID_TO_GROUP: Record<string, MuscleGroup> = {
  'shoulder-front-left': 'shoulders',
  'shoulder-side-left': 'shoulders',
  'shoulder-front-right': 'shoulders',
  'shoulder-side-right': 'shoulders',
  'deltoid-rear-left': 'shoulders',
  'deltoid-rear-right': 'shoulders',
  'biceps-left': 'biceps',
  'biceps-right': 'biceps',
  'triceps-long-left': 'triceps',
  'triceps-lateral-left': 'triceps',
  'triceps-long-right': 'triceps',
  'triceps-lateral-right': 'triceps',
  'forearm-left': 'forearms',
  'forearm-right': 'forearms',
  'forearm-flexors-left': 'forearms',
  'forearm-extensors-left': 'forearms',
  'forearm-flexors-right': 'forearms',
  'forearm-extensors-right': 'forearms',
  'chest-upper-left': 'chest',
  'chest-lower-left': 'chest',
  'chest-upper-right': 'chest',
  'chest-lower-right': 'chest',
  'traps-upper-left': 'back',
  'traps-mid-left': 'back',
  'traps-lower-left': 'back',
  'traps-upper-right': 'back',
  'traps-mid-right': 'back',
  'traps-lower-right': 'back',
  'lats-upper-left': 'back',
  'lats-mid-left': 'back',
  'lats-lower-left': 'back',
  'lats-upper-right': 'back',
  'lats-mid-right': 'back',
  'lats-lower-right': 'back',
  'abs-upper-left': 'core',
  'abs-upper-right': 'core',
  'abs-lower-right': 'core',
  'abs-lower-left': 'core',
  'serratus-anterior-left': 'core',
  'serratus-anterior-right': 'core',
  'obliques-left': 'core',
  'obliques-right': 'core',
  'spine': 'lower_back',
  'lower-back-erectors-left': 'lower_back',
  'lower-back-ql-left': 'lower_back',
  'lower-back-erectors-right': 'lower_back',
  'lower-back-ql-right': 'lower_back',
  'hip-flexor-right': 'hip_flexors',
  'hip-flexor-left': 'hip_flexors',
  'gluteus-medius-left': 'glutes',
  'gluteus-maximus-left': 'glutes',
  'gluteus-medius-right': 'glutes',
  'gluteus-maximus-right': 'glutes',
  'quads-left': 'quads',
  'quads-right': 'quads',
  'adductors-left': 'quads',
  'adductors-right': 'quads',
  'hamstrings-medial-left': 'hamstrings',
  'hamstrings-lateral-left': 'hamstrings',
  'hamstrings-medial-right': 'hamstrings',
  'hamstrings-lateral-right': 'hamstrings',
  'calves-gastroc-medial-left': 'calves',
  'calves-gastroc-lateral-left': 'calves',
  'calves-soleus-left': 'calves',
  'calves-gastroc-medial-right': 'calves',
  'calves-gastroc-lateral-right': 'calves',
  'calves-soleus-right': 'calves',
}

/** Which vendored shape ids light up for each SpecificMuscle. The biceps heads and
 *  brachialis have no distinct shape in the artwork, so they fall back to the
 *  general biceps region — still a real highlight, just not a more precise one.
 *  forearm_flexors/extensors additionally include the front view's single
 *  undivided forearm shape, since only the back view has that split. */
const SPECIFIC_MUSCLE_TO_SHAPE_IDS: Record<SpecificMuscle, string[]> = {
  chest_upper: ['chest-upper-left', 'chest-upper-right'],
  chest_lower: ['chest-lower-left', 'chest-lower-right'],
  front_delts: ['shoulder-front-left', 'shoulder-front-right'],
  side_delts: ['shoulder-side-left', 'shoulder-side-right'],
  rear_delts: ['deltoid-rear-left', 'deltoid-rear-right'],
  biceps_long_head: ['biceps-left', 'biceps-right'],
  biceps_short_head: ['biceps-left', 'biceps-right'],
  brachialis: ['biceps-left', 'biceps-right'],
  triceps_long_head: ['triceps-long-left', 'triceps-long-right'],
  triceps_lateral_head: ['triceps-lateral-left', 'triceps-lateral-right'],
  forearm_flexors: ['forearm-flexors-left', 'forearm-flexors-right', 'forearm-left', 'forearm-right'],
  forearm_extensors: ['forearm-extensors-left', 'forearm-extensors-right', 'forearm-left', 'forearm-right'],
  lats: ['lats-upper-left', 'lats-mid-left', 'lats-lower-left', 'lats-upper-right', 'lats-mid-right', 'lats-lower-right'],
  traps: ['traps-upper-left', 'traps-mid-left', 'traps-lower-left', 'traps-upper-right', 'traps-mid-right', 'traps-lower-right'],
  upper_abs: ['abs-upper-left', 'abs-upper-right'],
  lower_abs: ['abs-lower-left', 'abs-lower-right'],
  obliques: ['obliques-left', 'obliques-right'],
  serratus_anterior: ['serratus-anterior-left', 'serratus-anterior-right'],
  gluteus_maximus: ['gluteus-maximus-left', 'gluteus-maximus-right'],
  gluteus_medius: ['gluteus-medius-left', 'gluteus-medius-right'],
  hamstrings_medial: ['hamstrings-medial-left', 'hamstrings-medial-right'],
  hamstrings_lateral: ['hamstrings-lateral-left', 'hamstrings-lateral-right'],
  gastrocnemius: ['calves-gastroc-medial-left', 'calves-gastroc-lateral-left', 'calves-gastroc-medial-right', 'calves-gastroc-lateral-right'],
  soleus: ['calves-soleus-left', 'calves-soleus-right'],
  adductors: ['adductors-left', 'adductors-right'],
}

type Tier = 'primary' | 'secondary' | 'none'

function tierFor(
  id: string,
  primary: Set<MuscleGroup>,
  secondary: Set<MuscleGroup>,
  primarySpecificIds: Set<string>,
  secondarySpecificIds: Set<string>,
  specificGroupsCovered: Set<MuscleGroup>,
): Tier {
  // A specific tag always wins, and takes priority over the broad fallback below.
  if (primarySpecificIds.has(id)) return 'primary'
  if (secondarySpecificIds.has(id)) return 'secondary'

  const muscle = MUSCLE_ID_TO_GROUP[id]
  if (!muscle) return 'none'

  // This shape's broad group was specifically tagged elsewhere on this exercise
  // (e.g. 'chest_upper' was given, but this shape is 'chest-lower-left') — leave
  // it unhighlighted rather than lighting up the whole group as a fallback, or
  // the specific tag wouldn't actually narrow anything on the diagram.
  if (specificGroupsCovered.has(muscle)) return 'none'

  if (primary.has(muscle)) return 'primary'
  if (secondary.has(muscle)) return 'secondary'
  // "Full body" exercises wash every mapped region at the secondary tier.
  if (primary.has('full_body') || secondary.has('full_body')) return 'secondary'
  return 'none'
}

/** Same accent color at every tier — primary shown near-opaque, secondary
 *  noticeably more transparent, unworked regions a flat neutral fill (the base
 *  silhouette). Matches how the reference design shades primary vs. secondary. */
const OPACITY: Record<Tier, number> = { primary: 0.95, secondary: 0.4, none: 1 }

function fillFor(tier: Tier): string {
  // primary-border reads clearly against the card's surface-muted background —
  // primary-tint (tried first) was nearly the same value as the background,
  // so unworked regions all but disappeared instead of forming a body outline.
  return tier === 'none' ? 'var(--color-primary-border)' : 'var(--color-secondary)'
}

function Silhouette({ shapes, viewBox, tierOf, label }: { shapes: BodyPathShape[]; viewBox: string; tierOf: (id: string) => Tier; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={viewBox} width={110} height={292} role="img" aria-label={`${label} view muscle diagram`}>
        {shapes.map((shape) => {
          const tier = tierOf(shape.id)
          return <path key={shape.id} d={shape.d} fill={fillFor(tier)} opacity={OPACITY[tier]} stroke="var(--color-surface)" strokeWidth={0.25} />
        })}
      </svg>
      <span className="text-xs font-medium text-primary-muted">{label}</span>
    </div>
  )
}

export function MuscleDiagram({
  primaryMuscles,
  secondaryMuscles,
  primarySpecificMuscles,
  secondarySpecificMuscles,
}: {
  primaryMuscles: MuscleGroup[]
  secondaryMuscles: MuscleGroup[]
  primarySpecificMuscles?: SpecificMuscle[]
  secondarySpecificMuscles?: SpecificMuscle[]
}) {
  const primary = new Set(primaryMuscles)
  const secondary = new Set(secondaryMuscles)
  const specificPrimary = primarySpecificMuscles ?? []
  const specificSecondary = secondarySpecificMuscles ?? []
  const primarySpecificIds = new Set(specificPrimary.flatMap((m) => SPECIFIC_MUSCLE_TO_SHAPE_IDS[m]))
  const secondarySpecificIds = new Set(specificSecondary.flatMap((m) => SPECIFIC_MUSCLE_TO_SHAPE_IDS[m]))
  const specificGroupsCovered = new Set([...specificPrimary, ...specificSecondary].map((m) => SPECIFIC_MUSCLE_GROUP[m]))
  const tierOf = (id: string) => tierFor(id, primary, secondary, primarySpecificIds, secondarySpecificIds, specificGroupsCovered)

  const hasMappedRegion = [...FRONT_BODY_PATHS, ...BACK_BODY_PATHS].some((s) => tierOf(s.id) !== 'none')
  const hasCardio = primary.has('cardiovascular') || secondary.has('cardiovascular')

  if (!hasMappedRegion && !hasCardio) return null

  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-primary-border bg-surface-muted p-4">
      <div className="flex gap-6">
        <Silhouette shapes={FRONT_BODY_PATHS} viewBox={FRONT_VIEW_BOX} tierOf={tierOf} label="Front" />
        <Silhouette shapes={BACK_BODY_PATHS} viewBox={BACK_VIEW_BOX} tierOf={tierOf} label="Back" />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-primary-muted">
        <LegendDot opacity={OPACITY.primary} label="Primary" />
        <LegendDot opacity={OPACITY.secondary} label="Secondary" />
      </div>
      {hasCardio && (
        <p className="text-xs text-primary-muted">
          Also targets: <span className="font-medium text-primary">{MUSCLE_GROUP_LABELS.cardiovascular}</span>
        </p>
      )}
    </div>
  )
}

function LegendDot({ opacity, label }: { opacity: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--color-secondary)', opacity }} aria-hidden="true" />
      {label}
    </span>
  )
}
