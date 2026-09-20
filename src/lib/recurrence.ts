import { addDays, differenceInCalendarDays, formatISO, parseISO } from 'date-fns'
import type {
  DayAssignment,
  OccurrenceOverride,
  RecurringSchedule,
  ResolvedOccurrence,
} from '../models/schedule'

/**
 * All recurrence math is done on calendar dates (YYYY-MM-DD, no time-of-day).
 * `differenceInCalendarDays` / `addDays` operate on local wall-clock date
 * parts, so this stays correct across DST transitions and month/year
 * boundaries without any timezone-offset arithmetic.
 */
export function toDateKey(d: Date): string {
  return formatISO(d, { representation: 'date' })
}

export function parseDateKey(key: string): Date {
  return parseISO(key)
}

/** The assignment a schedule's pattern produces for a given date, ignoring overrides. */
export function assignmentForDate(schedule: RecurringSchedule, dateKey: string): DayAssignment | null {
  const date = parseDateKey(dateKey)
  const start = parseDateKey(schedule.startDate)
  if (differenceInCalendarDays(date, start) < 0) return null
  if (schedule.endDate && differenceInCalendarDays(date, parseDateKey(schedule.endDate)) > 0) return null

  const { pattern } = schedule
  if (pattern.type === 'one_off') {
    return dateKey === schedule.startDate ? pattern.assignment : null
  }
  if (pattern.type === 'weekday') {
    const weekday = date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
    return pattern.assignments[weekday] ?? null
  }
  // cycle
  const cycleLength = pattern.days.length
  if (cycleLength === 0) return null
  const offset = differenceInCalendarDays(date, start)
  const index = ((offset % cycleLength) + cycleLength) % cycleLength
  return pattern.days[index] ?? null
}

/** Generate resolved occurrences for [fromDate, toDate] inclusive, across all given
 *  schedules, applying any persisted overrides (reschedule/skip/miss/delete/edit). */
export function resolveOccurrences(
  schedules: RecurringSchedule[],
  overrides: OccurrenceOverride[],
  fromDate: string,
  toDate: string,
): ResolvedOccurrence[] {
  const overridesByKey = new Map<string, OccurrenceOverride>()
  for (const o of overrides) {
    overridesByKey.set(`${o.scheduleId}:${o.originalDate}`, o)
  }

  const results: ResolvedOccurrence[] = []
  const from = parseDateKey(fromDate)
  const to = parseDateKey(toDate)
  const scanFrom = addDays(from, -60) // rescheduled occurrences may originate before the window

  for (const schedule of schedules) {
    let cursor = scanFrom
    const scheduleStart = parseDateKey(schedule.startDate)
    if (differenceInCalendarDays(scheduleStart, cursor) > 0) cursor = scheduleStart

    while (differenceInCalendarDays(cursor, to) <= 0) {
      const dateKey = toDateKey(cursor)
      const assignment = assignmentForDate(schedule, dateKey)
      cursor = addDays(cursor, 1)
      if (!assignment) continue

      const override = overridesByKey.get(`${schedule.id}:${dateKey}`)
      if (override?.status === 'deleted') continue

      const effectiveDate = override?.newDate ?? dateKey
      if (differenceInCalendarDays(parseDateKey(effectiveDate), from) < 0) continue
      if (differenceInCalendarDays(parseDateKey(effectiveDate), to) > 0) continue

      results.push({
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        date: effectiveDate,
        originalDate: dateKey,
        assignment: override?.assignmentOverride ?? assignment,
        status: override?.status ?? 'planned',
        sessionId: override?.sessionId,
      })
    }
  }

  return results.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Splits a schedule at `fromDate` for a "this and all future sessions" edit:
 * the original is truncated to end the day before `fromDate`, and a new
 * schedule is returned starting at `fromDate` that continues the same
 * pattern (cycle-phase-aligned, so unedited future days don't shift).
 * The caller then applies the actual edit to the continuation's pattern.
 */
export function splitScheduleAtDate(
  schedule: RecurringSchedule,
  fromDate: string,
): { truncatedOriginal: RecurringSchedule; continuation: RecurringSchedule } {
  const now = new Date().toISOString()
  const dayBefore = toDateKey(addDays(parseDateKey(fromDate), -1))
  const truncatedOriginal: RecurringSchedule = { ...schedule, endDate: dayBefore, updatedAt: now }

  let pattern = schedule.pattern
  if (pattern.type === 'cycle') {
    const offset =
      ((differenceInCalendarDays(parseDateKey(fromDate), parseDateKey(schedule.startDate)) %
        pattern.days.length) +
        pattern.days.length) %
      pattern.days.length
    const rotated = [...pattern.days.slice(offset), ...pattern.days.slice(0, offset)]
    pattern = { type: 'cycle', days: rotated }
  }

  const continuation: RecurringSchedule = {
    id: crypto.randomUUID(),
    name: schedule.name,
    startDate: fromDate,
    endDate: schedule.endDate,
    pattern,
    createdAt: now,
    updatedAt: now,
  }

  return { truncatedOriginal, continuation }
}

/** The next occurrence strictly after `afterDate` (exclusive), scanning forward. */
export function nextOccurrenceAfter(
  schedules: RecurringSchedule[],
  overrides: OccurrenceOverride[],
  afterDate: string,
  maxScanDays = 400,
): ResolvedOccurrence | null {
  const from = toDateKey(addDays(parseDateKey(afterDate), 1))
  const to = toDateKey(addDays(parseDateKey(afterDate), maxScanDays))
  const all = resolveOccurrences(schedules, overrides, from, to).filter(
    (o) => o.status !== 'skipped' && o.status !== 'missed',
  )
  return all[0] ?? null
}
