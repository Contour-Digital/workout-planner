import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes/routes'
import { seedIfEmpty } from './db/seed'
import { ensureProfile } from './db/profileRepo'
import { useSettingsStore } from './store/settingsStore'

export default function App() {
  const [ready, setReady] = useState(false)
  const loadSettings = useSettingsStore((s) => s.load)

  useEffect(() => {
    Promise.all([seedIfEmpty(), loadSettings(), ensureProfile()]).then(() => setReady(true))
  }, [loadSettings])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-primary-muted">
        Loading Workout Planner…
      </div>
    )
  }

  return <RouterProvider router={router} />
}
