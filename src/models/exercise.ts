export type ExerciseCategory =
  | 'strength'
  | 'cardio'
  | 'mobility'
  | 'bodyweight'
  | 'functional'
  | 'recovery'

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'full_body'
  | 'cardiovascular'
  | 'hip_flexors'
  | 'lower_back'

/** Finer detail within a broad MuscleGroup (e.g. 'chest_upper' within 'chest') —
 *  optional, since it's only populated for exercises where the targeting is
 *  well-established and unambiguous. Each maps to its parent group via
 *  SPECIFIC_MUSCLE_GROUP below. Where the muscle diagram's artwork has a distinct
 *  region for one (most of these), it highlights precisely that region instead of
 *  the whole broad group; a few (the biceps heads, brachialis) have no distinct
 *  shape in that artwork and fall back to the general biceps region there, but
 *  still show as their own named muscle in the exercise detail text. */
export type SpecificMuscle =
  | 'chest_upper'
  | 'chest_lower'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps_long_head'
  | 'biceps_short_head'
  | 'brachialis'
  | 'triceps_long_head'
  | 'triceps_lateral_head'
  | 'forearm_flexors'
  | 'forearm_extensors'
  | 'lats'
  | 'traps'
  | 'upper_abs'
  | 'lower_abs'
  | 'obliques'
  | 'serratus_anterior'
  | 'gluteus_maximus'
  | 'gluteus_medius'
  | 'hamstrings_medial'
  | 'hamstrings_lateral'
  | 'gastrocnemius'
  | 'soleus'
  | 'adductors'

export type Equipment =
  | 'none'
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'machine'
  | 'cable'
  | 'resistance_band'
  | 'bench'
  | 'pull_up_bar'
  | 'treadmill'
  | 'bike'
  | 'rower'
  | 'foam_roller'
  | 'mat'
  | 'other'

/** Placeholder-media system: real assets can be swapped in later without a schema change. */
export interface ExerciseMedia {
  kind: 'placeholder' | 'image' | 'gif' | 'upload'
  /** For 'placeholder', an icon/token key used to render a generic illustration. */
  placeholderToken?: string
  url?: string
  muscleMapUrl?: string
}

export interface ExerciseBase {
  id: string
  name: string
  category: ExerciseCategory
  primaryMuscles: MuscleGroup[]
  secondaryMuscles: MuscleGroup[]
  /** Optional finer detail within primaryMuscles/secondaryMuscles above — see
   *  SpecificMuscle. Only populated for a subset of exercises so far. */
  primarySpecificMuscles?: SpecificMuscle[]
  secondarySpecificMuscles?: SpecificMuscle[]
  equipment: Equipment[]
  instructions: string[]
  techniqueTips: string[]
  commonMistakes: string[]
  media: ExerciseMedia
  notes?: string
}

/** Library (built-in, seeded) exercise. Not user-editable. */
export interface LibraryExercise extends ExerciseBase {
  source: 'library'
}

/** User-created exercise. Fully editable/deletable by the owner. */
export interface CustomExercise extends ExerciseBase {
  source: 'custom'
  createdAt: string
  updatedAt: string
}

export type Exercise = LibraryExercise | CustomExercise

/** A personal rename of a built-in library exercise's title. Library exercises are
 *  shared reference data (same for every user), so a rename can't mutate them
 *  directly — this sits alongside as a per-user override, applied on read. */
export interface LibraryExerciseNameOverride {
  id: string
  exerciseId: string
  name: string
  updatedAt: string
}

/** An AI-suggested exercise to add somewhere (a routine section, an in-progress
 *  session) — shared shape used by both the chat assistant and the post-workout
 *  summary, so both can be resolved/added the same way. */
export interface ExerciseSuggestion {
  name: string
  section: 'warmup' | 'main' | 'cooldown'
  category: ExerciseCategory
  primaryMuscles: MuscleGroup[]
  equipment: Equipment[]
  reason: string
}

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  mobility: 'Mobility',
  bodyweight: 'Bodyweight',
  functional: 'Functional',
  recovery: 'Recovery',
}

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  core: 'Core',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  full_body: 'Full body',
  cardiovascular: 'Cardiovascular',
  hip_flexors: 'Hip flexors',
  lower_back: 'Lower back',
}

export const SPECIFIC_MUSCLE_LABELS: Record<SpecificMuscle, string> = {
  chest_upper: 'Upper chest',
  chest_lower: 'Lower chest',
  front_delts: 'Front deltoids',
  side_delts: 'Side deltoids',
  rear_delts: 'Rear deltoids',
  biceps_long_head: 'Biceps (long head)',
  biceps_short_head: 'Biceps (short head)',
  brachialis: 'Brachialis',
  triceps_long_head: 'Triceps (long head)',
  triceps_lateral_head: 'Triceps (lateral head)',
  forearm_flexors: 'Forearm flexors',
  forearm_extensors: 'Forearm extensors',
  lats: 'Lats',
  traps: 'Traps',
  upper_abs: 'Upper abs',
  lower_abs: 'Lower abs',
  obliques: 'Obliques',
  serratus_anterior: 'Serratus anterior',
  gluteus_maximus: 'Gluteus maximus',
  gluteus_medius: 'Gluteus medius',
  hamstrings_medial: 'Hamstrings (medial)',
  hamstrings_lateral: 'Hamstrings (lateral)',
  gastrocnemius: 'Gastrocnemius',
  soleus: 'Soleus',
  adductors: 'Adductors',
}

/** The broad MuscleGroup each SpecificMuscle falls under — used to tell whether an
 *  exercise's specific tags fully account for a broad group's shapes on the muscle
 *  diagram, so the untagged parts of that group don't stay highlighted alongside
 *  the now-more-precise tagged part (see MuscleDiagram.tsx). */
export const SPECIFIC_MUSCLE_GROUP: Record<SpecificMuscle, MuscleGroup> = {
  chest_upper: 'chest',
  chest_lower: 'chest',
  front_delts: 'shoulders',
  side_delts: 'shoulders',
  rear_delts: 'shoulders',
  biceps_long_head: 'biceps',
  biceps_short_head: 'biceps',
  brachialis: 'biceps',
  triceps_long_head: 'triceps',
  triceps_lateral_head: 'triceps',
  forearm_flexors: 'forearms',
  forearm_extensors: 'forearms',
  lats: 'back',
  traps: 'back',
  upper_abs: 'core',
  lower_abs: 'core',
  obliques: 'core',
  serratus_anterior: 'core',
  gluteus_maximus: 'glutes',
  gluteus_medius: 'glutes',
  hamstrings_medial: 'hamstrings',
  hamstrings_lateral: 'hamstrings',
  gastrocnemius: 'calves',
  soleus: 'calves',
  adductors: 'quads',
}

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  none: 'None',
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  machine: 'Machine',
  cable: 'Cable',
  resistance_band: 'Resistance band',
  bench: 'Bench',
  pull_up_bar: 'Pull-up bar',
  treadmill: 'Treadmill',
  bike: 'Bike',
  rower: 'Rower',
  foam_roller: 'Foam roller',
  mat: 'Mat',
  other: 'Other',
}
