import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { RoutineSectionEditor } from './RoutineSectionEditor'
import { getRoutine, saveRoutine } from '../../db/routinesRepo'
import { createEmptySection, type ExerciseConfig, type RoutineSection, type RoutineTemplate } from '../../models/routine'

export function RoutineEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [routine, setRoutine] = useState<RoutineTemplate | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) {
      const now = new Date().toISOString()
      setRoutine({
        id: crypto.randomUUID(),
        type: 'workout',
        name: '',
        description: '',
        notes: '',
        warmup: createEmptySection(),
        main: [],
        cooldown: createEmptySection(),
        defaultRestSeconds: 60,
        archived: false,
        createdAt: now,
        updatedAt: now,
      })
      return
    }
    getRoutine(id!).then((r) => {
      setRoutine(r ?? null)
      setLoading(false)
    })
  }, [id, isNew])

  async function handleSave() {
    if (!routine) return
    if (!routine.name.trim()) {
      setError('Please name your routine.')
      return
    }
    if (routine.main.length === 0) {
      setError('Add at least one exercise to the main workout.')
      return
    }
    await saveRoutine(routine)
    navigate(`/routines`)
  }

  if (loading) return <div className="p-6 text-sm text-primary-muted">Loading…</div>
  if (!routine) return <div className="p-6 text-sm text-danger">Routine not found.</div>

  function setSection(key: 'warmup' | 'cooldown', section: RoutineSection) {
    setRoutine((r) => (r ? { ...r, [key]: section } : r))
  }

  function setMain(main: ExerciseConfig[]) {
    setRoutine((r) => (r ? { ...r, main } : r))
  }

  return (
    <div className="p-4 pb-28 sm:p-6">
      <PageHeader title={isNew ? 'New Routine' : 'Edit Routine'} />

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-primary-strong">Name</span>
          <input
            className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
            value={routine.name}
            onChange={(e) => setRoutine({ ...routine, name: e.target.value })}
            placeholder="e.g. Push Day"
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

        <div className="rounded-[var(--radius-card)] border border-primary-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-primary-strong">
            <input
              type="checkbox"
              checked={routine.warmup.enabled}
              onChange={(e) => setSection('warmup', { ...routine.warmup, enabled: e.target.checked })}
            />
            Include a warm-up section
          </label>
          {routine.warmup.enabled && (
            <div className="mt-3">
              <RoutineSectionEditor
                title="Warm-up"
                exercises={routine.warmup.exercises}
                onChange={(exercises) => setSection('warmup', { ...routine.warmup, exercises })}
                emptyHint="Add stretches, mobility drills, or light cardio to prepare for the workout."
              />
            </div>
          )}
        </div>

        <RoutineSectionEditor
          title="Main workout"
          exercises={routine.main}
          onChange={setMain}
          emptyHint="Add exercises to build your workout."
        />

        <div className="rounded-[var(--radius-card)] border border-primary-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-primary-strong">
            <input
              type="checkbox"
              checked={routine.cooldown.enabled}
              onChange={(e) => setSection('cooldown', { ...routine.cooldown, enabled: e.target.checked })}
            />
            Include a cool-down section
          </label>
          {routine.cooldown.enabled && (
            <div className="mt-3">
              <RoutineSectionEditor
                title="Cool-down"
                exercises={routine.cooldown.exercises}
                onChange={(exercises) => setSection('cooldown', { ...routine.cooldown, exercises })}
                emptyHint="Add stretches or breathing work to wind down."
              />
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-primary-strong">General workout notes (optional)</span>
          <textarea
            className="min-h-16 rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
            value={routine.notes ?? ''}
            onChange={(e) => setRoutine({ ...routine, notes: e.target.value })}
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-primary-border bg-surface p-3 sm:static sm:mt-6 sm:border-none sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-3xl gap-3">
          <Button variant="ghost" fullWidth onClick={() => navigate('/routines')}>
            Cancel
          </Button>
          <Button fullWidth onClick={handleSave}>
            Save routine
          </Button>
        </div>
      </div>
    </div>
  )
}
