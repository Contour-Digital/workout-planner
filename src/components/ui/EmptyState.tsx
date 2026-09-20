import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-primary-border px-6 py-10 text-center">
      {icon && <div className="text-4xl">{icon}</div>}
      <p className="font-semibold text-primary-strong">{title}</p>
      {description && <p className="max-w-xs text-sm text-primary-muted">{description}</p>}
      {action}
    </div>
  )
}
