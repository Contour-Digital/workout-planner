import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { IconPlus } from '../../components/ui/icons'
import { RecoveryActivityRow } from './RecoveryActivityRow'
import { getRecoveryRoutine, saveRecoveryRoutine } from '../../db/routinesRepo'
import { createRecoveryActivityConfig, type RecoveryActivityConfig, type RecoveryRoutineTemplate } from '../../models/recovery'

export function RecoveryRoutineEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [routine, setRoutine] = useState<RecoveryRoutineTemplate | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) {
      const now = new Date().toISOString()
      setRoutine({
        id: crypto.randomUUID(),
        type: 'recovery',
        name: '',
        description: '',
        instructions: '',
        activities: [],
        archived: false,
        createdAt: now,
        updatedAt: now,
      })
      return
    }
    getRecoveryRoutine(id!).then((r) => {
      setRoutine(r ?? null)
      setLoading(false)
    })
  }, [id, isNew])

  async function handleSave() {
    if (!routine) return
    if (!routine.name.trim()) {
      setError('Please name your recovery routine.')
      return
    }
    if (routine.activities.length === 0) {
      setError('Add at least one activity.')
      return
    }
    await saveRecoveryRoutine(routine)
    navigate('/routines?tab=recovery')
  }

  if (loading) return <div className="p-6 text-sm text-primary-muted">Loading…</div>
  if (!routine) return <div className="p-6 text-sm text-danger">Recovery routine not found.</div>

  function addActivity() {
    setRoutine((r) => (r ? { ...r, activities: [...r.activities, createRecoveryActivityConfig(r.activities.length)] } : r))
  }
  function updateActivity(i: number, activity: RecoveryActivityConfig) {
    setRoutine((r) => (r ? { ...r, activities: r.activities.map((a, idx) => (idx === i ? activity : a)) } : r))
  }
  function removeActivity(i: number) {
    setRoutine((r) => (r ? { ...r, activities: r.activities.filter((_, idx) => idx !== i) } : r))
  }
  function moveActivity(i: number, dir: -1 | 1) {
    setRoutine((r) => {
      if (!r) return r
      const target = i + dir
      if (target < 0 || target >= r.activities.length) return r
      const copy = [...r.activities]
      ;[copy[i], copy[target]] = [copy[target], copy[i]]
      return { ...r, activities: copy.map((a, idx) => ({ ...a, orderIndex: idx })) }
    })
  }

  return (
    <div className="p-4 pb-28 sm:p-6">
      <PageHeader title={isNew ? 'New Recovery Routine' : 'Edit Recovery Routine'} />

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-primary-strong">Name</span>
          <input
            className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
            value={routine.name}
            onChange={(e) => setRoutine({ ...routine, name: e.target.value })}
            placeholder="e.g. Active Recovery Day"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-primary-strong">Description (optional)</span>
          <textarea
            className="min-h-16 rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
            value={routine.description ?? ''}
            onChange={(e) => setRoutine({ ...routine, description: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-primary-strong">Instructions (optional)</span>
          <textarea
            className="min-h-16 rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
            value={routine.instructions ?? ''}
            onChange={(e) => setRoutine({ ...routine, instructions: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-primary-strong">Estimated duration (minutes, optional)</span>
          <input
            type="number"
            className="w-32 rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm"
            value={routine.estimatedDurationMinutes ?? ''}
            onChange={(e) =>
              setRoutine({ ...routine, estimatedDurationMinutes: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          />
        </label>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-primary-strong">Activities</h3>
          <Button size="sm" variant="secondary" icon={<IconPlus width={16} height={16} />} onClick={addActivity}>
            Add activity
          </Button>
        </div>

        {routine.activities.length === 0 ? (
          <p className="rounded-[var(--radius-control)] border border-dashed border-primary-border p-4 text-center text-sm text-primary-muted">
            Add stretching, walking, hydration, sleep, or other recovery activities.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {routine.activities.map((activity, i) => (
              <RecoveryActivityRow
                key={activity.id}
                activity={activity}
                onChange={(a) => updateActivity(i, a)}
                onRemove={() => removeActivity(i)}
                onMoveUp={i > 0 ? () => moveActivity(i, -1) : undefined}
                onMoveDown={i < routine.activities.length - 1 ? () => moveActivity(i, 1) : undefined}
              />
            ))}
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-primary-border bg-surface p-3 sm:static sm:mt-6 sm:border-none sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-3xl gap-3">
          <Button variant="ghost" fullWidth onClick={() => navigate('/routines')}>
            Cancel
          </Button>
          <Button fullWidth onClick={handleSave}>
            Save recovery routine
          </Button>
        </div>
      </div>
    </div>
  )
}
