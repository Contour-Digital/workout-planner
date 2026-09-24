import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { getRoutine } from '../../db/routinesRepo'
import { startWorkoutSession, startBlankWorkoutSession } from '../../db/sessionActions'
import { toDateKey } from '../../lib/recurrence'
import { useSettingsStore } from '../../store/settingsStore'
import type { RoutineTemplate } from '../../models/routine'

/** Resolves a "start a workout" intent (from a routine, a scheduled occurrence, or
 *  blank) and, once the rest timer choice below is confirmed, creates the session
 *  and redirects into the active session screen. */
export function SessionStartPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const defaultRestSeconds = useSettingsStore((s) => s.settings.defaultRestSeconds)
  const globalRestTimerEnabled = useSettingsStore((s) => s.settings.restTimerEnabled)

  const routineId = params.get('routineId')
  const scheduleId = params.get('scheduleId') ?? undefined
  const occurrenceDate = params.get('occurrenceDate') ?? undefined
  const scheduledDate = params.get('date') ?? toDateKey(new Date())

  const [routine, setRoutine] = useState<RoutineTemplate | null | undefined>(routineId ? undefined : null)
  const [restEnabled, setRestEnabled] = useState(globalRestTimerEnabled)
  const [restSeconds, setRestSeconds] = useState(defaultRestSeconds)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!routineId) return
    getRoutine(routineId).then(setRoutine)
  }, [routineId])

  async function start() {
    setStarting(true)
    if (!routineId) {
      const session = await startBlankWorkoutSession('Workout', {
        enabled: restEnabled,
        seconds: restEnabled ? restSeconds : undefined,
      })
      navigate(`/session/${session.id}`, { replace: true })
      return
    }
    if (!routine) {
      navigate('/routines', { replace: true })
      return
    }
    const session = await startWorkoutSession({
      routine,
      scheduledDate,
      origin: scheduleId ? 'scheduled' : 'impromptu',
      scheduleId,
      occurrenceDate,
      restTimerEnabled: restEnabled,
      restTimerSeconds: restEnabled ? restSeconds : undefined,
    })
    navigate(`/session/${session.id}`, { replace: true })
  }

  if (routineId && routine === undefined) {
    return <div className="p-6 text-sm text-primary-muted">Loading…</div>
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title={routine ? routine.name : 'Start workout'} subtitle="Set your rest timer before you begin." />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-primary-border p-3">
          <div>
            <p className="text-sm font-medium text-primary-strong">Rest timer</p>
            <p className="text-xs text-primary-muted">Shows a countdown after each completed set.</p>
          </div>
          <input
            type="checkbox"
            aria-label="Rest timer enabled"
            checked={restEnabled}
            onChange={(e) => setRestEnabled(e.target.checked)}
            className="h-5 w-5"
          />
        </div>

        {restEnabled && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Duration (seconds)</span>
            <input
              type="number"
              min={5}
              step={5}
              className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
              value={restSeconds}
              onChange={(e) => setRestSeconds(Math.max(5, Number(e.target.value) || 5))}
            />
          </label>
        )}

        <Button fullWidth size="lg" loading={starting} onClick={start}>
          Start workout
        </Button>
      </div>
    </div>
  )
}
