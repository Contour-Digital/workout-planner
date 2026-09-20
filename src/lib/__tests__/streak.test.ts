import { describe, expect, it } from 'vitest'
import { computeStreak } from '../streak'
import type { StreakSettings } from '../../models/settings'

describe('computeStreak', () => {
  const settings: StreakSettings = { periodLengthDays: 7, targetDaysPerPeriod: 3, anchor: { type: 'rolling' } }

  it('counts multiple workouts on the same day as one workout day', () => {
    const today = new Date(2026, 0, 10) // Sat Jan 10
    const days = ['2026-01-05', '2026-01-05', '2026-01-06', '2026-01-07']
    const result = computeStreak(days, settings, today)
    expect(result.currentPeriod.workoutDayKeys).toEqual(['2026-01-05', '2026-01-06', '2026-01-07'])
  })

  it('meets goal once target workout days are reached in the period', () => {
    const today = new Date(2026, 0, 8)
    const days = ['2026-01-05', '2026-01-05', '2026-01-06', '2026-01-07']
    const result = computeStreak(days, settings, today)
    expect(result.currentPeriod.goalMet).toBe(true)
  })

  it('builds a streak across consecutive completed periods', () => {
    const today = new Date(2026, 0, 22) // well into a 3rd period
    const days = [
      // period 1: 2026-01-05..01-11
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      // period 2: 2026-01-12..01-18
      '2026-01-12',
      '2026-01-13',
      '2026-01-14',
      // period 3 (current, in progress): 2026-01-19..01-25
      '2026-01-19',
    ]
    const result = computeStreak(days, settings, today)
    expect(result.currentStreak).toBe(2) // two completed periods that met goal; current period excluded until it resolves
  })

  it('breaks the streak when a completed period misses the goal', () => {
    const today = new Date(2026, 0, 22)
    const days = [
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      // period 2 only has 1 day -> goal missed
      '2026-01-12',
      '2026-01-19',
      '2026-01-20',
      '2026-01-21',
    ]
    const result = computeStreak(days, settings, today)
    expect(result.currentStreak).toBe(0)
  })

  it('supports a weekday-anchored period', () => {
    const weekdaySettings: StreakSettings = {
      periodLengthDays: 7,
      targetDaysPerPeriod: 2,
      anchor: { type: 'weekday', weekday: 1 }, // Monday
    }
    const today = new Date(2026, 0, 10) // Saturday
    const days = ['2026-01-05', '2026-01-06'] // Mon, Tue of that week
    const result = computeStreak(days, weekdaySettings, today)
    expect(result.currentPeriod.startDate).toBe('2026-01-05')
    expect(result.currentPeriod.goalMet).toBe(true)
  })
})
