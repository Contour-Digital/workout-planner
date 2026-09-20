import { addDays, differenceInCalendarDays } from 'date-fns'
import type { StreakSettings } from '../models/settings'
import { parseDateKey, toDateKey } from './recurrence'

export interface StreakPeriod {
  startDate: string
  endDate: string
  workoutDayKeys: string[] // distinct calendar days with >=1 completed/partial workout
  goalMet: boolean
  isCurrent: boolean
  isComplete: boolean // the period has fully elapsed
}

export interface StreakResult {
  currentStreak: number // number of consecutive qualifying periods, most recent first
  periods: StreakPeriod[]
  currentPeriod: StreakPeriod
}

/** Only workout days count toward the streak; recovery/rest days are tracked separately. */
export function computeStreak(
  workoutDayKeysSorted: string[],
  settings: StreakSettings,
  today: Date = new Date(),
): StreakResult {
  const todayKey = toDateKey(today)
  const uniqueDays = new Set(workoutDayKeysSorted)
  const periodLength = Math.max(1, settings.periodLengthDays)

  const anchorStart = periodAnchorStart(settings, uniqueDays, todayKey, periodLength)

  const periods: StreakPeriod[] = []
  let cursorStart = anchorStart
  while (differenceInCalendarDays(parseDateKey(cursorStart), parseDateKey(todayKey)) <= 0) {
    const cursorEnd = toDateKey(addDays(parseDateKey(cursorStart), periodLength - 1))
    const daysInPeriod = [...uniqueDays].filter(
      (d) =>
        differenceInCalendarDays(parseDateKey(d), parseDateKey(cursorStart)) >= 0 &&
        differenceInCalendarDays(parseDateKey(d), parseDateKey(cursorEnd)) <= 0,
    )
    const isComplete = differenceInCalendarDays(parseDateKey(cursorEnd), parseDateKey(todayKey)) < 0
    periods.push({
      startDate: cursorStart,
      endDate: cursorEnd,
      workoutDayKeys: daysInPeriod.sort(),
      goalMet: daysInPeriod.length >= settings.targetDaysPerPeriod,
      isCurrent: !isComplete && differenceInCalendarDays(parseDateKey(cursorEnd), parseDateKey(todayKey)) >= 0,
      isComplete,
    })
    cursorStart = toDateKey(addDays(parseDateKey(cursorEnd), 1))
  }

  const currentPeriod = periods[periods.length - 1]
  let currentStreak = 0
  for (let i = periods.length - 1; i >= 0; i--) {
    const p = periods[i]
    if (p.isCurrent) continue // in-progress period doesn't break or count until it resolves
    if (p.goalMet) currentStreak++
    else break
  }

  return { currentStreak, periods, currentPeriod }
}

function periodAnchorStart(
  settings: StreakSettings,
  workoutDays: Set<string>,
  todayKey: string,
  periodLength: number,
): string {
  if (settings.anchor.type === 'weekday') {
    // Walk back from today to the most recent matching weekday, then keep
    // walking back by full periods to the earliest one worth displaying.
    let d = parseDateKey(todayKey)
    while ((d.getDay() as number) !== settings.anchor.weekday) {
      d = addDays(d, -1)
    }
    // Extend back to cover all recorded workout history (bounded to avoid runaway loops).
    const earliestDay = [...workoutDays].sort()[0]
    let start = d
    if (earliestDay) {
      while (differenceInCalendarDays(start, parseDateKey(earliestDay)) > 0) {
        start = addDays(start, -periodLength)
      }
    } else {
      start = addDays(start, -periodLength * 3)
    }
    return toDateKey(start)
  }

  // Rolling: anchor to the earliest recorded workout day (or fall back to a
  // short recent window so a brand-new user still sees a sensible period).
  const earliestDay = [...workoutDays].sort()[0]
  if (earliestDay) return earliestDay
  return toDateKey(addDays(parseDateKey(todayKey), -(periodLength - 1)))
}
