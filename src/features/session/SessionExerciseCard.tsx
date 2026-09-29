import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { ExerciseMediaThumb } from '../../components/ui/ExerciseMedia'
import { IconCheck, IconChevronDown, IconTrash } from '../../components/ui/icons'
import { getExercise } from '../../db/exercisesRepo'
import { getPreviousExercisePerformance } from '../../db/sessionsRepo'
import { formatSetResult } from '../../lib/formatPerformance'
import { formatPace, paceSplitMetersFor } from '../../models/units'
import { useNow } from '../../lib/useNow'
import { useSettingsStore } from '../../store/settingsStore'
import type { Exercise } from '../../models/exercise'
import type { SessionExerciseEntry, SetResult } from '../../models/session'

/** Cycles a set's side tag: untagged -> left -> right -> untagged. */
function nextSetSide(side: SetResult['side']): SetResult['side'] {
  if (side === 'left') return 'right'
  if (side === 'right') return undefined
  return 'left'
}

interface SessionExerciseCardProps {
  entry: SessionExerciseEntry
  sessionId: string
  onToggleSet: (setId: string, patch: Partial<SetResult>) => void
  /** Like onToggleSet, but for manual reps/weight/duration/distance edits — the parent
   *  also carries the value forward onto later, not-yet-completed sets of this exercise. */
  onFieldChange: (setId: string, patch: Partial<SetResult>) => void
  onAddSet: () => void
  onRemoveSet: (setId: string) => void
  onNotesChange: (notes: string) => void
  onRemoveExercise: () => void
  onSetCompleted: (restSeconds: number | undefined) => void
  onViewDetail: (exercise: Exercise) => void
  defaultExpanded?: boolean
  /** Marks this as the single "up next" exercise — the first one in the workout
   *  that isn't fully done yet — with a subtle accent edge, so it's obvious what
   *  to do next without having to scan every group. */
  highlight?: boolean
  /** Fires when the user opens (not closes) this card's sets — the parent uses this
   *  to move the highlight above onto whatever the user actually opened, even before
   *  a set's logged, rather than only reacting once a set is completed. */
  onExpand?: () => void
}

export function SessionExerciseCard({
  entry,
  onToggleSet,
  onFieldChange,
  onAddSet,
  onRemoveSet,
  onNotesChange,
  onRemoveExercise,
  onSetCompleted,
  onViewDetail,
  defaultExpanded,
  highlight,
  onExpand,
}: SessionExerciseCardProps) {
  const [expanded, setExpanded] = useState(!!defaultExpanded)
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [previous, setPrevious] = useState<string | null>(null)
  const vibrationEnabled = useSettingsStore((s) => s.settings.vibrationEnabled)
  const isCardio = exercise?.category === 'cardio'
  const isStretch = exercise?.category === 'mobility'

  useEffect(() => {
    getExercise(entry.exerciseId).then((e) => e && setExercise(e))
    getPreviousExercisePerformance(entry.exerciseId).then((result) => {
      if (!result) return
      const lastCompleted = [...result.entry.actualSets].reverse().find((s) => s.completed)
      if (!lastCompleted) return
      const formatted = formatSetResult(lastCompleted, entry.exerciseName)
      if (formatted) setPrevious(formatted)
    })
  }, [entry.exerciseId, entry.exerciseName])

  const doneCount = entry.actualSets.filter((s) => s.completed).length
  const isComplete = entry.actualSets.length > 0 && doneCount === entry.actualSets.length

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
    <div
      className={clsx(
        'rounded-[var(--radius-card)] border bg-surface',
        highlight ? 'border-primary-border border-l-4 border-l-secondary' : 'border-primary-border',
      )}
    >
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
          onClick={() => {
            setExpanded((v) => {
              const next = !v
              if (next) onExpand?.()
              return next
            })
          }}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse' : isComplete ? 'Completed — expand to view sets' : 'Expand'}
          className={clsx('rounded-full p-2 hover:bg-primary-tint', isComplete ? 'text-success' : 'text-primary')}
        >
          {isComplete ? (
            <IconCheck width={18} height={18} />
          ) : (
            <IconChevronDown width={18} height={18} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
          )}
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
              const livePace = isCardio ? formatPace(set.actualDistanceMeters, set.actualDurationSeconds, paceSplitMetersFor(entry.exerciseName)) : null
              // A non-cardio set configured with a target hold time (set in the routine
              // editor's Duration field) is a timed hold — a stretch or plank, not reps —
              // so it gets a tap-to-start countdown instead of a reps/weight input.
              const isHold = !isCardio && target?.targetDurationSeconds != null
              return (
                <div key={set.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleSet(set.id, { side: nextSetSide(set.side) })}
                      aria-label={
                        set.side
                          ? `Set ${i + 1}, ${set.side} side — tap to ${set.side === 'left' ? 'switch to right side' : 'clear side'}`
                          : `Set ${i + 1} — tap to mark as left or right side, for single-arm/single-leg exercises`
                      }
                      className={clsx(
                        'w-7 shrink-0 rounded-[var(--radius-control)] py-1 text-center text-xs font-semibold tabular-nums',
                        set.side ? 'text-secondary' : 'text-primary-muted hover:text-primary',
                      )}
                    >
                      {i + 1}
                      {set.side === 'left' ? 'L' : set.side === 'right' ? 'R' : ''}
                    </button>
                    <span className="w-24 shrink-0 text-xs text-primary-muted">
                      {isCardio ? (
                        <>
                          Target: {target?.targetDurationSeconds ? `${target.targetDurationSeconds}s` : '–'}
                          {target?.targetDistanceMeters ? ` × ${target.targetDistanceMeters}m` : ''}
                          {(() => {
                            const pace = formatPace(target?.targetDistanceMeters, target?.targetDurationSeconds, paceSplitMetersFor(entry.exerciseName))
                            return pace ? ` (${pace})` : ''
                          })()}
                        </>
                      ) : isHold ? (
                        <>Hold: {target!.targetDurationSeconds}s</>
                      ) : (
                        <>
                          Target: {target?.targetReps ?? '–'}
                          {!isStretch && target?.targetWeightKg ? ` × ${target.targetWeightKg}kg` : ''}
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
                          onChange={(e) => onFieldChange(set.id, { actualDurationSeconds: e.target.value === '' ? undefined : Number(e.target.value) })}
                        />
                        <input
                          type="number"
                          aria-label={`Set ${i + 1} actual distance in meters`}
                          placeholder="m"
                          className="w-16 rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
                          value={set.actualDistanceMeters ?? ''}
                          onChange={(e) => onFieldChange(set.id, { actualDistanceMeters: e.target.value === '' ? undefined : Number(e.target.value) })}
                        />
                      </>
                    ) : isHold ? (
                      <HoldTimerControl
                        targetSeconds={target!.targetDurationSeconds!}
                        actualSeconds={set.actualDurationSeconds}
                        completed={set.completed}
                        vibrationEnabled={vibrationEnabled}
                        onFinish={() => handleQuickComplete(set, i)}
                      />
                    ) : (
                      <>
                        <input
                          type="number"
                          aria-label={`Set ${i + 1} actual reps`}
                          placeholder="reps"
                          className="w-16 rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
                          value={set.actualReps ?? ''}
                          onChange={(e) => onFieldChange(set.id, { actualReps: e.target.value === '' ? undefined : Number(e.target.value) })}
                        />
                        {!isStretch && (
                          <input
                            type="number"
                            aria-label={`Set ${i + 1} actual weight`}
                            placeholder="kg"
                            className="w-16 rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
                            value={set.actualWeightKg ?? ''}
                            onChange={(e) => onFieldChange(set.id, { actualWeightKg: e.target.value === '' ? undefined : Number(e.target.value) })}
                          />
                        )}
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
                  {livePace && <p className="pl-8 text-xs text-primary-subtle">Pace: {livePace}</p>}
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

/** Tap-to-start countdown for a timed hold (a stretch, plank, etc.) instead of typing
 *  in a number — starts from the set's target duration and counts down to 0, then
 *  completes the set automatically (same path as tapping the checkmark), so you know
 *  exactly when to stop holding without watching a separate clock. Tapping again while
 *  it's running cancels it. Derives remaining time from an absolute end timestamp
 *  (rather than decrementing a counter) so it stays correct even if the tab is
 *  backgrounded mid-hold — same approach as the between-sets RestTimerBar. */
function HoldTimerControl({
  targetSeconds,
  actualSeconds,
  completed,
  vibrationEnabled,
  onFinish,
}: {
  targetSeconds: number
  actualSeconds?: number
  completed: boolean
  vibrationEnabled: boolean
  onFinish: () => void
}) {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const now = useNow(1000)
  const firedRef = useRef(false)
  const remainingMs = endsAt !== null ? Math.max(0, endsAt - now) : null
  const remainingSeconds = remainingMs !== null ? Math.ceil(remainingMs / 1000) : null

  useEffect(() => {
    if (remainingMs !== 0 || firedRef.current) return
    firedRef.current = true
    if (vibrationEnabled && 'vibrate' in navigator) navigator.vibrate?.(200)
    onFinish()
    setEndsAt(null)
  }, [remainingMs, onFinish, vibrationEnabled])

  if (completed) {
    return <span className="w-16 shrink-0 text-center text-sm text-primary-muted">{actualSeconds ?? targetSeconds}s</span>
  }

  if (remainingSeconds !== null) {
    return (
      <button
        onClick={() => setEndsAt(null)}
        aria-label="Cancel hold timer"
        className="w-16 shrink-0 rounded-[var(--radius-control)] border border-secondary bg-secondary-tint px-2 py-1.5 text-center text-sm font-semibold tabular-nums text-secondary"
      >
        {remainingSeconds}s
      </button>
    )
  }

  return (
    <button
      onClick={() => {
        firedRef.current = false
        setEndsAt(Date.now() + targetSeconds * 1000)
      }}
      aria-label={`Start ${targetSeconds} second hold timer`}
      className="w-16 shrink-0 rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-center text-sm text-primary hover:border-secondary"
    >
      {targetSeconds}s ▶
    </button>
  )
}
