import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { CategoryBadge } from '../../components/ui/CategoryBadge'
import { ProgressBar, ProgressRing } from '../../components/ui/ProgressBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { IconCalendar, IconDumbbell, IconFlame, IconMoon, IconPlay, IconPlus } from '../../components/ui/icons'
import { db } from '../../db/db'
import { getOccurrencesInRange } from '../../db/scheduleRepo'
import { getActiveRecoverySession, getActiveWorkoutSession, getCompletedWorkoutDayKeys, getHistorySessions } from '../../db/sessionsRepo'
import { nextOccurrenceAfter, toDateKey } from '../../lib/recurrence'
import { computeStreak } from '../../lib/streak'
import { useSettingsStore } from '../../store/settingsStore'
import { workoutSetsCompleted } from '../../models/session'
import type { ResolvedOccurrence } from '../../models/schedule'
import { assignmentColor, assignmentStyle, makeRoutineNameResolver, startOccurrence } from '../schedule/occurrenceDisplay'
import { OccurrenceActionsSheet } from '../schedule/OccurrenceActionsSheet'
import { ImpromptuStartSheet } from '../session/ImpromptuStartSheet'
import { AssistantChat } from '../assistant/AssistantChat'
import type { AssistantContext } from '../../lib/assistantChat'

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

  const routineName = useMemo(() => makeRoutineNameResolver(routines, recoveryRoutines), [routines, recoveryRoutines])

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary-muted">{dateLabel}</p>
          <h1 className="text-2xl font-bold text-primary-strong">Today</h1>
        </div>
        <Button variant="secondary" size="sm" icon={<IconCalendar width={18} height={18} />} onClick={() => navigate('/calendar')}>
          Calendar
        </Button>
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
                  <CategoryBadge color={assignmentColor(occ.assignment, settings.calendarColors)} icon={style.icon}>
                    {style.label}
                  </CategoryBadge>
                  {occ.status !== 'planned' && <Badge tone="warning">{occ.status}</Badge>}
                </div>
                <h3 className="mb-1 text-lg font-bold text-primary-strong">{routineName(occ.assignment)}</h3>
                <div className="flex gap-2">
                  {occ.assignment.kind !== 'rest' && occ.assignment.kind !== 'off' && occ.status === 'planned' && (
                    <Button icon={<IconPlay width={18} height={18} />} onClick={() => startOccurrence(navigate, occ)}>
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

      <AssistantChat
        floating
        storageKey="dashboard"
        buildContext={(): AssistantContext => ({ kind: 'general' })}
        greeting="Hi, I'm Spot! Ask me about exercises, training questions, or what to do today — I'm here whenever you need a hand."
      />
    </div>
  )
}
