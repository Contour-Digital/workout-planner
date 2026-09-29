import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '../../components/ui/Button'
import { SegmentedProgressBar, type ProgressSegment } from '../../components/ui/ProgressBar'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Sheet } from '../../components/ui/Sheet'
import { IconChevronDown, IconClock, IconPause, IconPlay, IconPlus, IconX } from '../../components/ui/icons'
import { SessionExerciseCard } from './SessionExerciseCard'
import { RestTimerBar } from './RestTimerBar'
import { PostWorkoutReviewSheet } from './PostWorkoutReviewSheet'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { ExerciseDetailSheet } from '../exercises/ExerciseDetailSheet'
import { createExerciseConfigWithHistory, deleteWorkoutSession, getWorkoutSession } from '../../db/sessionsRepo'
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
import { addSuggestionToRoutine } from '../../lib/addSuggestionToRoutine'
import { AssistantChat } from '../assistant/AssistantChat'
import { resolveSuggestedExercise, type AssistantContext, type AssistantSuggestion } from '../../lib/assistantChat'
import { useSettingsStore } from '../../store/settingsStore'
import type { Exercise } from '../../models/exercise'

export function ActiveWorkoutPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useLiveQuery(() => (id ? getWorkoutSession(id) : undefined), [id])
  const exercises = useLiveQuery(getAllExercises, [], [])
  const globalRestTimerEnabled = useSettingsStore((s) => s.settings.restTimerEnabled)
  const restTimerEnabled = session?.restTimerEnabled ?? globalRestTimerEnabled
  const now = useNow(1000)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null)
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [missedExercises, setMissedExercises] = useState<MissedExercise[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [saveRoutineName, setSaveRoutineName] = useState('')
  const [saveRoutineOpen, setSaveRoutineOpen] = useState(false)
  /** null = no manual toggle yet, so the section's open/closed state is driven
   *  automatically by completion (see warmupOpen/cooldownOpen below). Once the
   *  user taps a section's header, their choice wins from then on. */
  const [warmupOverride, setWarmupOverride] = useState<boolean | null>(null)
  const [cooldownOverride, setCooldownOverride] = useState<boolean | null>(null)
  /** The main-workout exercise last opened (expanded) by the user — sticks as the
   *  highlighted one until all its sets are done, even across collapsing it again,
   *  a rest, or opening a different exercise without finishing this one first. */
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)

  if (!session) return <div className="p-6 text-sm text-primary-muted">Loading…</div>

  const exerciseById = new Map(exercises.map((e) => [e.id, e]))
  const isPaused = session.pauseIntervals.some((p) => !p.end)
  const elapsed = elapsedSeconds(session.startedAt, session.finishedAt, session.pauseIntervals)
  void now // force re-render each tick while active
  const { done, total } = workoutSetsCompleted(session)
  const warmupExercises = session.warmup?.enabled ? session.warmup.exercises : []
  const cooldownExercises = session.cooldown?.enabled ? session.cooldown.exercises : []
  const warmupAllDone = warmupExercises.length > 0 && warmupExercises.every(isEntryComplete)
  const mainAllDone = session.main.length > 0 && session.main.every(isEntryComplete)
  const warmupOpen = warmupOverride ?? !warmupAllDone
  const cooldownOpen = cooldownOverride ?? mainAllDone
  const finisherExercises = session.finisher?.enabled ? session.finisher.exercises : []
  // Highlighted as the one to focus on right now, across all muscle groups, so it's
  // obvious what to do without scanning every group. Defaults to the first not-yet-
  // started exercise in list order — but opening (expanding) a different exercise's
  // sets takes over the highlight instead, and it stays there (even if you collapse
  // it again) until every one of its sets is done.
  const activeMainEntry =
    (activeEntryId && session.main.find((e) => e.id === activeEntryId && !isEntryComplete(e))) ||
    session.main.find((e) => !isEntryComplete(e))
  const progressSegments: ProgressSegment[] = [
    warmupExercises.length > 0 && { key: 'warmup', weight: warmupExercises.length, value: sectionFraction(warmupExercises) },
    { key: 'main', weight: Math.max(session.main.length, 1), value: sectionFraction(session.main) },
    finisherExercises.length > 0 && { key: 'finisher', weight: finisherExercises.length, value: sectionFraction(finisherExercises) },
    cooldownExercises.length > 0 && { key: 'cooldown', weight: cooldownExercises.length, value: sectionFraction(cooldownExercises) },
  ].filter((s): s is ProgressSegment => !!s)
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

  async function confirmCancel() {
    setCancelConfirmOpen(false)
    await deleteWorkoutSession(session!.id)
    navigate('/', { replace: true })
  }

  function isEntryComplete(entry: SessionExerciseEntry): boolean {
    return entry.actualSets.length > 0 && entry.actualSets.every((s) => s.completed)
  }

  function sectionFraction(entries: SessionExerciseEntry[]): number {
    const totalSets = entries.reduce((sum, e) => sum + e.actualSets.length, 0)
    if (totalSets === 0) return 0
    const doneSets = entries.reduce((sum, e) => sum + e.actualSets.filter((s) => s.completed).length, 0)
    return doneSets / totalSets
  }

  function renderEntry(entry: SessionExerciseEntry, section: 'warmup' | 'main' | 'finisher' | 'cooldown', highlight = false) {
    return (
      <SessionExerciseCard
        key={entry.id}
        entry={entry}
        sessionId={session!.id}
        highlight={highlight}
        onExpand={section === 'main' ? () => setActiveEntryId(entry.id) : undefined}
        onToggleSet={(setId, patch) => updateSetResult(session!.id, entry.id, setId, patch)}
        onFieldChange={(setId, patch) => updateSetResultWithCascade(session!.id, entry.id, setId, patch)}
        onAddSet={() => addSetToEntry(session!.id, entry.id)}
        onRemoveSet={(setId) => removeSetFromEntry(session!.id, entry.id, setId)}
        onNotesChange={(notes) => updateEntryNotes(session!.id, entry.id, notes)}
        onRemoveExercise={() => removeSessionExercise(session!.id, entry.id, section)}
        onSetCompleted={(restSeconds) => {
          const effectiveRestSeconds = session!.restTimerSeconds ?? restSeconds
          if (restTimerEnabled && effectiveRestSeconds && effectiveRestSeconds > 0) startRestTimer(session!.id, effectiveRestSeconds)
        }}
        onViewDetail={setDetailExercise}
      />
    )
  }

  function renderSection(title: string, sectionExercises: SessionExerciseEntry[], section: 'warmup' | 'main' | 'finisher' | 'cooldown') {
    if (sectionExercises.length === 0) return null

    // Group only the main workout section by muscle — carried over from how the
    // routine was set up, so training stays organized (chest, back, core, ...)
    // the same way while you're actually doing it.
    if (section === 'main') {
      const groups = groupByPrimaryMuscle(sectionExercises, exerciseById)
      return (
        <section className="flex flex-col gap-6">
          <h2 className="text-base font-bold uppercase tracking-wide text-primary-strong">{title}</h2>
          {groups.map((group) => {
            // Finished exercises sink to the bottom of their muscle group, so what's
            // still left to do stays at the top as you work through the workout.
            const ordered = [...group.items].sort((a, b) => Number(isEntryComplete(a)) - Number(isEntryComplete(b)))
            return (
              <div key={group.muscle} className="flex flex-col gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-primary-muted/70">{group.label}</h3>
                {ordered.map((entry) => renderEntry(entry, section, entry.id === activeMainEntry?.id))}
              </div>
            )
          })}
        </section>
      )
    }

    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold uppercase tracking-wide text-primary-strong">{title}</h2>
        {sectionExercises.map((entry) => renderEntry(entry, section))}
      </section>
    )
  }

  // Warm-up starts open and auto-collapses once every stretch is checked off;
  // cool-down starts collapsed and auto-opens once the main workout is fully
  // done, nudging you straight into the cool-down stretches. Either can still
  // be tapped open/closed manually — that choice then sticks for the rest of
  // the session (see warmupOverride/cooldownOverride above).
  function renderCollapsibleSection(
    title: string,
    sectionExercises: SessionExerciseEntry[],
    section: 'warmup' | 'cooldown',
    open: boolean,
    onToggle: () => void,
  ) {
    if (sectionExercises.length === 0) return null
    const doneCount = sectionExercises.filter(isEntryComplete).length
    // A faint tint (reusing colors already used elsewhere) so the two
    // collapsible cards read apart from each other and from the plain
    // sections at a glance, not just by their title text.
    const tint = section === 'warmup' ? 'bg-recovery-bg' : 'bg-secondary/20'

    return (
      <section className={`my-3 overflow-hidden rounded-[var(--radius-card)] border border-primary-border ${tint}`}>
        <button
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
          className="flex w-full items-center justify-between gap-2 p-3 text-left"
        >
          <span className="text-base font-bold uppercase tracking-wide text-primary-strong">{title}</span>
          <span className="flex items-center gap-2 text-primary-muted">
            <span className="text-xs font-medium tabular-nums">
              {doneCount} of {sectionExercises.length}
            </span>
            <IconChevronDown width={18} height={18} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </span>
        </button>
        {open && (
          <div className="flex flex-col gap-2 border-t border-primary-border p-3">
            {sectionExercises.map((entry) => renderEntry(entry, section))}
          </div>
        )}
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
      finisher: (session!.finisher?.enabled ? session!.finisher.exercises : []).map((e) => e.exerciseName),
      cooldown: (session!.cooldown?.enabled ? session!.cooldown.exercises : []).map((e) => e.exerciseName),
    }
  }

  async function handleAddSuggestion(suggestion: AssistantSuggestion) {
    if (!session) throw new Error('This session is no longer available — try reopening it.')
    const { exercise } = await resolveSuggestedExercise(suggestion, exercises)
    const config = await createExerciseConfigWithHistory(exercise.id, session.main.length)
    await addAdHocExercise(session.id, exercise.id, config.sets, config.restSeconds)
  }

  return (
    <div className="p-4 pb-[calc(var(--bottom-nav-height)+6rem)] sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary-strong">{session.name}</h1>
          <p className="flex items-center gap-1.5 text-sm text-primary-muted">
            <IconClock width={16} height={16} />
            <span className="tabular-nums">{timeLabel}</span>
            {isPaused && <span className="font-medium text-warning">· Paused</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={isPaused ? <IconPlay width={16} height={16} /> : <IconPause width={16} height={16} />}
            onClick={() => (isPaused ? resumeWorkoutSession(session.id) : pauseWorkoutSession(session.id))}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="ghost" size="sm" icon={<IconX width={16} height={16} />} onClick={() => setCancelConfirmOpen(true)} className="text-danger">
            Cancel
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-sm font-medium text-primary">
          <span>
            {done} of {total} sets completed
          </span>
          <span>{total > 0 ? Math.round((done / total) * 100) : 0}%</span>
        </div>
        <SegmentedProgressBar segments={progressSegments} />
      </div>

      {session.restTimerEndsAt && (
        <RestTimerBar
          endsAt={session.restTimerEndsAt}
          onCancel={() => clearRestTimer(session.id)}
          onComplete={() => clearRestTimer(session.id)}
        />
      )}

      <div className="flex flex-col gap-5">
        {renderCollapsibleSection('Warm-up', warmupExercises, 'warmup', warmupOpen, () => setWarmupOverride(!warmupOpen))}
        {renderSection('Workout', session.main, 'main')}
        {renderSection('Finisher', session.finisher?.enabled ? session.finisher.exercises : [], 'finisher')}
        {renderCollapsibleSection('Cool-down', cooldownExercises, 'cooldown', cooldownOpen, () => setCooldownOverride(!cooldownOpen))}
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

      <AssistantChat
        storageKey={`session:${session.id}`}
        buildContext={buildAssistantContext}
        onAddSuggestion={handleAddSuggestion}
        className="mt-4 w-full"
        greeting="Hi, I'm Spot! Need a swap, an extra exercise, or a tip mid-workout? Ask away — I can add suggestions straight into today's session."
      />

      <label className="mt-5 flex flex-col gap-1">
        <span className="text-sm font-medium text-primary-strong">Session notes</span>
        <textarea
          className="min-h-16 rounded-[var(--radius-control)] border border-primary-border px-3 py-2 text-sm"
          defaultValue={session.notes ?? ''}
          onBlur={(e) => updateSessionNotes(session.id, e.target.value)}
        />
      </label>

      <div className="fixed inset-x-0 bottom-[var(--bottom-nav-height)] z-20 flex flex-col gap-2 border-t border-primary-border bg-surface p-3 sm:static sm:mt-6 sm:border-none sm:bg-transparent sm:p-0">
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

      <ConfirmDialog
        open={cancelConfirmOpen}
        title="Cancel this workout?"
        description="This session and anything logged so far will be deleted — it won't be saved to history. This can't be undone."
        confirmLabel="Cancel workout"
        danger
        onCancel={() => setCancelConfirmOpen(false)}
        onConfirm={confirmCancel}
      />

      <PostWorkoutReviewSheet
        open={reviewOpen}
        missedExercises={missedExercises}
        achievements={achievements}
        onGenerateAiSummary={() => generateWorkoutSummary(session, missedExercises, achievements)}
        onAddExerciseSuggestion={
          session.routineTemplateId
            ? (suggestion) => addSuggestionToRoutine(session.routineTemplateId!, suggestion, exercises)
            : undefined
        }
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
