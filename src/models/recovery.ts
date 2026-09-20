/** Recovery activities support several distinct tracking methods, chosen per-activity. */
export type RecoveryTrackingType =
  | 'checkbox'
  | 'duration'
  | 'distance'
  | 'steps'
  | 'reps'
  | 'sleep_duration'
  | 'bedtime'
  | 'water_intake'
  | 'notes'

export interface RecoveryActivityConfig {
  id: string
  /** Optional link into the exercise/activity library (e.g. "Stretching", "Foam rolling"). */
  exerciseId?: string
  /** Freeform label, used when not linked to the library (e.g. "Hydration goal"). */
  name: string
  trackingType: RecoveryTrackingType
  orderIndex: number
  targetDurationSeconds?: number
  targetDistanceMeters?: number
  targetSteps?: number
  targetReps?: number
  targetSleepMinutes?: number
  targetBedtimeLocal?: string // "HH:mm"
  targetWaterMl?: number
  notes?: string
}

export interface RecoveryRoutineTemplate {
  id: string
  type: 'recovery'
  name: string
  description?: string
  instructions?: string
  activities: RecoveryActivityConfig[]
  estimatedDurationMinutes?: number
  archived: boolean
  createdAt: string
  updatedAt: string
}

export function createRecoveryActivityConfig(
  orderIndex: number,
  overrides: Partial<RecoveryActivityConfig> = {},
): RecoveryActivityConfig {
  return {
    id: crypto.randomUUID(),
    name: 'New activity',
    trackingType: 'checkbox',
    orderIndex,
    ...overrides,
  }
}

export const RECOVERY_TRACKING_LABELS: Record<RecoveryTrackingType, string> = {
  checkbox: 'Simple completion',
  duration: 'Duration',
  distance: 'Distance',
  steps: 'Step target',
  reps: 'Repetitions',
  sleep_duration: 'Sleep duration',
  bedtime: 'Bedtime target',
  water_intake: 'Water intake',
  notes: 'Notes only',
}
