import { db } from './db'
import type { RecoverySession, RestDaySession, WorkoutSession } from '../models/session'

export async function getActiveWorkoutSession(): Promise<WorkoutSession | undefined> {
  return db.workoutSessions.where('status').equals('in_progress').first()
}

export async function getActiveRecoverySession(): Promise<RecoverySession | undefined> {
  const openOrProgress = await db.recoverySessions.where('status').anyOf('in_progress', 'open').toArray()
  return openOrProgress[0]
}

export async function getWorkoutSession(id: string): Promise<WorkoutSession | undefined> {
  return db.workoutSessions.get(id)
}

export async function saveWorkoutSession(session: WorkoutSession): Promise<void> {
  await db.workoutSessions.put({ ...session, updatedAt: new Date().toISOString() })
}

export async function deleteWorkoutSession(id: string): Promise<void> {
  await db.workoutSessions.delete(id)
}

export async function getRecoverySession(id: string): Promise<RecoverySession | undefined> {
  return db.recoverySessions.get(id)
}

export async function saveRecoverySession(session: RecoverySession): Promise<void> {
  await db.recoverySessions.put({ ...session, updatedAt: new Date().toISOString() })
}

export async function saveRestDaySession(session: RestDaySession): Promise<void> {
  await db.restDaySessions.put({ ...session, updatedAt: new Date().toISOString() })
}

export async function getHistorySessions(): Promise<(WorkoutSession | RecoverySession | RestDaySession)[]> {
  const [workouts, recoveries, rest] = await Promise.all([
    db.workoutSessions.toArray(),
    db.recoverySessions.toArray(),
    db.restDaySessions.toArray(),
  ])
  return [...workouts, ...recoveries, ...rest].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
}

export async function getCompletedWorkoutDatesForExercise(exerciseId: string): Promise<WorkoutSession[]> {
  const sessions = await db.workoutSessions
    .where('status')
    .anyOf('completed', 'partial')
    .toArray()
  return sessions
    .filter((s) => s.main.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
}

/** Most recent completed/partial session (other than `excludeSessionId`) that included
 *  this exercise, for showing "Previous: 10 reps × 30 kg" style comparisons. */
export async function getPreviousExercisePerformance(
  exerciseId: string,
  excludeSessionId?: string,
): Promise<{ session: WorkoutSession; entry: WorkoutSession['main'][number] } | undefined> {
  const sessions = await getCompletedWorkoutDatesForExercise(exerciseId)
  for (const session of sessions) {
    if (session.id === excludeSessionId) continue
    const entry = session.main.find((e) => e.exerciseId === exerciseId)
    if (entry && entry.actualSets.some((s) => s.completed)) return { session, entry }
  }
  return undefined
}

/** Distinct calendar days on which at least one workout was completed/partial — the
 *  unit the streak engine counts (multiple sessions in a day still count once). */
export async function getCompletedWorkoutDayKeys(): Promise<string[]> {
  const sessions = await db.workoutSessions.where('status').anyOf('completed', 'partial').toArray()
  return [...new Set(sessions.map((s) => s.scheduledDate))].sort()
}
