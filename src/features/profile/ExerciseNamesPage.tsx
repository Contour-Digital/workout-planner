import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { IconSearch } from '../../components/ui/icons'
import { db } from '../../db/db'
import { resetLibraryExerciseName, setLibraryExerciseName } from '../../db/exercisesRepo'
import { EXERCISE_CATEGORY_LABELS } from '../../models/exercise'

/** Renaming here only ever touches a per-user override (see exercisesRepo.ts) —
 *  the shared library row itself is never modified, so this can't affect other
 *  users or the app's bundled seed data. */
export function ExerciseNamesPage() {
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const library = useLiveQuery(() => db.libraryExercises.toArray(), [], []) ?? []
  const overrides = useLiveQuery(() => db.libraryExerciseNameOverrides.toArray(), [], []) ?? []

  const rows = useMemo(() => {
    const overrideByExerciseId = new Map(overrides.map((o) => [o.exerciseId, o.name]))
    return library
      .map((e) => ({
        id: e.id,
        category: e.category,
        originalName: e.name,
        currentName: overrideByExerciseId.get(e.id) ?? e.name,
      }))
      .filter((row) => !query || row.currentName.toLowerCase().includes(query.toLowerCase()) || row.originalName.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.currentName.localeCompare(b.currentName))
  }, [library, overrides, query])

  function startEdit(id: string, currentName: string) {
    setEditingId(id)
    setDraft(currentName)
  }

  async function save(id: string) {
    await setLibraryExerciseName(id, draft)
    setEditingId(null)
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="Exercise names" subtitle="Rename any built-in exercise's title — just for you, nothing else about it changes." />

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
          const isRenamed = row.currentName !== row.originalName
          const isEditing = editingId === row.id
          return (
            <li key={row.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <input
                    autoFocus
                    className="w-full rounded-[var(--radius-control)] border border-secondary px-2 py-1.5 text-sm"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') save(row.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                  />
                ) : (
                  <>
                    <p className="truncate text-sm font-medium text-primary-strong">{row.currentName}</p>
                    <p className="truncate text-xs text-primary-muted">
                      {EXERCISE_CATEGORY_LABELS[row.category]}
                      {isRenamed ? ` · originally "${row.originalName}"` : ''}
                    </p>
                  </>
                )}
              </div>
              {isEditing ? (
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" onClick={() => save(row.id)}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(row.id, row.currentName)}>
                    Rename
                  </Button>
                  {isRenamed && (
                    <Button size="sm" variant="ghost" onClick={() => resetLibraryExerciseName(row.id)}>
                      Reset
                    </Button>
                  )}
                </div>
              )}
            </li>
          )
        })}
        {rows.length === 0 && <p className="py-6 text-center text-sm text-primary-muted">No exercises match.</p>}
      </ul>
    </div>
  )
}
