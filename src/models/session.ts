import type { SetTarget } from './routine'
import type { RecoveryTrackingType } from './recovery'
import type { ExerciseSuggestion } from './exercise'

export interface SetResult {
  id: string
  setNumber: number
  completed: boolean
  completedAt?: string
  actualReps?: number
  actualWeightKg?: number
  actualDurationSeconds?: number
  actualDistanceMeters?: number
}

export interface SessionExerciseEntry {
  id: string
  exerciseId: string
  /** Snapshot so history reads correctly even if the exercise is later edited/deleted. */
  exerciseName: string
  orderIndex: number
  targetSets: SetTarget[]
  actualSets: SetResult[]
  restSeconds?: number
  notes?: string
  addedAdHoc?: boolean
  removedAdHoc?: boolean
}

export interface RecoveryActivityResult {
  id: string
  configId: string
  name: string
  trackingType: RecoveryTrackingType
  status: 'pending' | 'completed' | 'skipped'
  completedAt?: string
  actualDurationSeconds?: number
  actualDistanceMeters?: number
  actualSteps?: number
  actualReps?: number
  actualSleepMinutes?: number
  actualBedtimeLocal?: string
  actualWaterMl?: number
  notes?: string
}

export type SessionStatus =
  | 'in_progress'
  | 'completed'
  | 'partial'
  | 'skipped'
  | 'missed'
  | 'open' // recovery sessions that may stay open across a day boundary

export type FeelingTag = 'great' | 'good' | 'okay' | 'tired' | 'sore' | 'struggling'

/** An exercise with one or more sets left unchecked at finish time. */
export interface MissedExercise {
  exerciseName: string
  missedCount: number
  totalCount: number
}

/** Lifted heavier/further/longer than the last time this exercise was performed. */
export interface Achievement {
  exerciseId: string
  exerciseName: string
  message: string
}

export interface PerceivedEffort {
  score: number // 1-10, RPE-style
  label: string
  reasoning: string
}

export interface PostWorkoutReview {
  effort?: number // 1-10
  feelings?: FeelingTag[]
  comments?: string
  painNotes?: string
  expectationVsActual?: 'easier' | 'about_same' | 'harder'
  /** Computed once at finish time and carried with the review so history keeps
   *  showing the same picture even if the session's exercises are edited later. */
  missedExercises?: MissedExercise[]
  achievements?: Achievement[]
  aiSummary?: string
  aiPerceivedEffort?: PerceivedEffort
  /** General, non-exercise-specific coaching tips for future sessions. */
  aiTips?: string[]
  /** Specific exercises the AI thinks are worth adding next time — actionable via
   *  "Add to routine" when this session came from a saved routine. */
  aiExerciseSuggestions?: ExerciseSuggestion[]
  createdAt: string
  updatedAt: string
}

export interface PauseInterval {
  start: string
  end?: string
}

export interface WorkoutSession {
  id: string
  kind: 'workout'
  origin: 'scheduled' | 'impromptu'
  scheduleId?: string
  occurrenceDate?: string
  routineTemplateId?: string
  name: string
  status: SessionStatus
  scheduledDate: string
  startedAt?: string
  finishedAt?: string
  pauseIntervals: PauseInterval[]
  warmup?: { enabled: boolean; exercises: SessionExerciseEntry[] }
  main: SessionExerciseEntry[]
  cooldown?: { enabled: boolean; exercises: SessionExerciseEntry[] }
  notes?: string
  review?: PostWorkoutReview
  /** ISO timestamp the current rest timer ends at, if one is running. Storing the
   *  target timestamp (not a countdown) keeps it correct across backgrounding/restarts. */
  restTimerEndsAt?: string
  createdAt: string
  updatedAt: string
}

export interface RecoverySession {
  id: string
  kind: 'recovery'
  origin: 'scheduled' | 'impromptu'
  scheduleId?: string
  occurrenceDate?: string
  routineTemplateId?: string
  name: string
  status: SessionStatus
  scheduledDate: string
  startedAt?: string
  finishedAt?: string
  activities: RecoveryActivityResult[]
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface RestDaySession {
  id: string
  kind: 'rest'
  scheduleId?: string
  occurrenceDate?: string
  scheduledDate: string
  status: SessionStatus
  notes?: string
  createdAt: string
  updatedAt: string
}

export type AnySession = WorkoutSession | RecoverySession | RestDaySession

export function workoutSetsCompleted(session: WorkoutSession): { done: number; total: number } {
  const all = [
    ...(session.warmup?.enabled ? session.warmup.exercises : []),
    ...session.main,
    ...(session.cooldown?.enabled ? session.cooldown.exercises : []),
  ]
  const total = all.reduce((sum, e) => sum + e.actualSets.length, 0)
  const done = all.reduce((sum, e) => sum + e.actualSets.filter((s) => s.completed).length, 0)
  return { done, total }
}

export function elapsedSeconds(startedAt?: string, finishedAt?: string, pauses: PauseInterval[] = []): number {
  if (!startedAt) return 0
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now()
  const start = new Date(startedAt).getTime()
  const pausedMs = pauses.reduce((sum, p) => {
    const pStart = new Date(p.start).getTime()
    const pEnd = p.end ? new Date(p.end).getTime() : end
    return sum + Math.max(0, pEnd - pStart)
  }, 0)
  return Math.max(0, Math.floor((end - start - pausedMs) / 1000))
}
