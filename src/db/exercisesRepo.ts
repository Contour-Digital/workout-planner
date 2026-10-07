import { db } from './db'
import { enqueueSync } from './sync/outbox'
import type { CustomExercise, Exercise, LibraryExerciseNameOverride } from '../models/exercise'
import { normalizeRoutine } from '../models/routine'
import { replaceExerciseInRecoveryRoutine, replaceExerciseInRoutine } from '../lib/exerciseReplacement'

async function applyNameOverrides(exercises: Exercise[]): Promise<Exercise[]> {
  const overrides = await db.libraryExerciseNameOverrides.toArray()
  if (overrides.length === 0) return exercises
  const nameByExerciseId = new Map(overrides.map((o) => [o.exerciseId, o.name]))
  return exercises.map((e) => {
    const name = nameByExerciseId.get(e.id)
    return name ? { ...e, name } : e
  })
}

export async function getAllExercises(): Promise<Exercise[]> {
  const [library, custom] = await Promise.all([db.libraryExercises.toArray(), db.customExercises.toArray()])
  const merged = await applyNameOverrides([...library, ...custom])
  return merged.sort((a, b) => a.name.localeCompare(b.name))
}

export async function getExercise(id: string): Promise<Exercise | undefined> {
  const exercise = (await db.libraryExercises.get(id)) ?? (await db.customExercises.get(id))
  if (!exercise) return undefined
  const override = await db.libraryExerciseNameOverrides.where('exerciseId').equals(id).first()
  return override ? { ...exercise, name: override.name } : exercise
}

/** Renames a built-in library exercise's title for this user only (creates or
 *  updates their personal override — the shared library row is never touched). */
export async function setLibraryExerciseName(exerciseId: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  const now = new Date().toISOString()
  const existing = await db.libraryExerciseNameOverrides.where('exerciseId').equals(exerciseId).first()
  if (existing) {
    await db.libraryExerciseNameOverrides.update(existing.id, { name: trimmed, updatedAt: now })
    await enqueueSync('libraryExerciseNameOverrides', existing.id, 'upsert')
    return
  }
  const override: LibraryExerciseNameOverride = { id: crypto.randomUUID(), exerciseId, name: trimmed, updatedAt: now }
  await db.libraryExerciseNameOverrides.add(override)
  await enqueueSync('libraryExerciseNameOverrides', override.id, 'upsert')
}

/** Reverts a library exercise back to its original title by removing the override. */
export async function resetLibraryExerciseName(exerciseId: string): Promise<void> {
  const existing = await db.libraryExerciseNameOverrides.where('exerciseId').equals(exerciseId).first()
  if (!existing) return
  await db.libraryExerciseNameOverrides.delete(existing.id)
  await enqueueSync('libraryExerciseNameOverrides', existing.id, 'delete')
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

/** Renames any exercise: a custom one is edited directly, a built-in library one
 *  gets a personal name override (see setLibraryExerciseName). */
export async function renameExercise(exercise: Exercise, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  if (exercise.source === 'custom') {
    await updateCustomExercise(exercise.id, { name: trimmed })
    return
  }
  await setLibraryExerciseName(exercise.id, trimmed)
}

/** How many workout/recovery routines still reference an exercise — shown before a
 *  delete so the user can choose what those routine entries become. */
export async function countRoutinesUsingExercise(exerciseId: string): Promise<number> {
  const [routines, recoveryRoutines] = await Promise.all([db.routines.toArray(), db.recoveryRoutines.toArray()])
  return (
    routines.filter((r) => replaceExerciseInRoutine(normalizeRoutine(r), exerciseId, null)).length +
    recoveryRoutines.filter((r) => replaceExerciseInRecoveryRoutine(r, exerciseId, null)).length
  )
}

/** Deletes a custom exercise. Routines that use it are pointed at `replacementId`
 *  when given (e.g. merging a duplicate into the copy you're keeping), otherwise
 *  the exercise is removed from them. Past session history keeps its own name
 *  snapshot, so it reads the same either way. */
export async function deleteCustomExercise(id: string, replacementId: string | null = null): Promise<void> {
  const [routines, recoveryRoutines] = await Promise.all([db.routines.toArray(), db.recoveryRoutines.toArray()])
  const now = new Date().toISOString()
  for (const routine of routines) {
    const updated = replaceExerciseInRoutine(normalizeRoutine(routine), id, replacementId)
    if (!updated) continue
    await db.routines.put({ ...updated, updatedAt: now })
    await enqueueSync('routines', routine.id, 'upsert')
  }
  for (const routine of recoveryRoutines) {
    const updated = replaceExerciseInRecoveryRoutine(routine, id, replacementId)
    if (!updated) continue
    await db.recoveryRoutines.put({ ...updated, updatedAt: now })
    await enqueueSync('recoveryRoutines', routine.id, 'upsert')
  }
  await db.customExercises.delete(id)
  await enqueueSync('customExercises', id, 'delete')
}
