import { useState, type ReactNode } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { IconSparkle } from '../../components/ui/icons'
import { generateExerciseDetails } from '../../lib/aiExerciseGenerator'
import { createCustomExercise, getAllExercises, updateCustomExercise } from '../../db/exercisesRepo'
import { findBestMatch } from '../../lib/exerciseMatching'
import {
  EQUIPMENT_LABELS,
  EXERCISE_CATEGORY_LABELS,
  MUSCLE_GROUP_LABELS,
  type Equipment,
  type Exercise,
  type ExerciseCategory,
  type MuscleGroup,
} from '../../models/exercise'

interface AiExerciseFormProps {
  open: boolean
  onClose: () => void
  onSaved: (exercise: Exercise) => void
}

type Step = 'input' | 'review'

const CATEGORY_OPTIONS = Object.entries(EXERCISE_CATEGORY_LABELS) as [ExerciseCategory, string][]
const MUSCLE_OPTIONS = Object.entries(MUSCLE_GROUP_LABELS) as [MuscleGroup, string][]
const EQUIPMENT_OPTIONS = Object.entries(EQUIPMENT_LABELS) as [Equipment, string][]

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function linesToList(value: string): string[] {
  return value.split('\n').map((s) => s.trim()).filter(Boolean)
}

/** Add-exercise flow that leads with Spot's research instead of a blank manual form:
 *  name + optional equipment/brand hints go to generateExerciseDetails(), and the
 *  result comes back as an ordinary editable draft — the same fields a manual form
 *  would have, just pre-filled — for the user to adjust and approve before it's
 *  actually saved to the library.
 *
 *  If the exercise is already in the library (matched on the typed name or Spot's
 *  cleaned-up one), approving updates that existing exercise with the reviewed
 *  details instead of adding a duplicate — so routines that use it keep working.
 *  A built-in exercise can't be edited, so a match there offers to use it as-is. */
export function AiExerciseForm({ open, onClose, onSaved }: AiExerciseFormProps) {
  const [step, setStep] = useState<Step>('input')
  const [name, setName] = useState('')
  const [equipmentName, setEquipmentName] = useState('')
  const [brand, setBrand] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const [reviewName, setReviewName] = useState('')
  const [category, setCategory] = useState<ExerciseCategory>('strength')
  const [primary, setPrimary] = useState<MuscleGroup[]>([])
  const [secondary, setSecondary] = useState<MuscleGroup[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [instructions, setInstructions] = useState('')
  const [techniqueTips, setTechniqueTips] = useState('')
  const [commonMistakes, setCommonMistakes] = useState('')
  const [notes, setNotes] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [existing, setExisting] = useState<Exercise | null>(null)
  const [addAsNew, setAddAsNew] = useState(false)

  function resetAndClose() {
    setStep('input')
    setName('')
    setEquipmentName('')
    setBrand('')
    setGenerateError(null)
    setSaveError(null)
    setExisting(null)
    setAddAsNew(false)
    onClose()
  }

  async function handleGenerate() {
    if (!name.trim()) {
      setGenerateError('Exercise name is required.')
      return
    }
    setGenerating(true)
    setGenerateError(null)
    try {
      const result = await generateExerciseDetails({
        name: name.trim(),
        equipmentName: equipmentName.trim() || undefined,
        brand: brand.trim() || undefined,
      })
      setReviewName(result.name)
      setCategory(result.category)
      setPrimary(result.primaryMuscles)
      setSecondary(result.secondaryMuscles)
      setEquipment(result.equipment)
      setInstructions(result.instructions.join('\n'))
      setTechniqueTips(result.techniqueTips.join('\n'))
      setCommonMistakes(result.commonMistakes.join('\n'))
      setNotes(result.notes ?? '')
      const all = await getAllExercises()
      setExisting(findBestMatch(name.trim(), all) ?? findBestMatch(result.name, all) ?? null)
      setAddAsNew(false)
      setSaveError(null)
      setStep('review')
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Could not generate exercise details. Try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleApprove() {
    if (!reviewName.trim()) {
      setSaveError('Name is required.')
      return
    }
    if (primary.length === 0) {
      setSaveError('Select at least one primary muscle.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const details = {
        name: reviewName.trim(),
        category,
        primaryMuscles: primary,
        secondaryMuscles: secondary,
        equipment,
        instructions: linesToList(instructions),
        techniqueTips: linesToList(techniqueTips),
        commonMistakes: linesToList(commonMistakes),
        notes: notes.trim() || undefined,
      }
      if (existing?.source === 'custom' && !addAsNew) {
        // Keep real media if it has some; a placeholder follows the (maybe new) category.
        const media = existing.media.kind === 'placeholder' ? { kind: 'placeholder' as const, placeholderToken: category } : existing.media
        await updateCustomExercise(existing.id, { ...details, media })
        onSaved({ ...existing, ...details, media })
      } else {
        const created = await createCustomExercise({ ...details, media: { kind: 'placeholder', placeholderToken: category } })
        onSaved(created)
      }
      resetAndClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={resetAndClose} title={step === 'input' ? 'Add exercise with Spot' : 'Review exercise details'}>
      {step === 'input' ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-primary-muted">
            Tell Spot the exercise name and Spot will research the muscle groups, category, and other details for you to review before it's added.
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Exercise name</span>
            <input
              autoFocus
              className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chest Press"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Machine/equipment name (optional)</span>
            <input
              className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
              value={equipmentName}
              onChange={(e) => setEquipmentName(e.target.value)}
              placeholder="e.g. Iso-Lateral Chest Press"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Machine brand (optional)</span>
            <input
              className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Hammer Strength"
            />
          </label>

          {generateError && <p className="text-sm text-danger">{generateError}</p>}

          <Button fullWidth icon={<IconSparkle width={18} height={18} />} loading={generating} onClick={handleGenerate}>
            Generate details
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-primary-muted">Spot's best guess — review and adjust anything before adding it to your library.</p>

          {existing && (
            <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-secondary bg-secondary-tint p-3 text-sm">
              {existing.source === 'custom' ? (
                <p className="text-primary-strong">
                  {addAsNew
                    ? `This will be added as a separate exercise alongside "${existing.name}".`
                    : `"${existing.name}" is already in your library. Saving updates it with these details instead of adding a duplicate.`}
                </p>
              ) : (
                <p className="text-primary-strong">
                  {addAsNew
                    ? `This will be added as a separate exercise alongside the built-in "${existing.name}".`
                    : `"${existing.name}" is already a built-in exercise. You can use it as it is, or add this as a separate exercise.`}
                </p>
              )}
              <button type="button" className="self-start text-xs font-medium text-secondary underline" onClick={() => setAddAsNew(!addAsNew)}>
                {addAsNew ? `Use "${existing.name}" instead` : "It's a different exercise, add it separately"}
              </button>
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Name</span>
            <input
              className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
              value={reviewName}
              onChange={(e) => setReviewName(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Category</span>
            <select
              className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
            >
              {CATEGORY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-primary-strong">Primary muscles</legend>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_OPTIONS.map(([value, label]) => (
                <ChipToggle key={value} active={primary.includes(value)} onClick={() => setPrimary(toggle(primary, value))}>
                  {label}
                </ChipToggle>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-primary-strong">Secondary muscles</legend>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_OPTIONS.map(([value, label]) => (
                <ChipToggle key={value} active={secondary.includes(value)} onClick={() => setSecondary(toggle(secondary, value))}>
                  {label}
                </ChipToggle>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-primary-strong">Equipment</legend>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map(([value, label]) => (
                <ChipToggle key={value} active={equipment.includes(value)} onClick={() => setEquipment(toggle(equipment, value))}>
                  {label}
                </ChipToggle>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Instructions (one step per line)</span>
            <textarea
              className="min-h-24 rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Technique tips (one per line)</span>
            <textarea
              className="min-h-16 rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
              value={techniqueTips}
              onChange={(e) => setTechniqueTips(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Common mistakes (one per line)</span>
            <textarea
              className="min-h-16 rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
              value={commonMistakes}
              onChange={(e) => setCommonMistakes(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Notes (optional)</span>
            <textarea
              className="min-h-16 rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {saveError && <p className="text-sm text-danger">{saveError}</p>}

          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setStep('input')}>
              Back
            </Button>
            {existing?.source === 'library' && !addAsNew ? (
              <Button
                fullWidth
                onClick={() => {
                  onSaved(existing)
                  resetAndClose()
                }}
              >
                Use existing
              </Button>
            ) : (
              <Button fullWidth loading={saving} onClick={handleApprove}>
                {existing && !addAsNew ? 'Update exercise' : 'Add to library'}
              </Button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}

function ChipToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ' +
        (active ? 'border-secondary bg-secondary-tint text-secondary' : 'border-primary-border text-primary-muted hover:bg-primary-tint')
      }
      aria-pressed={active}
    >
      {children}
    </button>
  )
}
