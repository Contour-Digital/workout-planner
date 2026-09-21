import { create } from 'zustand'
import { ensureSettings, getSettings, saveSettings } from '../db/settingsRepo'
import { DEFAULT_SETTINGS, type AppSettings } from '../models/settings'

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<AppSettings>) => Promise<void>
}

function applyTheme(theme: AppSettings['theme']) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    await ensureSettings()
    const settings = await getSettings()
    applyTheme(settings.theme)
    set({ settings, loaded: true })
  },
  update: async (patch) => {
    const updated = await saveSettings(patch)
    if (patch.theme) applyTheme(updated.theme)
    set({ settings: updated })
  },
}))
