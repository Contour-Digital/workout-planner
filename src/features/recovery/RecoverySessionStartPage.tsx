import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getRecoveryRoutine } from '../../db/routinesRepo'
import { startRecoverySession } from '../../db/sessionActions'
import { toDateKey } from '../../lib/recurrence'

export function RecoverySessionStartPage() {
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
        navigate('/routines?tab=recovery', { replace: true })
        return
      }
      const routine = await getRecoveryRoutine(routineId)
      if (!routine) {
        navigate('/routines?tab=recovery', { replace: true })
        return
      }
      const session = await startRecoverySession({
        routine,
        scheduledDate,
        origin: scheduleId ? 'scheduled' : 'impromptu',
        scheduleId,
        occurrenceDate,
      })
      navigate(`/recovery-session/${session.id}`, { replace: true })
    })()
  }, [params, navigate])

  return <div className="p-6 text-sm text-primary-muted">Starting recovery session…</div>
}
