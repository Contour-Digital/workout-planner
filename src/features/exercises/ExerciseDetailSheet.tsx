import { Sheet } from '../../components/ui/Sheet'
import { Badge } from '../../components/ui/Badge'
import { MuscleDiagram } from '../../components/ui/MuscleDiagram'
import { Button } from '../../components/ui/Button'
import { ExerciseMediaThumb } from '../../components/ui/ExerciseMedia'
import { IconEdit, IconRepeat, IconTrash } from '../../components/ui/icons'
import {
  EQUIPMENT_LABELS,
  EXERCISE_CATEGORY_LABELS,
  MUSCLE_GROUP_LABELS,
  SPECIFIC_MUSCLE_LABELS,
  type Exercise,
  type MuscleGroup,
  type SpecificMuscle,
} from '../../models/exercise'

/** e.g. "Back (Lats)" — the broad group(s), plus finer detail in parens when known. */
function formatMuscles(groups: MuscleGroup[], specifics: SpecificMuscle[] | undefined): string {
  const groupLabels = groups.map((m) => MUSCLE_GROUP_LABELS[m]).join(', ')
  if (!specifics || specifics.length === 0) return groupLabels || '—'
  const specificLabels = specifics.map((m) => SPECIFIC_MUSCLE_LABELS[m]).join(', ')
  return `${groupLabels} (${specificLabels})`
}

interface ExerciseDetailSheetProps {
  exercise: Exercise | null
  onClose: () => void
  onEdit?: (exercise: Exercise) => void
  onDelete?: (exercise: Exercise) => void
  /** The best-matching swap-in for `exercise`, by shared muscles — pass alongside
   *  `onSwap` to show a "Swap for a similar exercise" prompt at the bottom of the
   *  sheet. Omit (or pass null/undefined) where a swap doesn't make sense, e.g.
   *  browsing the library outside of a routine. */
  similarExercise?: Exercise | null
  onSwap?: (replacement: Exercise) => void
}

/** Reusable exercise detail view — used both from the routine builder and mid-active-workout,
 *  as a sheet layered over whatever screen is open so in-progress state is never lost. */
export function ExerciseDetailSheet({ exercise, onClose, onEdit, onDelete, similarExercise, onSwap }: ExerciseDetailSheetProps) {
  return (
    <Sheet open={!!exercise} onClose={onClose} title={exercise?.name ?? ''}>
      {exercise && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="secondary">{EXERCISE_CATEGORY_LABELS[exercise.category]}</Badge>
            {exercise.source === 'custom' && <Badge tone="neutral">Custom</Badge>}
          </div>

          <MuscleDiagram
            primaryMuscles={exercise.primaryMuscles}
            secondaryMuscles={exercise.secondaryMuscles}
            primarySpecificMuscles={exercise.primarySpecificMuscles}
            secondarySpecificMuscles={exercise.secondarySpecificMuscles}
          />

          <section>
            <h3 className="mb-1 text-sm font-semibold text-primary-strong">Muscles worked</h3>
            <p className="text-sm text-primary-muted">
              Primary: {formatMuscles(exercise.primaryMuscles, exercise.primarySpecificMuscles)}
            </p>
            {exercise.secondaryMuscles.length > 0 && (
              <p className="text-sm text-primary-muted">
                Secondary: {formatMuscles(exercise.secondaryMuscles, exercise.secondarySpecificMuscles)}
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-1 text-sm font-semibold text-primary-strong">Equipment</h3>
            <p className="text-sm text-primary-muted">
              {exercise.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ') || 'None'}
            </p>
          </section>

          {exercise.instructions.length > 0 && (
            <section>
              <h3 className="mb-1 text-sm font-semibold text-primary-strong">How to perform</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-primary">
                {exercise.instructions.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </section>
          )}

          {exercise.techniqueTips.length > 0 && (
            <section>
              <h3 className="mb-1 text-sm font-semibold text-primary-strong">Technique tips</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-primary">
                {exercise.techniqueTips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </section>
          )}

          {exercise.commonMistakes.length > 0 && (
            <section>
              <h3 className="mb-1 text-sm font-semibold text-primary-strong">Common mistakes</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-primary">
                {exercise.commonMistakes.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </section>
          )}

          {exercise.notes && (
            <section>
              <h3 className="mb-1 text-sm font-semibold text-primary-strong">Notes</h3>
              <p className="text-sm text-primary-muted">{exercise.notes}</p>
            </section>
          )}

          {similarExercise && onSwap && (
            <section className="rounded-[var(--radius-card)] border border-primary-border bg-surface-muted p-3">
              <h3 className="mb-2 text-sm font-semibold text-primary-strong">Swap for a similar exercise</h3>
              <div className="flex items-center gap-3">
                <ExerciseMediaThumb media={similarExercise.media} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary-strong">{similarExercise.name}</p>
                  <p className="truncate text-xs text-secondary">
                    {formatMuscles(similarExercise.primaryMuscles, similarExercise.primarySpecificMuscles)}
                  </p>
                </div>
              </div>
              <Button
                fullWidth
                variant="secondary"
                className="mt-3"
                icon={<IconRepeat width={16} height={16} />}
                onClick={() => onSwap(similarExercise)}
              >
                Swap in {similarExercise.name}
              </Button>
            </section>
          )}

          {exercise.source === 'custom' && (onEdit || onDelete) && (
            <div className="flex gap-3 border-t border-primary-border pt-4">
              {onEdit && (
                <Button variant="secondary" fullWidth icon={<IconEdit width={18} height={18} />} onClick={() => onEdit(exercise)}>
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button variant="danger" fullWidth icon={<IconTrash width={18} height={18} />} onClick={() => onDelete(exercise)}>
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
