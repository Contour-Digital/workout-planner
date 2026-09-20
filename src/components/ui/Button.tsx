import type { ButtonHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg' | 'sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
  fullWidth?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-secondary text-white hover:bg-secondary-strong active:brightness-95 disabled:bg-primary-subtle',
  secondary: 'bg-white text-secondary border border-secondary hover:bg-secondary-tint disabled:text-primary-subtle disabled:border-primary-border',
  ghost: 'bg-transparent text-primary hover:bg-primary-tint disabled:text-primary-subtle',
  danger: 'bg-danger text-white hover:brightness-95 disabled:bg-primary-subtle',
}

const sizeClasses: Record<Size, string> = {
  sm: 'text-sm px-3 py-2 min-h-[40px]',
  md: 'text-sm px-4 py-2.5 min-h-[44px]',
  lg: 'text-base px-5 py-3.5 min-h-[52px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  fullWidth,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary',
        'disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : icon}
      {children}
    </button>
  )
}
