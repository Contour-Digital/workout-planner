import Dexie, { type Table } from 'dexie'
import type { CustomExercise, LibraryExercise } from '../models/exercise'
import type { RoutineTemplate } from '../models/routine'
import type { RecoveryRoutineTemplate } from '../models/recovery'
import type { RecurringSchedule, OccurrenceOverride } from '../models/schedule'
import type { WorkoutSession, RecoverySession, RestDaySession } from '../models/session'
import type { Profile, WeightEntry, HeightEntry } from '../models/profile'
import type { AppSettings } from '../models/settings'

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

  constructor() {
    super('workout-planner')
    this.version(1).stores({
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
  }
}

export const db = new WorkoutDB()
