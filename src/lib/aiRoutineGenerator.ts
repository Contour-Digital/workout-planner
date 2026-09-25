import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { findBestMatch } from './exerciseMatching'
import { createCustomExercise, getAllExercises } from '../db/exercisesRepo'
import type { Equipment, ExerciseCategory, MuscleGroup } from '../models/exercise'
import { createEmptySection, createEmptySetTarget, type ExerciseConfig, type RoutineTemplate, type SetTarget } from '../models/routine'

export interface ParsedSet {
  targetReps: number | null
  targetWeightKg: number | null
  targetDurationSeconds: number | null
  targetDistanceMeters: number | null
}

export interface ParsedExercise {
  name: string
  section: 'warmup' | 'main' | 'cooldown'
  category: ExerciseCategory
  primaryMuscles: MuscleGroup[]
  equipment: Equipment[]
  sets: ParsedSet[]
  restSeconds: number | null
  notes: string | null
}

export interface ParsedRoutine {
  name: string
  description: string | null
  notes: string | null
  exercises: ParsedExercise[]
}

export interface GeneratedRoutineResult {
  draft: RoutineTemplate
  matchedCount: number
  createdExerciseNames: string[]
}

/** Calls the parse-workout edge function, then matches and builds a draft routine
 * ready for the user to review in the routine editor. Never saves anything itself. */
export async function generateRoutineFromNotes(notes: string): Promise<GeneratedRoutineResult> {
  const parsed = await callParseWorkout(notes)

  if (parsed.exercises.length === 0) {
    throw new Error('No exercises were found in these notes. Try including exercise names and sets/reps.')
  }

  return buildRoutineDraftFromParsed(parsed)
}

/** Matches a parsed routine's exercise names against the library (creating custom
 * exercises for unmatched ones) and builds a draft RoutineTemplate — the shared
 * second half of both "From notes" (parse-workout) and Spot's conversational
 * routine creation (assistant-chat's create_routine tool), which both produce the
 * same ParsedRoutine shape upstream. Never saves anything itself. */
export async function buildRoutineDraftFromParsed(parsed: ParsedRoutine): Promise<GeneratedRoutineResult> {
  const library = await getAllExercises()
  let matchedCount = 0
  const createdExerciseNames: string[] = []

  const warmup = createEmptySection()
  const cooldown = createEmptySection()
  const main: ExerciseConfig[] = []
  let warmupOrder = 0
  let mainOrder = 0
  let cooldownOrder = 0

  for (const parsedExercise of parsed.exercises) {
    const match = findBestMatch(parsedExercise.name, library)
    let exerciseId: string

    if (match) {
      exerciseId = match.id
      matchedCount++
    } else {
      const created = await createCustomExercise({
        name: parsedExercise.name,
        category: parsedExercise.category,
        primaryMuscles: parsedExercise.primaryMuscles,
        secondaryMuscles: [],
        equipment: parsedExercise.equipment.length > 0 ? parsedExercise.equipment : ['none'],
        instructions: [],
        techniqueTips: [],
        commonMistakes: [],
        media: { kind: 'placeholder' },
        notes: parsedExercise.notes ?? undefined,
      })
      exerciseId = created.id
      createdExerciseNames.push(parsedExercise.name)
      library.push(created)
    }

    const config: ExerciseConfig = {
      id: crypto.randomUUID(),
      exerciseId,
      orderIndex:
        parsedExercise.section === 'warmup' ? warmupOrder++ : parsedExercise.section === 'cooldown' ? cooldownOrder++ : mainOrder++,
      uniformSets: areSetsUniform(parsedExercise.sets),
      sets: buildSetTargets(parsedExercise.sets, parsedExercise.category),
      restSeconds: parsedExercise.restSeconds ?? undefined,
      notes: parsedExercise.notes ?? undefined,
    }

    if (parsedExercise.section === 'warmup') {
      warmup.exercises.push(config)
      warmup.enabled = true
    } else if (parsedExercise.section === 'cooldown') {
      cooldown.exercises.push(config)
      cooldown.enabled = true
    } else {
      main.push(config)
    }
  }

  const now = new Date().toISOString()
  const draft: RoutineTemplate = {
    id: crypto.randomUUID(),
    type: 'workout',
    name: parsed.name?.trim() || 'Generated Routine',
    description: parsed.description ?? '',
    notes: parsed.notes ?? '',
    warmup,
    main,
    cooldown,
    defaultRestSeconds: 60,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }

  return { draft, matchedCount, createdExerciseNames }
}

async function callParseWorkout(notes: string): Promise<ParsedRoutine> {
  const { data, error } = await supabase.functions.invoke<{ routine: ParsedRoutine }>('parse-workout', {
    body: { notes },
  })

  if (error) {
    let message: string | undefined
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json()
        if (typeof body?.error === 'string') message = body.error
      } catch {
        // response body wasn't JSON; fall through to the generic message below
      }
    }
    throw new Error(message ?? 'Could not reach the AI assistant. Check your connection and try again.')
  }

  if (!data?.routine) {
    throw new Error('The assistant did not return a routine. Try again with more detail.')
  }

  return data.routine
}

function buildSetTargets(sets: ParsedSet[], category: ExerciseCategory): SetTarget[] {
  if (sets.length === 0) {
    return [createEmptySetTarget(1, category), createEmptySetTarget(2, category), createEmptySetTarget(3, category)]
  }
  return sets.map((s, i) => ({
    id: crypto.randomUUID(),
    setNumber: i + 1,
    targetReps: s.targetReps ?? undefined,
    targetWeightKg: s.targetWeightKg ?? undefined,
    targetDurationSeconds: s.targetDurationSeconds ?? undefined,
    targetDistanceMeters: s.targetDistanceMeters ?? undefined,
  }))
}

function areSetsUniform(sets: ParsedSet[]): boolean {
  if (sets.length <= 1) return true
  const [first, ...rest] = sets
  return rest.every(
    (s) =>
      s.targetReps === first.targetReps &&
      s.targetWeightKg === first.targetWeightKg &&
      s.targetDurationSeconds === first.targetDurationSeconds &&
      s.targetDistanceMeters === first.targetDistanceMeters,
  )
}

