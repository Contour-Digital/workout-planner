import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '../../components/ui/Button'
import { IconPlus } from '../../components/ui/icons'
import { ExerciseConfigRow } from './ExerciseConfigRow'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { ExerciseDetailSheet } from '../exercises/ExerciseDetailSheet'
import { getAllExercises } from '../../db/exercisesRepo'
import { createExerciseConfig, type ExerciseConfig } from '../../models/routine'
import type { Exercise } from '../../models/exercise'

interface RoutineSectionEditorProps {
  title: string
  exercises: ExerciseConfig[]
  onChange: (exercises: ExerciseConfig[]) => void
  emptyHint: string
}

export function RoutineSectionEditor({ title, exercises, onChange, emptyHint }: RoutineSectionEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null)
  const library = useLiveQuery(getAllExercises, [], []) ?? []
  const byId = new Map(library.map((e) => [e.id, e]))

  function addExercise(exercise: Exercise) {
    onChange([...exercises, createExerciseConfig(exercise.id, exercises.length)])
    setPickerOpen(false)
  }

  function update(index: number, config: ExerciseConfig) {
    onChange(exercises.map((c, i) => (i === index ? config : c)))
  }

  function remove(index: number) {
    onChange(exercises.filter((_, i) => i !== index).map((c, i) => ({ ...c, orderIndex: i })))
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= exercises.length) return
    const copy = [...exercises]
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
    onChange(copy.map((c, i) => ({ ...c, orderIndex: i })))
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
      ) : (
        <div className="flex flex-col gap-2">
          {exercises.map((config, i) => (
            <ExerciseConfigRow
              key={config.id}
              config={config}
              exercise={byId.get(config.exerciseId)}
              onChange={(c) => update(i, c)}
              onRemove={() => remove(i)}
              onMoveUp={i > 0 ? () => move(i, -1) : undefined}
              onMoveDown={i < exercises.length - 1 ? () => move(i, 1) : undefined}
              onViewDetail={() => {
                const ex = byId.get(config.exerciseId)
                if (ex) setDetailExercise(ex)
              }}
            />
          ))}
        </div>
      )}

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addExercise} />
      <ExerciseDetailSheet exercise={detailExercise} onClose={() => setDetailExercise(null)} />
    </div>
  )
}
