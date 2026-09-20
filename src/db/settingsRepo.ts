import { db } from './db'
import { DEFAULT_SETTINGS, type AppSettings } from '../models/settings'

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('singleton')
  if (existing) return existing
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings()
  const updated: AppSettings = { ...current, ...patch, id: 'singleton', updatedAt: new Date().toISOString() }
  await db.settings.put(updated)
  return updated
}
