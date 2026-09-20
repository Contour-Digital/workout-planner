import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge, type BadgeTone } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { IconHistory } from '../../components/ui/icons'
import { getHistorySessions } from '../../db/sessionsRepo'
import { db } from '../../db/db'
import type { SessionStatus } from '../../models/session'

const STATUS_TONE: Record<SessionStatus, BadgeTone> = {
  completed: 'success',
  partial: 'warning',
  skipped: 'neutral',
  missed: 'danger',
  in_progress: 'secondary',
  open: 'recovery',
}

export function HistoryPage() {
  const navigate = useNavigate()
  const sessions = useLiveQuery(() => getHistorySessions(), [], []) ?? []
  const routines = useLiveQuery(() => db.routines.toArray(), [], []) ?? []

  const [statusFilter, setStatusFilter] = useState<'all' | SessionStatus>('all')
  const [routineFilter, setRoutineFilter] = useState<'all' | string>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (routineFilter !== 'all' && (!('routineTemplateId' in s) || s.routineTemplateId !== routineFilter)) return false
      if (from && s.scheduledDate < from) return false
      if (to && s.scheduledDate > to) return false
      return true
    })
  }, [sessions, statusFilter, routineFilter, from, to])

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="History" />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select
          className="rounded-[var(--radius-control)] border border-primary-border px-2 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | SessionStatus)}
        >
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="partial">Partial</option>
          <option value="skipped">Skipped</option>
          <option value="missed">Missed</option>
          <option value="in_progress">In progress</option>
          <option value="open">Open</option>
        </select>
        <select
          className="rounded-[var(--radius-control)] border border-primary-border px-2 py-2 text-sm"
          value={routineFilter}
          onChange={(e) => setRoutineFilter(e.target.value)}
        >
          <option value="all">All routines</option>
          {routines.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <input type="date" className="rounded-[var(--radius-control)] border border-primary-border px-2 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="rounded-[var(--radius-control)] border border-primary-border px-2 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<IconHistory />} title="No sessions found" description="Try adjusting your filters, or complete a workout to see it here." />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => navigate(`/history/${s.id}`)}
                className="flex w-full items-center justify-between rounded-[var(--radius-control)] border border-primary-border bg-surface px-4 py-3 text-left hover:bg-primary-tint"
              >
                <div>
                  <p className="text-sm font-semibold text-primary-strong">{'name' in s ? s.name : 'Rest day'}</p>
                  <p className="text-xs text-primary-muted">
                    {s.scheduledDate} · {s.kind}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[s.status]}>{s.status.replace('_', ' ')}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
