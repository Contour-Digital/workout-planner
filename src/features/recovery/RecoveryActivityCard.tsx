import { IconCheck } from '../../components/ui/icons'
import type { RecoveryActivityResult } from '../../models/session'

interface RecoveryActivityCardProps {
  activity: RecoveryActivityResult
  onChange: (patch: Partial<RecoveryActivityResult>) => void
}

function targetInputFor(activity: RecoveryActivityResult, onChange: (patch: Partial<RecoveryActivityResult>) => void) {
  switch (activity.trackingType) {
    case 'duration':
      return (
        <NumberInput label="Minutes" value={activity.actualDurationSeconds ? activity.actualDurationSeconds / 60 : undefined} onChange={(v) => onChange({ actualDurationSeconds: v ? v * 60 : undefined })} />
      )
    case 'distance':
      return <NumberInput label="Distance (m)" value={activity.actualDistanceMeters} onChange={(v) => onChange({ actualDistanceMeters: v })} />
    case 'steps':
      return <NumberInput label="Steps" value={activity.actualSteps} onChange={(v) => onChange({ actualSteps: v })} />
    case 'reps':
      return <NumberInput label="Reps" value={activity.actualReps} onChange={(v) => onChange({ actualReps: v })} />
    case 'sleep_duration':
      return <NumberInput label="Hours" value={activity.actualSleepMinutes ? activity.actualSleepMinutes / 60 : undefined} onChange={(v) => onChange({ actualSleepMinutes: v ? v * 60 : undefined })} />
    case 'water_intake':
      return <NumberInput label="Water (ml)" value={activity.actualWaterMl} onChange={(v) => onChange({ actualWaterMl: v })} />
    case 'bedtime':
      return (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-primary-muted">Actual bedtime</span>
          <input
            type="time"
            className="rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
            value={activity.actualBedtimeLocal ?? ''}
            onChange={(e) => onChange({ actualBedtimeLocal: e.target.value })}
          />
        </label>
      )
    default:
      return null
  }
}

export function RecoveryActivityCard({ activity, onChange }: RecoveryActivityCardProps) {
  const isDone = activity.status === 'completed'
  const isSkipped = activity.status === 'skipped'

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-primary-border bg-surface p-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange({ status: isDone ? 'pending' : 'completed', completedAt: isDone ? undefined : new Date().toISOString() })}
          aria-pressed={isDone}
          aria-label={isDone ? `${activity.name} completed, tap to undo` : `Mark ${activity.name} complete`}
          className={
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 ' +
            (isDone ? 'border-success bg-success text-white' : 'border-primary-border text-primary-subtle hover:border-secondary')
          }
        >
          <IconCheck width={20} height={20} />
        </button>
        <div className="flex-1">
          <p className={'text-sm font-semibold ' + (isSkipped ? 'text-primary-subtle line-through' : 'text-primary-strong')}>{activity.name}</p>
          {isSkipped && <p className="text-xs text-primary-subtle">Skipped</p>}
        </div>
        {!isDone && (
          <button
            onClick={() => onChange({ status: isSkipped ? 'pending' : 'skipped' })}
            className="text-xs font-medium text-primary-muted hover:underline"
          >
            {isSkipped ? 'Unskip' : 'Skip'}
          </button>
        )}
      </div>

      {!isSkipped && targetInputFor(activity, onChange)}

      {activity.trackingType === 'notes' && (
        <textarea
          className="min-h-12 rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
          placeholder="Notes"
          value={activity.notes ?? ''}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      )}
    </div>
  )
}

function NumberInput({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-primary-muted">{label}</span>
      <input
        type="number"
        className="w-32 rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </label>
  )
}
