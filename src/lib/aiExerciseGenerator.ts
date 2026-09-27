import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { Equipment, ExerciseCategory, MuscleGroup } from '../models/exercise'

export interface GeneratedExerciseDetails {
  name: string
  category: ExerciseCategory
  primaryMuscles: MuscleGroup[]
  secondaryMuscles: MuscleGroup[]
  equipment: Equipment[]
  instructions: string[]
  techniqueTips: string[]
  commonMistakes: string[]
  notes: string | null
}

/** Asks Spot to research a new exercise from its name and optional equipment/brand
 *  hints, returning a draft for the user to review before it's added to the library. */
export async function generateExerciseDetails(input: {
  name: string
  equipmentName?: string
  brand?: string
}): Promise<GeneratedExerciseDetails> {
  const { data, error } = await supabase.functions.invoke<{ exercise: GeneratedExerciseDetails }>('generate-exercise-details', {
    body: { name: input.name, equipmentName: input.equipmentName, brand: input.brand },
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
    throw new Error(message ?? 'Could not reach Spot. Check your connection and try again.')
  }

  if (!data?.exercise) {
    throw new Error('Spot could not research this exercise. Try a more specific name.')
  }

  return data.exercise
}
