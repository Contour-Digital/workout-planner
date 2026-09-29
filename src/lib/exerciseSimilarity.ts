import type { Exercise } from '../models/exercise'

function overlapCount<T>(a: T[], b: T[]): number {
  const set = new Set(b)
  return a.filter((x) => set.has(x)).length
}

/** How good a substitute `candidate` would be for `exercise`, purely on muscles worked —
 *  a shared primary muscle counts far more than a shared secondary one, matching specific
 *  muscle tags add a small tiebreaking bonus, and staying in the same category (so a
 *  strength move doesn't get swapped for a stretch) breaks ties the rest of the way. */
export function muscleSimilarityScore(exercise: Exercise, candidate: Exercise): number {
  let score = 0
  score += overlapCount(exercise.primaryMuscles, candidate.primaryMuscles) * 3
  score += overlapCount(exercise.primaryMuscles, candidate.secondaryMuscles)
  score += overlapCount(exercise.secondaryMuscles, candidate.primaryMuscles)
  score += overlapCount(exercise.secondaryMuscles, candidate.secondaryMuscles) * 0.5
  // No shared muscle at all — never worth suggesting as a swap, whatever else matches.
  if (score === 0) return 0
  score += overlapCount(exercise.primarySpecificMuscles ?? [], candidate.primarySpecificMuscles ?? []) * 0.5
  score += overlapCount(exercise.secondarySpecificMuscles ?? [], candidate.secondarySpecificMuscles ?? []) * 0.5
  if (exercise.category === candidate.category) score += 0.25
  return score
}

/** The best available swap-in for `exercise` from `pool`, ranked by how much its muscle
 *  targeting overlaps. Returns null if nothing in the pool shares a muscle with it. */
export function findMostSimilarExercise(exercise: Exercise, pool: Exercise[]): Exercise | null {
  let best: Exercise | null = null
  let bestScore = 0
  for (const candidate of pool) {
    if (candidate.id === exercise.id) continue
    const score = muscleSimilarityScore(exercise, candidate)
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best
}
