import { formatPace, paceSplitMetersFor } from '../models/units'
import type { SetResult } from '../models/session'
import type { SetTarget } from '../models/routine'

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

/** Formats a planned set's targets the same way formatSetResult formats actuals
 *  ("10 reps × 30 kg (Left)"), or null if the set has no targets at all. */
export function formatSetTarget(set: SetTarget): string | null {
  const parts: string[] = []
  if (set.targetReps) parts.push(`${set.targetReps} reps`)
  if (set.targetWeightKg) parts.push(`${set.targetWeightKg} kg`)
  if (set.targetDurationSeconds) parts.push(`${set.targetDurationSeconds}s`)
  if (set.targetDistanceMeters) parts.push(`${set.targetDistanceMeters} m`)
  const base = parts.length > 0 ? parts.join(' × ') : null
  if (!set.side) return base
  const sideLabel = set.side === 'left' ? 'Left' : 'Right'
  return base ? `${base} (${sideLabel})` : sideLabel
}

/** One line per run of identical planned sets, for a read-only preview of a
 *  routine — e.g. three sets of 10 reps × 30 kg read as "3 sets · 10 reps × 30 kg". */
export function summarizeSetTargets(sets: SetTarget[]): string[] {
  const lines: { text: string; count: number }[] = []
  for (const set of sets) {
    const text = formatSetTarget(set) ?? 'No target'
    const last = lines[lines.length - 1]
    if (last && last.text === text) last.count += 1
    else lines.push({ text, count: 1 })
  }
  return lines.map(({ text, count }) => `${count} ${count === 1 ? 'set' : 'sets'} · ${text}`)
}
