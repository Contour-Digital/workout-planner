export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday, matches Date#getDay()

export type DayAssignment =
  | { kind: 'workout'; routineTemplateId: string }
  | { kind: 'recovery'; routineTemplateId: string }
  | { kind: 'rest' }
  | { kind: 'off' }

/**
 * A repeating pattern. `cycle` generalises fixed intervals ("every 8 days" is a
 * 1-assignment cycle of length 8) and full multi-day training cycles alike.
 * `weekday` anchors to actual calendar weekdays so it stays correct across
 * month/DST boundaries without cycle-offset arithmetic.
 */
export type SchedulePattern =
  | { type: 'cycle'; days: DayAssignment[] } // days[0] aligns with startDate
  | { type: 'weekday'; assignments: Partial<Record<Weekday, DayAssignment>> }
  | { type: 'one_off'; assignment: DayAssignment }

export interface RecurringSchedule {
  id: string
  name: string
  /** ISO calendar date (YYYY-MM-DD), the pattern's local anchor. No time-of-day/timezone
   *  is stored: recurrence is calendar-date math, which sidesteps DST entirely. */
  startDate: string
  /** Inclusive end date; undefined means "repeats forever". Used to truncate a schedule
   *  when the user applies a "this and all future" edit as of some date. */
  endDate?: string
  pattern: SchedulePattern
  createdAt: string
  updatedAt: string
}

export type OccurrenceStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'partial'
  | 'skipped'
  | 'missed'
  | 'deleted'

/**
 * Persisted only when an occurrence diverges from its generating schedule:
 * a reschedule, skip, miss, deletion, or a session-only content override.
 * Keyed by (scheduleId, originalDate) so it always finds the virtual
 * occurrence it modifies, even if that occurrence's date changes.
 */
export interface OccurrenceOverride {
  id: string
  scheduleId: string
  originalDate: string
  newDate?: string
  status?: OccurrenceStatus
  /** Session-only replacement for the day's assignment (e.g. swapped routine, or
   *  edited exercise config) — never mutates the template or the series. */
  assignmentOverride?: DayAssignment
  sessionId?: string
  createdAt: string
  updatedAt: string
}

/** A fully resolved occurrence for a given calendar date, ready to render. */
export interface ResolvedOccurrence {
  scheduleId: string
  scheduleName: string
  /** The date this occurrence is actually presented on (after any reschedule). */
  date: string
  originalDate: string
  assignment: DayAssignment
  status: OccurrenceStatus
  sessionId?: string
}
