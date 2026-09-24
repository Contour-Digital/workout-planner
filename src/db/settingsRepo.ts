import { db } from './db'
import { enqueueSync } from './sync/outbox'
import { DEFAULT_CALENDAR_COLORS, DEFAULT_SETTINGS, type AppSettings } from '../models/settings'

/** Fills in defaults for fields added after a settings row was first created —
 *  locally (an older schema version) or remotely (pulled before this field existed). */
function withDefaults(settings: AppSettings): AppSettings {
  return { ...DEFAULT_SETTINGS, ...settings, calendarColors: { ...DEFAULT_CALENDAR_COLORS, ...settings.calendarColors } }
}

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('singleton')
  return existing ? withDefaults(existing) : DEFAULT_SETTINGS
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
