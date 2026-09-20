import { describe, expect, it } from 'vitest'
import {
  assignmentForDate,
  resolveOccurrences,
  splitScheduleAtDate,
  toDateKey,
} from '../recurrence'
import type { OccurrenceOverride, RecurringSchedule } from '../../models/schedule'

function makeSchedule(overrides: Partial<RecurringSchedule> = {}): RecurringSchedule {
  return {
    id: 's1',
    name: 'Test schedule',
    startDate: '2026-01-05', // a Monday
    pattern: { type: 'cycle', days: [{ kind: 'workout', routineTemplateId: 'r1' }] },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('assignmentForDate', () => {
  it('every-N-days cycle repeats correctly', () => {
    const schedule = makeSchedule({
      pattern: {
        type: 'cycle',
        days: [
          { kind: 'workout', routineTemplateId: 'r1' },
          { kind: 'off' },
          { kind: 'off' },
        ],
      },
    })
    expect(assignmentForDate(schedule, '2026-01-05')).toEqual({ kind: 'workout', routineTemplateId: 'r1' })
    expect(assignmentForDate(schedule, '2026-01-06')).toEqual({ kind: 'off' })
    expect(assignmentForDate(schedule, '2026-01-08')).toEqual({ kind: 'workout', routineTemplateId: 'r1' })
    expect(assignmentForDate(schedule, '2026-01-11')).toEqual({ kind: 'workout', routineTemplateId: 'r1' })
  })

  it('returns null before the schedule start date', () => {
    const schedule = makeSchedule()
    expect(assignmentForDate(schedule, '2026-01-01')).toBeNull()
  })

  it('respects an end date', () => {
    const schedule = makeSchedule({ endDate: '2026-01-06' })
    expect(assignmentForDate(schedule, '2026-01-06')).not.toBeNull()
    expect(assignmentForDate(schedule, '2026-01-07')).toBeNull()
  })

  it('weekday pattern only fires on selected days regardless of month boundaries', () => {
    const schedule = makeSchedule({
      startDate: '2026-01-01',
      pattern: {
        type: 'weekday',
        assignments: { 1: { kind: 'workout', routineTemplateId: 'r1' }, 4: { kind: 'workout', routineTemplateId: 'r2' } },
      },
    })
    // 2026-01-26 is a Monday, 2026-01-29 is a Thursday, 2026-02-02 is a Monday.
    expect(assignmentForDate(schedule, '2026-01-26')).toEqual({ kind: 'workout', routineTemplateId: 'r1' })
    expect(assignmentForDate(schedule, '2026-01-27')).toBeNull()
    expect(assignmentForDate(schedule, '2026-01-29')).toEqual({ kind: 'workout', routineTemplateId: 'r2' })
    expect(assignmentForDate(schedule, '2026-02-02')).toEqual({ kind: 'workout', routineTemplateId: 'r1' })
  })

  it('one-off pattern only fires on its single date', () => {
    const schedule = makeSchedule({
      startDate: '2026-03-10',
      pattern: { type: 'one_off', assignment: { kind: 'workout', routineTemplateId: 'r9' } },
    })
    expect(assignmentForDate(schedule, '2026-03-10')).toEqual({ kind: 'workout', routineTemplateId: 'r9' })
    expect(assignmentForDate(schedule, '2026-03-11')).toBeNull()
  })

  it('is unaffected by DST spring-forward transitions', () => {
    // US DST 2026 spring-forward is 2026-03-08. An every-2-days cycle spanning it
    // must still fall on the correct calendar dates.
    const schedule = makeSchedule({
      startDate: '2026-03-05',
      pattern: {
        type: 'cycle',
        days: [{ kind: 'workout', routineTemplateId: 'r1' }, { kind: 'off' }],
      },
    })
    expect(assignmentForDate(schedule, '2026-03-05')).toEqual({ kind: 'workout', routineTemplateId: 'r1' })
    expect(assignmentForDate(schedule, '2026-03-07')).toEqual({ kind: 'workout', routineTemplateId: 'r1' })
    expect(assignmentForDate(schedule, '2026-03-09')).toEqual({ kind: 'workout', routineTemplateId: 'r1' })
    expect(assignmentForDate(schedule, '2026-03-08')).toEqual({ kind: 'off' })
  })
})

describe('resolveOccurrences', () => {
  it('applies reschedule, skip, and delete overrides', () => {
    const schedule = makeSchedule()
    const overrides: OccurrenceOverride[] = [
      {
        id: 'o1',
        scheduleId: 's1',
        originalDate: '2026-01-06',
        newDate: '2026-01-07',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'o2',
        scheduleId: 's1',
        originalDate: '2026-01-08',
        status: 'skipped',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'o3',
        scheduleId: 's1',
        originalDate: '2026-01-09',
        status: 'deleted',
        createdAt: '',
        updatedAt: '',
      },
    ]
    const results = resolveOccurrences([schedule], overrides, '2026-01-05', '2026-01-10')
    const dates = results.map((r) => ({ date: r.date, status: r.status }))
    // 01-06's occurrence is rescheduled onto 01-07, landing alongside 01-07's own
    // occurrence (two sessions that day); 01-08 is skipped in place; 01-09 is deleted.
    expect(dates).toEqual([
      { date: '2026-01-05', status: 'planned' },
      { date: '2026-01-07', status: 'planned' },
      { date: '2026-01-07', status: 'planned' },
      { date: '2026-01-08', status: 'skipped' },
      { date: '2026-01-10', status: 'planned' },
    ])
  })

  it('does not mutate other occurrences when one is edited', () => {
    const schedule = makeSchedule()
    const overrides: OccurrenceOverride[] = [
      {
        id: 'o1',
        scheduleId: 's1',
        originalDate: '2026-01-06',
        assignmentOverride: { kind: 'workout', routineTemplateId: 'swapped' },
        createdAt: '',
        updatedAt: '',
      },
    ]
    const results = resolveOccurrences([schedule], overrides, '2026-01-05', '2026-01-07')
    expect(results.find((r) => r.date === '2026-01-05')?.assignment).toEqual({
      kind: 'workout',
      routineTemplateId: 'r1',
    })
    expect(results.find((r) => r.date === '2026-01-06')?.assignment).toEqual({
      kind: 'workout',
      routineTemplateId: 'swapped',
    })
    expect(results.find((r) => r.date === '2026-01-07')?.assignment).toEqual({
      kind: 'workout',
      routineTemplateId: 'r1',
    })
  })
})

describe('splitScheduleAtDate', () => {
  it('truncates the original and phase-aligns the continuation cycle', () => {
    const schedule = makeSchedule({
      pattern: {
        type: 'cycle',
        days: [
          { kind: 'workout', routineTemplateId: 'push' },
          { kind: 'workout', routineTemplateId: 'pull' },
          { kind: 'rest' },
        ],
      },
    })
    // 2026-01-07 is cycle-day index 2 (rest) relative to start 2026-01-05.
    const { truncatedOriginal, continuation } = splitScheduleAtDate(schedule, '2026-01-07')
    expect(truncatedOriginal.endDate).toBe('2026-01-06')
    expect(continuation.startDate).toBe('2026-01-07')

    // Future dates should resolve identically whether read from the original
    // pattern or the split continuation.
    for (const d of ['2026-01-07', '2026-01-08', '2026-01-09', '2026-01-12']) {
      expect(assignmentForDate(continuation, d)).toEqual(assignmentForDate(schedule, d))
    }
  })

  it('editing the continuation does not affect the truncated original', () => {
    const schedule = makeSchedule()
    const { truncatedOriginal, continuation } = splitScheduleAtDate(schedule, '2026-01-08')
    const editedContinuation: RecurringSchedule = {
      ...continuation,
      pattern: { type: 'cycle', days: [{ kind: 'workout', routineTemplateId: 'new-routine' }] },
    }
    expect(assignmentForDate(truncatedOriginal, '2026-01-05')).toEqual({
      kind: 'workout',
      routineTemplateId: 'r1',
    })
    expect(assignmentForDate(editedContinuation, '2026-01-08')).toEqual({
      kind: 'workout',
      routineTemplateId: 'new-routine',
    })
    expect(assignmentForDate(truncatedOriginal, '2026-01-08')).toBeNull()
  })
})

describe('toDateKey', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
