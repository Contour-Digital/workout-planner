import { db } from './db'
import { enqueueSync } from './sync/outbox'
import type { ExerciseConfig, RoutineSection, RoutineTemplate, SetTarget } from '../models/routine'
import type { RecoveryActivityConfig, RecoveryRoutineTemplate } from '../models/recovery'
import type { RecurringSchedule } from '../models/schedule'
import { toDateKey } from '../lib/recurrence'

function sets(reps: number[], weightKg?: number[]): SetTarget[] {
  return reps.map((r, i) => ({
    id: crypto.randomUUID(),
    setNumber: i + 1,
    targetReps: r,
    targetWeightKg: weightKg?.[i],
  }))
}

function uniformSets(count: number, reps: number, weightKg?: number): SetTarget[] {
  return Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    setNumber: i + 1,
    targetReps: reps,
    targetWeightKg: weightKg,
  }))
}

function exerciseConfig(
  exerciseId: string,
  orderIndex: number,
  targets: SetTarget[],
  overrides: Partial<ExerciseConfig> = {},
): ExerciseConfig {
  return {
    id: crypto.randomUUID(),
    exerciseId,
    orderIndex,
    uniformSets: new Set(targets.map((t) => `${t.targetReps}-${t.targetWeightKg}`)).size === 1,
    sets: targets,
    restSeconds: 90,
    ...overrides,
  }
}

function generalWarmup(): RoutineSection {
  return {
    enabled: true,
    exercises: [
      exerciseConfig('ex-treadmill-run', 0, [{ id: crypto.randomUUID(), setNumber: 1, targetDurationSeconds: 300 }], {
        restSeconds: 0,
        notes: 'Easy pace to raise heart rate',
      }),
      exerciseConfig('ex-band-pull-apart', 1, uniformSets(2, 15), { restSeconds: 30 }),
      exerciseConfig('ex-hip-flexor-stretch', 2, [{ id: crypto.randomUUID(), setNumber: 1, targetDurationSeconds: 30 }], {
        restSeconds: 15,
      }),
    ],
  }
}

function generalCooldown(): RoutineSection {
  return {
    enabled: true,
    exercises: [
      exerciseConfig('ex-hamstring-stretch', 0, [{ id: crypto.randomUUID(), setNumber: 1, targetDurationSeconds: 30 }], {
        restSeconds: 15,
      }),
      exerciseConfig('ex-cat-cow', 1, uniformSets(1, 10), { restSeconds: 0 }),
      exerciseConfig('ex-box-breathing', 2, [{ id: crypto.randomUUID(), setNumber: 1, targetDurationSeconds: 120 }], {
        restSeconds: 0,
      }),
    ],
  }
}

function routine(
  name: string,
  description: string,
  main: ExerciseConfig[],
  now: string,
): RoutineTemplate {
  return {
    id: crypto.randomUUID(),
    type: 'workout',
    name,
    description,
    warmup: generalWarmup(),
    main,
    cooldown: generalCooldown(),
    defaultRestSeconds: 90,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
}

function activity(overrides: Partial<RecoveryActivityConfig>): RecoveryActivityConfig {
  return { id: crypto.randomUUID(), name: 'Activity', trackingType: 'checkbox', orderIndex: 0, ...overrides }
}

let seedPromise: Promise<void> | null = null

/**
 * Seeds example routines/recovery routines/schedule for a brand-new account only.
 * Call this *after* the initial pull from Supabase has completed, so "empty" means
 * "this user genuinely has no data anywhere" rather than "this is a new device" —
 * otherwise a returning user signing in on a second device would get a duplicate
 * set of demo content alongside their real, just-synced data.
 *
 * Guards against concurrent double-invocation (e.g. React StrictMode's double
 * effect in dev) so seeding never races itself into a duplicate-key error.
 */
export function seedDemoDataIfNewAccount(): Promise<void> {
  if (!seedPromise) seedPromise = runSeed()
  return seedPromise
}

async function runSeed(): Promise<void> {
  const routineCount = await db.routines.count()
  const recoveryCount = await db.recoveryRoutines.count()
  const scheduleCount = await db.schedules.count()
  if (routineCount > 0 || recoveryCount > 0 || scheduleCount > 0) return

  const now = new Date().toISOString()

  const pushDay = routine(
    'Push Day',
    'Chest, shoulders, and triceps.',
    [
      exerciseConfig('ex-bench-press', 0, sets([10, 8, 6], [60, 70, 80])),
      exerciseConfig('ex-overhead-press', 1, uniformSets(3, 8, 40)),
      exerciseConfig('ex-push-up', 2, uniformSets(3, 15)),
    ],
    now,
  )

  const pullDay = routine(
    'Pull Day',
    'Back and biceps.',
    [
      exerciseConfig('ex-barbell-deadlift', 0, sets([8, 6, 6], [80, 100, 100])),
      exerciseConfig('ex-barbell-row', 1, uniformSets(3, 10, 50)),
      exerciseConfig('ex-pull-up', 2, uniformSets(3, 8)),
    ],
    now,
  )

  const lowerDay = routine(
    'Lower Body',
    'Squat-focused leg day.',
    [
      exerciseConfig('ex-barbell-back-squat', 0, sets([10, 8, 6], [60, 70, 80])),
      exerciseConfig('ex-dumbbell-lunge', 1, uniformSets(3, 12, 12)),
      exerciseConfig('ex-plank', 2, uniformSets(3, 1), { restSeconds: 45 }),
    ],
    now,
  )

  const upperDay = routine(
    'Upper Body',
    'Balanced upper-body strength.',
    [
      exerciseConfig('ex-dumbbell-shoulder-press', 0, uniformSets(3, 10, 18)),
      exerciseConfig('ex-barbell-row', 1, uniformSets(3, 10, 50)),
      exerciseConfig('ex-push-up', 2, uniformSets(3, 12)),
    ],
    now,
  )

  const conditioningDay = routine(
    'Conditioning',
    'High-intensity full-body conditioning.',
    [
      exerciseConfig('ex-kettlebell-swing', 0, uniformSets(4, 15, 16)),
      exerciseConfig('ex-box-jump', 1, uniformSets(4, 8)),
      exerciseConfig('ex-jump-rope', 2, [{ id: crypto.randomUUID(), setNumber: 1, targetDurationSeconds: 180 }], {
        restSeconds: 60,
      }),
    ],
    now,
  )

  const seededRoutines = [pushDay, pullDay, lowerDay, upperDay, conditioningDay]
  await db.routines.bulkAdd(seededRoutines)
  await Promise.all(seededRoutines.map((r) => enqueueSync('routines', r.id, 'upsert')))

  const activeRecovery: RecoveryRoutineTemplate = {
    id: crypto.randomUUID(),
    type: 'recovery',
    name: 'Active Recovery Day',
    description: 'Light movement and mobility to aid recovery.',
    instructions: 'Keep effort easy throughout — this should feel refreshing, not tiring.',
    estimatedDurationMinutes: 45,
    archived: false,
    createdAt: now,
    updatedAt: now,
    activities: [
      activity({ orderIndex: 0, exerciseId: 'ex-recovery-walk', name: 'Recovery walk', trackingType: 'duration', targetDurationSeconds: 1800 }),
      activity({ orderIndex: 1, exerciseId: 'ex-foam-roll-quads', name: 'Mobility session', trackingType: 'duration', targetDurationSeconds: 600 }),
      activity({ orderIndex: 2, name: 'Water intake', trackingType: 'water_intake', targetWaterMl: 2500 }),
      activity({ orderIndex: 3, name: 'Sleep goal', trackingType: 'sleep_duration', targetSleepMinutes: 480 }),
    ],
  }

  const fullRest: RecoveryRoutineTemplate = {
    id: crypto.randomUUID(),
    type: 'recovery',
    name: 'Full Rest Day',
    description: 'No structured training — focus on hydration and sleep.',
    instructions: 'Complete rest from training. Prioritise sleep and hydration.',
    estimatedDurationMinutes: 10,
    archived: false,
    createdAt: now,
    updatedAt: now,
    activities: [
      activity({ orderIndex: 0, name: 'Water intake', trackingType: 'water_intake', targetWaterMl: 2500 }),
      activity({ orderIndex: 1, name: 'Begin bedtime routine', trackingType: 'bedtime', targetBedtimeLocal: '21:30' }),
      activity({ orderIndex: 2, exerciseId: 'ex-box-breathing', name: 'Breathing session (optional)', trackingType: 'duration', targetDurationSeconds: 300 }),
    ],
  }

  await db.recoveryRoutines.bulkAdd([activeRecovery, fullRest])
  await enqueueSync('recoveryRoutines', activeRecovery.id, 'upsert')
  await enqueueSync('recoveryRoutines', fullRest.id, 'upsert')

  const schedule: RecurringSchedule = {
    id: crypto.randomUUID(),
    name: '8-Day Training Cycle',
    startDate: toDateKey(new Date()),
    pattern: {
      type: 'cycle',
      days: [
        { kind: 'workout', routineTemplateId: pushDay.id },
        { kind: 'workout', routineTemplateId: pullDay.id },
        { kind: 'workout', routineTemplateId: lowerDay.id },
        { kind: 'recovery', routineTemplateId: activeRecovery.id },
        { kind: 'workout', routineTemplateId: upperDay.id },
        { kind: 'workout', routineTemplateId: conditioningDay.id },
        { kind: 'recovery', routineTemplateId: activeRecovery.id },
        { kind: 'recovery', routineTemplateId: fullRest.id },
      ],
    },
    createdAt: now,
    updatedAt: now,
  }
  await db.schedules.add(schedule)
  await enqueueSync('schedules', schedule.id, 'upsert')
}
