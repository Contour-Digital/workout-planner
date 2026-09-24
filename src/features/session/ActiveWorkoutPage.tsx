import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '../../components/ui/Button'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Sheet } from '../../components/ui/Sheet'
import { IconClock, IconPause, IconPlay, IconPlus } from '../../components/ui/icons'
import { SessionExerciseCard } from './SessionExerciseCard'
import { RestTimerBar } from './RestTimerBar'
import { PostWorkoutReviewSheet } from './PostWorkoutReviewSheet'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { ExerciseDetailSheet } from '../exercises/ExerciseDetailSheet'
import { createExerciseConfigWithHistory, getWorkoutSession } from '../../db/sessionsRepo'
import {
  addAdHocExercise,
  addSetToEntry,
  clearRestTimer,
  finishWorkoutSession,
  pauseWorkoutSession,
  removeSessionExercise,
  removeSetFromEntry,
  resumeWorkoutSession,
  saveSessionAsRoutine,
  saveWorkoutReview,
  startRestTimer,
  updateEntryNotes,
  updateSessionNotes,
  updateSetResult,
  updateSetResultWithCascade,
} from '../../db/sessionActions'
import { elapsedSeconds, workoutSetsCompleted, type Achievement, type MissedExercise, type SessionExerciseEntry } from '../../models/session'
import { useNow } from '../../lib/useNow'
import { getAllExercises } from '../../db/exercisesRepo'
import { groupByPrimaryMuscle } from '../../lib/exerciseGrouping'
import { computeMissedExercises, computeSessionAchievements } from '../../lib/workoutReview'
import { generateWorkoutSummary } from '../../lib/workoutAiSummary'
import { AssistantChat } from '../assistant/AssistantChat'
import { resolveSuggestedExercise, type AssistantContext, type AssistantSuggestion } from '../../lib/assistantChat'
import { useSettingsStore } from '../../store/settingsStore'
import type { Exercise } from '../../models/exercise'

export function ActiveWorkoutPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useLiveQuery(() => (id ? getWorkoutSession(id) : undefined), [id])
  const exercises = useLiveQuery(getAllExercises, [], [])
  const restTimerEnabled = useSettingsStore((s) => s.settings.restTimerEnabled)
  const now = useNow(1000)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null)
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [missedExercises, setMissedExercises] = useState<MissedExercise[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [saveRoutineName, setSaveRoutineName] = useState('')
  const [saveRoutineOpen, setSaveRoutineOpen] = useState(false)

  if (!session) return <div className="p-6 text-sm text-primary-muted">Loading…</div>

  const exerciseById = new Map(exercises.map((e) => [e.id, e]))
  const isPaused = session.pauseIntervals.some((p) => !p.end)
  const elapsed = elapsedSeconds(session.startedAt, session.finishedAt, session.pauseIntervals)
  void now // force re-render each tick while active
  const { done, total } = workoutSetsCompleted(session)
  const hh = Math.floor(elapsed / 3600)
  const mm = Math.floor((elapsed % 3600) / 60)
  const ss = elapsed % 60
  const timeLabel = hh > 0 ? `${hh}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}` : `${mm}:${ss.toString().padStart(2, '0')}`

  async function openReview() {
    setMissedExercises(computeMissedExercises(session!))
    setAchievements(await computeSessionAchievements(session!))
    setReviewOpen(true)
  }

  async function handleFinishRequest() {
    if (done < total) {
      setFinishConfirmOpen(true)
      return
    }
    await finishWorkoutSession(session!.id)
    await openReview()
  }

  async function confirmPartialFinish() {
    setFinishConfirmOpen(false)
    await finishWorkoutSession(session!.id)
    await openReview()
  }

  function renderEntry(entry: SessionExerciseEntry, section: 'warmup' | 'main' | 'cooldown') {
    return (
      <SessionExerciseCard
        key={entry.id}
        entry={entry}
        sessionId={session!.id}
        onToggleSet={(setId, patch) => updateSetResult(session!.id, entry.id, setId, patch)}
        onFieldChange={(setId, patch) => updateSetResultWithCascade(session!.id, entry.id, setId, patch)}
        onAddSet={() => addSetToEntry(session!.id, entry.id)}
        onRemoveSet={(setId) => removeSetFromEntry(session!.id, entry.id, setId)}
        onNotesChange={(notes) => updateEntryNotes(session!.id, entry.id, notes)}
        onRemoveExercise={() => removeSessionExercise(session!.id, entry.id, section)}
        onSetCompleted={(restSeconds) => {
          if (restTimerEnabled && restSeconds && restSeconds > 0) startRestTimer(session!.id, restSeconds)
        }}
        onViewDetail={setDetailExercise}
      />
    )
  }

  function renderSection(title: string, sectionExercises: SessionExerciseEntry[], section: 'warmup' | 'main' | 'cooldown') {
    if (sectionExercises.length === 0) return null

    // Group only the main workout section by muscle — carried over from how the
    // routine was set up, so training stays organized (chest, back, core, ...)
    // the same way while you're actually doing it.
    if (section === 'main') {
      const groups = groupByPrimaryMuscle(sectionExercises, exerciseById)
      return (
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-primary-muted">{title}</h2>
          {groups.map((group) => (
            <div key={group.muscle} className="flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-primary-muted/70">{group.label}</h3>
              {group.items.map((entry) => renderEntry(entry, section))}
            </div>
          ))}
        </section>
      )
    }

    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-primary-muted">{title}</h2>
        {sectionExercises.map((entry) => renderEntry(entry, section))}
      </section>
    )
  }

  function buildAssistantContext(): AssistantContext {
    return {
      kind: 'session',
      routineName: session!.name,
      elapsedMinutes: Math.floor(elapsedSeconds(session!.startedAt, session!.finishedAt, session!.pauseIntervals) / 60),
      warmup: (session!.warmup?.enabled ? session!.warmup.exercises : []).map((e) => e.exerciseName),
      main: session!.main.map((e) => ({ name: e.exerciseName, setsDone: e.actualSets.filter((s) => s.completed).length, setsTotal: e.actualSets.length })),
      cooldown: (session!.cooldown?.enabled ? session!.cooldown.exercises : []).map((e) => e.exerciseName),
    }
  }

  async function handleAddSuggestion(suggestion: AssistantSuggestion) {
    const { exercise } = await resolveSuggestedExercise(suggestion, exercises)
    const config = await createExerciseConfigWithHistory(exercise.id, session!.main.length)
    await addAdHocExercise(session!.id, exercise.id, config.sets, config.restSeconds)
  }

  return (
    <div className="p-4 pb-44 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary-strong">{session.name}</h1>
          <p className="flex items-center gap-1.5 text-sm text-primary-muted">
            <IconClock width={16} height={16} />
            <span className="tabular-nums">{timeLabel}</span>
            {isPaused && <span className="font-medium text-warning">· Paused</span>}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={isPaused ? <IconPlay width={16} height={16} /> : <IconPause width={16} height={16} />}
          onClick={() => (isPaused ? resumeWorkoutSession(session.id) : pauseWorkoutSession(session.id))}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </Button>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-sm font-medium text-primary">
          <span>
            {done} of {total} sets completed
          </span>
          <span>{total > 0 ? Math.round((done / total) * 100) : 0}%</span>
        </div>
        <ProgressBar value={total > 0 ? done / total : 0} />
      </div>

      {session.restTimerEndsAt && (
        <RestTimerBar
          endsAt={session.restTimerEndsAt}
          onCancel={() => clearRestTimer(session.id)}
          onComplete={() => clearRestTimer(session.id)}
        />
      )}

      <div className="flex flex-col gap-5">
        {renderSection('Warm-up', session.warmup?.enabled ? session.warmup.exercises : [], 'warmup')}
        {renderSection('Workout', session.main, 'main')}
        {renderSection('Cool-down', session.cooldown?.enabled ? session.cooldown.exercises : [], 'cooldown')}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" icon={<IconPlus width={18} height={18} />} onClick={() => setPickerOpen(true)}>
          Add exercise to this session
        </Button>
        {session.origin === 'impromptu' && session.main.length > 0 && (
          <Button variant="ghost" onClick={() => { setSaveRoutineName(session.name); setSaveRoutineOpen(true) }}>
            Save as reusable routine
          </Button>
        )}
      </div>

      <label className="mt-5 flex flex-col gap-1">
        <span className="text-sm font-medium text-primary-strong">Session notes</span>
        <textarea
          className="min-h-16 rounded-[var(--radius-control)] border border-primary-border px-3 py-2 text-sm"
          defaultValue={session.notes ?? ''}
          onBlur={(e) => updateSessionNotes(session.id, e.target.value)}
        />
      </label>

      <div className="fixed inset-x-0 bottom-20 z-20 flex flex-col gap-2 border-t border-primary-border bg-surface p-3 sm:static sm:mt-6 sm:border-none sm:bg-transparent sm:p-0">
        <AssistantChat
          storageKey={`session:${session.id}`}
          buildContext={buildAssistantContext}
          onAddSuggestion={handleAddSuggestion}
          className="w-full"
        />
        <Button fullWidth size="lg" onClick={handleFinishRequest}>
          Finish Workout
        </Button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={async (exercise) => {
          const config = await createExerciseConfigWithHistory(exercise.id, session.main.length)
          await addAdHocExercise(session.id, exercise.id, config.sets, config.restSeconds)
          setPickerOpen(false)
        }}
      />
      <ExerciseDetailSheet exercise={detailExercise} onClose={() => setDetailExercise(null)} />

      <ConfirmDialog
        open={finishConfirmOpen}
        title="Some sets aren't complete"
        description={`You've completed ${done} of ${total} sets. You can go back and finish them, or save this as a partially completed workout.`}
        confirmLabel="Finish as partial"
        onCancel={() => setFinishConfirmOpen(false)}
        onConfirm={confirmPartialFinish}
      />

      <PostWorkoutReviewSheet
        open={reviewOpen}
        missedExercises={missedExercises}
        achievements={achievements}
        onGenerateAiSummary={() => generateWorkoutSummary(session, missedExercises, achievements)}
        onSave={async (review) => {
          await saveWorkoutReview(session.id, review)
          setReviewOpen(false)
          navigate(`/history/${session.id}`, { replace: true })
        }}
        onClose={() => navigate(`/history/${session.id}`, { replace: true })}
      />

      <Sheet open={saveRoutineOpen} onClose={() => setSaveRoutineOpen(false)} title="Save as reusable routine">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Routine name</span>
            <input
              className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm"
              value={saveRoutineName}
              onChange={(e) => setSaveRoutineName(e.target.value)}
            />
          </label>
          <Button
            fullWidth
            onClick={async () => {
              await saveSessionAsRoutine(session.id, saveRoutineName.trim() || session.name)
              setSaveRoutineOpen(false)
            }}
          >
            Save routine
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
