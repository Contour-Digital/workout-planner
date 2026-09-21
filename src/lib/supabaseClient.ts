import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local for local dev, ' +
      'or set them in your host (e.g. Vercel project settings -> Environment Variables) and redeploy.',
  )
}

// Deliberately never throw here: this module is imported at the very top of the app's
// module graph (App -> AuthGate -> authStore -> here), so throwing would blank the
// whole page before React ever mounts, with nothing on screen to explain why. When
// misconfigured, we build a client pointed at a harmless placeholder host instead —
// every call site already handles Supabase being unreachable (offline, etc.)
// gracefully, and <ConfigWarning /> tells the user what to fix.
export const supabase = createClient(
  isSupabaseConfigured ? url : 'https://not-configured.invalid',
  isSupabaseConfigured ? anonKey : 'not-configured',
)
