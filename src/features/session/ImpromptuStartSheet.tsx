import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { getActiveRecoveryRoutines, getActiveRoutines } from '../../db/routinesRepo'

interface ImpromptuStartSheetProps {
  open: boolean
  onClose: () => void
}

export function ImpromptuStartSheet({ open, onClose }: ImpromptuStartSheetProps) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'menu' | 'pick-workout' | 'pick-recovery'>('menu')
  const routines = useLiveQuery(getActiveRoutines, [], []) ?? []
  const recoveryRoutines = useLiveQuery(getActiveRecoveryRoutines, [], []) ?? []

  function reset() {
    setMode('menu')
    onClose()
  }

  return (
    <Sheet open={open} onClose={reset} title="Start impromptu session">
      {mode === 'menu' && (
        <div className="flex flex-col gap-2">
          <Button fullWidth onClick={() => { navigate('/session/start'); reset() }}>
            Start a blank workout
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setMode('pick-workout')}>
            Start from an existing routine
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setMode('pick-recovery')}>
            Start a recovery session
          </Button>
        </div>
      )}

      {mode === 'pick-workout' && (
        <div className="flex flex-col gap-2">
          {routines.length === 0 && <p className="text-sm text-primary-muted">No routines yet.</p>}
          {routines.map((r) => (
            <Button
              key={r.id}
              variant="secondary"
              fullWidth
              onClick={() => { navigate(`/session/start?routineId=${r.id}`); reset() }}
            >
              {r.name}
            </Button>
          ))}
          <Button variant="ghost" fullWidth onClick={() => setMode('menu')}>
            Back
          </Button>
        </div>
      )}

      {mode === 'pick-recovery' && (
        <div className="flex flex-col gap-2">
          {recoveryRoutines.length === 0 && <p className="text-sm text-primary-muted">No recovery routines yet.</p>}
          {recoveryRoutines.map((r) => (
            <Button
              key={r.id}
              variant="secondary"
              fullWidth
              onClick={() => { navigate(`/recovery-session/start?routineId=${r.id}`); reset() }}
            >
              {r.name}
            </Button>
          ))}
          <Button variant="ghost" fullWidth onClick={() => setMode('menu')}>
            Back
          </Button>
        </div>
      )}
    </Sheet>
  )
}
