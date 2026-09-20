import { Card } from '../../components/ui/Card'
import type { StreakAnchor, StreakSettings } from '../../models/settings'

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function StreakSettingsCard({ settings, onChange }: { settings: StreakSettings; onChange: (s: StreakSettings) => void }) {
  function setAnchor(anchor: StreakAnchor) {
    onChange({ ...settings, anchor })
  }

  return (
    <Card className="mb-4 flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-primary-muted">Streak settings</h2>
      <p className="text-xs text-primary-muted">
        A streak period is {settings.periodLengthDays} day(s) long. Completing at least {settings.targetDaysPerPeriod} distinct
        workout day{settings.targetDaysPerPeriod === 1 ? '' : 's'} within a period keeps your streak going — extra workouts on
        the same day don't count twice, and skipped/missed sessions don't break it as long as you still hit the goal.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-primary-muted">Period length (days)</span>
          <input
            type="number"
            min={1}
            max={31}
            className="rounded-[var(--radius-control)] border border-primary-border px-2 py-2 text-sm"
            value={settings.periodLengthDays}
            onChange={(e) => onChange({ ...settings, periodLengthDays: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-primary-muted">Workout days needed (1-10)</span>
          <input
            type="number"
            min={1}
            max={10}
            className="rounded-[var(--radius-control)] border border-primary-border px-2 py-2 text-sm"
            value={settings.targetDaysPerPeriod}
            onChange={(e) => onChange({ ...settings, targetDaysPerPeriod: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium text-primary-muted">Period reset</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={settings.anchor.type === 'rolling'} onChange={() => setAnchor({ type: 'rolling' })} />
          Rolling — resets every {settings.periodLengthDays} days
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={settings.anchor.type === 'weekday'}
            onChange={() => setAnchor({ type: 'weekday', weekday: 1 })}
          />
          Fixed weekday
        </label>
        {settings.anchor.type === 'weekday' && (
          <select
            className="ml-6 w-40 rounded-[var(--radius-control)] border border-primary-border px-2 py-2 text-sm"
            value={settings.anchor.weekday}
            onChange={(e) => setAnchor({ type: 'weekday', weekday: Number(e.target.value) as 0 | 1 | 2 | 3 | 4 | 5 | 6 })}
          >
            {WEEKDAY_LABELS.map((label, i) => (
              <option key={i} value={i}>
                {label}
              </option>
            ))}
          </select>
        )}
      </fieldset>
    </Card>
  )
}
