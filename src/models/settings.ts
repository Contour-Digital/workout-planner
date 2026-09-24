export type ThemeMode = 'light' | 'dark' | 'system'

export type StreakAnchor =
  | { type: 'rolling' } // period resets every `periodLengthDays` from streak start
  | { type: 'weekday'; weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6 } // fixed weekly reset day

export interface StreakSettings {
  periodLengthDays: number // default 7
  targetDaysPerPeriod: number // 1-10
  anchor: StreakAnchor
}

/** Colors for the calendar's category badges/dots (Workout, Recovery, Rest, and the
 *  default for new personal events) — user-customizable, independent of the app's
 *  fixed design-system tones so recoloring the calendar doesn't touch other UI. */
export interface CalendarCategoryColors {
  workout: string
  recovery: string
  rest: string
  event: string
}

export const DEFAULT_CALENDAR_COLORS: CalendarCategoryColors = {
  workout: '#5064ff',
  recovery: '#b48bff',
  rest: '#5fc9c9',
  event: '#f2a83e',
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
  /** Whether completing a set starts the floating rest-timer card during a workout. */
  restTimerEnabled: boolean
  calendarColors: CalendarCategoryColors
  updatedAt: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'singleton',
  streak: { periodLengthDays: 7, targetDaysPerPeriod: 3, anchor: { type: 'rolling' } },
  defaultRestSeconds: 60,
  soundEnabled: true,
  vibrationEnabled: true,
  showExerciseMedia: true,
  theme: 'dark',
  notificationsEnabled: false,
  restTimerEnabled: true,
  calendarColors: DEFAULT_CALENDAR_COLORS,
  updatedAt: new Date().toISOString(),
}
