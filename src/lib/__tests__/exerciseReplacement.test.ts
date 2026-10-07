import { describe, expect, it } from 'vitest'
import { replaceExerciseInRecoveryRoutine, replaceExerciseInRoutine } from '../exerciseReplacement'
import { createEmptySection, type ExerciseConfig, type RoutineTemplate } from '../../models/routine'
import type { RecoveryRoutineTemplate } from '../../models/recovery'

function config(exerciseId: string, orderIndex: number): ExerciseConfig {
  return { id: `${exerciseId}-${orderIndex}`, exerciseId, orderIndex, uniformSets: true, sets: [{ id: 's1', setNumber: 1, targetReps: 8 }], notes: 'keep me' }
}

function routine(main: ExerciseConfig[], warmup: ExerciseConfig[] = []): RoutineTemplate {
  return {
    id: 'r1',
    type: 'workout',
    name: 'Push',
    warmup: { enabled: warmup.length > 0, exercises: warmup },
    main,
    finisher: createEmptySection(),
    cooldown: createEmptySection(),
    defaultRestSeconds: 90,
    archived: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  }
}

describe('replaceExerciseInRoutine', () => {
  it('returns undefined when the routine does not use the exercise', () => {
    expect(replaceExerciseInRoutine(routine([config('bench', 0)]), 'fly-dup', 'fly')).toBeUndefined()
  })

  it('swaps every use to the replacement, keeping sets, notes and order', () => {
    const updated = replaceExerciseInRoutine(routine([config('bench', 0), config('fly-dup', 1)], [config('fly-dup', 0)]), 'fly-dup', 'fly')!
    expect(updated.main.map((c) => c.exerciseId)).toEqual(['bench', 'fly'])
    expect(updated.main[1]).toMatchObject({ orderIndex: 1, notes: 'keep me', sets: [{ targetReps: 8 }] })
    expect(updated.warmup.exercises[0].exerciseId).toBe('fly')
  })

  it('removes the entries and closes the ordering gap when there is no replacement', () => {
    const updated = replaceExerciseInRoutine(routine([config('bench', 0), config('fly-dup', 1), config('dips', 2)]), 'fly-dup', null)!
    expect(updated.main.map((c) => [c.exerciseId, c.orderIndex])).toEqual([
      ['bench', 0],
      ['dips', 1],
    ])
  })
})

describe('replaceExerciseInRecoveryRoutine', () => {
  const recovery: RecoveryRoutineTemplate = {
    id: 'rr1',
    type: 'recovery',
    name: 'Stretch',
    activities: [
      { id: 'a1', exerciseId: 'stretch-dup', name: 'Couch Stretch', trackingType: 'duration', orderIndex: 0 },
      { id: 'a2', name: 'Hydration', trackingType: 'water_intake', orderIndex: 1 },
    ],
    archived: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  }

  it('relinks the activity to the replacement', () => {
    expect(replaceExerciseInRecoveryRoutine(recovery, 'stretch-dup', 'stretch')!.activities[0].exerciseId).toBe('stretch')
  })

  it('keeps the activity but clears the link when there is no replacement', () => {
    const updated = replaceExerciseInRecoveryRoutine(recovery, 'stretch-dup', null)!
    expect(updated.activities).toHaveLength(2)
    expect(updated.activities[0]).not.toHaveProperty('exerciseId')
    expect(updated.activities[0].name).toBe('Couch Stretch')
  })
})
