export type ThemeMode = 'light' | 'dark' | 'system'

export type StreakAnchor =
  | { type: 'rolling' } // period resets every `periodLengthDays` from streak start
  | { type: 'weekday'; weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6 } // fixed weekly reset day

export interface StreakSettings {
  periodLengthDays: number // default 7
  targetDaysPerPeriod: number // 1-10
  anchor: StreakAnchor
}

export interface AppSettings {
  id: 'singleton'
  streak: StreakSettings
  defaultRestSeconds: number
  soundEnabled: boolean
  vibrationEnabled: boolean
  showExerciseMedia: boolean
  theme: ThemeMode
  notificationsEnabled: boolean
  updatedAt: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'singleton',
  streak: { periodLengthDays: 7, targetDaysPerPeriod: 3, anchor: { type: 'rolling' } },
  defaultRestSeconds: 60,
  soundEnabled: true,
  vibrationEnabled: true,
  showExerciseMedia: true,
  theme: 'system',
  notificationsEnabled: false,
  updatedAt: new Date().toISOString(),
}
