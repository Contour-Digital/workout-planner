import { formatPace, paceSplitMetersFor } from '../models/units'
import type { SetResult } from '../models/session'

/** Formats a completed set's actuals as "10 reps × 30 kg" style text, or null if
 *  the set has nothing recorded (shouldn't normally happen for a completed set).
 *  Pass the exercise's name to also append its pace (e.g. "5:30 /km") whenever
 *  both duration and distance were logged. */
export function formatSetResult(set: SetResult, exerciseName?: string): string | null {
  const parts: string[] = []
  if (set.actualReps) parts.push(`${set.actualReps} reps`)
  if (set.actualWeightKg) parts.push(`${set.actualWeightKg} kg`)
  if (set.actualDurationSeconds) parts.push(`${set.actualDurationSeconds}s`)
  if (set.actualDistanceMeters) parts.push(`${set.actualDistanceMeters} m`)
  const pace = formatPace(set.actualDistanceMeters, set.actualDurationSeconds, paceSplitMetersFor(exerciseName ?? ''))
  if (pace) parts.push(pace)
  return parts.length > 0 ? parts.join(' × ') : null
}
