import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { IconSparkle } from '../../components/ui/icons'
import { RoutineSectionEditor } from './RoutineSectionEditor'
import { AssistantChat } from '../assistant/AssistantChat'
import { getAllExercises } from '../../db/exercisesRepo'
import { getRoutine, saveRoutine } from '../../db/routinesRepo'
import { createExerciseConfig, createEmptySection, type ExerciseConfig, type RoutineSection, type RoutineTemplate } from '../../models/routine'
import { resolveSuggestedExercise, type AssistantContext, type AssistantSuggestion } from '../../lib/assistantChat'
import type { GeneratedRoutineResult } from '../../lib/aiRoutineGenerator'

export function RoutineEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isNew = !id || id === 'new'
  const aiDraft = isNew ? (location.state as { draft?: RoutineTemplate; aiSummary?: GeneratedRoutineResult } | null) : null

  const [routine, setRoutine] = useState<RoutineTemplate | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [error, setError] = useState<string | null>(null)
  const library = useLiveQuery(getAllExercises, [], [])

  useEffect(() => {
    if (isNew) {
      if (aiDraft?.draft) {
        setRoutine(aiDraft.draft)
        return
      }
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

  const exerciseById = new Map(library.map((e) => [e.id, e]))
  const exerciseName = (exerciseId: string) => exerciseById.get(exerciseId)?.name ?? 'Unknown exercise'

  function buildAssistantContext(): AssistantContext {
    return {
      kind: 'routine',
      routineName: routine!.name,
      warmup: routine!.warmup.exercises.map((c) => exerciseName(c.exerciseId)),
      main: routine!.main.map((c) => exerciseName(c.exerciseId)),
      cooldown: routine!.cooldown.exercises.map((c) => exerciseName(c.exerciseId)),
    }
  }

  async function handleAddSuggestion(suggestion: AssistantSuggestion) {
    const { exercise } = await resolveSuggestedExercise(suggestion, library)
    setRoutine((r) => {
      if (!r) return r
      if (suggestion.section === 'warmup') {
        const exercises = [...r.warmup.exercises, createExerciseConfig(exercise.id, r.warmup.exercises.length)]
        return { ...r, warmup: { enabled: true, exercises } }
      }
      if (suggestion.section === 'cooldown') {
        const exercises = [...r.cooldown.exercises, createExerciseConfig(exercise.id, r.cooldown.exercises.length)]
        return { ...r, cooldown: { enabled: true, exercises } }
      }
      return { ...r, main: [...r.main, createExerciseConfig(exercise.id, r.main.length)] }
    })
  }

  return (
    <div className="p-4 pb-32 sm:p-6">
      <PageHeader title={isNew ? 'New Routine' : 'Edit Routine'} />

      {aiDraft?.aiSummary && (
        <div className="mb-4 rounded-[var(--radius-card)] border border-secondary/40 bg-secondary-tint p-3">
          <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-secondary">
            <IconSparkle width={16} height={16} />
            Generated from your notes
          </div>
          <p className="text-xs text-primary-muted">
            Matched {aiDraft.aiSummary.matchedCount} exercise{aiDraft.aiSummary.matchedCount === 1 ? '' : 's'} to your library.
            {aiDraft.aiSummary.createdExerciseNames.length > 0 && (
              <>
                {' '}
                Created {aiDraft.aiSummary.createdExerciseNames.length} new custom exercise
                {aiDraft.aiSummary.createdExerciseNames.length === 1 ? '' : 's'}:{' '}
                {aiDraft.aiSummary.createdExerciseNames.join(', ')}.
              </>
            )}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone="secondary">Review everything below, then save</Badge>
          </div>
        </div>
      )}

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
          groupByMuscle
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

      <div className="fixed inset-x-0 bottom-20 z-20 border-t border-primary-border bg-surface p-3 sm:static sm:mt-6 sm:border-none sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-3xl gap-3">
          <Button variant="ghost" fullWidth onClick={() => navigate('/routines')}>
            Cancel
          </Button>
          <Button fullWidth onClick={handleSave}>
            Save routine
          </Button>
        </div>
      </div>

      <AssistantChat
        storageKey={`routine:${routine.id}`}
        buildContext={buildAssistantContext}
        onAddSuggestion={handleAddSuggestion}
        fabClassName="bottom-44 right-4 sm:bottom-6"
      />
    </div>
  )
}
