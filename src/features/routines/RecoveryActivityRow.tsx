import { IconTrash } from '../../components/ui/icons'
import { RECOVERY_TRACKING_LABELS, type RecoveryActivityConfig, type RecoveryTrackingType } from '../../models/recovery'

interface RecoveryActivityRowProps {
  activity: RecoveryActivityConfig
  onChange: (activity: RecoveryActivityConfig) => void
  onRemove: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

const TRACKING_TYPES = Object.keys(RECOVERY_TRACKING_LABELS) as RecoveryTrackingType[]

export function RecoveryActivityRow({ activity, onChange, onRemove, onMoveUp, onMoveDown }: RecoveryActivityRowProps) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-primary-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <button type="button" aria-label="Move up" disabled={!onMoveUp} onClick={onMoveUp} className="text-primary-subtle hover:text-primary disabled:opacity-30">
            ▲
          </button>
          <button type="button" aria-label="Move down" disabled={!onMoveDown} onClick={onMoveDown} className="text-primary-subtle hover:text-primary disabled:opacity-30">
            ▼
          </button>
        </div>
        <input
          className="flex-1 rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
          value={activity.name}
          onChange={(e) => onChange({ ...activity, name: e.target.value })}
          placeholder="Activity name"
        />
        <button type="button" onClick={onRemove} aria-label="Remove activity" className="rounded-full p-2 text-danger hover:bg-danger-bg">
          <IconTrash width={18} height={18} />
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-primary-muted">Tracking method</span>
        <select
          className="rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
          value={activity.trackingType}
          onChange={(e) => onChange({ ...activity, trackingType: e.target.value as RecoveryTrackingType })}
        >
          {TRACKING_TYPES.map((t) => (
            <option key={t} value={t}>
              {RECOVERY_TRACKING_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      {activity.trackingType === 'duration' && (
        <TargetField label="Target duration (seconds)" value={activity.targetDurationSeconds} onChange={(v) => onChange({ ...activity, targetDurationSeconds: v })} />
      )}
      {activity.trackingType === 'distance' && (
        <TargetField label="Target distance (metres)" value={activity.targetDistanceMeters} onChange={(v) => onChange({ ...activity, targetDistanceMeters: v })} />
      )}
      {activity.trackingType === 'steps' && (
        <TargetField label="Target steps" value={activity.targetSteps} onChange={(v) => onChange({ ...activity, targetSteps: v })} />
      )}
      {activity.trackingType === 'reps' && (
        <TargetField label="Target repetitions" value={activity.targetReps} onChange={(v) => onChange({ ...activity, targetReps: v })} />
      )}
      {activity.trackingType === 'sleep_duration' && (
        <TargetField label="Target sleep (minutes)" value={activity.targetSleepMinutes} onChange={(v) => onChange({ ...activity, targetSleepMinutes: v })} />
      )}
      {activity.trackingType === 'water_intake' && (
        <TargetField label="Target water (ml)" value={activity.targetWaterMl} onChange={(v) => onChange({ ...activity, targetWaterMl: v })} />
      )}
      {activity.trackingType === 'bedtime' && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-primary-muted">Target bedtime</span>
          <input
            type="time"
            className="rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
            value={activity.targetBedtimeLocal ?? ''}
            onChange={(e) => onChange({ ...activity, targetBedtimeLocal: e.target.value })}
          />
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-primary-muted">Notes (optional)</span>
        <input
          className="rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
          value={activity.notes ?? ''}
          onChange={(e) => onChange({ ...activity, notes: e.target.value })}
        />
      </label>
    </div>
  )
}

function TargetField({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-primary-muted">{label}</span>
      <input
        type="number"
        className="rounded-[var(--radius-control)] border border-primary-border px-2 py-1.5 text-sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </label>
  )
}
