import { useEffect, useState } from 'react'
import { ExerciseMediaThumb } from '../../components/ui/ExerciseMedia'
import { IconCheck, IconChevronDown, IconTrash } from '../../components/ui/icons'
import { getExercise } from '../../db/exercisesRepo'
import { getPreviousExercisePerformance } from '../../db/sessionsRepo'
import { formatSetResult } from '../../lib/formatPerformance'
import { useSettingsStore } from '../../store/settingsStore'
import type { Exercise } from '../../models/exercise'
import type { SessionExerciseEntry, SetResult } from '../../models/session'

interface SessionExerciseCardProps {
  entry: SessionExerciseEntry
  sessionId: string
  onToggleSet: (setId: string, patch: Partial<SetResult>) => void
  onAddSet: () => void
  onRemoveSet: (setId: string) => void
  onNotesChange: (notes: string) => void
  onRemoveExercise: () => void
  onSetCompleted: (restSeconds: number | undefined) => void
  onViewDetail: (exercise: Exercise) => void
  defaultExpanded?: boolean
}

export function SessionExerciseCard({
  entry,
  onToggleSet,
  onAddSet,
  onRemoveSet,
  onNotesChange,
  onRemoveExercise,
  onSetCompleted,
  onViewDetail,
  defaultExpanded,
}: SessionExerciseCardProps) {
  const [expanded, setExpanded] = useState(!!defaultExpanded)
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [previous, setPrevious] = useState<string | null>(null)
  const vibrationEnabled = useSettingsStore((s) => s.settings.vibrationEnabled)
  const isCardio = exercise?.category === 'cardio'

  useEffect(() => {
    getExercise(entry.exerciseId).then((e) => e && setExercise(e))
    getPreviousExercisePerformance(entry.exerciseId).then((result) => {
      if (!result) return
      const lastCompleted = [...result.entry.actualSets].reverse().find((s) => s.completed)
      if (!lastCompleted) return
      const formatted = formatSetResult(lastCompleted)
      if (formatted) setPrevious(formatted)
    })
  }, [entry.exerciseId])

  const doneCount = entry.actualSets.filter((s) => s.completed).length

  function handleQuickComplete(set: SetResult, targetIndex: number) {
    const target = entry.targetSets[targetIndex]
    if (set.completed) {
      onToggleSet(set.id, { completed: false, completedAt: undefined })
      return
    }
    if (vibrationEnabled && 'vibrate' in navigator) navigator.vibrate?.(15)
    onToggleSet(set.id, {
      completed: true,
      completedAt: new Date().toISOString(),
      actualReps: set.actualReps ?? target?.targetReps,
      actualWeightKg: set.actualWeightKg ?? target?.targetWeightKg,
      actualDurationSeconds: set.actualDurationSeconds ?? target?.targetDurationSeconds,
      actualDistanceMeters: set.actualDistanceMeters ?? target?.targetDistanceMeters,
    })
    onSetCompleted(entry.restSeconds)
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-primary-border bg-surface">
      <div className="flex items-center gap-3 p-3">
        <button
          className="flex flex-1 items-center gap-3 text-left"
          onClick={() => exercise && onViewDetail(exercise)}
        >
          {exercise && <ExerciseMediaThumb media={exercise.media} size={44} />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-primary-strong">{entry.exerciseName}</p>
            <p className="text-xs text-primary-muted">
              {doneCount} of {entry.actualSets.length} sets
            </p>
          </div>
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          className="rounded-full p-2 text-primary hover:bg-primary-tint"
        >
          <IconChevronDown width={18} height={18} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-primary-border p-3">
          {previous && (
            <p className="rounded-[var(--radius-control)] bg-primary-tint px-3 py-2 text-xs font-medium text-primary-muted">
              Previous: {previous}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {entry.actualSets.map((set, i) => {
              const target = entry.targetSets[i]
              return (
                <div key={set.id} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-xs font-semibold text-primary-muted">{i + 1}</span>
                  <span className="w-24 shrink-0 text-xs text-primary-muted">
                    {isCardio ? (
                      <>
                        Target: {target?.targetDurationSeconds ? `${target.targetDurationSeconds}s` : '–'}
                        {target?.targetDistanceMeters ? ` × ${target.targetDistanceMeters}m` : ''}
                      </>
                    ) : (
                      <>
                        Target: {target?.targetReps ?? '–'}
                        {target?.targetWeightKg ? ` × ${target.targetWeightKg}kg` : ''}
                      </>
                    )}
                  </span>
                  {isCardio ? (
                    <>
                      <input
                        type="number"
                        aria-label={`Set ${i + 1} actual duration in seconds`}
                        placeholder="secs"
                        className="w-16 rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
                        value={set.actualDurationSeconds ?? ''}
                        onChange={(e) => onToggleSet(set.id, { actualDurationSeconds: e.target.value === '' ? undefined : Number(e.target.value) })}
                      />
                      <input
                        type="number"
                        aria-label={`Set ${i + 1} actual distance in meters`}
                        placeholder="m"
                        className="w-16 rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
                        value={set.actualDistanceMeters ?? ''}
                        onChange={(e) => onToggleSet(set.id, { actualDistanceMeters: e.target.value === '' ? undefined : Number(e.target.value) })}
                      />
                    </>
                  ) : (
                    <>
                      <input
                        type="number"
                        aria-label={`Set ${i + 1} actual reps`}
                        placeholder="reps"
                        className="w-16 rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
                        value={set.actualReps ?? ''}
                        onChange={(e) => onToggleSet(set.id, { actualReps: e.target.value === '' ? undefined : Number(e.target.value) })}
                      />
                      <input
                        type="number"
                        aria-label={`Set ${i + 1} actual weight`}
                        placeholder="kg"
                        className="w-16 rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
                        value={set.actualWeightKg ?? ''}
                        onChange={(e) => onToggleSet(set.id, { actualWeightKg: e.target.value === '' ? undefined : Number(e.target.value) })}
                      />
                    </>
                  )}
                  <button
                    onClick={() => handleQuickComplete(set, i)}
                    aria-pressed={set.completed}
                    aria-label={set.completed ? `Set ${i + 1} completed, tap to undo` : `Mark set ${i + 1} complete`}
                    className={
                      'ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors ' +
                      (set.completed ? 'border-success bg-success text-white' : 'border-primary-border text-primary-subtle hover:border-secondary')
                    }
                  >
                    <IconCheck width={20} height={20} />
                  </button>
                  <button
                    onClick={() => onRemoveSet(set.id)}
                    aria-label={`Remove set ${i + 1}`}
                    className="text-primary-subtle hover:text-danger"
                  >
                    <IconTrash width={16} height={16} />
                  </button>
                </div>
              )
            })}
          </div>

          <button onClick={onAddSet} className="self-start text-sm font-medium text-secondary hover:underline">
            + Add set
          </button>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-primary-muted">Notes</span>
            <textarea
              className="min-h-12 rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
              value={entry.notes ?? ''}
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </label>

          <button onClick={onRemoveExercise} className="self-start text-sm font-medium text-danger hover:underline">
            Remove from this session
          </button>
        </div>
      )}
    </div>
  )
}
