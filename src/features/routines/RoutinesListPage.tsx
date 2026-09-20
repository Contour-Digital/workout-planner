import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { IconArchive, IconCopy, IconDumbbell, IconEdit, IconLeaf, IconPlay, IconPlus, IconTrash } from '../../components/ui/icons'
import { db } from '../../db/db'
import {
  archiveRecoveryRoutine,
  archiveRoutine,
  deleteRecoveryRoutine,
  deleteRoutine,
  duplicateRecoveryRoutine,
  duplicateRoutine,
} from '../../db/routinesRepo'
import type { RoutineTemplate } from '../../models/routine'
import type { RecoveryRoutineTemplate } from '../../models/recovery'

type Tab = 'workout' | 'recovery'

export function RoutinesListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: Tab = searchParams.get('tab') === 'recovery' ? 'recovery' : 'workout'
  const [showArchived, setShowArchived] = useState(false)
  const [deletingRoutine, setDeletingRoutine] = useState<{ id: string; name: string; kind: Tab } | null>(null)

  const routines = useLiveQuery(() => db.routines.toArray(), [], []) ?? []
  const recoveryRoutines = useLiveQuery(() => db.recoveryRoutines.toArray(), [], []) ?? []

  const visibleWorkouts = routines.filter((r) => r.archived === showArchived).sort((a, b) => a.name.localeCompare(b.name))
  const visibleRecovery = recoveryRoutines.filter((r) => r.archived === showArchived).sort((a, b) => a.name.localeCompare(b.name))

  function setTab(t: Tab) {
    setSearchParams(t === 'recovery' ? { tab: 'recovery' } : {})
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Workouts & Recovery"
        action={
          <Button
            size="sm"
            icon={<IconPlus width={18} height={18} />}
            onClick={() => navigate(tab === 'workout' ? '/routines/new' : '/recovery-routines/new')}
          >
            New
          </Button>
        }
      />

      <div className="mb-4 flex gap-2 rounded-full bg-primary-tint p-1">
        <button
          onClick={() => setTab('workout')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium ${tab === 'workout' ? 'bg-surface text-secondary shadow-sm' : 'text-primary-muted'}`}
        >
          <IconDumbbell width={16} height={16} /> Workout routines
        </button>
        <button
          onClick={() => setTab('recovery')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium ${tab === 'recovery' ? 'bg-surface text-secondary shadow-sm' : 'text-primary-muted'}`}
        >
          <IconLeaf width={16} height={16} /> Recovery routines
        </button>
      </div>

      <label className="mb-3 flex items-center gap-2 text-sm text-primary-muted">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived
      </label>

      {tab === 'workout' ? (
        visibleWorkouts.length === 0 ? (
          <EmptyState
            icon={<IconDumbbell />}
            title={showArchived ? 'No archived routines' : 'No workout routines yet'}
            description={showArchived ? undefined : 'Create a reusable routine to schedule and track your training.'}
            action={
              !showArchived && (
                <Button onClick={() => navigate('/routines/new')} icon={<IconPlus width={18} height={18} />}>
                  Create routine
                </Button>
              )
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {visibleWorkouts.map((r) => (
              <WorkoutRoutineCard
                key={r.id}
                routine={r}
                onEdit={() => navigate(`/routines/${r.id}`)}
                onStart={() => navigate(`/session/start?routineId=${r.id}`)}
                onDuplicate={() => duplicateRoutine(r.id)}
                onArchiveToggle={() => archiveRoutine(r.id, !r.archived)}
                onDelete={() => setDeletingRoutine({ id: r.id, name: r.name, kind: 'workout' })}
              />
            ))}
          </div>
        )
      ) : visibleRecovery.length === 0 ? (
        <EmptyState
          icon={<IconLeaf />}
          title={showArchived ? 'No archived recovery routines' : 'No recovery routines yet'}
          description={showArchived ? undefined : 'Build reusable recovery days: stretching, walking, hydration, sleep goals.'}
          action={
            !showArchived && (
              <Button onClick={() => navigate('/recovery-routines/new')} icon={<IconPlus width={18} height={18} />}>
                Create recovery routine
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visibleRecovery.map((r) => (
            <RecoveryRoutineCard
              key={r.id}
              routine={r}
              onEdit={() => navigate(`/recovery-routines/${r.id}`)}
              onStart={() => navigate(`/recovery-session/start?routineId=${r.id}`)}
              onDuplicate={() => duplicateRecoveryRoutine(r.id)}
              onArchiveToggle={() => archiveRecoveryRoutine(r.id, !r.archived)}
              onDelete={() => setDeletingRoutine({ id: r.id, name: r.name, kind: 'recovery' })}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deletingRoutine}
        title="Delete routine?"
        description={`"${deletingRoutine?.name}" will be permanently deleted. Past workout history is kept, but the template can't be recovered. Consider archiving instead.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeletingRoutine(null)}
        onConfirm={async () => {
          if (deletingRoutine?.kind === 'workout') await deleteRoutine(deletingRoutine.id)
          if (deletingRoutine?.kind === 'recovery') await deleteRecoveryRoutine(deletingRoutine.id)
          setDeletingRoutine(null)
        }}
      />
    </div>
  )
}

function RoutineActions({
  onEdit,
  onStart,
  onDuplicate,
  onArchiveToggle,
  onDelete,
  archived,
}: {
  onEdit: () => void
  onStart: () => void
  onDuplicate: () => void
  onArchiveToggle: () => void
  onDelete: () => void
  archived: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {!archived && (
        <Button size="sm" icon={<IconPlay width={16} height={16} />} onClick={onStart}>
          Start
        </Button>
      )}
      <Button size="sm" variant="secondary" icon={<IconEdit width={16} height={16} />} onClick={onEdit}>
        Edit
      </Button>
      <Button size="sm" variant="ghost" icon={<IconCopy width={16} height={16} />} onClick={onDuplicate}>
        Duplicate
      </Button>
      <Button size="sm" variant="ghost" icon={<IconArchive width={16} height={16} />} onClick={onArchiveToggle}>
        {archived ? 'Unarchive' : 'Archive'}
      </Button>
      <Button size="sm" variant="ghost" icon={<IconTrash width={16} height={16} />} onClick={onDelete}>
        Delete
      </Button>
    </div>
  )
}

function WorkoutRoutineCard({
  routine,
  onEdit,
  onStart,
  onDuplicate,
  onArchiveToggle,
  onDelete,
}: {
  routine: RoutineTemplate
  onEdit: () => void
  onStart: () => void
  onDuplicate: () => void
  onArchiveToggle: () => void
  onDelete: () => void
}) {
  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-primary-strong">{routine.name}</h3>
          {routine.description && <p className="text-sm text-primary-muted">{routine.description}</p>}
        </div>
        {routine.archived && <Badge tone="neutral">Archived</Badge>}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5 text-xs text-primary-muted">
        <Badge tone="secondary">{routine.main.length} exercises</Badge>
        {routine.warmup.enabled && <Badge tone="neutral">Warm-up</Badge>}
        {routine.cooldown.enabled && <Badge tone="neutral">Cool-down</Badge>}
      </div>
      <RoutineActions
        onEdit={onEdit}
        onStart={onStart}
        onDuplicate={onDuplicate}
        onArchiveToggle={onArchiveToggle}
        onDelete={onDelete}
        archived={routine.archived}
      />
    </Card>
  )
}

function RecoveryRoutineCard({
  routine,
  onEdit,
  onStart,
  onDuplicate,
  onArchiveToggle,
  onDelete,
}: {
  routine: RecoveryRoutineTemplate
  onEdit: () => void
  onStart: () => void
  onDuplicate: () => void
  onArchiveToggle: () => void
  onDelete: () => void
}) {
  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-primary-strong">{routine.name}</h3>
          {routine.description && <p className="text-sm text-primary-muted">{routine.description}</p>}
        </div>
        {routine.archived && <Badge tone="neutral">Archived</Badge>}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        <Badge tone="recovery">{routine.activities.length} activities</Badge>
        {routine.estimatedDurationMinutes && <Badge tone="neutral">{routine.estimatedDurationMinutes} min</Badge>}
      </div>
      <RoutineActions
        onEdit={onEdit}
        onStart={onStart}
        onDuplicate={onDuplicate}
        onArchiveToggle={onArchiveToggle}
        onDelete={onDelete}
        archived={routine.archived}
      />
    </Card>
  )
}
