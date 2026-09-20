import type { ReactNode } from 'react'
import clsx from 'clsx'

export type BadgeTone = 'success' | 'warning' | 'danger' | 'recovery' | 'rest' | 'neutral' | 'secondary'

const toneClasses: Record<BadgeTone, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  recovery: 'bg-recovery-bg text-recovery',
  rest: 'bg-rest-bg text-rest',
  neutral: 'bg-primary-tint text-primary-muted',
  secondary: 'bg-secondary-tint text-secondary',
}

export function Badge({ tone = 'neutral', icon, children }: { tone?: BadgeTone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        toneClasses[tone],
      )}
    >
      {icon}
      {children}
    </span>
  )
}
