import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { createCustomExercise, getAllExercises } from '../db/exercisesRepo'
import type { Equipment, Exercise, ExerciseCategory, MuscleGroup } from '../models/exercise'
import { createEmptySection, createEmptySetTarget, type ExerciseConfig, type RoutineTemplate, type SetTarget } from '../models/routine'

interface ParsedSet {
  targetReps: number | null
  targetWeightKg: number | null
  targetDurationSeconds: number | null
  targetDistanceMeters: number | null
}

interface ParsedExercise {
  name: string
  section: 'warmup' | 'main' | 'cooldown'
  category: ExerciseCategory
  primaryMuscles: MuscleGroup[]
  equipment: Equipment[]
  sets: ParsedSet[]
  restSeconds: number | null
  notes: string | null
}

interface ParsedRoutine {
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

/** Calls the parse-workout edge function, matches parsed exercise names against the
 * library (creating custom exercises for unmatched ones), and builds a draft routine
 * ready for the user to review in the routine editor. Never saves anything itself. */
export async function generateRoutineFromNotes(notes: string): Promise<GeneratedRoutineResult> {
  const parsed = await callParseWorkout(notes)

  if (parsed.exercises.length === 0) {
    throw new Error('No exercises were found in these notes. Try including exercise names and sets/reps.')
  }

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
      sets: buildSetTargets(parsedExercise.sets),
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
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json()
        if (body?.error) throw new Error(body.error)
      } catch {
        // fall through to generic message below
      }
    }
    throw new Error('Could not reach the AI assistant. Check your connection and try again.')
  }

  if (!data?.routine) {
    throw new Error('The assistant did not return a routine. Try again with more detail.')
  }

  return data.routine
}

function buildSetTargets(sets: ParsedSet[]): SetTarget[] {
  if (sets.length === 0) {
    return [createEmptySetTarget(1), createEmptySetTarget(2), createEmptySetTarget(3)]
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

const MATCH_THRESHOLD = 0.72

function findBestMatch(name: string, exercises: Exercise[]): Exercise | undefined {
  const target = normalize(name)
  if (!target) return undefined

  const exact = exercises.find((e) => normalize(e.name) === target)
  if (exact) return exact

  let best: Exercise | undefined
  let bestScore = 0
  for (const exercise of exercises) {
    const score = similarity(target, normalize(exercise.name))
    if (score > bestScore) {
      bestScore = score
      best = exercise
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : undefined
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.9
  const distance = levenshtein(a, b)
  const maxLen = Math.max(a.length, b.length)
  return 1 - distance / maxLen
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const matrix: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0))
  for (let i = 0; i < rows; i++) matrix[i][0] = i
  for (let j = 0; j < cols; j++) matrix[0][j] = j
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    }
  }
  return matrix[rows - 1][cols - 1]
}
