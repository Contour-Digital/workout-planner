import { useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import {
  deleteOccurrence,
  deleteSeriesFrom,
  markOccurrenceMissed,
  rescheduleOccurrence,
  skipOccurrence,
} from '../../db/scheduleRepo'
import type { ResolvedOccurrence } from '../../models/schedule'

interface OccurrenceActionsSheetProps {
  occurrence: ResolvedOccurrence | null
  onClose: () => void
}

export function OccurrenceActionsSheet({ occurrence, onClose }: OccurrenceActionsSheetProps) {
  const [rescheduling, setRescheduling] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [confirmingDeleteSeries, setConfirmingDeleteSeries] = useState(false)

  if (!occurrence) return null

  return (
    <Sheet open={!!occurrence} onClose={onClose} title={occurrence.scheduleName}>
      {rescheduling ? (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">New date</span>
            <input
              type="date"
              className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </label>
          <Button
            fullWidth
            disabled={!newDate}
            onClick={async () => {
              await rescheduleOccurrence(occurrence.scheduleId, occurrence.originalDate, newDate)
              onClose()
            }}
          >
            Confirm new date
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setRescheduling(false)}>
            Back
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              setNewDate(occurrence.date)
              setRescheduling(true)
            }}
          >
            Reschedule this occurrence
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={async () => {
              await skipOccurrence(occurrence.scheduleId, occurrence.originalDate)
              onClose()
            }}
          >
            Skip this occurrence
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={async () => {
              await markOccurrenceMissed(occurrence.scheduleId, occurrence.originalDate)
              onClose()
            }}
          >
            Mark as missed
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={async () => {
              await deleteOccurrence(occurrence.scheduleId, occurrence.originalDate)
              onClose()
            }}
          >
            Delete this occurrence only
          </Button>
          <Button variant="danger" fullWidth onClick={() => setConfirmingDeleteSeries(true)}>
            Delete this and all future occurrences
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmingDeleteSeries}
        title="Delete future occurrences?"
        description="This ends the repeating schedule from this date onward. Past history is kept."
        confirmLabel="Delete series"
        danger
        onCancel={() => setConfirmingDeleteSeries(false)}
        onConfirm={async () => {
          await deleteSeriesFrom(occurrence.scheduleId, occurrence.date)
          setConfirmingDeleteSeries(false)
          onClose()
        }}
      />
    </Sheet>
  )
}
