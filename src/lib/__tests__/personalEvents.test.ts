import { describe, expect, it } from 'vitest'
import { resolvePersonalEventsInRange } from '../personalEvents'
import type { PersonalEvent } from '../../models/calendarEvent'

function makeEvent(overrides: Partial<PersonalEvent> = {}): PersonalEvent {
  return {
    id: 'e1',
    title: 'On shift',
    color: '#f2a83e',
    startDate: '2026-01-05', // a Monday
    recurrence: { type: 'none' },
    excludedDates: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('resolvePersonalEventsInRange', () => {
  it('a non-repeating event only occurs on its start date', () => {
    const event = makeEvent()
    const results = resolvePersonalEventsInRange([event], '2026-01-01', '2026-01-31')
    expect(results).toEqual([{ event, date: '2026-01-05' }])
  })

  it('an interval event repeats every N days from the start date', () => {
    const event = makeEvent({ recurrence: { type: 'interval', everyDays: 3 } })
    const results = resolvePersonalEventsInRange([event], '2026-01-05', '2026-01-14')
    expect(results.map((r) => r.date)).toEqual(['2026-01-05', '2026-01-08', '2026-01-11', '2026-01-14'])
  })

  it('a weekly event occurs only on the selected weekdays', () => {
    // 2026-01-05 is a Monday; select Mon (1) and Wed (3)
    const event = makeEvent({ recurrence: { type: 'weekly', weekdays: [1, 3] } })
    const results = resolvePersonalEventsInRange([event], '2026-01-05', '2026-01-18')
    expect(results.map((r) => r.date)).toEqual(['2026-01-05', '2026-01-07', '2026-01-12', '2026-01-14'])
  })

  it('skips excluded dates without ending the series', () => {
    const event = makeEvent({ recurrence: { type: 'interval', everyDays: 1 }, excludedDates: ['2026-01-06'] })
    const results = resolvePersonalEventsInRange([event], '2026-01-05', '2026-01-07')
    expect(results.map((r) => r.date)).toEqual(['2026-01-05', '2026-01-07'])
  })

  it('respects an end date', () => {
    const event = makeEvent({ recurrence: { type: 'interval', everyDays: 1 }, endDate: '2026-01-06' })
    const results = resolvePersonalEventsInRange([event], '2026-01-01', '2026-01-31')
    expect(results.map((r) => r.date)).toEqual(['2026-01-05', '2026-01-06'])
  })

  it('never occurs before the start date', () => {
    const event = makeEvent({ recurrence: { type: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6] } })
    const results = resolvePersonalEventsInRange([event], '2026-01-01', '2026-01-06')
    expect(results.map((r) => r.date)).toEqual(['2026-01-05', '2026-01-06'])
  })
})
