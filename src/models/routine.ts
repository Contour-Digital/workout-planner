/** A single planned set within an exercise config. Values are optional because
 * not every exercise uses every metric (e.g. a plank has duration but no weight). */
export interface SetTarget {
  id: string
  setNumber: number
  targetReps?: number
  targetWeightKg?: number
  targetDurationSeconds?: number
  targetDistanceMeters?: number
}

export interface ExerciseConfig {
  id: string
  exerciseId: string
  orderIndex: number
  /** When true, all sets share sets[0]'s targets; editing one edits all. */
  uniformSets: boolean
  sets: SetTarget[]
  restSeconds?: number
  notes?: string
}

export type RoutineSectionKind = 'warmup' | 'main' | 'cooldown'

export interface RoutineSection {
  enabled: boolean
  exercises: ExerciseConfig[]
}

export interface RoutineTemplate {
  id: string
  type: 'workout'
  name: string
  description?: string
  notes?: string
  warmup: RoutineSection
  main: ExerciseConfig[]
  cooldown: RoutineSection
  defaultRestSeconds: number
  archived: boolean
  createdAt: string
  updatedAt: string
}

export function createEmptySection(): RoutineSection {
  return { enabled: false, exercises: [] }
}

export function createEmptySetTarget(setNumber: number): SetTarget {
  return { id: crypto.randomUUID(), setNumber, targetReps: 10 }
}

export function createExerciseConfig(exerciseId: string, orderIndex: number): ExerciseConfig {
  return {
    id: crypto.randomUUID(),
    exerciseId,
    orderIndex,
    uniformSets: true,
    sets: [createEmptySetTarget(1), createEmptySetTarget(2), createEmptySetTarget(3)],
    restSeconds: 60,
  }
}
