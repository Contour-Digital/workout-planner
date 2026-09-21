import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from '../../store/authStore'
import { SignInPage } from './SignInPage'

export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const init = useAuthStore((s) => s.init)

  useEffect(() => {
    init()
  }, [init])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-primary-muted">
        Loading Workout Planner…
      </div>
    )
  }

  if (status === 'signedOut') {
    return <SignInPage />
  }

  return <>{children}</>
}
