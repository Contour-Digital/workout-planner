import { describe, expect, it } from 'vitest'
import { analyzeSimpleSchedule, describeSchedule } from '../scheduleDescribe'
import type { RecurringSchedule } from '../../models/schedule'

const names: Record<string, string> = { 'routine-1': 'Push Day', 'recovery-1': 'Active Recovery' }
const routineName = (id: string) => names[id] ?? 'Deleted routine'

function base(pattern: RecurringSchedule['pattern']): RecurringSchedule {
  return {
    id: 's1',
    name: 'Test',
    startDate: '2026-01-05',
    pattern,
    createdAt: '',
    updatedAt: '',
  }
}

describe('analyzeSimpleSchedule', () => {
  it('recognizes an every-N-days cycle built by the schedule editor', () => {
    const schedule = base({
      type: 'cycle',
      days: [{ kind: 'workout', routineTemplateId: 'routine-1' }, { kind: 'off' }, { kind: 'off' }],
    })
    expect(analyzeSimpleSchedule(schedule)).toEqual({
      mode: 'interval',
      intervalDays: 3,
      assignment: { kind: 'workout', routineTemplateId: 'routine-1' },
    })
  })

  it('recognizes a weekday schedule where every selected day shares the same assignment', () => {
    const schedule = base({
      type: 'weekday',
      assignments: {
        1: { kind: 'recovery', routineTemplateId: 'recovery-1' },
        3: { kind: 'recovery', routineTemplateId: 'recovery-1' },
      },
    })
    const shape = analyzeSimpleSchedule(schedule)
    expect(shape?.mode).toBe('weekday')
    expect(shape?.weekdays?.sort()).toEqual([1, 3])
  })

  it('returns null for a genuine multi-day cycle with different routines per day', () => {
    const schedule = base({
      type: 'cycle',
      days: [
        { kind: 'workout', routineTemplateId: 'routine-1' },
        { kind: 'recovery', routineTemplateId: 'recovery-1' },
      ],
    })
    expect(analyzeSimpleSchedule(schedule)).toBeNull()
  })

  it('returns null for a weekday schedule with different assignments on different days', () => {
    const schedule = base({
      type: 'weekday',
      assignments: {
        1: { kind: 'workout', routineTemplateId: 'routine-1' },
        3: { kind: 'recovery', routineTemplateId: 'recovery-1' },
      },
    })
    expect(analyzeSimpleSchedule(schedule)).toBeNull()
  })

  it('recognizes a one-off schedule', () => {
    const schedule = base({ type: 'one_off', assignment: { kind: 'rest' } })
    expect(analyzeSimpleSchedule(schedule)).toEqual({ mode: 'one_off', assignment: { kind: 'rest' } })
  })
})

describe('describeSchedule', () => {
  it('describes an interval schedule in plain language', () => {
    const schedule = base({
      type: 'cycle',
      days: [{ kind: 'workout', routineTemplateId: 'routine-1' }, { kind: 'off' }, { kind: 'off' }],
    })
    expect(describeSchedule(schedule, routineName)).toBe('Push Day · every 3 days')
  })

  it('describes a complex cycle without pretending it is simple', () => {
    const schedule = base({
      type: 'cycle',
      days: [
        { kind: 'workout', routineTemplateId: 'routine-1' },
        { kind: 'recovery', routineTemplateId: 'recovery-1' },
      ],
    })
    expect(describeSchedule(schedule, routineName)).toBe('Custom 2-day cycle')
  })
})
