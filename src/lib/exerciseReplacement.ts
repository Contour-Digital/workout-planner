import type { RoutineTemplate, ExerciseConfig, RoutineSection } from '../models/routine'
import type { RecoveryRoutineTemplate } from '../models/recovery'

/** Points every use of `fromId` in a workout routine at `toId` instead, or drops
 *  those entries when `toId` is null (deleting an exercise with nothing to swap in).
 *  Returns undefined when the routine doesn't use `fromId`, so callers only save
 *  routines that actually changed. Sets, rest and notes carry over on a swap. */
export function replaceExerciseInRoutine(
  routine: RoutineTemplate,
  fromId: string,
  toId: string | null,
): RoutineTemplate | undefined {
  const uses = (configs: ExerciseConfig[]) => configs.some((c) => c.exerciseId === fromId)
  if (!uses(routine.main) && !uses(routine.warmup.exercises) && !uses(routine.finisher.exercises) && !uses(routine.cooldown.exercises)) {
    return undefined
  }

  const replaceIn = (configs: ExerciseConfig[]): ExerciseConfig[] => {
    if (toId) return configs.map((c) => (c.exerciseId === fromId ? { ...c, exerciseId: toId } : c))
    return configs
      .filter((c) => c.exerciseId !== fromId)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((c, i) => ({ ...c, orderIndex: i }))
  }
  const replaceSection = (section: RoutineSection): RoutineSection => ({ ...section, exercises: replaceIn(section.exercises) })

  return {
    ...routine,
    main: replaceIn(routine.main),
    warmup: replaceSection(routine.warmup),
    finisher: replaceSection(routine.finisher),
    cooldown: replaceSection(routine.cooldown),
  }
}

/** Recovery activities only optionally link to an exercise and keep their own name,
 *  so with no replacement the link is just cleared rather than the activity removed. */
export function replaceExerciseInRecoveryRoutine(
  routine: RecoveryRoutineTemplate,
  fromId: string,
  toId: string | null,
): RecoveryRoutineTemplate | undefined {
  if (!routine.activities.some((a) => a.exerciseId === fromId)) return undefined
  return {
    ...routine,
    activities: routine.activities.map((a) => {
      if (a.exerciseId !== fromId) return a
      if (toId) return { ...a, exerciseId: toId }
      const { exerciseId: _removed, ...rest } = a
      return rest
    }),
  }
}
