import { db } from './db'
import { enqueueSync } from './sync/outbox'
import type { CardioActivity } from '../models/cardioActivity'

export async function saveCardioActivity(activity: CardioActivity): Promise<void> {
  await db.cardioActivities.put(activity)
  await enqueueSync('cardioActivities', activity.id, 'upsert')
}

export async function getAllCardioActivities(): Promise<CardioActivity[]> {
  return db.cardioActivities.orderBy('startedAt').reverse().toArray()
}

export async function getCardioActivity(id: string): Promise<CardioActivity | undefined> {
  return db.cardioActivities.get(id)
}

export async function deleteCardioActivity(id: string): Promise<void> {
  await db.cardioActivities.delete(id)
  await enqueueSync('cardioActivities', id, 'delete')
}
