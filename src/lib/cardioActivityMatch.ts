import { getExercise } from '../db/exercisesRepo'
import { getRecoveryRoutine, getRoutine } from '../db/routinesRepo'
import { getOccurrencesInRange } from '../db/scheduleRepo'
import { startRecoverySession, startWorkoutSession, updateRecoveryActivity, updateSetResult } from '../db/sessionActions'
import { getActiveRecoverySession, getActiveWorkoutSession, getWorkoutSession } from '../db/sessionsRepo'
import { toDateKey } from './recurrence'
import type { RecoveryRoutineTemplate } from '../models/recovery'
import type { RoutineTemplate } from '../models/routine'
import type { CardioActivity, CardioActivityTarget, CardioActivityType } from '../models/cardioActivity'

/** A candidate schedule/session item a just-recorded activity could be logged against.
 *  "active_*" points at a session already open today; "scheduled_*" points at today's
 *  schedule assignment that hasn't been started yet (applying it starts the session). */
export type LoggableTarget =
  | { kind: 'active_recovery'; sessionId: string; activityId: string; label: string }
  | { kind: 'active_workout'; sessionId: string; entryId: string; label: string }
  | { kind: 'scheduled_recovery'; routine: RecoveryRoutineTemplate; activityConfigId: string; scheduleId?: string; occurrenceDate?: string; label: string }
  | { kind: 'scheduled_workout'; routine: RoutineTemplate; exerciseId: string; scheduleId?: string; occurrenceDate?: string; label: string }

const KEYWORDS: Record<CardioActivityType, RegExp> = {
  walk: /walk/i,
  run: /run|jog/i,
}

/** Finds today's distance/duration-trackable exercises this activity could complete —
 *  from sessions already in progress, and from today's schedule if not started yet.
 *  Keyword-matching candidates (e.g. "walk" for a recorded walk) are sorted first, since
 *  they're the most likely intended match when there's more than one candidate. */
export async function findLoggableTargets(activityType: CardioActivityType): Promise<LoggableTarget[]> {
  const today = toDateKey(new Date())
  const targets: LoggableTarget[] = []

  const activeRecovery = await getActiveRecoverySession()
  if (activeRecovery) {
    for (const activity of activeRecovery.activities) {
      if (activity.status === 'completed') continue
      if (activity.trackingType !== 'distance' && activity.trackingType !== 'duration') continue
      targets.push({ kind: 'active_recovery', sessionId: activeRecovery.id, activityId: activity.id, label: activity.name })
    }
  }

  const activeWorkout = await getActiveWorkoutSession()
  if (activeWorkout) {
    for (const entry of activeWorkout.main) {
      if (!entry.actualSets.some((s) => !s.completed)) continue
      const exercise = await getExercise(entry.exerciseId)
      if (exercise?.category !== 'cardio') continue
      targets.push({ kind: 'active_workout', sessionId: activeWorkout.id, entryId: entry.id, label: entry.exerciseName })
    }
  }

  const occurrences = await getOccurrencesInRange(today, today)
  for (const occ of occurrences) {
    if (occ.sessionId) continue // already started — covered by the active-session checks above
    if (occ.assignment.kind === 'recovery') {
      const routine = await getRecoveryRoutine(occ.assignment.routineTemplateId)
      if (!routine) continue
      for (const config of routine.activities) {
        if (config.trackingType !== 'distance' && config.trackingType !== 'duration') continue
        targets.push({
          kind: 'scheduled_recovery',
          routine,
          activityConfigId: config.id,
          scheduleId: occ.scheduleId,
          occurrenceDate: occ.originalDate,
          label: config.name,
        })
      }
    } else if (occ.assignment.kind === 'workout') {
      const routine = await getRoutine(occ.assignment.routineTemplateId)
      if (!routine) continue
      for (const config of routine.main) {
        const exercise = await getExercise(config.exerciseId)
        if (exercise?.category !== 'cardio') continue
        targets.push({
          kind: 'scheduled_workout',
          routine,
          exerciseId: config.exerciseId,
          scheduleId: occ.scheduleId,
          occurrenceDate: occ.originalDate,
          label: exercise.name,
        })
      }
    }
  }

  const keyword = KEYWORDS[activityType]
  return [...targets].sort((a, b) => Number(keyword.test(b.label)) - Number(keyword.test(a.label)))
}

/** Applies a finished recording to the chosen target — starting today's session first if
 *  it hasn't been opened yet — and returns the `loggedAgainst` link to store on the activity. */
export async function applyCardioActivityToTarget(activity: CardioActivity, target: LoggableTarget): Promise<CardioActivityTarget> {
  const completedAt = activity.finishedAt
  const actualDurationSeconds = Math.round(activity.durationSeconds)
  const actualDistanceMeters = Math.round(activity.distanceMeters)

  if (target.kind === 'active_recovery') {
    await updateRecoveryActivity(target.sessionId, target.activityId, { status: 'completed', completedAt, actualDurationSeconds, actualDistanceMeters })
    return { kind: 'recovery_activity', sessionId: target.sessionId, activityId: target.activityId, label: target.label }
  }

  if (target.kind === 'active_workout') {
    const session = await getWorkoutSession(target.sessionId)
    const entry = session?.main.find((e) => e.id === target.entryId)
    const set = entry?.actualSets.find((s) => !s.completed)
    if (session && entry && set) {
      await updateSetResult(target.sessionId, target.entryId, set.id, { completed: true, completedAt, actualDurationSeconds, actualDistanceMeters })
    }
    return { kind: 'workout_exercise', sessionId: target.sessionId, entryId: target.entryId, label: target.label }
  }

  if (target.kind === 'scheduled_recovery') {
    const session = await startRecoverySession({
      routine: target.routine,
      scheduledDate: toDateKey(new Date()),
      origin: target.scheduleId ? 'scheduled' : 'impromptu',
      scheduleId: target.scheduleId,
      occurrenceDate: target.occurrenceDate,
    })
    const matched = session.activities.find((a) => a.configId === target.activityConfigId)
    if (matched) {
      await updateRecoveryActivity(session.id, matched.id, { status: 'completed', completedAt, actualDurationSeconds, actualDistanceMeters })
    }
    return { kind: 'recovery_activity', sessionId: session.id, activityId: matched?.id ?? '', label: target.label }
  }

  // scheduled_workout
  const session = await startWorkoutSession({
    routine: target.routine,
    scheduledDate: toDateKey(new Date()),
    origin: target.scheduleId ? 'scheduled' : 'impromptu',
    scheduleId: target.scheduleId,
    occurrenceDate: target.occurrenceDate,
  })
  const entry = session.main.find((e) => e.exerciseId === target.exerciseId)
  const set = entry?.actualSets[0]
  if (entry && set) {
    await updateSetResult(session.id, entry.id, set.id, { completed: true, completedAt, actualDurationSeconds, actualDistanceMeters })
  }
  return { kind: 'workout_exercise', sessionId: session.id, entryId: entry?.id ?? '', label: target.label }
}
