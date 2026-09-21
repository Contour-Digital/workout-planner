import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { addHeightEntry, addWeightEntry, getHeightHistory, getProfile, getWeightHistory, saveProfile } from '../../db/profileRepo'
import { calculateAge } from '../../models/profile'
import { displayHeightFor, displayWeightFor, parseHeightInput, parseWeightInput } from './unitHelpers'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { db } from '../../db/db'
import { StreakSettingsCard } from './StreakSettingsCard'
import { supabase } from '../../lib/supabaseClient'
import { useSyncStore } from '../../store/syncStore'

export function ProfilePage() {
  const profile = useLiveQuery(getProfile)
  const weightHistory = useLiveQuery(getWeightHistory, [], []) ?? []
  const heightHistory = useLiveQuery(getHeightHistory, [], []) ?? []
  const { settings, update } = useSettingsStore()

  const [newWeight, setNewWeight] = useState('')
  const [newHeight, setNewHeight] = useState('')

  if (!profile) return <div className="p-6 text-sm text-primary-muted">Loading…</div>

  const age = profile.dob ? calculateAge(profile.dob) : undefined
  const latestWeight = weightHistory[0]
  const latestHeight = heightHistory[0]

  async function exportData() {
    const dump: Record<string, unknown> = {}
    for (const table of db.tables) {
      dump[table.name] = await table.toArray()
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workout-planner-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 pb-10 sm:p-6">
      <PageHeader title="Profile & Settings" />

      <Card className="mb-4 flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary-muted">Profile</h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-primary-strong">Name</span>
          <input
            className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm"
            defaultValue={profile.name}
            onBlur={(e) => saveProfile({ name: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-primary-strong">Date of birth</span>
          <input
            type="date"
            className="rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm"
            defaultValue={profile.dob ?? ''}
            onBlur={(e) => saveProfile({ dob: e.target.value || undefined })}
          />
        </label>
        {age !== undefined && <p className="text-sm text-primary-muted">Age: {age}</p>}
      </Card>

      <Card className="mb-4 flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary-muted">Health details</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-primary-strong">
              Weight: {latestWeight ? displayWeightFor(latestWeight.valueKg, profile.weightUnit) : '—'}
            </p>
            {latestWeight && <p className="text-xs text-primary-muted">Last updated {new Date(latestWeight.recordedAt).toLocaleString()}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder={`Weight (${profile.weightUnit})`}
            className="flex-1 rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
          />
          <Button
            onClick={async () => {
              const v = Number(newWeight)
              if (!v || v <= 0) return
              await addWeightEntry(parseWeightInput(v, profile.weightUnit))
              setNewWeight('')
            }}
          >
            Log weight
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-primary-strong">
              Height: {latestHeight ? displayHeightFor(latestHeight.valueCm, profile.heightUnit) : '—'}
            </p>
            {latestHeight && <p className="text-xs text-primary-muted">Last updated {new Date(latestHeight.recordedAt).toLocaleString()}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder={`Height (${profile.heightUnit === 'cm' ? 'cm' : 'inches'})`}
            className="flex-1 rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm"
            value={newHeight}
            onChange={(e) => setNewHeight(e.target.value)}
          />
          <Button
            onClick={async () => {
              const v = Number(newHeight)
              if (!v || v <= 0) return
              await addHeightEntry(parseHeightInput(v, profile.heightUnit))
              setNewHeight('')
            }}
          >
            Log height
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-primary-muted">Weight unit</span>
            <select
              className="rounded-[var(--radius-control)] border border-primary-border px-2 py-2 text-sm"
              value={profile.weightUnit}
              onChange={(e) => saveProfile({ weightUnit: e.target.value as 'kg' | 'lb' })}
            >
              <option value="kg">Kilograms</option>
              <option value="lb">Pounds</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-primary-muted">Height unit</span>
            <select
              className="rounded-[var(--radius-control)] border border-primary-border px-2 py-2 text-sm"
              value={profile.heightUnit}
              onChange={(e) => saveProfile({ heightUnit: e.target.value as 'cm' | 'ft_in' })}
            >
              <option value="cm">Centimetres</option>
              <option value="ft_in">Feet / inches</option>
            </select>
          </label>
        </div>
      </Card>

      <StreakSettingsCard settings={settings.streak} onChange={(streak) => update({ streak })} />

      <Card className="mb-4 flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary-muted">Session preferences</h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-primary-strong">Default rest timer (seconds)</span>
          <input
            type="number"
            className="w-32 rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm"
            defaultValue={settings.defaultRestSeconds}
            onBlur={(e) => update({ defaultRestSeconds: Number(e.target.value) || 60 })}
          />
        </label>
        <ToggleRow label="Sound" checked={settings.soundEnabled} onChange={(v) => update({ soundEnabled: v })} />
        <ToggleRow label="Vibration" checked={settings.vibrationEnabled} onChange={(v) => update({ vibrationEnabled: v })} />
        <ToggleRow label="Show exercise media" checked={settings.showExerciseMedia} onChange={(v) => update({ showExerciseMedia: v })} />
        <ToggleRow
          label="Notifications (rest timer complete)"
          checked={settings.notificationsEnabled}
          onChange={async (v) => {
            if (v && 'Notification' in window && Notification.permission !== 'granted') {
              const perm = await Notification.requestPermission()
              if (perm !== 'granted') return
            }
            update({ notificationsEnabled: v })
          }}
        />
      </Card>

      <Card className="mb-4 flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary-muted">Appearance</h2>
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => update({ theme: t })}
              className={
                'flex-1 rounded-[var(--radius-control)] border px-3 py-2 text-sm font-medium capitalize ' +
                (settings.theme === t ? 'border-secondary bg-secondary-tint text-secondary' : 'border-primary-border text-primary-muted')
              }
            >
              {t}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4 flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary-muted">Data</h2>
        <Button variant="secondary" onClick={exportData}>
          Export all data (JSON)
        </Button>
      </Card>

      <AccountCard />
    </div>
  )
}

function AccountCard() {
  const email = useAuthStore((s) => s.session?.user.email)
  const syncState = useSyncStore((s) => s.state)
  const lastError = useSyncStore((s) => s.lastError)
  const pendingCount = useSyncStore((s) => s.pendingCount)

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-primary-muted">Account</h2>
      <p className="text-sm text-primary-muted">Signed in as {email}</p>
      <p className="text-sm text-primary-muted">
        Sync:{' '}
        <span className={syncState === 'error' ? 'font-medium text-danger' : 'font-medium text-primary'}>
          {syncState === 'syncing' ? 'Syncing…' : syncState === 'offline' ? 'Offline — will sync when reconnected' : syncState === 'error' ? 'Sync error' : 'Up to date'}
        </span>
        {pendingCount > 0 && ` (${pendingCount} pending)`}
      </p>
      {lastError && <p className="text-xs text-danger">{lastError}</p>}
      <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
        Sign out
      </Button>
    </Card>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-primary-strong">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" />
    </label>
  )
}
