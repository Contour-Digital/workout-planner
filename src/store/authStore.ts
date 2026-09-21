import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn'
  session: Session | null
  userId: string | null
  init: () => void
}

let initialized = false

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  session: null,
  userId: null,
  init: () => {
    if (initialized) return
    initialized = true

    supabase.auth.getSession().then(({ data }) => {
      set({
        session: data.session,
        userId: data.session?.user.id ?? null,
        status: data.session ? 'signedIn' : 'signedOut',
      })
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        userId: session?.user.id ?? null,
        status: session ? 'signedIn' : 'signedOut',
      })
    })
  },
}))
