import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNow } from '../../lib/useNow'
import { Button } from '../../components/ui/Button'
import { IconClock, IconX } from '../../components/ui/icons'
import { useSettingsStore } from '../../store/settingsStore'
import { showNotification } from '../../lib/notify'

/** Floats above the page (fixed position, portalled to body) so it stays visible
 *  no matter how far you've scrolled into the exercise list — the whole point of a
 *  rest timer is that you can see it without hunting for it. */
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
        showNotification('Rest complete', { body: 'Time for your next set.', tag: 'rest-timer' })
      }
      onComplete()
    }
  }, [remainingMs, onComplete, settings.vibrationEnabled, settings.notificationsEnabled])

  const mm = Math.floor(remainingSeconds / 60)
  const ss = remainingSeconds % 60

  return createPortal(
    <div className="fixed inset-x-4 bottom-56 z-40 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-8 sm:justify-end">
      <div className="flex w-full max-w-xs items-center gap-3 rounded-[var(--radius-card)] bg-secondary-tint px-4 py-3 shadow-xl ring-1 ring-secondary/30">
        <IconClock width={20} height={20} className="shrink-0 text-secondary" />
        <span className="text-2xl font-bold tabular-nums text-secondary">
          {mm}:{ss.toString().padStart(2, '0')}
        </span>
        <span className="flex-1 text-sm font-medium text-secondary">Rest</span>
        <Button size="sm" variant="ghost" icon={<IconX width={16} height={16} />} onClick={onCancel}>
          Skip
        </Button>
      </div>
    </div>,
    document.body,
  )
}
