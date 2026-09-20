import { db } from './db'
import type { HeightEntry, Profile, WeightEntry } from '../models/profile'

const DEFAULT_PROFILE: Profile = {
  id: 'singleton',
  name: '',
  weightUnit: 'kg',
  heightUnit: 'cm',
  updatedAt: new Date().toISOString(),
}

/** Read-only: safe to call from a liveQuery. Falls back to the default in memory
 *  without writing — writing happens once via `ensureProfile()` at app startup. */
export async function getProfile(): Promise<Profile> {
  return (await db.profile.get('singleton')) ?? DEFAULT_PROFILE
}

export async function ensureProfile(): Promise<void> {
  const existing = await db.profile.get('singleton')
  if (!existing) await db.profile.put(DEFAULT_PROFILE)
}

export async function saveProfile(patch: Partial<Profile>): Promise<Profile> {
  const current = await getProfile()
  const updated: Profile = { ...current, ...patch, id: 'singleton', updatedAt: new Date().toISOString() }
  await db.profile.put(updated)
  return updated
}

export async function getWeightHistory(): Promise<WeightEntry[]> {
  return (await db.weightEntries.toArray()).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
}

export async function addWeightEntry(valueKg: number, recordedAt = new Date().toISOString()): Promise<WeightEntry> {
  const entry: WeightEntry = { id: crypto.randomUUID(), valueKg, recordedAt }
  await db.weightEntries.add(entry)
  return entry
}

export async function getHeightHistory(): Promise<HeightEntry[]> {
  return (await db.heightEntries.toArray()).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
}

export async function addHeightEntry(valueCm: number, recordedAt = new Date().toISOString()): Promise<HeightEntry> {
  const entry: HeightEntry = { id: crypto.randomUUID(), valueCm, recordedAt }
  await db.heightEntries.add(entry)
  return entry
}
