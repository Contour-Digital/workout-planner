import { db } from './db'
import { enqueueSync } from './sync/outbox'
import { saveRoutine } from './routinesRepo'
import { linkOccurrenceSession } from './scheduleRepo'
import { createEmptySection, type RoutineTemplate, type SetTarget } from '../models/routine'
import type { RecoveryActivityConfig, RecoveryRoutineTemplate } from '../models/recovery'
import type {
  RecoveryActivityResult,
  RecoverySession,
  SessionExerciseEntry,
  SetResult,
  WorkoutSession,
} from '../models/session'
import { toDateKey } from '../lib/recurrence'

function toSessionEntry(exerciseConfig: { id: string; exerciseId: string; orderIndex: number; sets: SetTarget[]; restSeconds?: number; notes?: string }, exerciseName: string): SessionExerciseEntry {
  return {
    id: crypto.randomUUID(),
    exerciseId: exerciseConfig.exerciseId,
    exerciseName,
    orderIndex: exerciseConfig.orderIndex,
    targetSets: exerciseConfig.sets,
    actualSets: exerciseConfig.sets.map((_, i) => ({ id: crypto.randomUUID(), setNumber: i + 1, completed: false })),
    restSeconds: exerciseConfig.restSeconds,
    notes: exerciseConfig.notes,
  }
}

function syncWorkout(sessionId: string): Promise<void> {
  return enqueueSync('workoutSessions', sessionId, 'upsert')
}
function syncRecovery(sessionId: string): Promise<void> {
  return enqueueSync('recoverySessions', sessionId, 'upsert')
}

async function exerciseName(exerciseId: string): Promise<string> {
  const ex = (await db.libraryExercises.get(exerciseId)) ?? (await db.customExercises.get(exerciseId))
  return ex?.name ?? 'Exercise'
}

async function buildSectionEntries(exercises: { id: string; exerciseId: string; orderIndex: number; sets: SetTarget[]; restSeconds?: number; notes?: string }[]) {
  const entries: SessionExerciseEntry[] = []
  for (const config of exercises) {
    entries.push(toSessionEntry(config, await exerciseName(config.exerciseId)))
  }
  return entries
}

/** Idempotent: if a session already exists for this schedule occurrence (or was already
 *  started today for this routine), returns it instead of creating a duplicate — this is
 *  what prevents duplicate sessions on app-restore or accidental double taps. */
export async function startWorkoutSession(opts: {
  routine: RoutineTemplate
  scheduledDate: string
  origin: 'scheduled' | 'impromptu'
  scheduleId?: string
  occurrenceDate?: string
}): Promise<WorkoutSession> {
  if (opts.scheduleId && opts.occurrenceDate) {
    const existing = await db.workoutSessions
      .where('scheduleId')
      .equals(opts.scheduleId)
      .and((s) => s.occurrenceDate === opts.occurrenceDate)
      .first()
    if (existing) return existing
  }

  const now = new Date().toISOString()
  const session: WorkoutSession = {
    id: crypto.randomUUID(),
    kind: 'workout',
    origin: opts.origin,
    scheduleId: opts.scheduleId,
    occurrenceDate: opts.occurrenceDate,
    routineTemplateId: opts.routine.id,
    name: opts.routine.name,
    status: 'in_progress',
    scheduledDate: opts.scheduledDate,
    startedAt: now,
    pauseIntervals: [],
    warmup: opts.routine.warmup.enabled
      ? { enabled: true, exercises: await buildSectionEntries(opts.routine.warmup.exercises) }
      : { enabled: false, exercises: [] },
    main: await buildSectionEntries(opts.routine.main),
    cooldown: opts.routine.cooldown.enabled
      ? { enabled: true, exercises: await buildSectionEntries(opts.routine.cooldown.exercises) }
      : { enabled: false, exercises: [] },
    notes: opts.routine.notes,
    createdAt: now,
    updatedAt: now,
  }
  await db.workoutSessions.add(session)
  await syncWorkout(session.id)
  if (opts.scheduleId && opts.occurrenceDate) {
    await linkOccurrenceSession(opts.scheduleId, opts.occurrenceDate, session.id)
  }
  return session
}

export async function startBlankWorkoutSession(name = 'Workout'): Promise<WorkoutSession> {
  const now = new Date().toISOString()
  const session: WorkoutSession = {
    id: crypto.randomUUID(),
    kind: 'workout',
    origin: 'impromptu',
    name,
    status: 'in_progress',
    scheduledDate: toDateKey(new Date()),
    startedAt: now,
    pauseIntervals: [],
    main: [],
    createdAt: now,
    updatedAt: now,
  }
  await db.workoutSessions.add(session)
  await syncWorkout(session.id)
  return session
}

export async function addAdHocExercise(sessionId: string, exerciseId: string, targets: SetTarget[]): Promise<void> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return
  const entry = toSessionEntry(
    { id: crypto.randomUUID(), exerciseId, orderIndex: session.main.length, sets: targets },
    await exerciseName(exerciseId),
  )
  entry.addedAdHoc = true
  await db.workoutSessions.update(sessionId, { main: [...session.main, entry], updatedAt: new Date().toISOString() })
  await syncWorkout(sessionId)
}

export async function removeSessionExercise(sessionId: string, entryId: string, section: 'warmup' | 'main' | 'cooldown' = 'main'): Promise<void> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return
  if (section === 'main') {
    await db.workoutSessions.update(sessionId, { main: session.main.filter((e) => e.id !== entryId) })
  } else if (section === 'warmup' && session.warmup) {
    await db.workoutSessions.update(sessionId, { warmup: { ...session.warmup, exercises: session.warmup.exercises.filter((e) => e.id !== entryId) } })
  } else if (section === 'cooldown' && session.cooldown) {
    await db.workoutSessions.update(sessionId, { cooldown: { ...session.cooldown, exercises: session.cooldown.exercises.filter((e) => e.id !== entryId) } })
  }
  await syncWorkout(sessionId)
}

async function mapEntryAcrossSections(
  session: WorkoutSession,
  entryId: string,
  fn: (entry: SessionExerciseEntry) => SessionExerciseEntry,
): Promise<Partial<WorkoutSession>> {
  const apply = (entries: SessionExerciseEntry[]) => entries.map((e) => (e.id === entryId ? fn(e) : e))
  return {
    main: apply(session.main),
    warmup: session.warmup ? { ...session.warmup, exercises: apply(session.warmup.exercises) } : session.warmup,
    cooldown: session.cooldown ? { ...session.cooldown, exercises: apply(session.cooldown.exercises) } : session.cooldown,
  }
}

export async function addSetToEntry(sessionId: string, entryId: string): Promise<void> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return
  const patch = await mapEntryAcrossSections(session, entryId, (entry) => {
    const lastTarget = entry.targetSets[entry.targetSets.length - 1]
    const setNumber = entry.actualSets.length + 1
    return {
      ...entry,
      targetSets: [...entry.targetSets, { ...lastTarget, id: crypto.randomUUID(), setNumber }],
      actualSets: [...entry.actualSets, { id: crypto.randomUUID(), setNumber, completed: false }],
    }
  })
  await db.workoutSessions.update(sessionId, patch)
  await syncWorkout(sessionId)
}

export async function removeSetFromEntry(sessionId: string, entryId: string, setId: string): Promise<void> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return
  const patch = await mapEntryAcrossSections(session, entryId, (entry) => {
    const setIndex = entry.actualSets.findIndex((s) => s.id === setId)
    if (setIndex === -1) return entry
    return {
      ...entry,
      targetSets: entry.targetSets.filter((_, i) => i !== setIndex),
      actualSets: entry.actualSets.filter((_, i) => i !== setIndex),
    }
  })
  await db.workoutSessions.update(sessionId, patch)
  await syncWorkout(sessionId)
}

export async function updateEntryNotes(sessionId: string, entryId: string, notes: string): Promise<void> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return
  const patch = await mapEntryAcrossSections(session, entryId, (entry) => ({ ...entry, notes }))
  await db.workoutSessions.update(sessionId, patch)
  await syncWorkout(sessionId)
}

export async function updateSessionNotes(sessionId: string, notes: string): Promise<void> {
  await db.workoutSessions.update(sessionId, { notes })
  await syncWorkout(sessionId)
}

export async function saveWorkoutReview(sessionId: string, review: WorkoutSession['review']): Promise<void> {
  await db.workoutSessions.update(sessionId, { review })
  await syncWorkout(sessionId)
}

export async function updateSetResult(sessionId: string, entryId: string, setId: string, patch: Partial<SetResult>): Promise<void> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return

  function patchEntries(entries: SessionExerciseEntry[]): SessionExerciseEntry[] {
    return entries.map((entry) =>
      entry.id === entryId
        ? { ...entry, actualSets: entry.actualSets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }
        : entry,
    )
  }

  await db.workoutSessions.update(sessionId, {
    main: patchEntries(session.main),
    warmup: session.warmup ? { ...session.warmup, exercises: patchEntries(session.warmup.exercises) } : session.warmup,
    cooldown: session.cooldown ? { ...session.cooldown, exercises: patchEntries(session.cooldown.exercises) } : session.cooldown,
    updatedAt: new Date().toISOString(),
  })
  await syncWorkout(sessionId)
}

export async function pauseWorkoutSession(sessionId: string): Promise<void> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session || session.pauseIntervals.some((p) => !p.end)) return
  await db.workoutSessions.update(sessionId, {
    pauseIntervals: [...session.pauseIntervals, { start: new Date().toISOString() }],
  })
  await syncWorkout(sessionId)
}

export async function resumeWorkoutSession(sessionId: string): Promise<void> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return
  const open = session.pauseIntervals.find((p) => !p.end)
  if (!open) return
  const now = new Date().toISOString()
  await db.workoutSessions.update(sessionId, {
    pauseIntervals: session.pauseIntervals.map((p) => (p === open ? { ...p, end: now } : p)),
  })
  await syncWorkout(sessionId)
}

export async function startRestTimer(sessionId: string, seconds: number): Promise<void> {
  const endsAt = new Date(Date.now() + seconds * 1000).toISOString()
  await db.workoutSessions.update(sessionId, { restTimerEndsAt: endsAt })
  await syncWorkout(sessionId)
}

export async function clearRestTimer(sessionId: string): Promise<void> {
  await db.workoutSessions.update(sessionId, { restTimerEndsAt: undefined })
  await syncWorkout(sessionId)
}

export async function finishWorkoutSession(sessionId: string): Promise<void> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return
  const allEntries = [...(session.warmup?.exercises ?? []), ...session.main, ...(session.cooldown?.exercises ?? [])]
  const totalSets = allEntries.reduce((sum, e) => sum + e.actualSets.length, 0)
  const doneSets = allEntries.reduce((sum, e) => sum + e.actualSets.filter((s) => s.completed).length, 0)
  const now = new Date().toISOString()
  const openPause = session.pauseIntervals.find((p) => !p.end)
  const status = totalSets === 0 || doneSets === totalSets ? 'completed' : 'partial'
  await db.workoutSessions.update(sessionId, {
    status,
    finishedAt: now,
    pauseIntervals: openPause ? session.pauseIntervals.map((p) => (p === openPause ? { ...p, end: now } : p)) : session.pauseIntervals,
  })
  await syncWorkout(sessionId)
}

/** Saves an impromptu (or any) session's current exercises as a new reusable routine.
 *  Never mutates the session or any existing routine template. */
export async function saveSessionAsRoutine(sessionId: string, name: string): Promise<RoutineTemplate> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) throw new Error('Session not found')
  const now = new Date().toISOString()
  const routine: RoutineTemplate = {
    id: crypto.randomUUID(),
    type: 'workout',
    name,
    warmup: createEmptySection(),
    cooldown: createEmptySection(),
    main: session.main.map((entry, i) => ({
      id: crypto.randomUUID(),
      exerciseId: entry.exerciseId,
      orderIndex: i,
      uniformSets: false,
      sets: entry.targetSets.map((t, si) => ({ ...t, id: crypto.randomUUID(), setNumber: si + 1 })),
      restSeconds: entry.restSeconds,
      notes: entry.notes,
    })),
    defaultRestSeconds: 90,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
  await saveRoutine(routine)
  return routine
}

/** Starts a new impromptu session pre-filled with a previous session's exercises and
 *  target sets (not its actual results) — "repeat a previous workout" from history. */
export async function repeatWorkoutSession(sourceSessionId: string): Promise<WorkoutSession> {
  const source = await db.workoutSessions.get(sourceSessionId)
  if (!source) throw new Error('Session not found')
  const now = new Date().toISOString()
  const rebuildEntries = (entries: SessionExerciseEntry[]): SessionExerciseEntry[] =>
    entries.map((entry) => ({
      ...entry,
      id: crypto.randomUUID(),
      actualSets: entry.targetSets.map((_, i) => ({ id: crypto.randomUUID(), setNumber: i + 1, completed: false })),
    }))
  const session: WorkoutSession = {
    id: crypto.randomUUID(),
    kind: 'workout',
    origin: 'impromptu',
    routineTemplateId: source.routineTemplateId,
    name: source.name,
    status: 'in_progress',
    scheduledDate: toDateKey(new Date()),
    startedAt: now,
    pauseIntervals: [],
    warmup: source.warmup ? { enabled: source.warmup.enabled, exercises: rebuildEntries(source.warmup.exercises) } : undefined,
    main: rebuildEntries(source.main),
    cooldown: source.cooldown ? { enabled: source.cooldown.enabled, exercises: rebuildEntries(source.cooldown.exercises) } : undefined,
    createdAt: now,
    updatedAt: now,
  }
  await db.workoutSessions.add(session)
  await syncWorkout(session.id)
  return session
}

// --- Recovery sessions ---

function toRecoveryResult(config: RecoveryActivityConfig): RecoveryActivityResult {
  return {
    id: crypto.randomUUID(),
    configId: config.id,
    name: config.name,
    trackingType: config.trackingType,
    status: 'pending',
  }
}

export async function startRecoverySession(opts: {
  routine: RecoveryRoutineTemplate
  scheduledDate: string
  origin: 'scheduled' | 'impromptu'
  scheduleId?: string
  occurrenceDate?: string
}): Promise<RecoverySession> {
  if (opts.scheduleId && opts.occurrenceDate) {
    const existing = await db.recoverySessions
      .where('scheduleId')
      .equals(opts.scheduleId)
      .and((s) => s.occurrenceDate === opts.occurrenceDate)
      .first()
    if (existing) return existing
  }
  const now = new Date().toISOString()
  const session: RecoverySession = {
    id: crypto.randomUUID(),
    kind: 'recovery',
    origin: opts.origin,
    scheduleId: opts.scheduleId,
    occurrenceDate: opts.occurrenceDate,
    routineTemplateId: opts.routine.id,
    name: opts.routine.name,
    status: 'open',
    scheduledDate: opts.scheduledDate,
    startedAt: now,
    activities: opts.routine.activities.map(toRecoveryResult),
    createdAt: now,
    updatedAt: now,
  }
  await db.recoverySessions.add(session)
  await syncRecovery(session.id)
  if (opts.scheduleId && opts.occurrenceDate) {
    await linkOccurrenceSession(opts.scheduleId, opts.occurrenceDate, session.id)
  }
  return session
}

export async function updateRecoveryActivity(sessionId: string, activityId: string, patch: Partial<RecoveryActivityResult>): Promise<void> {
  const session = await db.recoverySessions.get(sessionId)
  if (!session) return
  await db.recoverySessions.update(sessionId, {
    activities: session.activities.map((a) => (a.id === activityId ? { ...a, ...patch } : a)),
    status: 'in_progress',
  })
  await syncRecovery(sessionId)
}

export async function updateRecoverySessionNotes(sessionId: string, notes: string): Promise<void> {
  await db.recoverySessions.update(sessionId, { notes })
  await syncRecovery(sessionId)
}

export async function closeRecoverySession(sessionId: string): Promise<void> {
  const session = await db.recoverySessions.get(sessionId)
  if (!session) return
  const completed = session.activities.filter((a) => a.status === 'completed').length
  const total = session.activities.length
  await db.recoverySessions.update(sessionId, {
    status: completed === total ? 'completed' : completed > 0 ? 'partial' : 'skipped',
    finishedAt: new Date().toISOString(),
  })
  await syncRecovery(sessionId)
}
