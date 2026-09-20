import { db } from './db'
import type { RoutineTemplate } from '../models/routine'
import type { RecoveryRoutineTemplate } from '../models/recovery'

export async function getActiveRoutines(): Promise<RoutineTemplate[]> {
  return (await db.routines.toArray()).filter((r) => !r.archived).sort((a, b) => a.name.localeCompare(b.name))
}

export async function getAllRoutines(): Promise<RoutineTemplate[]> {
  return db.routines.toArray()
}

export async function getRoutine(id: string): Promise<RoutineTemplate | undefined> {
  return db.routines.get(id)
}

export async function saveRoutine(routine: RoutineTemplate): Promise<void> {
  await db.routines.put({ ...routine, updatedAt: new Date().toISOString() })
}

export async function duplicateRoutine(id: string): Promise<RoutineTemplate | undefined> {
  const original = await db.routines.get(id)
  if (!original) return undefined
  const now = new Date().toISOString()
  const copy: RoutineTemplate = {
    ...original,
    id: crypto.randomUUID(),
    name: `${original.name} (copy)`,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
  await db.routines.add(copy)
  return copy
}

export async function archiveRoutine(id: string, archived = true): Promise<void> {
  await db.routines.update(id, { archived, updatedAt: new Date().toISOString() })
}

export async function deleteRoutine(id: string): Promise<void> {
  await db.routines.delete(id)
}

// --- Recovery routines ---

export async function getActiveRecoveryRoutines(): Promise<RecoveryRoutineTemplate[]> {
  return (await db.recoveryRoutines.toArray()).filter((r) => !r.archived).sort((a, b) => a.name.localeCompare(b.name))
}

export async function getRecoveryRoutine(id: string): Promise<RecoveryRoutineTemplate | undefined> {
  return db.recoveryRoutines.get(id)
}

export async function saveRecoveryRoutine(routine: RecoveryRoutineTemplate): Promise<void> {
  await db.recoveryRoutines.put({ ...routine, updatedAt: new Date().toISOString() })
}

export async function duplicateRecoveryRoutine(id: string): Promise<RecoveryRoutineTemplate | undefined> {
  const original = await db.recoveryRoutines.get(id)
  if (!original) return undefined
  const now = new Date().toISOString()
  const copy: RecoveryRoutineTemplate = {
    ...original,
    id: crypto.randomUUID(),
    name: `${original.name} (copy)`,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
  await db.recoveryRoutines.add(copy)
  return copy
}

export async function archiveRecoveryRoutine(id: string, archived = true): Promise<void> {
  await db.recoveryRoutines.update(id, { archived, updatedAt: new Date().toISOString() })
}

export async function deleteRecoveryRoutine(id: string): Promise<void> {
  await db.recoveryRoutines.delete(id)
}
