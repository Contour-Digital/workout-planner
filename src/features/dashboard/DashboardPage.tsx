import { useMemo, useState, type ReactElement } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { ProgressBar, ProgressRing } from '../../components/ui/ProgressBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { IconDumbbell, IconFlame, IconLeaf, IconMoon, IconPlay, IconPlus } from '../../components/ui/icons'
import { db } from '../../db/db'
import { getOccurrencesInRange } from '../../db/scheduleRepo'
import { getActiveRecoverySession, getActiveWorkoutSession, getCompletedWorkoutDayKeys, getHistorySessions } from '../../db/sessionsRepo'
import { nextOccurrenceAfter, toDateKey } from '../../lib/recurrence'
import { computeStreak } from '../../lib/streak'
import { useSettingsStore } from '../../store/settingsStore'
import { workoutSetsCompleted } from '../../models/session'
import type { DayAssignment, ResolvedOccurrence } from '../../models/schedule'
import { OccurrenceActionsSheet } from '../schedule/OccurrenceActionsSheet'
import { ImpromptuStartSheet } from '../session/ImpromptuStartSheet'

function assignmentStyle(assignment: DayAssignment): { tone: 'secondary' | 'recovery' | 'rest' | 'neutral'; label: string; icon: ReactElement } {
  if (assignment.kind === 'workout') return { tone: 'secondary', label: 'Workout', icon: <IconDumbbell width={16} height={16} /> }
  if (assignment.kind === 'recovery') return { tone: 'recovery', label: 'Recovery', icon: <IconLeaf width={16} height={16} /> }
  if (assignment.kind === 'rest') return { tone: 'rest', label: 'Rest day', icon: <IconMoon width={16} height={16} /> }
  return { tone: 'neutral', label: 'Off', icon: <IconMoon width={16} height={16} /> }
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [menuOccurrence, setMenuOccurrence] = useState<ResolvedOccurrence | null>(null)
  const [impromptuOpen, setImpromptuOpen] = useState(false)
  const settings = useSettingsStore((s) => s.settings)

  const today = toDateKey(new Date())
  const todayOccurrences = useLiveQuery(() => getOccurrencesInRange(today, today), [today], []) ?? []
  const allSchedulesAndOverrides = useLiveQuery(
    async () => ({ schedules: await db.schedules.toArray(), overrides: await db.occurrenceOverrides.toArray() }),
    [],
  )
  const routines = useLiveQuery(() => db.routines.toArray(), [], []) ?? []
  const recoveryRoutines = useLiveQuery(() => db.recoveryRoutines.toArray(), [], []) ?? []
  const activeWorkout = useLiveQuery(getActiveWorkoutSession, [], undefined)
  const activeRecovery = useLiveQuery(getActiveRecoverySession, [], undefined)
  const completedDayKeys = useLiveQuery(getCompletedWorkoutDayKeys, [], []) ?? []
  const recentSessions = useLiveQuery(() => getHistorySessions(), [], []) ?? []

  const streak = useMemo(() => computeStreak(completedDayKeys, settings.streak), [completedDayKeys, settings.streak])

  const nextOccurrence = useMemo(() => {
    if (!allSchedulesAndOverrides || todayOccurrences.length > 0) return null
    return nextOccurrenceAfter(allSchedulesAndOverrides.schedules, allSchedulesAndOverrides.overrides, today)
  }, [allSchedulesAndOverrides, todayOccurrences, today])

  function routineName(assignment: DayAssignment): string {
    if (assignment.kind === 'workout') return routines.find((r) => r.id === assignment.routineTemplateId)?.name ?? 'Workout'
    if (assignment.kind === 'recovery') return recoveryRoutines.find((r) => r.id === assignment.routineTemplateId)?.name ?? 'Recovery'
    if (assignment.kind === 'rest') return 'Full Rest Day'
    return 'No plan'
  }

  function startOccurrence(occurrence: ResolvedOccurrence) {
    const { assignment } = occurrence
    if (assignment.kind === 'workout') {
      navigate(
        `/session/start?routineId=${assignment.routineTemplateId}&scheduleId=${occurrence.scheduleId}&occurrenceDate=${occurrence.originalDate}&date=${occurrence.date}`,
      )
    } else if (assignment.kind === 'recovery') {
      navigate(
        `/recovery-session/start?routineId=${assignment.routineTemplateId}&scheduleId=${occurrence.scheduleId}&occurrenceDate=${occurrence.originalDate}&date=${occurrence.date}`,
      )
    }
  }

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <p className="text-sm font-medium text-primary-muted">{dateLabel}</p>
        <h1 className="text-2xl font-bold text-primary-strong">Today</h1>
      </div>

      {(activeWorkout || activeRecovery) && (
        <Card className="mb-4 border-secondary bg-secondary-tint">
          {activeWorkout && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-secondary">Workout in progress</p>
                <p className="text-lg font-bold text-primary-strong">{activeWorkout.name}</p>
                <p className="text-sm text-primary-muted">
                  {workoutSetsCompleted(activeWorkout).done} of {workoutSetsCompleted(activeWorkout).total} sets done
                </p>
              </div>
              <Button icon={<IconPlay width={18} height={18} />} onClick={() => navigate(`/session/${activeWorkout.id}`)}>
                Resume
              </Button>
            </div>
          )}
          {activeRecovery && (
            <div className={activeWorkout ? 'mt-3 flex items-center justify-between gap-3 border-t border-secondary-subtle pt-3' : 'flex items-center justify-between gap-3'}>
              <div>
                <p className="text-sm font-semibold text-recovery">Recovery session open</p>
                <p className="text-lg font-bold text-primary-strong">{activeRecovery.name}</p>
              </div>
              <Button variant="secondary" onClick={() => navigate(`/recovery-session/${activeRecovery.id}`)}>
                Open
              </Button>
            </div>
          )}
        </Card>
      )}

      {todayOccurrences.length > 0 ? (
        <div className="mb-4 flex flex-col gap-3">
          {todayOccurrences.map((occ, i) => {
            const style = assignmentStyle(occ.assignment)
            const alreadyStarted = !!occ.sessionId
            return (
              <Card key={`${occ.scheduleId}-${occ.originalDate}-${i}`}>
                <div className="mb-2 flex items-center justify-between">
                  <Badge tone={style.tone === 'neutral' ? 'neutral' : style.tone}>
                    {style.icon}
                    {style.label}
                  </Badge>
                  {occ.status !== 'planned' && <Badge tone="warning">{occ.status}</Badge>}
                </div>
                <h3 className="mb-1 text-lg font-bold text-primary-strong">{routineName(occ.assignment)}</h3>
                <div className="flex gap-2">
                  {occ.assignment.kind !== 'rest' && occ.assignment.kind !== 'off' && occ.status === 'planned' && (
                    <Button icon={<IconPlay width={18} height={18} />} onClick={() => startOccurrence(occ)}>
                      {alreadyStarted ? 'Continue' : 'Start'}
                    </Button>
                  )}
                  {occ.assignment.kind !== 'off' && (
                    <Button variant="ghost" size="sm" onClick={() => setMenuOccurrence(occ)}>
                      Options
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      ) : nextOccurrence ? (
        <EmptyState
          icon={<IconMoon />}
          title="Nothing scheduled today"
          description={`Your next session, "${routineName(nextOccurrence.assignment)}", is on ${nextOccurrence.date}.`}
        />
      ) : (
        <EmptyState
          icon={<IconDumbbell />}
          title="No schedule set up yet"
          description="Create a routine and a recurring schedule to see your plan here."
          action={
            <Button onClick={() => navigate('/routines')} icon={<IconPlus width={18} height={18} />}>
              Go to routines
            </Button>
          }
        />
      )}

      <Button variant="secondary" fullWidth icon={<IconPlus width={18} height={18} />} className="mb-5" onClick={() => setImpromptuOpen(true)}>
        Start impromptu session
      </Button>

      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <ProgressRing value={streak.currentPeriod.workoutDayKeys.length / Math.max(1, settings.streak.targetDaysPerPeriod)} />
          <div className="flex-1">
            <p className="flex items-center gap-1.5 text-lg font-bold text-primary-strong">
              <IconFlame width={20} height={20} className="text-warning" />
              {streak.currentStreak}-period streak
            </p>
            <p className="text-sm text-primary-muted">
              {streak.currentPeriod.workoutDayKeys.length} of {settings.streak.targetDaysPerPeriod} workout days this period
            </p>
          </div>
        </div>
        <ProgressBar
          className="mt-3"
          value={streak.currentPeriod.workoutDayKeys.length / Math.max(1, settings.streak.targetDaysPerPeriod)}
        />
        <p className="mt-2 text-xs text-primary-muted">
          Current period: {streak.currentPeriod.startDate} – {streak.currentPeriod.endDate} ({settings.streak.periodLengthDays}-day{' '}
          {settings.streak.anchor.type === 'rolling' ? 'rolling' : 'weekly'} period). Multiple workouts on one day count once;
          hitting {settings.streak.targetDaysPerPeriod} workout day{settings.streak.targetDaysPerPeriod === 1 ? '' : 's'} keeps
          the streak going.
        </p>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-primary-muted">Recently completed</h2>
        {recentSessions.filter((s) => s.status === 'completed' || s.status === 'partial').length === 0 ? (
          <p className="text-sm text-primary-muted">No completed sessions yet — get started today!</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentSessions
              .filter((s) => s.kind !== 'rest' && (s.status === 'completed' || s.status === 'partial'))
              .slice(0, 5)
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/history/${s.id}`)}
                  className="flex items-center justify-between rounded-[var(--radius-control)] border border-primary-border bg-surface px-4 py-3 text-left hover:bg-primary-tint"
                >
                  <div>
                    <p className="text-sm font-semibold text-primary-strong">{'name' in s ? s.name : 'Session'}</p>
                    <p className="text-xs text-primary-muted">{s.scheduledDate}</p>
                  </div>
                  <Badge tone={s.status === 'completed' ? 'success' : 'warning'}>{s.status}</Badge>
                </button>
              ))}
          </div>
        )}
      </div>

      <OccurrenceActionsSheet occurrence={menuOccurrence} onClose={() => setMenuOccurrence(null)} />
      <ImpromptuStartSheet open={impromptuOpen} onClose={() => setImpromptuOpen(false)} />
    </div>
  )
}
