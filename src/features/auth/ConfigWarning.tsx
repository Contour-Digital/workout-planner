export function ConfigWarning() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="max-w-md rounded-[var(--radius-card)] border border-danger bg-danger-bg p-6">
        <h1 className="mb-2 text-lg font-bold text-primary-strong">Supabase isn't configured</h1>
        <p className="mb-3 text-sm text-primary">
          This app needs <code className="rounded bg-primary-tint px-1 py-0.5">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-primary-tint px-1 py-0.5">VITE_SUPABASE_ANON_KEY</code> set to connect to your Supabase
          project. Right now they're missing, so the app can't sign anyone in.
        </p>
        <p className="text-sm text-primary-muted">
          Locally: copy <code className="rounded bg-primary-tint px-1 py-0.5">.env.example</code> to{' '}
          <code className="rounded bg-primary-tint px-1 py-0.5">.env.local</code> and fill in the values, then restart the dev
          server.
          <br />
          On Vercel: Project Settings → Environment Variables → add both, then redeploy (a redeploy is required — adding the
          variables alone doesn't update a build that already ran).
        </p>
      </div>
    </div>
  )
}
