import Dexie, { type Table } from 'dexie'
import type { CustomExercise, LibraryExercise } from '../models/exercise'
import type { RoutineTemplate } from '../models/routine'
import type { RecoveryRoutineTemplate } from '../models/recovery'
import type { RecurringSchedule, OccurrenceOverride } from '../models/schedule'
import type { WorkoutSession, RecoverySession, RestDaySession } from '../models/session'
import type { Profile, WeightEntry, HeightEntry } from '../models/profile'
import type { AppSettings } from '../models/settings'

/** Lightweight pending-push record. Keyed by `${dexieTableName}:${recordId}`, so
 *  repeated writes to the same record before the outbox drains just overwrite the
 *  pending entry (natural de-dup/coalescing) rather than piling up. The payload
 *  itself is *not* stored here — the push worker re-reads the record's current
 *  state from its local table at flush time, so only the latest state is ever sent. */
export interface SyncOutboxEntry {
  key: string
  table: string
  recordId: string
  op: 'upsert' | 'delete'
  enqueuedAt: string
}

export class WorkoutDB extends Dexie {
  libraryExercises!: Table<LibraryExercise, string>
  customExercises!: Table<CustomExercise, string>
  routines!: Table<RoutineTemplate, string>
  recoveryRoutines!: Table<RecoveryRoutineTemplate, string>
  schedules!: Table<RecurringSchedule, string>
  occurrenceOverrides!: Table<OccurrenceOverride, string>
  workoutSessions!: Table<WorkoutSession, string>
  recoverySessions!: Table<RecoverySession, string>
  restDaySessions!: Table<RestDaySession, string>
  profile!: Table<Profile, string>
  weightEntries!: Table<WeightEntry, string>
  heightEntries!: Table<HeightEntry, string>
  settings!: Table<AppSettings, string>
  syncOutbox!: Table<SyncOutboxEntry, string>

  constructor() {
    super('workout-planner')
    this.version(1).stores({
      syncOutbox: 'key, table, recordId',
      libraryExercises: 'id, category, name',
      customExercises: 'id, category, name',
      routines: 'id, archived, name, updatedAt',
      recoveryRoutines: 'id, archived, name, updatedAt',
      schedules: 'id, startDate, endDate',
      occurrenceOverrides: 'id, scheduleId, originalDate, [scheduleId+originalDate]',
      workoutSessions: 'id, scheduledDate, status, scheduleId, routineTemplateId, origin',
      recoverySessions: 'id, scheduledDate, status, scheduleId, routineTemplateId, origin',
      restDaySessions: 'id, scheduledDate, status, scheduleId',
      profile: 'id',
      weightEntries: 'id, recordedAt',
      heightEntries: 'id, recordedAt',
      settings: 'id',
    })
    // v2: syncOutbox needs `enqueuedAt` indexed — push.ts orders the outbox by it
    // (oldest-first flush), which Dexie's SchemaError rejects on an unindexed field.
    this.version(2).stores({
      syncOutbox: 'key, table, recordId, enqueuedAt',
    })
  }
}

export const db = new WorkoutDB()
