import type { Exercise } from '../models/exercise'

const MATCH_THRESHOLD = 0.72

/** Finds the closest library/custom exercise to a free-text name (exact match first,
 *  then substring/Levenshtein similarity), or undefined if nothing is close enough. */
export function findBestMatch(name: string, exercises: Exercise[]): Exercise | undefined {
  const target = normalize(name)
  if (!target) return undefined

  const exact = exercises.find((e) => normalize(e.name) === target)
  if (exact) return exact

  let best: Exercise | undefined
  let bestScore = 0
  for (const exercise of exercises) {
    const score = similarity(target, normalize(exercise.name))
    if (score > bestScore) {
      bestScore = score
      best = exercise
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : undefined
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.9
  const distance = levenshtein(a, b)
  const maxLen = Math.max(a.length, b.length)
  return 1 - distance / maxLen
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const matrix: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0))
  for (let i = 0; i < rows; i++) matrix[i][0] = i
  for (let j = 0; j < cols; j++) matrix[0][j] = j
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    }
  }
  return matrix[rows - 1][cols - 1]
}
