import type { SetResult } from '../models/session'

/** Formats a completed set's actuals as "10 reps × 30 kg" style text, or null if
 *  the set has nothing recorded (shouldn't normally happen for a completed set). */
export function formatSetResult(set: SetResult): string | null {
  const parts: string[] = []
  if (set.actualReps) parts.push(`${set.actualReps} reps`)
  if (set.actualWeightKg) parts.push(`${set.actualWeightKg} kg`)
  if (set.actualDurationSeconds) parts.push(`${set.actualDurationSeconds}s`)
  if (set.actualDistanceMeters) parts.push(`${set.actualDistanceMeters} m`)
  return parts.length > 0 ? parts.join(' × ') : null
}
