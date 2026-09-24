import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from '../../store/authStore'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { SignInPage } from './SignInPage'
import { ConfigWarning } from './ConfigWarning'

export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const init = useAuthStore((s) => s.init)

  useEffect(() => {
    if (isSupabaseConfigured) init()
  }, [init])

  if (!isSupabaseConfigured) {
    return <ConfigWarning />
  }

  if (status === 'loading') {
    return <LoadingScreen label="Signing you in…" />
  }

  if (status === 'signedOut') {
    return <SignInPage />
  }

  return <>{children}</>
}
