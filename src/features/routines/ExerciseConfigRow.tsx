import { useEffect, useState } from 'react'
import { ExerciseMediaThumb } from '../../components/ui/ExerciseMedia'
import { IconChevronDown, IconRepeat, IconTrash } from '../../components/ui/icons'
import { getPreviousExercisePerformance } from '../../db/sessionsRepo'
import { formatSetResult } from '../../lib/formatPerformance'
import { formatPace, paceSplitMetersFor } from '../../models/units'
import { MUSCLE_GROUP_LABELS, type Exercise } from '../../models/exercise'
import type { ExerciseConfig, SetTarget } from '../../models/routine'

interface ExerciseConfigRowProps {
  config: ExerciseConfig
  exercise: Exercise | undefined
  onChange: (config: ExerciseConfig) => void
  onRemove: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onViewDetail: () => void
  /** Finisher only — shows the "part of a round" toggle. See ExerciseConfig.inRound. */
  allowRounds?: boolean
}

/** Left, right, left, right, ... — the simplest even split across however many sets
 *  are configured, so turning on "split left/right" never needs per-set tapping. */
function alternatingSides(count: number): ('left' | 'right')[] {
  return Array.from({ length: count }, (_, i) => (i % 2 === 0 ? 'left' : 'right'))
}

function summarize(config: ExerciseConfig, isCardio: boolean, isStretch: boolean, exerciseName: string): string {
  if (config.sets.length === 0) return 'No sets configured'
  const first = config.sets[0]
  const parts: string[] = []
  if (config.uniformSets) {
    if (isCardio) {
      if (first.targetDurationSeconds) parts.push(`${config.sets.length} × ${first.targetDurationSeconds}s`)
      else parts.push(`${config.sets.length} sets`)
      if (first.targetDistanceMeters) parts.push(`${first.targetDistanceMeters} m`)
      const pace = formatPace(first.targetDistanceMeters, first.targetDurationSeconds, paceSplitMetersFor(exerciseName))
      if (pace) parts.push(pace)
    } else {
      if (first.targetReps) parts.push(`${config.sets.length} × ${first.targetReps} reps`)
      else parts.push(`${config.sets.length} sets`)
      if (!isStretch && first.targetWeightKg) parts.push(`${first.targetWeightKg} kg`)
    }
  } else if (isCardio) {
    parts.push(config.sets.map((s) => (s.targetDurationSeconds ? `${s.targetDurationSeconds}s` : '–')).join('/'))
    if (first.targetDistanceMeters) parts.push(`${first.targetDistanceMeters} m`)
  } else {
    parts.push(config.sets.map((s) => s.targetReps ?? '–').join('/') + ' reps')
  }
  return parts.join(' · ')
}

export function ExerciseConfigRow({ config, exercise, onChange, onRemove, onMoveUp, onMoveDown, onViewDetail, allowRounds }: ExerciseConfigRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [previous, setPrevious] = useState<string | null>(null)
  const isCardio = exercise?.category === 'cardio'
  const isStretch = exercise?.category === 'mobility'

  useEffect(() => {
    setPrevious(null)
    getPreviousExercisePerformance(config.exerciseId).then((result) => {
      if (!result) return
      const lastCompleted = [...result.entry.actualSets].reverse().find((s) => s.completed)
      if (!lastCompleted) return
      const formatted = formatSetResult(lastCompleted, exercise?.name)
      if (formatted) setPrevious(formatted)
    })
  }, [config.exerciseId, exercise?.name])

  // Split mode isn't its own field — it's just "does this exercise currently have any
  // side tags", so there's nothing to keep in sync when sets are added/removed/reset.
  const isSplit = config.sets.some((s) => s.side)

  function updateSet(index: number, patch: Partial<SetTarget>) {
    const sets = config.sets.map((s, i) => (i === index ? { ...s, ...patch } : s))
    onChange({ ...config, sets })
  }

  function setUniformField(patch: Partial<SetTarget>) {
    onChange({ ...config, sets: config.sets.map((s) => ({ ...s, ...patch })) })
  }

  function setSetCount(count: number) {
    const clamped = Math.max(1, Math.min(20, count))
    const current = config.sets
    if (clamped === current.length) return
    let sets: SetTarget[]
    if (clamped > current.length) {
      const template = current[current.length - 1]
      const added: SetTarget[] = Array.from({ length: clamped - current.length }, (_, i) => ({
        ...template,
        id: crypto.randomUUID(),
        setNumber: current.length + i + 1,
      }))
      sets = [...current, ...added]
    } else {
      sets = current.slice(0, clamped)
    }
    // Re-spread left/right across the new count so a resize never leaves a run of
    // duplicate sides at the end (e.g. growing from 3 sets ending on "right" would
    // otherwise just repeat "right" for every set added).
    if (isSplit) {
      const sides = alternatingSides(sets.length)
      sets = sets.map((s, i) => ({ ...s, side: sides[i] }))
    }
    onChange({ ...config, sets })
  }

  function setSplitMode(split: boolean) {
    const sides = split ? alternatingSides(config.sets.length) : undefined
    onChange({ ...config, sets: config.sets.map((s, i) => ({ ...s, side: sides?.[i] })) })
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-primary-border bg-surface">
      <div className="flex items-center gap-2 p-3">
        <div className="flex flex-col">
          <button
            type="button"
            aria-label="Move up"
            disabled={!onMoveUp}
            onClick={onMoveUp}
            className="text-primary-subtle hover:text-primary disabled:opacity-30"
          >
            ▲
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={!onMoveDown}
            onClick={onMoveDown}
            className="text-primary-subtle hover:text-primary disabled:opacity-30"
          >
            ▼
          </button>
        </div>
        <button onClick={onViewDetail} className="flex flex-1 items-center gap-3 text-left">
          {exercise && <ExerciseMediaThumb media={exercise.media} size={40} />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-primary-strong">{exercise?.name ?? 'Unknown exercise'}</p>
            {exercise && exercise.primaryMuscles.length > 0 && (
              <p className="truncate text-xs text-secondary">{exercise.primaryMuscles.map((m) => MUSCLE_GROUP_LABELS[m]).join(', ')}</p>
            )}
            <p className="truncate text-xs text-primary-muted">{summarize(config, isCardio, isStretch, exercise?.name ?? '')}</p>
            {config.inRound && (
              <p className="flex items-center gap-1 text-xs font-medium text-secondary">
                <IconRepeat width={12} height={12} /> In a round
              </p>
            )}
            {previous && <p className="truncate text-xs text-primary-subtle">Previous: {previous}</p>}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          className="rounded-full p-2 text-primary hover:bg-primary-tint"
        >
          <IconChevronDown width={18} height={18} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
        <button type="button" onClick={onRemove} aria-label="Remove exercise" className="rounded-full p-2 text-danger hover:bg-danger-bg">
          <IconTrash width={18} height={18} />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-primary-border p-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={config.uniformSets} onChange={(e) => onChange({ ...config, uniformSets: e.target.checked })} />
              Same target for every set
            </label>
            <label className="ml-auto flex items-center gap-2 text-sm">
              Sets
              <input
                type="number"
                min={1}
                max={20}
                className="w-16 rounded-[var(--radius-control)] border border-primary-border px-2 py-1 text-sm"
                value={config.sets.length}
                onChange={(e) => setSetCount(Number(e.target.value))}
              />
            </label>
          </div>

          {allowRounds && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={config.inRound ?? false} onChange={(e) => onChange({ ...config, inRound: e.target.checked })} />
              Part of a round — do one set, then move to the next round exercise, repeating until all of them finish together
            </label>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-primary-muted">Movement</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSplitMode(false)}
                aria-pressed={!isSplit}
                className={
                  'flex-1 rounded-[var(--radius-control)] border px-3 py-2 text-sm font-medium ' +
                  (!isSplit ? 'border-secondary bg-secondary-tint text-secondary' : 'border-primary-border text-primary-muted')
                }
              >
                One movement
              </button>
              <button
                type="button"
                onClick={() => setSplitMode(true)}
                aria-pressed={isSplit}
                className={
                  'flex-1 rounded-[var(--radius-control)] border px-3 py-2 text-sm font-medium ' +
                  (isSplit ? 'border-secondary bg-secondary-tint text-secondary' : 'border-primary-border text-primary-muted')
                }
              >
                Split left / right
              </button>
            </div>
            {isSplit && (
              <p className="text-xs text-primary-muted">
                Sets alternate sides — {config.sets.map((s) => (s.side === 'left' ? 'L' : 'R')).join(', ')}.
              </p>
            )}
          </div>

          {config.uniformSets ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {isCardio ? (
                <>
                  <NumberField label="Duration (s)" value={config.sets[0]?.targetDurationSeconds} onChange={(v) => setUniformField({ targetDurationSeconds: v })} />
                  <NumberField label="Distance (m)" value={config.sets[0]?.targetDistanceMeters} onChange={(v) => setUniformField({ targetDistanceMeters: v })} />
                </>
              ) : (
                <>
                  <NumberField label="Reps" value={config.sets[0]?.targetReps} onChange={(v) => setUniformField({ targetReps: v })} />
                  {!isStretch && (
                    <NumberField label="Weight (kg)" value={config.sets[0]?.targetWeightKg} onChange={(v) => setUniformField({ targetWeightKg: v })} step={0.5} />
                  )}
                  <NumberField label="Duration (s)" value={config.sets[0]?.targetDurationSeconds} onChange={(v) => setUniformField({ targetDurationSeconds: v })} />
                  {!isStretch && (
                    <NumberField label="Distance (m)" value={config.sets[0]?.targetDistanceMeters} onChange={(v) => setUniformField({ targetDistanceMeters: v })} />
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {config.sets.map((set, i) => (
                <div key={set.id} className={isCardio ? 'grid grid-cols-4 items-center gap-2' : isStretch ? 'grid grid-cols-3 items-center gap-2' : 'grid grid-cols-5 items-center gap-2'}>
                  <span className="text-xs font-medium text-primary-muted">Set {i + 1}</span>
                  {isCardio ? (
                    <>
                      <NumberField compact label="Dur (s)" value={set.targetDurationSeconds} onChange={(v) => updateSet(i, { targetDurationSeconds: v })} />
                      <NumberField compact label="Dist (m)" value={set.targetDistanceMeters} onChange={(v) => updateSet(i, { targetDistanceMeters: v })} />
                      <span className="truncate text-xs text-primary-subtle">
                        {formatPace(set.targetDistanceMeters, set.targetDurationSeconds, paceSplitMetersFor(exercise?.name ?? '')) ?? ''}
                      </span>
                    </>
                  ) : (
                    <>
                      <NumberField compact label="Reps" value={set.targetReps} onChange={(v) => updateSet(i, { targetReps: v })} />
                      {!isStretch && (
                        <NumberField compact label="Weight" value={set.targetWeightKg} onChange={(v) => updateSet(i, { targetWeightKg: v })} step={0.5} />
                      )}
                      <NumberField compact label="Dur (s)" value={set.targetDurationSeconds} onChange={(v) => updateSet(i, { targetDurationSeconds: v })} />
                      {!isStretch && (
                        <NumberField compact label="Dist (m)" value={set.targetDistanceMeters} onChange={(v) => updateSet(i, { targetDistanceMeters: v })} />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Rest (s)" value={config.restSeconds} onChange={(v) => onChange({ ...config, restSeconds: v })} />
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-primary-muted">Exercise notes</span>
            <textarea
              className="min-h-12 rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
              value={config.notes ?? ''}
              onChange={(e) => onChange({ ...config, notes: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  compact,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  step?: number
  compact?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      {!compact && <span className="text-xs font-medium text-primary-muted">{label}</span>}
      <input
        type="number"
        step={step}
        placeholder={compact ? label : undefined}
        className="rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </label>
  )
}
