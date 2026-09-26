export type CardioActivityType = 'walk' | 'run'

export interface GeoPoint {
  lat: number
  lng: number
  timestamp: string
  accuracy?: number
  /** Metres above sea level, when the device reports one (not all do — network-based
   *  or low-end GPS fixes often omit it). Elevation charts are hidden when absent. */
  altitude?: number
}

/** What a recorded activity was logged against, if anything — lets history cross-reference
 *  back to the routine/schedule item it fulfilled instead of just sitting standalone. */
export type CardioActivityTarget =
  | { kind: 'recovery_activity'; sessionId: string; activityId: string; label: string }
  | { kind: 'workout_exercise'; sessionId: string; entryId: string; label: string }

export interface CardioActivity {
  id: string
  activityType: CardioActivityType
  name: string
  startedAt: string
  finishedAt: string
  route: GeoPoint[]
  distanceMeters: number
  durationSeconds: number
  loggedAgainst?: CardioActivityTarget
  notes?: string
  createdAt: string
  updatedAt: string
}

export const CARDIO_ACTIVITY_TYPE_LABELS: Record<CardioActivityType, string> = {
  walk: 'Walk',
  run: 'Run',
}
