import { addDays, differenceInCalendarDays } from 'date-fns'
import { parseDateKey, toDateKey } from './recurrence'
import type { PersonalEvent } from '../models/calendarEvent'

export interface ResolvedPersonalEvent {
  event: PersonalEvent
  date: string
}

function matchesRecurrence(event: PersonalEvent, dateKey: string, date: Date, start: Date): boolean {
  const { recurrence } = event
  if (recurrence.type === 'none') return dateKey === event.startDate
  if (recurrence.type === 'weekly') {
    const weekday = date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
    return recurrence.weekdays.includes(weekday)
  }
  const offset = differenceInCalendarDays(date, start)
  return offset % Math.max(1, recurrence.everyDays) === 0
}

/** Expands personal events into concrete dated occurrences within [fromDate, toDate]
 *  (inclusive), skipping any date listed in the event's excludedDates. */
export function resolvePersonalEventsInRange(events: PersonalEvent[], fromDate: string, toDate: string): ResolvedPersonalEvent[] {
  const results: ResolvedPersonalEvent[] = []
  const to = parseDateKey(toDate)

  for (const event of events) {
    const start = parseDateKey(event.startDate)
    let cursor = parseDateKey(fromDate)
    if (differenceInCalendarDays(start, cursor) > 0) cursor = start
    const seriesEnd = event.endDate ? parseDateKey(event.endDate) : to
    const scanEnd = differenceInCalendarDays(seriesEnd, to) < 0 ? seriesEnd : to

    while (differenceInCalendarDays(cursor, scanEnd) <= 0) {
      const dateKey = toDateKey(cursor)
      cursor = addDays(cursor, 1)
      if (event.excludedDates.includes(dateKey)) continue
      if (!matchesRecurrence(event, dateKey, parseDateKey(dateKey), start)) continue
      results.push({ event, date: dateKey })
    }
  }

  return results.sort((a, b) => a.date.localeCompare(b.date))
}
