import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { IconPlus, IconSearch } from '../../components/ui/icons'
import { db } from '../../db/db'
import { countRoutinesUsingExercise, deleteCustomExercise, renameExercise, resetLibraryExerciseName } from '../../db/exercisesRepo'
import { normalizeExerciseName } from '../../lib/exerciseMatching'
import { EXERCISE_CATEGORY_LABELS, type Exercise } from '../../models/exercise'
import { AiExerciseForm } from '../exercises/AiExerciseForm'

interface Row {
  exercise: Exercise
  originalName: string
  /** Other exercises whose name normalizes to the same thing — likely duplicates. */
  duplicateIds: string[]
}

/** Every exercise in the library — built-in and ones you (or Spot) added — with a
 *  Manage action per row to rename or delete it. Renaming a built-in exercise only
 *  ever touches a per-user override (see exercisesRepo.ts), so the shared library
 *  row and the app's bundled seed data are never modified; built-ins can't be
 *  deleted for the same reason. */
export function ManageExercisesPage() {
  const [query, setQuery] = useState('')
  const [managingId, setManagingId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const library = useLiveQuery(() => db.libraryExercises.toArray(), [], []) ?? []
  const custom = useLiveQuery(() => db.customExercises.toArray(), [], []) ?? []
  const overrides = useLiveQuery(() => db.libraryExerciseNameOverrides.toArray(), [], []) ?? []

  const allRows = useMemo(() => {
    const overrideByExerciseId = new Map(overrides.map((o) => [o.exerciseId, o.name]))
    const rows: Row[] = [...library, ...custom].map((e) => ({
      exercise: { ...e, name: overrideByExerciseId.get(e.id) ?? e.name },
      originalName: e.name,
      duplicateIds: [],
    }))
    const idsByName = new Map<string, string[]>()
    for (const row of rows) {
      const key = normalizeExerciseName(row.exercise.name)
      idsByName.set(key, [...(idsByName.get(key) ?? []), row.exercise.id])
    }
    for (const row of rows) {
      row.duplicateIds = (idsByName.get(normalizeExerciseName(row.exercise.name)) ?? []).filter((id) => id !== row.exercise.id)
    }
    return rows.sort((a, b) => a.exercise.name.localeCompare(b.exercise.name))
  }, [library, custom, overrides])

  const rows = useMemo(() => {
    const q = query.toLowerCase()
    return allRows.filter((row) => !q || row.exercise.name.toLowerCase().includes(q) || row.originalName.toLowerCase().includes(q))
  }, [allRows, query])

  const managing = allRows.find((r) => r.exercise.id === managingId) ?? null

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="Manage exercises" subtitle="Rename any exercise, or delete ones you've added." />

      <div className="relative mb-4">
        <IconSearch width={18} height={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-subtle" />
        <input
          className="w-full rounded-[var(--radius-control)] border border-primary-border py-2.5 pl-9 pr-3 text-sm focus:border-secondary focus:outline-none"
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <ul className="flex flex-col divide-y divide-primary-border">
        {rows.map((row) => {
          const { exercise } = row
          const isRenamed = exercise.source === 'library' && exercise.name !== row.originalName
          return (
            <li key={exercise.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-primary-strong">{exercise.name}</p>
                <p className="truncate text-xs text-primary-muted">
                  {EXERCISE_CATEGORY_LABELS[exercise.category]}
                  {exercise.source === 'custom' ? ' · Added by you' : ''}
                  {isRenamed ? ` · originally "${row.originalName}"` : ''}
                  {row.duplicateIds.length > 0 && <span className="font-medium text-danger"> · Duplicate</span>}
                </p>
              </div>
              <Button size="sm" variant="secondary" className="shrink-0" onClick={() => setManagingId(exercise.id)}>
                Manage
              </Button>
            </li>
          )
        })}
        {rows.length === 0 && <p className="py-6 text-center text-sm text-primary-muted">No exercises match.</p>}
      </ul>

      <Button fullWidth variant="secondary" className="mt-4" icon={<IconPlus width={18} height={18} />} onClick={() => setAddOpen(true)}>
        Add exercise
      </Button>

      {managing && <ManageExerciseSheet key={managing.exercise.id} row={managing} allRows={allRows} onClose={() => setManagingId(null)} />}
      <AiExerciseForm open={addOpen} onClose={() => setAddOpen(false)} onSaved={() => setAddOpen(false)} />
    </div>
  )
}

const REMOVE_FROM_ROUTINES = ''

function ManageExerciseSheet({ row, allRows, onClose }: { row: Row; allRows: Row[]; onClose: () => void }) {
  const { exercise } = row
  const [draft, setDraft] = useState(exercise.name)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Default a duplicate's routine entries over to the copy that's being kept.
  const [replacementId, setReplacementId] = useState(row.duplicateIds[0] ?? REMOVE_FROM_ROUTINES)
  const [busy, setBusy] = useState(false)
  const routineCount = useLiveQuery(() => countRoutinesUsingExercise(exercise.id), [exercise.id], 0) ?? 0

  const isRenamed = exercise.source === 'library' && exercise.name !== row.originalName
  const replacementOptions = allRows.filter((r) => r.exercise.id !== exercise.id)

  async function saveName() {
    if (!draft.trim() || draft.trim() === exercise.name) return
    setBusy(true)
    await renameExercise(exercise, draft)
    setBusy(false)
    onClose()
  }

  async function confirmDelete() {
    setBusy(true)
    await deleteCustomExercise(exercise.id, replacementId || null)
    setBusy(false)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={confirmingDelete ? `Delete "${exercise.name}"?` : exercise.name}>
      {confirmingDelete ? (
        <div className="flex flex-col gap-4">
          {routineCount > 0 ? (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-primary-muted">
                It's used in {routineCount} {routineCount === 1 ? 'routine' : 'routines'}. What should replace it there?
              </span>
              <select
                className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
                value={replacementId}
                onChange={(e) => setReplacementId(e.target.value)}
              >
                <option value={REMOVE_FROM_ROUTINES}>Nothing, remove it from those routines</option>
                {replacementOptions.map((r) => (
                  <option key={r.exercise.id} value={r.exercise.id}>
                    {r.exercise.name}
                    {row.duplicateIds.includes(r.exercise.id) ? ' (duplicate)' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-primary-muted">It isn't used in any routines.</p>
          )}
          <p className="text-sm text-primary-muted">Past workout history that used it is unaffected.</p>
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setConfirmingDelete(false)}>
              Back
            </Button>
            <Button variant="danger" fullWidth loading={busy} onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Name</span>
            <input
              className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName()
              }}
            />
            {isRenamed && <span className="text-xs text-primary-muted">Originally "{row.originalName}"</span>}
          </label>
          <div className="flex gap-3">
            {isRenamed && (
              <Button
                variant="ghost"
                fullWidth
                onClick={async () => {
                  await resetLibraryExerciseName(exercise.id)
                  onClose()
                }}
              >
                Reset name
              </Button>
            )}
            <Button fullWidth loading={busy} disabled={!draft.trim() || draft.trim() === exercise.name} onClick={saveName}>
              Save name
            </Button>
          </div>

          {row.duplicateIds.length > 0 && (
            <p className="text-sm text-danger">
              There {row.duplicateIds.length === 1 ? 'is another exercise' : `are ${row.duplicateIds.length} other exercises`} with this name.
            </p>
          )}

          {exercise.source === 'custom' ? (
            <Button variant="danger" fullWidth onClick={() => setConfirmingDelete(true)}>
              Delete exercise
            </Button>
          ) : (
            <p className="text-xs text-primary-muted">Built-in exercises can be renamed but not deleted.</p>
          )}
        </div>
      )}
    </Sheet>
  )
}
