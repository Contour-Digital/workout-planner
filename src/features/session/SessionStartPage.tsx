import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getRoutine } from '../../db/routinesRepo'
import { startWorkoutSession, startBlankWorkoutSession } from '../../db/sessionActions'
import { toDateKey } from '../../lib/recurrence'

/** Resolves a "start a workout" intent (from a routine, a scheduled occurrence, or
 *  blank) into an idempotent session, then redirects into the active session screen. */
export function SessionStartPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      const routineId = params.get('routineId')
      const scheduleId = params.get('scheduleId') ?? undefined
      const occurrenceDate = params.get('occurrenceDate') ?? undefined
      const scheduledDate = params.get('date') ?? toDateKey(new Date())

      if (!routineId) {
        const session = await startBlankWorkoutSession()
        navigate(`/session/${session.id}`, { replace: true })
        return
      }
      const routine = await getRoutine(routineId)
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
      })
      navigate(`/session/${session.id}`, { replace: true })
    })()
  }, [params, navigate])

  return <div className="p-6 text-sm text-primary-muted">Starting workout…</div>
}
