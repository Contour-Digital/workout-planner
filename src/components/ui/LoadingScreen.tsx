import { IconDumbbell } from './icons'

export function LoadingScreen({ label = 'Loading your data…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-primary-border border-t-secondary" />
        <IconDumbbell width={30} height={30} className="animate-bounce text-secondary" />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-base font-bold text-primary-strong">Workout Planner</p>
        <p className="animate-pulse text-sm text-primary-muted">{label}</p>
      </div>
    </div>
  )
}
