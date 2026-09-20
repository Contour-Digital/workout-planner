import type { ReactNode } from 'react'

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-primary-strong">{title}</h1>
        {subtitle && <p className="text-sm text-primary-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
