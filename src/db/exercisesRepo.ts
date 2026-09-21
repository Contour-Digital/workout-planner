import { db } from './db'
import { enqueueSync } from './sync/outbox'
import type { CustomExercise, Exercise } from '../models/exercise'

export async function getAllExercises(): Promise<Exercise[]> {
  const [library, custom] = await Promise.all([db.libraryExercises.toArray(), db.customExercises.toArray()])
  return [...library, ...custom].sort((a, b) => a.name.localeCompare(b.name))
}

export async function getExercise(id: string): Promise<Exercise | undefined> {
  return (await db.libraryExercises.get(id)) ?? (await db.customExercises.get(id))
}

export async function createCustomExercise(
  input: Omit<CustomExercise, 'id' | 'source' | 'createdAt' | 'updatedAt'>,
): Promise<CustomExercise> {
  const now = new Date().toISOString()
  const exercise: CustomExercise = { ...input, id: crypto.randomUUID(), source: 'custom', createdAt: now, updatedAt: now }
  await db.customExercises.add(exercise)
  await enqueueSync('customExercises', exercise.id, 'upsert')
  return exercise
}

export async function updateCustomExercise(id: string, patch: Partial<CustomExercise>): Promise<void> {
  await db.customExercises.update(id, { ...patch, updatedAt: new Date().toISOString() })
  await enqueueSync('customExercises', id, 'upsert')
}

export async function deleteCustomExercise(id: string): Promise<void> {
  await db.customExercises.delete(id)
  await enqueueSync('customExercises', id, 'delete')
}
