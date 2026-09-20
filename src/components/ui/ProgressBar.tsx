import clsx from 'clsx'

interface ProgressBarProps {
  value: number // 0-1
  className?: string
  color?: 'secondary' | 'success' | 'warning' | 'recovery'
  label?: string
}

const colorClasses = {
  secondary: 'bg-secondary',
  success: 'bg-success',
  warning: 'bg-warning',
  recovery: 'bg-recovery',
}

export function ProgressBar({ value, className, color = 'secondary', label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={clsx('w-full', className)}>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-primary-tint"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={clsx('h-full rounded-full transition-[width] duration-300', colorClasses[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function ProgressRing({ value, size = 56, strokeWidth = 6 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(1, value))
  const offset = circumference * (1 - pct)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(pct * 100)}% complete`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-primary-tint)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-secondary)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-[stroke-dashoffset] duration-300"
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize={size * 0.28} fill="var(--color-primary)" fontWeight={600}>
        {Math.round(pct * 100)}%
      </text>
    </svg>
  )
}
