import { describe, expect, it } from 'vitest'
import { computeMissedExercises } from '../workoutReview'
import type { SessionExerciseEntry, WorkoutSession } from '../../models/session'

function makeEntry(overrides: Partial<SessionExerciseEntry> = {}): SessionExerciseEntry {
  return {
    id: 'e1',
    exerciseId: 'ex1',
    exerciseName: 'Bench Press',
    orderIndex: 0,
    targetSets: [],
    actualSets: [
      { id: 's1', setNumber: 1, completed: true, actualReps: 8, actualWeightKg: 60 },
      { id: 's2', setNumber: 2, completed: true, actualReps: 8, actualWeightKg: 60 },
      { id: 's3', setNumber: 3, completed: false },
    ],
    ...overrides,
  }
}

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'sess1',
    kind: 'workout',
    origin: 'scheduled',
    name: 'Push Day',
    status: 'partial',
    scheduledDate: '2026-01-05',
    pauseIntervals: [],
    main: [],
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
    ...overrides,
  }
}

describe('computeMissedExercises', () => {
  it('flags an exercise with an incomplete set', () => {
    const session = makeSession({ main: [makeEntry()] })
    expect(computeMissedExercises(session)).toEqual([{ exerciseName: 'Bench Press', missedCount: 1, totalCount: 3 }])
  })

  it('does not flag a fully completed exercise', () => {
    const entry = makeEntry({ actualSets: [{ id: 's1', setNumber: 1, completed: true, actualReps: 8 }] })
    const session = makeSession({ main: [entry] })
    expect(computeMissedExercises(session)).toEqual([])
  })

  it('checks warmup and cooldown sections too, but only when enabled', () => {
    const missedEntry = makeEntry({ id: 'w1', exerciseName: 'Stretch' })
    const session = makeSession({
      main: [],
      warmup: { enabled: true, exercises: [missedEntry] },
      cooldown: { enabled: false, exercises: [makeEntry({ id: 'c1', exerciseName: 'Cooldown walk' })] },
    })
    expect(computeMissedExercises(session)).toEqual([{ exerciseName: 'Stretch', missedCount: 1, totalCount: 3 }])
  })
})
