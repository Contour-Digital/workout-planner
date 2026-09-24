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

export interface MuscleGroupConfigSection {
  muscle: MuscleGroup | 'other'
  label: string
  configs: ExerciseConfig[]
}

/** Same grouping as groupExercisesByPrimaryMuscle, but for the exercise configs already
 *  in a routine section — keeps each config's place within its muscle group as it already
 *  appears in the list, rather than re-sorting by name. Used so a routine reads sectioned
 *  by muscle group (chest, back, core, ...) the way it might in a written workout program. */
export function groupExerciseConfigsByMuscle(configs: ExerciseConfig[], byId: Map<string, Exercise>): MuscleGroupConfigSection[] {
  const buckets = new Map<MuscleGroup | 'other', ExerciseConfig[]>()

  for (const config of configs) {
    const key = byId.get(config.exerciseId)?.primaryMuscles[0] ?? 'other'
    const bucket = buckets.get(key)
    if (bucket) bucket.push(config)
    else buckets.set(key, [config])
  }

  const sections: MuscleGroupConfigSection[] = Array.from(buckets.entries()).map(([muscle, configList]) => ({
    muscle,
    label: muscle === 'other' ? 'Other' : MUSCLE_GROUP_LABELS[muscle],
    configs: configList,
  }))

  return sections.sort((a, b) => {
    if (a.muscle === 'other') return 1
    if (b.muscle === 'other') return -1
    return a.label.localeCompare(b.label)
  })
}

/** Flattens grouped sections back into a single ordered list with orderIndex reassigned
 *  to match the grouped order, so the stored routine order reflects what's displayed. */
export function flattenMuscleGroupConfigSections(sections: MuscleGroupConfigSection[]): ExerciseConfig[] {
  return sections.flatMap((s) => s.configs).map((c, i) => ({ ...c, orderIndex: i }))
}
