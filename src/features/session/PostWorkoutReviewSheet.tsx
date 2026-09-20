import { useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import type { FeelingTag, PostWorkoutReview } from '../../models/session'

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
}

export function PostWorkoutReviewSheet({ open, onClose, onSave, existing }: PostWorkoutReviewSheetProps) {
  const [effort, setEffort] = useState<number | undefined>(existing?.effort)
  const [feelings, setFeelings] = useState<FeelingTag[]>(existing?.feelings ?? [])
  const [comments, setComments] = useState(existing?.comments ?? '')
  const [painNotes, setPainNotes] = useState(existing?.painNotes ?? '')
  const [expectation, setExpectation] = useState<PostWorkoutReview['expectationVsActual']>(existing?.expectationVsActual)

  function toggleFeeling(f: FeelingTag) {
    setFeelings((prev) => (prev.includes(f) ? prev.filter((v) => v !== f) : [...prev, f]))
  }

  function save() {
    const now = new Date().toISOString()
    onSave({
      effort,
      feelings: feelings.length ? feelings : undefined,
      comments: comments.trim() || undefined,
      painNotes: painNotes.trim() || undefined,
      expectationVsActual: expectation,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title="How was your workout?">
      <div className="flex flex-col gap-5">
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
          <Button variant="ghost" fullWidth onClick={() => onSave({ createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })}>
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
