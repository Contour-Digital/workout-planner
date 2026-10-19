import { useLiveQuery } from 'dexie-react-hooks'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { IconPlay } from '../../components/ui/icons'
import { getAllExercises } from '../../db/exercisesRepo'
import { summarizeSetTargets } from '../../lib/formatPerformance'
import { RECOVERY_TRACKING_LABELS, type RecoveryActivityConfig, type RecoveryRoutineTemplate } from '../../models/recovery'
import type { ExerciseConfig, RoutineTemplate } from '../../models/routine'
import type { ResolvedOccurrence } from '../../models/schedule'

interface WorkoutPreviewSheetProps {
  occurrence: ResolvedOccurrence | null
  routines: RoutineTemplate[]
  recoveryRoutines: RecoveryRoutineTemplate[]
  /** Shown as the sheet's primary action; omitted when the occurrence can't be started. */
  onStart?: () => void
  startLabel?: string
  onClose: () => void
}

/** Read-only look at a scheduled day's routine — exercises, sets and targets —
 *  without creating a session or starting any timers. */
export function WorkoutPreviewSheet({ occurrence, routines, recoveryRoutines, onStart, startLabel = 'Start', onClose }: WorkoutPreviewSheetProps) {
  const exercises = useLiveQuery(getAllExercises, [], [])
  const exerciseName = (id: string) => exercises?.find((e) => e.id === id)?.name ?? 'Exercise'

  if (!occurrence) return null
  const { assignment } = occurrence
  const routine = assignment.kind === 'workout' ? routines.find((r) => r.id === assignment.routineTemplateId) : undefined
  const recovery = assignment.kind === 'recovery' ? recoveryRoutines.find((r) => r.id === assignment.routineTemplateId) : undefined
  const title = routine?.name ?? recovery?.name ?? (assignment.kind === 'rest' ? 'Full Rest Day' : 'Workout')

  const renderExercises = (label: string, configs: ExerciseConfig[]) => {
    if (configs.length === 0) return null
    return (
      <section className="mb-4">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-primary-muted">{label}</h3>
        <ol className="flex flex-col gap-2">
          {[...configs]
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((c) => (
              <li key={c.id} className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2">
                <p className="text-sm font-semibold text-primary-strong">{exerciseName(c.exerciseId)}</p>
                {summarizeSetTargets(c.sets).map((line, i) => (
                  <p key={i} className="text-sm text-primary-muted">
                    {line}
                  </p>
                ))}
                {c.restSeconds !== undefined && <p className="text-xs text-primary-muted">Rest {c.restSeconds}s</p>}
                {c.notes && <p className="mt-1 text-xs text-primary-muted">{c.notes}</p>}
              </li>
            ))}
        </ol>
      </section>
    )
  }

  return (
    <Sheet open={!!occurrence} onClose={onClose} title={title}>
      {routine ? (
        <>
          {routine.description && <p className="mb-4 text-sm text-primary-muted">{routine.description}</p>}
          {routine.warmup.enabled && renderExercises('Warm-up', routine.warmup.exercises)}
          {renderExercises('Workout', routine.main)}
          {routine.finisher.enabled && renderExercises('Finisher', routine.finisher.exercises)}
          {routine.cooldown.enabled && renderExercises('Cool-down', routine.cooldown.exercises)}
          {routine.notes && <p className="mb-4 text-sm text-primary-muted">{routine.notes}</p>}
        </>
      ) : recovery ? (
        <>
          {recovery.description && <p className="mb-2 text-sm text-primary-muted">{recovery.description}</p>}
          {recovery.instructions && <p className="mb-4 text-sm text-primary-muted">{recovery.instructions}</p>}
          <ol className="mb-4 flex flex-col gap-2">
            {[...recovery.activities]
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((a) => (
                <li key={a.id} className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2">
                  <p className="text-sm font-semibold text-primary-strong">{a.exerciseId ? exerciseName(a.exerciseId) : a.name}</p>
                  <p className="text-sm text-primary-muted">{recoveryTarget(a)}</p>
                </li>
              ))}
          </ol>
        </>
      ) : (
        <p className="mb-4 text-sm text-primary-muted">
          {assignment.kind === 'rest' ? 'Nothing to do today, just rest.' : "This routine couldn't be found."}
        </p>
      )}
      {onStart && (routine || recovery) && (
        <Button fullWidth icon={<IconPlay width={18} height={18} />} onClick={onStart}>
          {startLabel}
        </Button>
      )}
    </Sheet>
  )
}

function recoveryTarget(a: RecoveryActivityConfig): string {
  if (a.targetDurationSeconds) return `${Math.round(a.targetDurationSeconds / 60)} min`
  if (a.targetDistanceMeters) return `${a.targetDistanceMeters} m`
  if (a.targetSteps) return `${a.targetSteps} steps`
  if (a.targetReps) return `${a.targetReps} reps`
  if (a.targetSleepMinutes) return `${Math.floor(a.targetSleepMinutes / 60)}h ${a.targetSleepMinutes % 60}m sleep`
  if (a.targetBedtimeLocal) return `Bed by ${a.targetBedtimeLocal}`
  if (a.targetWaterMl) return `${a.targetWaterMl} ml water`
  return RECOVERY_TRACKING_LABELS[a.trackingType]
}
