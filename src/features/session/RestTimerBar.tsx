import { useEffect, useRef } from 'react'
import { useNow } from '../../lib/useNow'
import { Button } from '../../components/ui/Button'
import { IconX } from '../../components/ui/icons'
import { useSettingsStore } from '../../store/settingsStore'

export function RestTimerBar({ endsAt, onCancel, onComplete }: { endsAt: string; onCancel: () => void; onComplete: () => void }) {
  const now = useNow(250)
  const settings = useSettingsStore((s) => s.settings)
  const remainingMs = Math.max(0, new Date(endsAt).getTime() - now)
  const remainingSeconds = Math.ceil(remainingMs / 1000)
  const firedRef = useRef(false)

  useEffect(() => {
    if (remainingMs === 0 && !firedRef.current) {
      firedRef.current = true
      if (settings.vibrationEnabled && 'vibrate' in navigator) navigator.vibrate?.(200)
      if (settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Rest complete', { body: 'Time for your next set.' })
      }
      onComplete()
    }
  }, [remainingMs, onComplete, settings.vibrationEnabled, settings.notificationsEnabled])

  const mm = Math.floor(remainingSeconds / 60)
  const ss = remainingSeconds % 60

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-control)] bg-secondary-tint px-4 py-3">
      <span className="text-lg font-bold tabular-nums text-secondary">
        {mm}:{ss.toString().padStart(2, '0')}
      </span>
      <span className="flex-1 text-sm font-medium text-secondary">Rest</span>
      <Button size="sm" variant="ghost" icon={<IconX width={16} height={16} />} onClick={onCancel}>
        Skip
      </Button>
    </div>
  )
}
