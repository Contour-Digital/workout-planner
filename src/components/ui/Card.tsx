import type { HTMLAttributes } from 'react'
import clsx from 'clsx'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'rounded-[var(--radius-card)] border border-primary-border bg-surface p-4 shadow-sm',
        className,
      )}
      {...rest}
    />
  )
}
