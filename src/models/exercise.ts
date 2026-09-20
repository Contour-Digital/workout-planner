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
