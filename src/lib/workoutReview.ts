import { getPreviousExercisePerformance } from '../db/sessionsRepo'
import { formatSetResult } from './formatPerformance'
import type { Achievement, MissedExercise, SessionExerciseEntry, SetResult, WorkoutSession } from '../models/session'

function allEntries(session: WorkoutSession): SessionExerciseEntry[] {
  return [
    ...(session.warmup?.enabled ? session.warmup.exercises : []),
    ...session.main,
    ...(session.cooldown?.enabled ? session.cooldown.exercises : []),
  ]
}

/** Exercises with at least one set left unchecked at finish time. */
export function computeMissedExercises(session: WorkoutSession): MissedExercise[] {
  return allEntries(session)
    .map((e) => ({
      exerciseName: e.exerciseName,
      missedCount: e.actualSets.filter((s) => !s.completed).length,
      totalCount: e.actualSets.length,
    }))
    .filter((e) => e.missedCount > 0)
}

function bestOf(sets: SetResult[], field: keyof Pick<SetResult, 'actualWeightKg' | 'actualReps' | 'actualDistanceMeters' | 'actualDurationSeconds'>): number {
  return sets.reduce((max, s) => Math.max(max, s[field] ?? 0), 0)
}

/** Compares each main-workout exercise's best completed set this session against its
 *  most recent prior performance, in priority order weight > reps > distance > duration
 *  (whichever metric the exercise actually uses) — flags it as an achievement when this
 *  session's best beats the last one. Skips exercises with no prior history to compare. */
export async function computeSessionAchievements(session: WorkoutSession): Promise<Achievement[]> {
  const achievements: Achievement[] = []

  for (const entry of session.main) {
    const completed = entry.actualSets.filter((s) => s.completed)
    if (completed.length === 0) continue

    const previous = await getPreviousExercisePerformance(entry.exerciseId, session.id)
    if (!previous) continue
    const previousCompleted = previous.entry.actualSets.filter((s) => s.completed)
    if (previousCompleted.length === 0) continue

    const metrics: { field: 'actualWeightKg' | 'actualReps' | 'actualDistanceMeters' | 'actualDurationSeconds'; unit: string; noun: string }[] = [
      { field: 'actualWeightKg', unit: 'kg', noun: 'weight' },
      { field: 'actualDistanceMeters', unit: 'm', noun: 'distance' },
      { field: 'actualDurationSeconds', unit: 's', noun: 'duration' },
      { field: 'actualReps', unit: 'reps', noun: 'rep' },
    ]

    for (const metric of metrics) {
      const currentBest = bestOf(completed, metric.field)
      const previousBest = bestOf(previousCompleted, metric.field)
      if (currentBest <= 0 || currentBest <= previousBest) continue

      const bestSet = completed.find((s) => s[metric.field] === currentBest)
      const detail = bestSet ? formatSetResult(bestSet) : null
      achievements.push({
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        message: `${entry.exerciseName}: new ${metric.noun} PB${detail ? ` — ${detail}` : ` at ${currentBest}${metric.unit}`} (up from ${previousBest}${metric.unit})`,
      })
      break // one achievement per exercise, first metric that improved
    }
  }

  return achievements
}
