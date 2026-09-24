import { MUSCLE_GROUP_LABELS, type Exercise, type MuscleGroup } from '../models/exercise'
import type { ExerciseConfig } from '../models/routine'

export interface MuscleGroupSection {
  muscle: MuscleGroup | 'other'
  label: string
  exercises: Exercise[]
}

/** Groups exercises under their first listed primary muscle, so each exercise
 *  appears exactly once. Exercises with no primary muscle land in "Other".
 *  Sections are sorted alphabetically by label; exercises within a section by name. */
export function groupExercisesByPrimaryMuscle(exercises: Exercise[]): MuscleGroupSection[] {
  const buckets = new Map<MuscleGroup | 'other', Exercise[]>()

  for (const exercise of exercises) {
    const key = exercise.primaryMuscles[0] ?? 'other'
    const bucket = buckets.get(key)
    if (bucket) bucket.push(exercise)
    else buckets.set(key, [exercise])
  }

  const sections: MuscleGroupSection[] = Array.from(buckets.entries()).map(([muscle, list]) => ({
    muscle,
    label: muscle === 'other' ? 'Other' : MUSCLE_GROUP_LABELS[muscle],
    exercises: [...list].sort((a, b) => a.name.localeCompare(b.name)),
  }))

  return sections.sort((a, b) => {
    if (a.muscle === 'other') return 1
    if (b.muscle === 'other') return -1
    return a.label.localeCompare(b.label)
  })
}

export interface MuscleGroupItemSection<T> {
  muscle: MuscleGroup | 'other'
  label: string
  items: T[]
}

/** Groups anything keyed by exerciseId (a routine's ExerciseConfig, a session's
 *  SessionExerciseEntry, ...) under its exercise's first primary muscle — keeping
 *  each item's place within its group as it already appears in the list, rather
 *  than re-sorting. Used so a routine or an in-progress workout reads sectioned
 *  by muscle group (chest, back, core, ...) the way a written program often is. */
export function groupByPrimaryMuscle<T extends { exerciseId: string }>(
  items: T[],
  byId: Map<string, Exercise>,
): MuscleGroupItemSection<T>[] {
  const buckets = new Map<MuscleGroup | 'other', T[]>()

  for (const item of items) {
    const key = byId.get(item.exerciseId)?.primaryMuscles[0] ?? 'other'
    const bucket = buckets.get(key)
    if (bucket) bucket.push(item)
    else buckets.set(key, [item])
  }

  const sections: MuscleGroupItemSection<T>[] = Array.from(buckets.entries()).map(([muscle, list]) => ({
    muscle,
    label: muscle === 'other' ? 'Other' : MUSCLE_GROUP_LABELS[muscle],
    items: list,
  }))

  return sections.sort((a, b) => {
    if (a.muscle === 'other') return 1
    if (b.muscle === 'other') return -1
    return a.label.localeCompare(b.label)
  })
}

export interface MuscleGroupConfigSection {
  muscle: MuscleGroup | 'other'
  label: string
  configs: ExerciseConfig[]
}

/** ExerciseConfig-specific view over groupByPrimaryMuscle, for callers (the routine
 *  editor) that also need to flatten back into a reordered, reindexed config list. */
export function groupExerciseConfigsByMuscle(configs: ExerciseConfig[], byId: Map<string, Exercise>): MuscleGroupConfigSection[] {
  return groupByPrimaryMuscle(configs, byId).map((s) => ({ muscle: s.muscle, label: s.label, configs: s.items }))
}

/** Flattens grouped sections back into a single ordered list with orderIndex reassigned
 *  to match the grouped order, so the stored routine order reflects what's displayed. */
export function flattenMuscleGroupConfigSections(sections: MuscleGroupConfigSection[]): ExerciseConfig[] {
  return sections.flatMap((s) => s.configs).map((c, i) => ({ ...c, orderIndex: i }))
}
