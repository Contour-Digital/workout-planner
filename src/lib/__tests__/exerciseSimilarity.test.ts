import { describe, expect, it } from 'vitest'
import { findMostSimilarExercise, muscleSimilarityScore } from '../exerciseSimilarity'
import type { LibraryExercise } from '../../models/exercise'

function ex(overrides: Partial<Omit<LibraryExercise, 'source'>> & Pick<LibraryExercise, 'id' | 'name'>): LibraryExercise {
  return {
    category: 'strength',
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment: ['none'],
    instructions: [],
    techniqueTips: [],
    commonMistakes: [],
    media: { kind: 'placeholder' },
    source: 'library',
    ...overrides,
  }
}

describe('muscleSimilarityScore', () => {
  it('weighs a shared primary muscle above a shared secondary one', () => {
    const bench = ex({ id: 'bench', name: 'Bench Press', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] })
    const chestFly = ex({ id: 'fly', name: 'Chest Fly', primaryMuscles: ['chest'], secondaryMuscles: ['shoulders'] })
    const tricepPushdown = ex({ id: 'pushdown', name: 'Tricep Pushdown', primaryMuscles: ['triceps'], secondaryMuscles: [] })
    expect(muscleSimilarityScore(bench, chestFly)).toBeGreaterThan(muscleSimilarityScore(bench, tricepPushdown))
  })

  it('scores zero for exercises with no muscle overlap at all', () => {
    const squat = ex({ id: 'squat', name: 'Squat', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'] })
    const curl = ex({ id: 'curl', name: 'Bicep Curl', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'] })
    expect(muscleSimilarityScore(squat, curl)).toBe(0)
  })
})

describe('findMostSimilarExercise', () => {
  const bench = ex({ id: 'bench', name: 'Bench Press', primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'shoulders'] })
  const chestFly = ex({ id: 'fly', name: 'Cable Chest Fly', primaryMuscles: ['chest'], secondaryMuscles: ['shoulders'] })
  const pushup = ex({ id: 'pushup', name: 'Push-Up', category: 'bodyweight', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] })
  const overheadPress = ex({ id: 'ohp', name: 'Overhead Press', primaryMuscles: ['shoulders'], secondaryMuscles: ['triceps'] })
  const unrelated = ex({ id: 'curl', name: 'Bicep Curl', primaryMuscles: ['biceps'], secondaryMuscles: [] })

  it('picks the candidate with the highest muscle overlap', () => {
    const result = findMostSimilarExercise(bench, [chestFly, pushup, overheadPress, unrelated])
    expect(result?.id).toBe('fly')
  })

  it('never suggests the exercise itself even if present in the pool', () => {
    const result = findMostSimilarExercise(bench, [bench, unrelated])
    expect(result?.id).not.toBe('bench')
  })

  it('returns null when nothing in the pool shares a muscle', () => {
    const isolatedBench = ex({ id: 'bench', name: 'Bench Press', primaryMuscles: ['chest'], secondaryMuscles: [] })
    const result = findMostSimilarExercise(isolatedBench, [unrelated])
    expect(result).toBeNull()
  })

  it('only matches a mobility exercise against other mobility exercises, even with a worse muscle overlap', () => {
    const hamstringStretch = ex({
      id: 'stretch',
      name: 'Standing Hamstring Stretch',
      category: 'mobility',
      primaryMuscles: ['hamstrings'],
      secondaryMuscles: ['lower_back'],
    })
    const legCurl = ex({ id: 'curl', name: 'Seated Leg Curl', category: 'strength', primaryMuscles: ['hamstrings'], secondaryMuscles: ['calves'] })
    const calfStretch = ex({ id: 'calf-stretch', name: 'Calf Stretch', category: 'mobility', primaryMuscles: ['lower_back'], secondaryMuscles: [] })
    const result = findMostSimilarExercise(hamstringStretch, [legCurl, calfStretch])
    expect(result?.id).toBe('calf-stretch')
  })

  it('never suggests a mobility exercise as a swap for a non-mobility exercise', () => {
    const legCurl = ex({ id: 'curl', name: 'Seated Leg Curl', category: 'strength', primaryMuscles: ['hamstrings'], secondaryMuscles: [] })
    const hamstringStretch = ex({
      id: 'stretch',
      name: 'Standing Hamstring Stretch',
      category: 'mobility',
      primaryMuscles: ['hamstrings'],
      secondaryMuscles: [],
    })
    const result = findMostSimilarExercise(legCurl, [hamstringStretch])
    expect(result).toBeNull()
  })
})
