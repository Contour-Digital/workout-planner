import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader } from '../../components/ui/PageHeader'
import { ExerciseMediaThumb } from '../../components/ui/ExerciseMedia'
import { Button } from '../../components/ui/Button'
import { IconPlus, IconSearch } from '../../components/ui/icons'
import { EXERCISE_CATEGORY_LABELS, type Exercise, type ExerciseCategory, type CustomExercise } from '../../models/exercise'
import { deleteCustomExercise, getAllExercises } from '../../db/exercisesRepo'
import { ExerciseDetailSheet } from './ExerciseDetailSheet'
import { CustomExerciseForm } from './CustomExerciseForm'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyState } from '../../components/ui/EmptyState'

const CATEGORIES: (ExerciseCategory | 'all')[] = ['all', 'strength', 'cardio', 'bodyweight', 'functional', 'mobility', 'recovery']

export function ExerciseLibraryPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all')
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [editing, setEditing] = useState<CustomExercise | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<CustomExercise | null>(null)

  const exercises = useLiveQuery(getAllExercises, [], []) ?? []

  const filtered = useMemo(() => {
    return exercises.filter((e) => {
      if (category !== 'all' && e.category !== category) return false
      if (query && !e.name.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [exercises, category, query])

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Exercise Library"
        action={
          <Button size="sm" icon={<IconPlus width={18} height={18} />} onClick={() => setCreating(true)}>
            Custom
          </Button>
        }
      />

      <div className="relative mb-3">
        <IconSearch width={18} height={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-subtle" />
        <input
          className="w-full rounded-[var(--radius-control)] border border-primary-border py-2.5 pl-9 pr-3 text-sm focus:border-secondary focus:outline-none"
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
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

      {filtered.length === 0 ? (
        <EmptyState title="No exercises found" description="Try a different search or category, or create a custom exercise." />
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {filtered.map((exercise) => (
            <li key={exercise.id}>
              <button
                onClick={() => setSelected(exercise)}
                className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-primary-border bg-surface p-3 text-left hover:bg-primary-tint"
              >
                <ExerciseMediaThumb media={exercise.media} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary-strong">{exercise.name}</p>
                  <p className="text-xs text-primary-muted">
                    {EXERCISE_CATEGORY_LABELS[exercise.category]}
                    {exercise.source === 'custom' ? ' · Custom' : ''}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ExerciseDetailSheet
        exercise={selected}
        onClose={() => setSelected(null)}
        onEdit={selected?.source === 'custom' ? (e) => { setEditing(e as CustomExercise); setSelected(null) } : undefined}
        onDelete={selected?.source === 'custom' ? (e) => { setDeleting(e as CustomExercise); setSelected(null) } : undefined}
      />

      <CustomExerciseForm open={creating} onClose={() => setCreating(false)} onSaved={() => setCreating(false)} />
      <CustomExerciseForm
        open={!!editing}
        existing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => setEditing(null)}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete custom exercise?"
        description={`"${deleting?.name}" will be permanently removed. Past workout history that used it is unaffected.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await deleteCustomExercise(deleting.id)
          setDeleting(null)
        }}
      />
    </div>
  )
}
