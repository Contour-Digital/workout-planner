import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabaseClient'

export function SignInPage() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signUpMessage, setSignUpMessage] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSignUpMessage(null)

    if (!email.trim() || !password) {
      setError('Enter an email and password.')
      return
    }
    if (mode === 'signUp' && password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) setError(error.message)
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) {
          setError(error.message)
        } else if (!data.session) {
          setSignUpMessage('Check your email to confirm your account, then sign in.')
          setMode('signIn')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-primary-strong">Workout Planner</h1>
        <p className="mb-6 text-center text-sm text-primary-muted">
          {mode === 'signIn' ? 'Sign in to your account' : 'Create an account to get started'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Email</span>
            <input
              type="email"
              autoComplete="email"
              className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary-strong">Password</span>
            <input
              type="password"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}
          {signUpMessage && <p className="text-sm text-success">{signUpMessage}</p>}

          <Button type="submit" fullWidth loading={loading}>
            {mode === 'signIn' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <button
          className="mt-4 w-full text-center text-sm font-medium text-secondary hover:underline"
          onClick={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn')
            setError(null)
            setSignUpMessage(null)
          }}
        >
          {mode === 'signIn' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
