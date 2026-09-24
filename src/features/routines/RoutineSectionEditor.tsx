import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '../../components/ui/Button'
import { IconPlus } from '../../components/ui/icons'
import { ExerciseConfigRow } from './ExerciseConfigRow'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { ExerciseDetailSheet } from '../exercises/ExerciseDetailSheet'
import { getAllExercises } from '../../db/exercisesRepo'
import { createExerciseConfigWithHistory } from '../../db/sessionsRepo'
import type { ExerciseConfig } from '../../models/routine'
import { flattenMuscleGroupConfigSections, groupExerciseConfigsByMuscle } from '../../lib/exerciseGrouping'
import type { Exercise } from '../../models/exercise'

interface RoutineSectionEditorProps {
  title: string
  exercises: ExerciseConfig[]
  onChange: (exercises: ExerciseConfig[]) => void
  emptyHint: string
  /** When true, exercises are displayed (and stored) grouped under muscle-group
   *  headers instead of as one flat list, so the routine reads sectioned the way
   *  a written workout program often is (e.g. Chest, Back, Core). */
  groupByMuscle?: boolean
  /** Warm-up/cool-down only: lets a stretch picked here be sent to the other section
   *  instead, via a second button in the picker. Pass both or neither. */
  otherSectionLabel?: string
  onAddToOtherSection?: (exercise: Exercise) => void
}

export function RoutineSectionEditor({
  title,
  exercises,
  onChange,
  emptyHint,
  groupByMuscle,
  otherSectionLabel,
  onAddToOtherSection,
}: RoutineSectionEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null)
  const library = useLiveQuery(getAllExercises, [], []) ?? []
  const byId = new Map(library.map((e) => [e.id, e]))

  function reindex(list: ExerciseConfig[]): ExerciseConfig[] {
    if (!groupByMuscle) return list.map((c, i) => ({ ...c, orderIndex: i }))
    return flattenMuscleGroupConfigSections(groupExerciseConfigsByMuscle(list, byId))
  }

  async function addExercise(exercise: Exercise) {
    // The picker can hand back a just-created custom exercise the live-query
    // snapshot in `byId` hasn't caught up to yet, so merge it in for grouping.
    const withNewExercise = new Map(byId).set(exercise.id, exercise)
    const config = await createExerciseConfigWithHistory(exercise.id, exercises.length)
    const appended = [...exercises, config]
    onChange(
      groupByMuscle
        ? flattenMuscleGroupConfigSections(groupExerciseConfigsByMuscle(appended, withNewExercise))
        : appended.map((c, i) => ({ ...c, orderIndex: i })),
    )
    setPickerOpen(false)
  }

  function update(id: string, config: ExerciseConfig) {
    onChange(exercises.map((c) => (c.id === id ? config : c)))
  }

  function remove(id: string) {
    onChange(reindex(exercises.filter((c) => c.id !== id)))
  }

  function move(id: string, dir: -1 | 1) {
    if (!groupByMuscle) {
      const index = exercises.findIndex((c) => c.id === id)
      const target = index + dir
      if (index < 0 || target < 0 || target >= exercises.length) return
      const copy = [...exercises]
      ;[copy[index], copy[target]] = [copy[target], copy[index]]
      onChange(reindex(copy))
      return
    }

    const sections = groupExerciseConfigsByMuscle(exercises, byId)
    for (const section of sections) {
      const index = section.configs.findIndex((c) => c.id === id)
      if (index === -1) continue
      const target = index + dir
      if (target < 0 || target >= section.configs.length) return
      ;[section.configs[index], section.configs[target]] = [section.configs[target], section.configs[index]]
      onChange(flattenMuscleGroupConfigSections(sections))
      return
    }
  }

  const sections = groupByMuscle ? groupExerciseConfigsByMuscle(exercises, byId) : null

  function renderRow(config: ExerciseConfig, canMoveUp: boolean, canMoveDown: boolean) {
    return (
      <ExerciseConfigRow
        key={config.id}
        config={config}
        exercise={byId.get(config.exerciseId)}
        onChange={(c) => update(config.id, c)}
        onRemove={() => remove(config.id)}
        onMoveUp={canMoveUp ? () => move(config.id, -1) : undefined}
        onMoveDown={canMoveDown ? () => move(config.id, 1) : undefined}
        onViewDetail={() => {
          const ex = byId.get(config.exerciseId)
          if (ex) setDetailExercise(ex)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary-strong">{title}</h3>
        <Button size="sm" variant="secondary" icon={<IconPlus width={16} height={16} />} onClick={() => setPickerOpen(true)}>
          Add
        </Button>
      </div>

      {exercises.length === 0 ? (
        <p className="rounded-[var(--radius-control)] border border-dashed border-primary-border p-4 text-center text-sm text-primary-muted">
          {emptyHint}
        </p>
      ) : sections ? (
        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <div key={section.muscle}>
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-primary-muted">{section.label}</h4>
              <div className="flex flex-col gap-2">
                {section.configs.map((config, i) => renderRow(config, i > 0, i < section.configs.length - 1))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {exercises.map((config, i) => renderRow(config, i > 0, i < exercises.length - 1))}
        </div>
      )}

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addExercise}
        stretchAltSection={
          otherSectionLabel && onAddToOtherSection
            ? {
                label: otherSectionLabel,
                onSelect: (exercise) => {
                  onAddToOtherSection(exercise)
                  setPickerOpen(false)
                },
              }
            : undefined
        }
      />
      <ExerciseDetailSheet exercise={detailExercise} onClose={() => setDetailExercise(null)} />
    </div>
  )
}
