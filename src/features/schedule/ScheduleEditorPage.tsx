import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { getActiveRecoveryRoutines, getActiveRoutines } from '../../db/routinesRepo'
import { deleteSchedule, getAllSchedules, saveSchedule } from '../../db/scheduleRepo'
import { toDateKey } from '../../lib/recurrence'
import { analyzeSimpleSchedule } from '../../lib/scheduleDescribe'
import type { DayAssignment, RecurringSchedule, SchedulePattern } from '../../models/schedule'

type ScheduleType = 'workout' | 'recovery' | 'rest'
type FrequencyMode = 'interval' | 'weekday' | 'one_off'

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

export function ScheduleEditorPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const routines = useLiveQuery(getActiveRoutines, [], []) ?? []
  const recoveryRoutines = useLiveQuery(getActiveRecoveryRoutines, [], []) ?? []
  const existingSchedules = useLiveQuery(getAllSchedules, [], []) ?? []
  const existing = isNew ? undefined : existingSchedules.find((s) => s.id === id)

  const [loaded, setLoaded] = useState(isNew)
  const [name, setName] = useState('')
  const [type, setType] = useState<ScheduleType>(params.get('kind') === 'recovery' ? 'recovery' : 'workout')
  const [routineId, setRoutineId] = useState(params.get('routineId') ?? params.get('recoveryRoutineId') ?? '')
  const [startDate, setStartDate] = useState(toDateKey(new Date()))
  const [frequency, setFrequency] = useState<FrequencyMode>('interval')
  const [intervalDays, setIntervalDays] = useState(7)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    if (isNew || !existing || loaded) return
    const shape = analyzeSimpleSchedule(existing)
    if (!shape) {
      setUnsupported(true)
      setLoaded(true)
      return
    }
    setName(existing.name)
    setStartDate(existing.startDate)
    if (shape.assignment.kind === 'workout') {
      setType('workout')
      setRoutineId(shape.assignment.routineTemplateId)
    } else if (shape.assignment.kind === 'recovery') {
      setType('recovery')
      setRoutineId(shape.assignment.routineTemplateId)
    } else {
      setType('rest')
    }
    setFrequency(shape.mode)
    if (shape.mode === 'interval') setIntervalDays(shape.intervalDays ?? 7)
    if (shape.mode === 'weekday') setWeekdays(shape.weekdays ?? [])
    setLoaded(true)
  }, [isNew, existing, loaded])

  const routineName = useMemo(() => {
    if (type === 'workout') return routines.find((r) => r.id === routineId)?.name
    if (type === 'recovery') return recoveryRoutines.find((r) => r.id === routineId)?.name
    return 'Rest day'
  }, [type, routineId, routines, recoveryRoutines])

  function toggleWeekday(d: number) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((v) => v !== d) : [...prev, d]))
  }

  function buildAssignment(): DayAssignment | null {
    if (type === 'rest') return { kind: 'rest' }
    if (!routineId) return null
    return type === 'workout' ? { kind: 'workout', routineTemplateId: routineId } : { kind: 'recovery', routineTemplateId: routineId }
  }

  async function handleSave() {
    setError(null)
    const assignment = buildAssignment()
    if (!assignment) {
      setError(type === 'rest' ? 'Something went wrong.' : `Choose a ${type === 'workout' ? 'routine' : 'recovery routine'}.`)
      return
    }
    if (!startDate) {
      setError('Choose a start date.')
      return
    }
    if (frequency === 'weekday' && weekdays.length === 0) {
      setError('Select at least one day of the week.')
      return
    }
    if (frequency === 'interval' && (!intervalDays || intervalDays < 1)) {
      setError('Enter a repeat interval of at least 1 day.')
      return
    }

    let pattern: SchedulePattern
    if (frequency === 'one_off') {
      pattern = { type: 'one_off', assignment }
    } else if (frequency === 'weekday') {
      pattern = { type: 'weekday', assignments: Object.fromEntries(weekdays.map((d) => [d, assignment])) }
    } else {
      pattern = { type: 'cycle', days: [assignment, ...Array.from({ length: intervalDays - 1 }, () => ({ kind: 'off' as const }))] }
    }

    const now = new Date().toISOString()
    const schedule: RecurringSchedule = {
      id: existing?.id ?? crypto.randomUUID(),
      name: name.trim() || routineName || 'Scheduled session',
      startDate,
      endDate: existing?.endDate,
      pattern,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await saveSchedule(schedule)
    navigate('/routines?tab=schedules')
  }

  if (!isNew && !loaded) return <div className="p-6 text-sm text-primary-muted">Loading…</div>

  if (unsupported && existing) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title="Edit Schedule" />
        <p className="mb-4 text-sm text-primary-muted">
          "{existing.name}" is a custom multi-day cycle with different sessions on different days. That can't be edited with
          this simple form yet — you can delete it and set up a new schedule instead.
        </p>
        <Button variant="danger" onClick={() => setDeleteConfirmOpen(true)}>
          Delete schedule
        </Button>
        <ConfirmDialog
          open={deleteConfirmOpen}
          title="Delete this schedule?"
          description="Future occurrences will no longer appear. Past history is kept."
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={async () => {
            await deleteSchedule(existing.id)
            navigate('/routines?tab=schedules')
          }}
        />
      </div>
    )
  }

  return (
    <div className="p-4 pb-28 sm:p-6">
      <PageHeader title={isNew ? 'New Schedule' : 'Edit Schedule'} />

      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-primary-strong">What to schedule</legend>
          <div className="flex gap-2">
            {(['workout', 'recovery', 'rest'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setType(t)
                  setRoutineId('')
                }}
                className={
                  'flex-1 rounded-[var(--radius-control)] border px-3 py-2 text-sm font-medium capitalize ' +
                  (type === t ? 'border-secondary bg-secondary-tint text-secondary' : 'border-primary-border text-primary-muted')
                }
              >
                {t === 'rest' ? 'Rest day' : t}
              </button>
            ))}
          </div>
        </fieldset>

        {type !== 'rest' && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">{type === 'workout' ? 'Routine' : 'Recovery routine'}</span>
            <select
              className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm"
              value={routineId}
              onChange={(e) => setRoutineId(e.target.value)}
            >
              <option value="">Select…</option>
              {(type === 'workout' ? routines : recoveryRoutines).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-primary-strong">Schedule name (optional)</span>
          <input
            className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={routineName || 'e.g. Push Day schedule'}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-primary-strong">{frequency === 'one_off' ? 'Date' : 'Start date'}</span>
          <input
            type="date"
            className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-primary-strong">Repeat frequency</legend>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={frequency === 'interval'} onChange={() => setFrequency('interval')} />
              Every
              <input
                type="number"
                min={1}
                max={60}
                disabled={frequency !== 'interval'}
                className="w-16 rounded-[var(--radius-control)] border border-primary-border px-2 py-1 text-sm disabled:opacity-50"
                value={intervalDays}
                onChange={(e) => setIntervalDays(Math.max(1, Number(e.target.value) || 1))}
              />
              day{intervalDays === 1 ? '' : 's'}
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={frequency === 'weekday'} onChange={() => setFrequency('weekday')} />
              On selected days of the week
            </label>
            {frequency === 'weekday' && (
              <div className="ml-6 flex flex-wrap gap-2">
                {WEEKDAYS.map((w) => (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => toggleWeekday(w.value)}
                    className={
                      'rounded-full border px-3 py-1.5 text-xs font-medium ' +
                      (weekdays.includes(w.value) ? 'border-secondary bg-secondary-tint text-secondary' : 'border-primary-border text-primary-muted')
                    }
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={frequency === 'one_off'} onChange={() => setFrequency('one_off')} />
              One-off — just this single date
            </label>
          </div>
        </fieldset>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-primary-border bg-surface p-3 sm:static sm:mt-6 sm:border-none sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-3xl gap-3">
          <Button variant="ghost" fullWidth onClick={() => navigate('/routines?tab=schedules')}>
            Cancel
          </Button>
          <Button fullWidth onClick={handleSave}>
            Save schedule
          </Button>
        </div>
      </div>
    </div>
  )
}
