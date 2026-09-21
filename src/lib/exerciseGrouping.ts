import { MUSCLE_GROUP_LABELS, type Exercise, type MuscleGroup } from '../models/exercise'

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
