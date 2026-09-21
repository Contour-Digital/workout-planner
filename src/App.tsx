import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes/routes'
import { AuthGate } from './features/auth/AuthGate'
import { useAuthStore } from './store/authStore'
import { useSettingsStore } from './store/settingsStore'
import { ensureProfile } from './db/profileRepo'
import { seedDemoDataIfNewAccount } from './db/seed'
import { startSync, stopSync } from './db/sync/syncEngine'
import { flushOutbox } from './db/sync/push'

export default function App() {
  return (
    <AuthGate>
      <SyncedApp />
    </AuthGate>
  )
}

function SyncedApp() {
  const userId = useAuthStore((s) => s.userId)
  const loadSettings = useSettingsStore((s) => s.load)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    ;(async () => {
      // Pull first: only after we know what (if anything) this user already has
      // in Supabase is it safe to create local defaults / seed demo data — otherwise
      // a returning user on a new device would get a fresh local default profile
      // whose `updatedAt` is newer than their real one, and last-write-wins would
      // wrongly keep the empty default instead of applying their synced data.
      await startSync(userId)
      await Promise.all([ensureProfile(), loadSettings()])
      await seedDemoDataIfNewAccount()
      await flushOutbox(userId)
      if (!cancelled) setReady(true)
    })()

    return () => {
      cancelled = true
      stopSync()
    }
  }, [userId, loadSettings])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-primary-muted">
        Loading Workout Planner…
      </div>
    )
  }

  return <RouterProvider router={router} />
}
