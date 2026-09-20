import { db } from './db'
import type { DayAssignment, OccurrenceOverride, RecurringSchedule } from '../models/schedule'
import { resolveOccurrences, splitScheduleAtDate } from '../lib/recurrence'

export async function getAllSchedules(): Promise<RecurringSchedule[]> {
  return db.schedules.toArray()
}

export async function saveSchedule(schedule: RecurringSchedule): Promise<void> {
  await db.schedules.put({ ...schedule, updatedAt: new Date().toISOString() })
}

export async function deleteSchedule(id: string): Promise<void> {
  await db.schedules.delete(id)
  const overrides = await db.occurrenceOverrides.where('scheduleId').equals(id).toArray()
  await db.occurrenceOverrides.bulkDelete(overrides.map((o) => o.id))
}

export async function getOccurrencesInRange(fromDate: string, toDate: string) {
  const [schedules, overrides] = await Promise.all([db.schedules.toArray(), db.occurrenceOverrides.toArray()])
  return resolveOccurrences(schedules, overrides, fromDate, toDate)
}

async function upsertOverride(
  scheduleId: string,
  originalDate: string,
  patch: Partial<OccurrenceOverride>,
): Promise<OccurrenceOverride> {
  const existing = await db.occurrenceOverrides
    .where('[scheduleId+originalDate]')
    .equals([scheduleId, originalDate])
    .first()
  const now = new Date().toISOString()
  if (existing) {
    const updated = { ...existing, ...patch, updatedAt: now }
    await db.occurrenceOverrides.put(updated)
    return updated
  }
  const created: OccurrenceOverride = {
    id: crypto.randomUUID(),
    scheduleId,
    originalDate,
    createdAt: now,
    updatedAt: now,
    ...patch,
  }
  await db.occurrenceOverrides.add(created)
  return created
}

export async function skipOccurrence(scheduleId: string, originalDate: string): Promise<void> {
  await upsertOverride(scheduleId, originalDate, { status: 'skipped' })
}

export async function markOccurrenceMissed(scheduleId: string, originalDate: string): Promise<void> {
  await upsertOverride(scheduleId, originalDate, { status: 'missed' })
}

export async function rescheduleOccurrence(scheduleId: string, originalDate: string, newDate: string): Promise<void> {
  await upsertOverride(scheduleId, originalDate, { newDate, status: 'planned' })
}

export async function deleteOccurrence(scheduleId: string, originalDate: string): Promise<void> {
  await upsertOverride(scheduleId, originalDate, { status: 'deleted' })
}

export async function linkOccurrenceSession(scheduleId: string, originalDate: string, sessionId: string): Promise<void> {
  await upsertOverride(scheduleId, originalDate, { sessionId })
}

/** Edit this occurrence only: replaces the day's assignment without touching the series. */
export async function editOccurrenceOnly(
  scheduleId: string,
  originalDate: string,
  assignment: DayAssignment,
): Promise<void> {
  await upsertOverride(scheduleId, originalDate, { assignmentOverride: assignment })
}

/** Edit this and all future occurrences: splits the schedule at `fromDate`, applying
 *  `assignment` to that date going forward via the continuation's pattern. */
export async function editThisAndFuture(
  scheduleId: string,
  fromDate: string,
  assignment: DayAssignment,
): Promise<void> {
  const schedule = await db.schedules.get(scheduleId)
  if (!schedule) return
  const { truncatedOriginal, continuation } = splitScheduleAtDate(schedule, fromDate)

  let pattern = continuation.pattern
  if (pattern.type === 'cycle') {
    pattern = { type: 'cycle', days: pattern.days.map((d, i) => (i === 0 ? assignment : d)) }
  } else if (pattern.type === 'weekday') {
    const weekday = new Date(fromDate).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
    pattern = { type: 'weekday', assignments: { ...pattern.assignments, [weekday]: assignment } }
  } else {
    pattern = { type: 'one_off', assignment }
  }

  await db.transaction('rw', db.schedules, async () => {
    await db.schedules.put(truncatedOriginal)
    await db.schedules.put({ ...continuation, pattern })
  })
}

/** Deletes the entire repeating series from a given date forward (keeps history before it). */
export async function deleteSeriesFrom(scheduleId: string, fromDate: string): Promise<void> {
  const schedule = await db.schedules.get(scheduleId)
  if (!schedule) return
  if (fromDate <= schedule.startDate) {
    await deleteSchedule(scheduleId)
    return
  }
  const { truncatedOriginal } = splitScheduleAtDate(schedule, fromDate)
  await db.schedules.put(truncatedOriginal)
}
