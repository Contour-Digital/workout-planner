import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { findBestMatch } from './exerciseMatching'
import { createCustomExercise } from '../db/exercisesRepo'
import type { Equipment, Exercise, ExerciseCategory, MuscleGroup } from '../models/exercise'

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantSuggestion {
  name: string
  section: 'warmup' | 'main' | 'cooldown'
  category: ExerciseCategory
  primaryMuscles: MuscleGroup[]
  equipment: Equipment[]
  reason: string
}

export interface AssistantReply {
  reply: string
  suggestions: AssistantSuggestion[]
}

export type AssistantContext =
  | { kind: 'routine'; routineName: string; warmup: string[]; main: string[]; cooldown: string[] }
  | {
      kind: 'session'
      routineName: string
      elapsedMinutes: number
      warmup: string[]
      main: { name: string; setsDone: number; setsTotal: number }[]
      cooldown: string[]
    }

/** Sends the full conversation (ending in the new user message) plus the current
 *  routine/session context, and gets back the assistant's reply and any exercise
 *  suggestions. Stateless on the server — the client owns conversation history. */
export async function sendAssistantMessage(messages: AssistantMessage[], context: AssistantContext): Promise<AssistantReply> {
  const { data, error } = await supabase.functions.invoke<AssistantReply>('assistant-chat', {
    body: { messages, context },
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
    throw new Error(message ?? 'Could not reach the assistant. Check your connection and try again.')
  }

  if (!data) {
    throw new Error('The assistant did not respond. Try again.')
  }

  return data
}

/** Matches a suggested exercise name against the library, creating a custom exercise
 *  from the assistant's best-guess metadata when nothing close enough already exists. */
export async function resolveSuggestedExercise(
  suggestion: AssistantSuggestion,
  library: Exercise[],
): Promise<{ exercise: Exercise; created: boolean }> {
  const match = findBestMatch(suggestion.name, library)
  if (match) return { exercise: match, created: false }

  const created = await createCustomExercise({
    name: suggestion.name,
    category: suggestion.category,
    primaryMuscles: suggestion.primaryMuscles,
    secondaryMuscles: [],
    equipment: suggestion.equipment.length > 0 ? suggestion.equipment : ['none'],
    instructions: [],
    techniqueTips: [],
    commonMistakes: [],
    media: { kind: 'placeholder' },
  })
  return { exercise: created, created: true }
}
