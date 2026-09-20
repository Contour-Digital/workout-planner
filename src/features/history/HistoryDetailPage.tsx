import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { db } from '../../db/db'
import { repeatWorkoutSession, saveWorkoutReview } from '../../db/sessionActions'
import { elapsedSeconds } from '../../models/session'
import { PostWorkoutReviewSheet } from '../session/PostWorkoutReviewSheet'
import type { SessionExerciseEntry, WorkoutSession } from '../../models/session'

export function HistoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [reviewOpen, setReviewOpen] = useState(false)

  const workout = useLiveQuery(() => (id ? db.workoutSessions.get(id) : undefined), [id])
  const recovery = useLiveQuery(() => (id ? db.recoverySessions.get(id) : undefined), [id])
  const rest = useLiveQuery(() => (id ? db.restDaySessions.get(id) : undefined), [id])

  if (workout) return <WorkoutDetail session={workout} onRepeat={async () => {
    const s = await repeatWorkoutSession(workout.id)
    navigate(`/session/${s.id}`)
  }} reviewOpen={reviewOpen} setReviewOpen={setReviewOpen} />

  if (recovery) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title={recovery.name} subtitle={`${recovery.scheduledDate} · Recovery`} />
        <Badge tone="recovery">{recovery.status}</Badge>
        <div className="mt-4 flex flex-col gap-2">
          {recovery.activities.map((a) => (
            <div key={a.id} className="rounded-[var(--radius-control)] border border-primary-border bg-surface p-3">
              <p className="text-sm font-semibold text-primary-strong">{a.name}</p>
              <p className="text-xs text-primary-muted">{a.status}</p>
              {a.notes && <p className="mt-1 text-sm text-primary">{a.notes}</p>}
            </div>
          ))}
        </div>
        {recovery.notes && (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-semibold text-primary-strong">Notes</h3>
            <p className="text-sm text-primary-muted">{recovery.notes}</p>
          </div>
        )}
      </div>
    )
  }

  if (rest) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title="Rest day" subtitle={rest.scheduledDate} />
        <Badge tone="rest">{rest.status}</Badge>
      </div>
    )
  }

  return <div className="p-6 text-sm text-primary-muted">Loading…</div>
}

function WorkoutDetail({
  session,
  onRepeat,
  reviewOpen,
  setReviewOpen,
}: {
  session: WorkoutSession
  onRepeat: () => void
  reviewOpen: boolean
  setReviewOpen: (v: boolean) => void
}) {
  const elapsed = elapsedSeconds(session.startedAt, session.finishedAt, session.pauseIntervals)
  const mm = Math.floor(elapsed / 60)

  function renderEntries(title: string, entries: SessionExerciseEntry[]) {
    if (entries.length === 0) return null
    return (
      <div className="mb-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-primary-muted">{title}</h3>
        <div className="flex flex-col gap-2">
          {entries.map((e) => (
            <div key={e.id} className="rounded-[var(--radius-control)] border border-primary-border bg-surface p-3">
              <p className="text-sm font-semibold text-primary-strong">{e.exerciseName}</p>
              <div className="mt-1 flex flex-col gap-0.5">
                {e.actualSets.map((s, i) => (
                  <p key={s.id} className="text-xs text-primary-muted">
                    Set {i + 1}: {s.completed ? (
                      <span className="font-medium text-primary">
                        {s.actualReps ?? '–'} reps{s.actualWeightKg ? ` × ${s.actualWeightKg}kg` : ''}
                        {s.actualDurationSeconds ? ` · ${s.actualDurationSeconds}s` : ''}
                        {s.actualDistanceMeters ? ` · ${s.actualDistanceMeters}m` : ''}
                      </span>
                    ) : (
                      'not completed'
                    )}
                  </p>
                ))}
              </div>
              {e.notes && <p className="mt-1 text-sm text-primary-muted">Note: {e.notes}</p>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title={session.name}
        subtitle={`${session.scheduledDate} · ${mm} min`}
        action={
          <Button size="sm" onClick={onRepeat}>
            Repeat workout
          </Button>
        }
      />
      <Badge tone={session.status === 'completed' ? 'success' : session.status === 'partial' ? 'warning' : 'neutral'}>{session.status}</Badge>

      <div className="mt-4">
        {renderEntries('Warm-up', session.warmup?.enabled ? session.warmup.exercises : [])}
        {renderEntries('Workout', session.main)}
        {renderEntries('Cool-down', session.cooldown?.enabled ? session.cooldown.exercises : [])}
      </div>

      {session.notes && (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-semibold text-primary-strong">Session notes</h3>
          <p className="text-sm text-primary-muted">{session.notes}</p>
        </div>
      )}

      <div className="rounded-[var(--radius-card)] border border-primary-border p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-primary-strong">Post-workout review</h3>
          <Button size="sm" variant="ghost" onClick={() => setReviewOpen(true)}>
            {session.review ? 'Edit' : 'Add'}
          </Button>
        </div>
        {session.review ? (
          <div className="flex flex-col gap-1 text-sm text-primary-muted">
            {session.review.effort && <p>Effort: {session.review.effort}/10</p>}
            {session.review.feelings && <p>Feelings: {session.review.feelings.join(', ')}</p>}
            {session.review.expectationVsActual && <p>Felt: {session.review.expectationVsActual.replace('_', ' ')}</p>}
            {session.review.comments && <p>Comments: {session.review.comments}</p>}
            {session.review.painNotes && <p className="text-warning">Pain/discomfort noted: {session.review.painNotes}</p>}
          </div>
        ) : (
          <p className="text-sm text-primary-muted">No review recorded.</p>
        )}
      </div>

      <PostWorkoutReviewSheet
        open={reviewOpen}
        existing={session.review}
        onClose={() => setReviewOpen(false)}
        onSave={async (review) => {
          await saveWorkoutReview(session.id, review)
          setReviewOpen(false)
        }}
      />
    </div>
  )
}
