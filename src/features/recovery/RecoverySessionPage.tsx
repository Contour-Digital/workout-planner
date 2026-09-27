import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { IconX } from '../../components/ui/icons'
import { RecoveryActivityCard } from './RecoveryActivityCard'
import { deleteRecoverySession, getRecoverySession } from '../../db/sessionsRepo'
import { closeRecoverySession, updateRecoveryActivity, updateRecoverySessionNotes } from '../../db/sessionActions'

export function RecoverySessionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useLiveQuery(() => (id ? getRecoverySession(id) : undefined), [id])
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

  if (!session) return <div className="p-6 text-sm text-primary-muted">Loading…</div>

  const done = session.activities.filter((a) => a.status === 'completed').length
  const total = session.activities.length

  return (
    <div className="p-4 pb-[calc(var(--bottom-nav-height)+6rem)] sm:p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-primary-strong">{session.name}</h1>
        <Button variant="ghost" size="sm" icon={<IconX width={16} height={16} />} onClick={() => setCancelConfirmOpen(true)} className="text-danger">
          Cancel
        </Button>
      </div>
      <p className="mb-4 text-sm text-primary-muted">
        Recovery sessions can stay open — come back any time today to finish activities like your sleep goal.
      </p>

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-sm font-medium text-primary">
          <span>
            {done} of {total} activities completed
          </span>
        </div>
        <ProgressBar value={total > 0 ? done / total : 0} color="recovery" />
      </div>

      <div className="flex flex-col gap-3">
        {session.activities.map((activity) => (
          <RecoveryActivityCard
            key={activity.id}
            activity={activity}
            onChange={(patch) => updateRecoveryActivity(session.id, activity.id, patch)}
          />
        ))}
      </div>

      <label className="mt-5 flex flex-col gap-1">
        <span className="text-sm font-medium text-primary-strong">Session notes</span>
        <textarea
          className="min-h-16 rounded-[var(--radius-control)] border border-primary-border px-3 py-2 text-sm"
          defaultValue={session.notes ?? ''}
          onBlur={(e) => updateRecoverySessionNotes(session.id, e.target.value)}
        />
      </label>

      <div className="fixed inset-x-0 bottom-[var(--bottom-nav-height)] z-20 border-t border-primary-border bg-surface p-3 sm:static sm:mt-6 sm:border-none sm:bg-transparent sm:p-0">
        <Button
          fullWidth
          size="lg"
          onClick={async () => {
            await closeRecoverySession(session.id)
            navigate(`/history/${session.id}`, { replace: true })
          }}
        >
          Close recovery session
        </Button>
      </div>

      <ConfirmDialog
        open={cancelConfirmOpen}
        title="Cancel this recovery session?"
        description="This session and anything logged so far will be deleted — it won't be saved to history. This can't be undone."
        confirmLabel="Cancel session"
        danger
        onCancel={() => setCancelConfirmOpen(false)}
        onConfirm={async () => {
          setCancelConfirmOpen(false)
          await deleteRecoverySession(session.id)
          navigate('/', { replace: true })
        }}
      />
    </div>
  )
}
