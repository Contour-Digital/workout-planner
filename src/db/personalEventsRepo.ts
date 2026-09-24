import { addDays } from 'date-fns'
import { db } from './db'
import { enqueueSync } from './sync/outbox'
import { parseDateKey, toDateKey } from '../lib/recurrence'
import type { PersonalEvent } from '../models/calendarEvent'

export async function getAllPersonalEvents(): Promise<PersonalEvent[]> {
  return db.personalEvents.toArray()
}

export async function getPersonalEvent(id: string): Promise<PersonalEvent | undefined> {
  return db.personalEvents.get(id)
}

export async function savePersonalEvent(event: PersonalEvent): Promise<void> {
  await db.personalEvents.put({ ...event, updatedAt: new Date().toISOString() })
  await enqueueSync('personalEvents', event.id, 'upsert')
}

export async function deletePersonalEvent(id: string): Promise<void> {
  await db.personalEvents.delete(id)
  await enqueueSync('personalEvents', id, 'delete')
}

/** Skips a single occurrence of a recurring event without ending the series. */
export async function skipPersonalEventOccurrence(id: string, date: string): Promise<void> {
  const event = await db.personalEvents.get(id)
  if (!event || event.excludedDates.includes(date)) return
  await savePersonalEvent({ ...event, excludedDates: [...event.excludedDates, date] })
}

/** Ends a recurring event's series from `fromDate` onward (keeps history before it). */
export async function deletePersonalEventSeriesFrom(id: string, fromDate: string): Promise<void> {
  const event = await db.personalEvents.get(id)
  if (!event) return
  if (fromDate <= event.startDate) {
    await deletePersonalEvent(id)
    return
  }
  const dayBefore = toDateKey(addDays(parseDateKey(fromDate), -1))
  await savePersonalEvent({ ...event, endDate: dayBefore })
}
