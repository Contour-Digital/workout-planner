import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { formatSetResult } from './formatPerformance'
import type { Achievement, MissedExercise, PerceivedEffort, WorkoutSession } from '../models/session'

export interface WorkoutAiSummaryResult {
  summary: string
  perceivedEffort: PerceivedEffort
}

/** Best completed set per exercise, formatted for the summary request — not shown
 *  to the user directly, just handed to the assistant as ground truth. */
function bestSetText(session: WorkoutSession) {
  return session.main.map((entry) => {
    const completed = entry.actualSets.filter((s) => s.completed)
    const best = completed.find((s) => s.actualWeightKg) ?? completed[0]
    return {
      name: entry.exerciseName,
      setsDone: completed.length,
      setsTotal: entry.actualSets.length,
      bestSet: best ? formatSetResult(best) : null,
    }
  })
}

/** Calls the workout-summary edge function with the session's exact facts (duration,
 *  per-exercise sets done/best set, already-computed missed exercises and achievements)
 *  and gets back a written recap plus a perceived-effort estimate. The model never has
 *  to invent or compare numbers itself — that's all done client-side beforehand. */
export async function generateWorkoutSummary(
  session: WorkoutSession,
  missedExercises: MissedExercise[],
  achievements: Achievement[],
): Promise<WorkoutAiSummaryResult> {
  const durationMinutes = session.startedAt
    ? Math.max(1, Math.round((new Date(session.finishedAt ?? Date.now()).getTime() - new Date(session.startedAt).getTime()) / 60000))
    : 0

  const { data, error } = await supabase.functions.invoke<WorkoutAiSummaryResult>('workout-summary', {
    body: {
      sessionName: session.name,
      durationMinutes,
      exercises: bestSetText(session),
      missedExercises,
      achievements,
    },
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
