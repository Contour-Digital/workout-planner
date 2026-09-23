import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { GenerateRoutineSheet } from './GenerateRoutineSheet'
import {
  IconArchive,
  IconCalendar,
  IconClock,
  IconCopy,
  IconDumbbell,
  IconEdit,
  IconLeaf,
  IconPlay,
  IconPlus,
  IconSparkle,
  IconTrash,
} from '../../components/ui/icons'
import { db } from '../../db/db'
import {
  archiveRecoveryRoutine,
  archiveRoutine,
  deleteRecoveryRoutine,
  deleteRoutine,
  duplicateRecoveryRoutine,
  duplicateRoutine,
} from '../../db/routinesRepo'
import { deleteSchedule, getAllSchedules } from '../../db/scheduleRepo'
import { describeSchedule } from '../../lib/scheduleDescribe'
import type { RoutineTemplate } from '../../models/routine'
import type { RecoveryRoutineTemplate } from '../../models/recovery'
import type { RecurringSchedule } from '../../models/schedule'

type Tab = 'workout' | 'recovery' | 'schedules'

export function RoutinesListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: Tab = tabParam === 'recovery' ? 'recovery' : tabParam === 'schedules' ? 'schedules' : 'workout'
  const [showArchived, setShowArchived] = useState(false)
  const [deletingRoutine, setDeletingRoutine] = useState<{ id: string; name: string; kind: 'workout' | 'recovery' } | null>(null)
  const [deletingSchedule, setDeletingSchedule] = useState<RecurringSchedule | null>(null)
  const [generateOpen, setGenerateOpen] = useState(false)

  const routines = useLiveQuery(() => db.routines.toArray(), [], []) ?? []
  const recoveryRoutines = useLiveQuery(() => db.recoveryRoutines.toArray(), [], []) ?? []
  const schedules = useLiveQuery(getAllSchedules, [], []) ?? []

  const visibleWorkouts = routines.filter((r) => r.archived === showArchived).sort((a, b) => a.name.localeCompare(b.name))
  const visibleRecovery = recoveryRoutines.filter((r) => r.archived === showArchived).sort((a, b) => a.name.localeCompare(b.name))
  const visibleSchedules = [...schedules].sort((a, b) => a.startDate.localeCompare(b.startDate))

  const routineName = useMemo(() => {
    const byId = new Map<string, string>()
    for (const r of routines) byId.set(r.id, r.name)
    for (const r of recoveryRoutines) byId.set(r.id, r.name)
    return (id: string) => byId.get(id) ?? 'Deleted routine'
  }, [routines, recoveryRoutines])

  function setTab(t: Tab) {
    setSearchParams(t === 'workout' ? {} : { tab: t })
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Workouts & Recovery"
        action={
          <div className="flex gap-2">
            {tab === 'schedules' && (
              <Button size="sm" variant="secondary" icon={<IconCalendar width={18} height={18} />} onClick={() => navigate('/calendar')}>
                Calendar
              </Button>
            )}
            {tab === 'workout' && (
              <Button size="sm" variant="secondary" icon={<IconSparkle width={18} height={18} />} onClick={() => setGenerateOpen(true)}>
                From notes
              </Button>
            )}
            <Button
              size="sm"
              icon={<IconPlus width={18} height={18} />}
              onClick={() =>
                navigate(tab === 'workout' ? '/routines/new' : tab === 'recovery' ? '/recovery-routines/new' : '/schedules/new')
              }
            >
              New
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex gap-1 rounded-full bg-primary-tint p-1">
        <button
          onClick={() => setTab('workout')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-medium sm:text-sm ${tab === 'workout' ? 'bg-surface text-secondary shadow-sm' : 'text-primary-muted'}`}
        >
          <IconDumbbell width={16} height={16} /> Workouts
        </button>
        <button
          onClick={() => setTab('recovery')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-medium sm:text-sm ${tab === 'recovery' ? 'bg-surface text-secondary shadow-sm' : 'text-primary-muted'}`}
        >
          <IconLeaf width={16} height={16} /> Recovery
        </button>
        <button
          onClick={() => setTab('schedules')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-medium sm:text-sm ${tab === 'schedules' ? 'bg-surface text-secondary shadow-sm' : 'text-primary-muted'}`}
        >
          <IconClock width={16} height={16} /> Schedules
        </button>
      </div>

      {tab !== 'schedules' && (
        <label className="mb-3 flex items-center gap-2 text-sm text-primary-muted">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      )}

      {tab === 'workout' &&
        (visibleWorkouts.length === 0 ? (
          <EmptyState
            icon={<IconDumbbell />}
            title={showArchived ? 'No archived routines' : 'No workout routines yet'}
            description={showArchived ? undefined : 'Create a reusable routine to schedule and track your training.'}
            action={
              !showArchived && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={() => navigate('/routines/new')} icon={<IconPlus width={18} height={18} />}>
                    Create routine
                  </Button>
                  <Button variant="secondary" onClick={() => setGenerateOpen(true)} icon={<IconSparkle width={18} height={18} />}>
                    Generate from notes
                  </Button>
                </div>
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
                onSchedule={() => navigate(`/schedules/new?routineId=${r.id}&kind=workout`)}
                onDuplicate={() => duplicateRoutine(r.id)}
                onArchiveToggle={() => archiveRoutine(r.id, !r.archived)}
                onDelete={() => setDeletingRoutine({ id: r.id, name: r.name, kind: 'workout' })}
              />
            ))}
          </div>
        ))}

      {tab === 'recovery' &&
        (visibleRecovery.length === 0 ? (
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
                onSchedule={() => navigate(`/schedules/new?recoveryRoutineId=${r.id}&kind=recovery`)}
                onDuplicate={() => duplicateRecoveryRoutine(r.id)}
                onArchiveToggle={() => archiveRecoveryRoutine(r.id, !r.archived)}
                onDelete={() => setDeletingRoutine({ id: r.id, name: r.name, kind: 'recovery' })}
              />
            ))}
          </div>
        ))}

      {tab === 'schedules' &&
        (visibleSchedules.length === 0 ? (
          <EmptyState
            icon={<IconClock />}
            title="No schedules yet"
            description="Schedule a routine to repeat on a custom interval, on selected weekdays, or as a one-off."
            action={
              <Button onClick={() => navigate('/schedules/new')} icon={<IconPlus width={18} height={18} />}>
                New schedule
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {visibleSchedules.map((s) => (
              <Card key={s.id}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-primary-strong">{s.name}</h3>
                  {s.endDate && <Badge tone="neutral">Ends {s.endDate}</Badge>}
                </div>
                <p className="mb-3 text-sm text-primary-muted">{describeSchedule(s, routineName)}</p>
                <p className="mb-3 text-xs text-primary-muted">Starts {s.startDate}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" icon={<IconEdit width={16} height={16} />} onClick={() => navigate(`/schedules/${s.id}`)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" icon={<IconTrash width={16} height={16} />} onClick={() => setDeletingSchedule(s)}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ))}

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

      <ConfirmDialog
        open={!!deletingSchedule}
        title="Delete this schedule?"
        description="Future occurrences will no longer appear on the dashboard. Past history is kept."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeletingSchedule(null)}
        onConfirm={async () => {
          if (deletingSchedule) await deleteSchedule(deletingSchedule.id)
          setDeletingSchedule(null)
        }}
      />

      <GenerateRoutineSheet open={generateOpen} onClose={() => setGenerateOpen(false)} />
    </div>
  )
}

function RoutineActions({
  onEdit,
  onStart,
  onSchedule,
  onDuplicate,
  onArchiveToggle,
  onDelete,
  archived,
}: {
  onEdit: () => void
  onStart: () => void
  onSchedule: () => void
  onDuplicate: () => void
  onArchiveToggle: () => void
  onDelete: () => void
  archived: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {!archived && (
        <>
          <Button size="sm" icon={<IconPlay width={16} height={16} />} onClick={onStart}>
            Start
          </Button>
          <Button size="sm" variant="secondary" icon={<IconClock width={16} height={16} />} onClick={onSchedule}>
            Schedule
          </Button>
        </>
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
  onSchedule,
  onDuplicate,
  onArchiveToggle,
  onDelete,
}: {
  routine: RoutineTemplate
  onEdit: () => void
  onStart: () => void
  onSchedule: () => void
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
        onSchedule={onSchedule}
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
  onSchedule,
  onDuplicate,
  onArchiveToggle,
  onDelete,
}: {
  routine: RecoveryRoutineTemplate
  onEdit: () => void
  onStart: () => void
  onSchedule: () => void
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
        onSchedule={onSchedule}
        onDuplicate={onDuplicate}
        onArchiveToggle={onArchiveToggle}
        onDelete={onDelete}
        archived={routine.archived}
      />
    </Card>
  )
}
