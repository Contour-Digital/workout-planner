import { formatPace, paceSplitMetersFor } from '../models/units'
import type { SetResult } from '../models/session'

/** Formats a completed set's actuals as "10 reps × 30 kg" style text, or null if
 *  the set has nothing recorded (shouldn't normally happen for a completed set).
 *  Pass the exercise's name to also append its pace (e.g. "5:30 /km") whenever
 *  both duration and distance were logged. Appends "(Left)"/"(Right)" when the set
 *  was tagged with a side, so e.g. "Previous:" text reminds you which side you're
 *  comparing against for single-arm/single-leg exercises. */
export function formatSetResult(set: SetResult, exerciseName?: string): string | null {
  const parts: string[] = []
  if (set.actualReps) parts.push(`${set.actualReps} reps`)
  if (set.actualWeightKg) parts.push(`${set.actualWeightKg} kg`)
  if (set.actualDurationSeconds) parts.push(`${set.actualDurationSeconds}s`)
  if (set.actualDistanceMeters) parts.push(`${set.actualDistanceMeters} m`)
  const pace = formatPace(set.actualDistanceMeters, set.actualDurationSeconds, paceSplitMetersFor(exerciseName ?? ''))
  if (pace) parts.push(pace)
  const base = parts.length > 0 ? parts.join(' × ') : null
  if (!set.side) return base
  const sideLabel = set.side === 'left' ? 'Left' : 'Right'
  return base ? `${base} (${sideLabel})` : sideLabel
}
