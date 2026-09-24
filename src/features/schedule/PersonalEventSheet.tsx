import { useEffect, useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { IconEdit, IconTrash } from '../../components/ui/icons'
import { deletePersonalEvent, deletePersonalEventSeriesFrom, savePersonalEvent, skipPersonalEventOccurrence } from '../../db/personalEventsRepo'
import { createEmptyPersonalEvent, type EventRecurrence, type PersonalEvent } from '../../models/calendarEvent'
import type { Weekday } from '../../models/schedule'

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

interface PersonalEventSheetProps {
  open: boolean
  /** null means creating a brand-new event anchored on occurrenceDate. */
  event: PersonalEvent | null
  /** The event's start date (create mode), or the specific occurrence date being viewed. */
  occurrenceDate: string
  defaultColor: string
  onClose: () => void
}

export function PersonalEventSheet({ open, event, occurrenceDate, defaultColor, onClose }: PersonalEventSheetProps) {
  const [editing, setEditing] = useState(!event)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [color, setColor] = useState(defaultColor)
  const [startDate, setStartDate] = useState(occurrenceDate)
  const [recurrenceType, setRecurrenceType] = useState<EventRecurrence['type']>('none')
  const [everyDays, setEveryDays] = useState(7)
  const [weekdays, setWeekdays] = useState<Weekday[]>([])
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmingDeleteSeries, setConfirmingDeleteSeries] = useState(false)

  useEffect(() => {
    if (!open) return
    setEditing(!event)
    setError(null)
    setTitle(event?.title ?? '')
    setNotes(event?.notes ?? '')
    setColor(event?.color ?? defaultColor)
    setStartDate(event?.startDate ?? occurrenceDate)
    setRecurrenceType(event?.recurrence.type ?? 'none')
    setEveryDays(event?.recurrence.type === 'interval' ? event.recurrence.everyDays : 7)
    setWeekdays(event?.recurrence.type === 'weekly' ? event.recurrence.weekdays : [])
    setEndDate(event?.endDate ?? '')
  }, [open, event, occurrenceDate, defaultColor])

  if (!open) return null

  function toggleWeekday(d: Weekday) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((v) => v !== d) : [...prev, d]))
  }

  async function handleSave() {
    if (!title.trim()) {
      setError('Give the event a title.')
      return
    }
    if (recurrenceType === 'weekly' && weekdays.length === 0) {
      setError('Pick at least one day of the week.')
      return
    }

    let recurrence: EventRecurrence = { type: 'none' }
    if (recurrenceType === 'interval') recurrence = { type: 'interval', everyDays: Math.max(1, everyDays) }
    if (recurrenceType === 'weekly') recurrence = { type: 'weekly', weekdays }

    const base = event ?? createEmptyPersonalEvent(startDate, color)
    const toSave: PersonalEvent = {
      ...base,
      title: title.trim(),
      notes: notes.trim() || undefined,
      color,
      startDate,
      endDate: recurrenceType === 'none' ? undefined : endDate || undefined,
      recurrence,
    }
    await savePersonalEvent(toSave)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? (event ? 'Edit event' : 'New event') : event?.title}>
      {!editing && event ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: event.color }} aria-hidden="true" />
            <p className="text-sm font-medium text-primary-strong">{event.title}</p>
          </div>
          {event.notes && <p className="text-sm text-primary-muted">{event.notes}</p>}

          <Button variant="secondary" fullWidth icon={<IconEdit width={16} height={16} />} onClick={() => setEditing(true)}>
            Edit event
          </Button>
          {event.recurrence.type !== 'none' && (
            <Button
              variant="secondary"
              fullWidth
              onClick={async () => {
                await skipPersonalEventOccurrence(event.id, occurrenceDate)
                onClose()
              }}
            >
              Remove this date only
            </Button>
          )}
          <Button variant="danger" fullWidth icon={<IconTrash width={16} height={16} />} onClick={() => setConfirmingDeleteSeries(true)}>
            Delete event
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Title</span>
            <input
              className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. On shift"
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

          <label className="flex items-center gap-3">
            <span className="text-sm font-medium text-primary-strong">Colour</span>
            <input
              type="color"
              className="h-9 w-14 cursor-pointer rounded-[var(--radius-control)] border border-primary-border bg-transparent p-1"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Date</span>
            <input
              type="date"
              className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-primary-strong">Repeat</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={recurrenceType === 'none'} onChange={() => setRecurrenceType('none')} />
              Doesn't repeat
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={recurrenceType === 'interval'} onChange={() => setRecurrenceType('interval')} />
              Every
              <input
                type="number"
                min={1}
                max={60}
                disabled={recurrenceType !== 'interval'}
                className="w-16 rounded-[var(--radius-control)] border border-primary-border px-2 py-1 text-sm disabled:opacity-50"
                value={everyDays}
                onChange={(e) => setEveryDays(Math.max(1, Number(e.target.value) || 1))}
              />
              day{everyDays === 1 ? '' : 's'}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={recurrenceType === 'weekly'} onChange={() => setRecurrenceType('weekly')} />
              On selected days of the week
            </label>
            {recurrenceType === 'weekly' && (
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
          </fieldset>

          {recurrenceType !== 'none' && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-primary-strong">End date (optional)</span>
              <input
                type="date"
                className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-3">
            <Button
              variant="ghost"
              fullWidth
              onClick={() => {
                if (event) setEditing(false)
                else onClose()
              }}
            >
              Cancel
            </Button>
            <Button fullWidth onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmingDeleteSeries}
        title="Delete this event?"
        description={
          event?.recurrence.type !== 'none'
            ? 'This ends the repeating event from this date onward. Past history is kept.'
            : 'This event will be permanently deleted.'
        }
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmingDeleteSeries(false)}
        onConfirm={async () => {
          if (!event) return
          if (event.recurrence.type === 'none') await deletePersonalEvent(event.id)
          else await deletePersonalEventSeriesFrom(event.id, occurrenceDate)
          setConfirmingDeleteSeries(false)
          onClose()
        }}
      />
    </Sheet>
  )
}
