import { useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { IconSparkle } from '../../components/ui/icons'
import type { ExerciseSuggestion } from '../../models/exercise'
import type { Achievement, FeelingTag, MissedExercise, PerceivedEffort, PostWorkoutReview } from '../../models/session'

const FEELINGS: { value: FeelingTag; label: string }[] = [
  { value: 'great', label: 'Great' },
  { value: 'good', label: 'Good' },
  { value: 'okay', label: 'Okay' },
  { value: 'tired', label: 'Tired' },
  { value: 'sore', label: 'Sore' },
  { value: 'struggling', label: 'Struggling' },
]

interface PostWorkoutReviewSheetProps {
  open: boolean
  onClose: () => void
  onSave: (review: PostWorkoutReview) => void
  existing?: PostWorkoutReview
  missedExercises: MissedExercise[]
  achievements: Achievement[]
  onGenerateAiSummary: () => Promise<{ summary: string; perceivedEffort: PerceivedEffort; tips: string[]; exerciseSuggestions: ExerciseSuggestion[] }>
  /** Omit when this session has no routine to add suggestions to (e.g. impromptu) —
   *  suggestions still show, just without an "Add to routine" button. */
  onAddExerciseSuggestion?: (suggestion: ExerciseSuggestion) => Promise<void>
}

export function PostWorkoutReviewSheet({
  open,
  onClose,
  onSave,
  existing,
  missedExercises,
  achievements,
  onGenerateAiSummary,
  onAddExerciseSuggestion,
}: PostWorkoutReviewSheetProps) {
  const [effort, setEffort] = useState<number | undefined>(existing?.effort)
  const [feelings, setFeelings] = useState<FeelingTag[]>(existing?.feelings ?? [])
  const [comments, setComments] = useState(existing?.comments ?? '')
  const [painNotes, setPainNotes] = useState(existing?.painNotes ?? '')
  const [expectation, setExpectation] = useState<PostWorkoutReview['expectationVsActual']>(existing?.expectationVsActual)
  const [aiSummary, setAiSummary] = useState(existing?.aiSummary)
  const [aiPerceivedEffort, setAiPerceivedEffort] = useState(existing?.aiPerceivedEffort)
  const [aiTips, setAiTips] = useState<string[]>(existing?.aiTips ?? [])
  const [aiExerciseSuggestions, setAiExerciseSuggestions] = useState<ExerciseSuggestion[]>(existing?.aiExerciseSuggestions ?? [])
  const [addedSuggestions, setAddedSuggestions] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  function toggleFeeling(f: FeelingTag) {
    setFeelings((prev) => (prev.includes(f) ? prev.filter((v) => v !== f) : [...prev, f]))
  }

  async function handleGenerateAiSummary() {
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await onGenerateAiSummary()
      setAiSummary(result.summary)
      setAiPerceivedEffort(result.perceivedEffort)
      setAiTips(result.tips)
      setAiExerciseSuggestions(result.exerciseSuggestions)
      setAddedSuggestions([])
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not generate a summary.')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleAddSuggestion(suggestion: ExerciseSuggestion) {
    if (!onAddExerciseSuggestion) return
    await onAddExerciseSuggestion(suggestion)
    setAddedSuggestions((prev) => [...prev, suggestion.name])
  }

  function save() {
    const now = new Date().toISOString()
    onSave({
      effort,
      feelings: feelings.length ? feelings : undefined,
      comments: comments.trim() || undefined,
      painNotes: painNotes.trim() || undefined,
      expectationVsActual: expectation,
      missedExercises: missedExercises.length ? missedExercises : undefined,
      achievements: achievements.length ? achievements : undefined,
      aiSummary,
      aiPerceivedEffort,
      aiTips: aiTips.length ? aiTips : undefined,
      aiExerciseSuggestions: aiExerciseSuggestions.length ? aiExerciseSuggestions : undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title="How was your workout?">
      <div className="flex flex-col gap-5">
        {(missedExercises.length > 0 || achievements.length > 0) && (
          <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-primary-border p-3">
            <p className="text-sm font-semibold text-primary-strong">Session summary</p>
            {achievements.map((a) => (
              <p key={a.exerciseId} className="text-sm text-success">
                🏆 {a.message}
              </p>
            ))}
            {missedExercises.map((m) => (
              <p key={m.exerciseName} className="text-sm text-warning">
                {m.exerciseName}: {m.missedCount} of {m.totalCount} sets not completed
              </p>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-primary-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-primary-strong">AI summary</p>
            <Button
              size="sm"
              variant="secondary"
              icon={<IconSparkle width={14} height={14} />}
              loading={aiLoading}
              onClick={handleGenerateAiSummary}
            >
              {aiSummary ? 'Regenerate' : 'Generate'}
            </Button>
          </div>
          {aiError && <p className="text-xs text-danger">{aiError}</p>}
          {aiSummary && (
            <>
              <p className="text-sm text-primary">{aiSummary}</p>
              {aiPerceivedEffort && (
                <div className="flex items-center gap-2">
                  <Badge tone="secondary">Perceived effort: {aiPerceivedEffort.score}/10 · {aiPerceivedEffort.label.replace('_', ' ')}</Badge>
                </div>
              )}
              {aiPerceivedEffort?.reasoning && <p className="text-xs text-primary-muted">{aiPerceivedEffort.reasoning}</p>}

              {aiTips.length > 0 && (
                <ul className="flex flex-col gap-1 pl-4 text-sm text-primary-muted">
                  {aiTips.map((tip, i) => (
                    <li key={i} className="list-disc">
                      {tip}
                    </li>
                  ))}
                </ul>
              )}

              {aiExerciseSuggestions.length > 0 && (
                <div className="flex flex-col gap-2">
                  {aiExerciseSuggestions.map((s) => {
                    const added = addedSuggestions.includes(s.name)
                    return (
                      <div
                        key={s.name}
                        className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-primary-border bg-surface-muted px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-primary-strong">{s.name}</p>
                          <p className="truncate text-xs text-primary-muted">{s.reason}</p>
                        </div>
                        {onAddExerciseSuggestion && (
                          <Button size="sm" variant={added ? 'ghost' : 'secondary'} disabled={added} onClick={() => handleAddSuggestion(s)}>
                            {added ? 'Added' : 'Add to routine'}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
          {!aiSummary && !aiLoading && (
            <p className="text-xs text-primary-muted">Have the assistant write a recap of this session and estimate how hard it was.</p>
          )}
        </section>

        <section>
          <p className="mb-2 text-sm font-semibold text-primary-strong">Overall effort</p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setEffort(n)}
                aria-pressed={effort === n}
                className={
                  'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold ' +
                  (effort === n ? 'border-secondary bg-secondary text-white' : 'border-primary-border text-primary hover:bg-primary-tint')
                }
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 text-sm font-semibold text-primary-strong">How do you feel? (optional, select any)</p>
          <div className="flex flex-wrap gap-2">
            {FEELINGS.map((f) => (
              <button
                key={f.value}
                onClick={() => toggleFeeling(f.value)}
                aria-pressed={feelings.includes(f.value)}
                className={
                  'rounded-full border px-3 py-1.5 text-sm font-medium ' +
                  (feelings.includes(f.value) ? 'border-secondary bg-secondary-tint text-secondary' : 'border-primary-border text-primary-muted hover:bg-primary-tint')
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 text-sm font-semibold text-primary-strong">Compared to expected</p>
          <div className="flex gap-2">
            {(['easier', 'about_same', 'harder'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setExpectation(v)}
                aria-pressed={expectation === v}
                className={
                  'flex-1 rounded-[var(--radius-control)] border px-3 py-2 text-sm font-medium capitalize ' +
                  (expectation === v ? 'border-secondary bg-secondary-tint text-secondary' : 'border-primary-border text-primary-muted')
                }
              >
                {v.replace('_', ' ')}
              </button>
            ))}
          </div>
        </section>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-primary-strong">Comments (optional)</span>
          <textarea
            className="min-h-16 rounded-[var(--radius-control)] border border-primary-border px-3 py-2 text-sm"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-primary-strong">Pain or discomfort (optional)</span>
          <textarea
            className="min-h-16 rounded-[var(--radius-control)] border border-primary-border px-3 py-2 text-sm"
            value={painNotes}
            onChange={(e) => setPainNotes(e.target.value)}
          />
          {painNotes.trim() && (
            <p className="rounded-[var(--radius-control)] bg-warning-bg px-3 py-2 text-xs text-warning">
              Noted. If this continues, consider adjusting your training and speaking with a qualified professional.
              This app doesn't diagnose injuries.
            </p>
          )}
        </label>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              const now = new Date().toISOString()
              onSave({
                missedExercises: missedExercises.length ? missedExercises : undefined,
                achievements: achievements.length ? achievements : undefined,
                aiSummary,
                aiPerceivedEffort,
                aiTips: aiTips.length ? aiTips : undefined,
                aiExerciseSuggestions: aiExerciseSuggestions.length ? aiExerciseSuggestions : undefined,
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
              })
            }}
          >
            Skip
          </Button>
          <Button fullWidth onClick={save}>
            Save review
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
