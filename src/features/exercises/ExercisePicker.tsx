import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { ExerciseMediaThumb } from '../../components/ui/ExerciseMedia'
import { IconPlus, IconSearch } from '../../components/ui/icons'
import { EXERCISE_CATEGORY_LABELS, type Exercise, type ExerciseCategory } from '../../models/exercise'
import { getAllExercises } from '../../db/exercisesRepo'
import { groupExercisesByPrimaryMuscle } from '../../lib/exerciseGrouping'
import { CustomExerciseForm } from './CustomExerciseForm'
import { ExerciseDetailSheet } from './ExerciseDetailSheet'

interface ExercisePickerProps {
  open: boolean
  onClose: () => void
  onSelect: (exercise: Exercise) => void
  title?: string
  /** When provided, stretches (mobility-category exercises) get a second small button
   *  alongside "Add" — letting you send them to the other of warm-up/cool-down instead
   *  of always landing in whichever section this picker was opened from. */
  stretchAltSection?: { label: string; onSelect: (exercise: Exercise) => void }
}

const CATEGORIES: (ExerciseCategory | 'all')[] = ['all', 'strength', 'cardio', 'bodyweight', 'functional', 'mobility', 'recovery']

export function ExercisePicker({ open, onClose, onSelect, title = 'Add exercise', stretchAltSection }: ExercisePickerProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [previewing, setPreviewing] = useState<Exercise | null>(null)

  const exercises = useLiveQuery(getAllExercises, [], []) ?? []

  const filtered = useMemo(() => {
    return exercises.filter((e) => {
      if (category !== 'all' && e.category !== category) return false
      if (query && !e.name.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [exercises, category, query])

  const sections = useMemo(() => groupExercisesByPrimaryMuscle(filtered), [filtered])

  return (
    <Sheet open={open} onClose={onClose} title={title} className="sm:max-w-xl">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <IconSearch width={18} height={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-subtle" />
          <input
            className="w-full rounded-[var(--radius-control)] border border-primary-border py-2.5 pl-9 pr-3 text-sm focus:border-secondary focus:outline-none"
            placeholder="Search exercises…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ' +
                (category === c ? 'border-secondary bg-secondary-tint text-secondary' : 'border-primary-border text-primary-muted')
              }
            >
              {c === 'all' ? 'All' : EXERCISE_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        <Button variant="secondary" icon={<IconPlus width={18} height={18} />} onClick={() => setCreateOpen(true)}>
          Create custom exercise
        </Button>

        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <div key={section.muscle}>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-primary-muted">{section.label}</h3>
              <ul className="flex flex-col divide-y divide-primary-border">
                {section.exercises.map((exercise) => (
                  <li key={exercise.id} className="flex items-center gap-3 py-2.5">
                    <button className="flex flex-1 items-center gap-3 text-left" onClick={() => setPreviewing(exercise)}>
                      <ExerciseMediaThumb media={exercise.media} size={40} />
                      <div>
                        <p className="text-sm font-medium text-primary-strong">{exercise.name}</p>
                        <p className="text-xs text-primary-muted">{EXERCISE_CATEGORY_LABELS[exercise.category]}</p>
                      </div>
                    </button>
                    {stretchAltSection && exercise.category === 'mobility' ? (
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button size="sm" onClick={() => onSelect(exercise)}>
                          Add
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => stretchAltSection.onSelect(exercise)}>
                          Add to {stretchAltSection.label}
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => onSelect(exercise)}>
                        Add
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {sections.length === 0 && <p className="py-6 text-center text-sm text-primary-muted">No exercises match.</p>}
        </div>
      </div>

      <CustomExerciseForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={(created) => onSelect(created)}
      />
      <ExerciseDetailSheet exercise={previewing} onClose={() => setPreviewing(null)} />
    </Sheet>
  )
}
