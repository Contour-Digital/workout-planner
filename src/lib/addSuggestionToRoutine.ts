import { getRoutine, saveRoutine } from '../db/routinesRepo'
import { createExerciseConfigWithHistory } from '../db/sessionsRepo'
import { resolveSuggestedExercise } from './assistantChat'
import type { Exercise, ExerciseSuggestion } from '../models/exercise'

/** Resolves a suggested exercise (matching the library, or creating a custom exercise
 *  from the AI's best-guess metadata) and appends it to the given routine's matching
 *  section, saving the routine. Used to action post-workout "consider adding X next
 *  time" suggestions directly, without a trip through the routine editor. */
export async function addSuggestionToRoutine(routineTemplateId: string, suggestion: ExerciseSuggestion, library: Exercise[]): Promise<void> {
  const routine = await getRoutine(routineTemplateId)
  if (!routine) throw new Error('That routine no longer exists.')

  const { exercise } = await resolveSuggestedExercise(suggestion, library)

  if (suggestion.section === 'warmup') {
    const config = await createExerciseConfigWithHistory(exercise.id, routine.warmup.exercises.length)
    await saveRoutine({ ...routine, warmup: { enabled: true, exercises: [...routine.warmup.exercises, config] } })
    return
  }
  if (suggestion.section === 'cooldown') {
    const config = await createExerciseConfigWithHistory(exercise.id, routine.cooldown.exercises.length)
    await saveRoutine({ ...routine, cooldown: { enabled: true, exercises: [...routine.cooldown.exercises, config] } })
    return
  }
  const config = await createExerciseConfigWithHistory(exercise.id, routine.main.length)
  await saveRoutine({ ...routine, main: [...routine.main, config] })
}
