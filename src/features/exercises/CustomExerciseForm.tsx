import { useState, type ReactNode } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import {
  EQUIPMENT_LABELS,
  EXERCISE_CATEGORY_LABELS,
  MUSCLE_GROUP_LABELS,
  type CustomExercise,
  type Equipment,
  type ExerciseCategory,
  type MuscleGroup,
} from '../../models/exercise'
import { createCustomExercise, updateCustomExercise } from '../../db/exercisesRepo'

interface CustomExerciseFormProps {
  open: boolean
  onClose: () => void
  onSaved: (exercise: CustomExercise) => void
  existing?: CustomExercise | null
}

const CATEGORY_OPTIONS = Object.entries(EXERCISE_CATEGORY_LABELS) as [ExerciseCategory, string][]
const MUSCLE_OPTIONS = Object.entries(MUSCLE_GROUP_LABELS) as [MuscleGroup, string][]
const EQUIPMENT_OPTIONS = Object.entries(EQUIPMENT_LABELS) as [Equipment, string][]

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function CustomExerciseForm({ open, onClose, onSaved, existing }: CustomExerciseFormProps) {
  const [name, setName] = useState(existing?.name ?? '')
  const [category, setCategory] = useState<ExerciseCategory>(existing?.category ?? 'strength')
  const [primary, setPrimary] = useState<MuscleGroup[]>(existing?.primaryMuscles ?? [])
  const [secondary, setSecondary] = useState<MuscleGroup[]>(existing?.secondaryMuscles ?? [])
  const [equipment, setEquipment] = useState<Equipment[]>(existing?.equipment ?? [])
  const [instructions, setInstructions] = useState(existing?.instructions.join('\n') ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [imageUrl, setImageUrl] = useState(existing?.media.url ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (primary.length === 0) {
      setError('Select at least one primary muscle.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        category,
        primaryMuscles: primary,
        secondaryMuscles: secondary,
        equipment,
        instructions: instructions.split('\n').map((s) => s.trim()).filter(Boolean),
        techniqueTips: existing?.techniqueTips ?? [],
        commonMistakes: existing?.commonMistakes ?? [],
        notes: notes.trim() || undefined,
        media: imageUrl.trim()
          ? { kind: 'upload' as const, url: imageUrl.trim() }
          : { kind: 'placeholder' as const, placeholderToken: category },
      }
      if (existing) {
        await updateCustomExercise(existing.id, payload)
        onSaved({ ...existing, ...payload })
      } else {
        const created = await createCustomExercise(payload)
        onSaved(created)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={existing ? 'Edit custom exercise' : 'New custom exercise'}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-primary-strong">Name</span>
          <input
            className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Landmine Press"
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
          <span className="text-sm font-medium text-primary-strong">Notes (optional)</span>
          <textarea
            className="min-h-16 rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-primary-strong">Image URL (optional)</span>
          <input
            className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button fullWidth loading={saving} onClick={handleSubmit}>
          {existing ? 'Save changes' : 'Create exercise'}
        </Button>
      </div>
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
