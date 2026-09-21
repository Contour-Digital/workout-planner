import { db } from './db'
import { enqueueSync } from './sync/outbox'
import { DEFAULT_SETTINGS, type AppSettings } from '../models/settings'

export async function getSettings(): Promise<AppSettings> {
  return (await db.settings.get('singleton')) ?? DEFAULT_SETTINGS
}

export async function ensureSettings(): Promise<void> {
  const existing = await db.settings.get('singleton')
  if (!existing) {
    await db.settings.put(DEFAULT_SETTINGS)
    await enqueueSync('settings', 'singleton', 'upsert')
  }
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings()
  const updated: AppSettings = { ...current, ...patch, id: 'singleton', updatedAt: new Date().toISOString() }
  await db.settings.put(updated)
  await enqueueSync('settings', 'singleton', 'upsert')
  return updated
}
