import type { Weekday } from './schedule'

export type EventRecurrence =
  | { type: 'none' }
  | { type: 'interval'; everyDays: number }
  | { type: 'weekly'; weekdays: Weekday[] }

/** A personal calendar entry unrelated to training (e.g. a work shift) that can
 *  coexist with a scheduled workout/recovery/rest day on the same date — unlike
 *  a RecurringSchedule, it never replaces a day's training assignment. */
export interface PersonalEvent {
  id: string
  title: string
  notes?: string
  /** Hex color, user-chosen at creation (defaults to the calendar's "event" category color). */
  color: string
  /** ISO calendar date (YYYY-MM-DD), the recurrence's local anchor. */
  startDate: string
  /** Inclusive end date; undefined means the recurrence has no end. */
  endDate?: string
  recurrence: EventRecurrence
  /** Dates on which this otherwise-recurring event is skipped, without ending the series. */
  excludedDates: string[]
  createdAt: string
  updatedAt: string
}

export function createEmptyPersonalEvent(startDate: string, color: string): PersonalEvent {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title: '',
    color,
    startDate,
    recurrence: { type: 'none' },
    excludedDates: [],
    createdAt: now,
    updatedAt: now,
  }
}
