import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { IconChevronLeft, IconChevronRight, IconMoon, IconPlay } from '../../components/ui/icons'
import { db } from '../../db/db'
import { getOccurrencesInRange } from '../../db/scheduleRepo'
import { toDateKey } from '../../lib/recurrence'
import { assignmentStyle, makeRoutineNameResolver, startOccurrence } from './occurrenceDisplay'
import { OccurrenceActionsSheet } from './OccurrenceActionsSheet'
import type { ResolvedOccurrence } from '../../models/schedule'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DOT_CLASS: Record<string, string> = {
  secondary: 'bg-secondary',
  recovery: 'bg-recovery',
  rest: 'bg-rest',
  neutral: 'bg-primary-subtle',
}

export function CalendarPage() {
  const navigate = useNavigate()
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()))
  const [menuOccurrence, setMenuOccurrence] = useState<ResolvedOccurrence | null>(null)

  const gridStart = startOfWeek(startOfMonth(monthCursor))
  const gridEnd = endOfWeek(endOfMonth(monthCursor))
  const gridDays = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd])
  const fromKey = toDateKey(gridStart)
  const toKey = toDateKey(gridEnd)

  const occurrences = useLiveQuery(() => getOccurrencesInRange(fromKey, toKey), [fromKey, toKey], []) ?? []
  const routines = useLiveQuery(() => db.routines.toArray(), [], []) ?? []
  const recoveryRoutines = useLiveQuery(() => db.recoveryRoutines.toArray(), [], []) ?? []
  const routineName = useMemo(() => makeRoutineNameResolver(routines, recoveryRoutines), [routines, recoveryRoutines])

  const occurrencesByDate = useMemo(() => {
    const map = new Map<string, ResolvedOccurrence[]>()
    for (const occ of occurrences) {
      const list = map.get(occ.date)
      if (list) list.push(occ)
      else map.set(occ.date, [occ])
    }
    return map
  }, [occurrences])

  const selectedOccurrences = occurrencesByDate.get(selectedDate) ?? []

  return (
    <div className="p-4 pb-10 sm:p-6">
      <PageHeader title="Calendar" />

      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" icon={<IconChevronLeft width={18} height={18} />} onClick={() => setMonthCursor((m) => subMonths(m, 1))}>
          <span className="sr-only">Previous month</span>
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-primary-strong">{format(monthCursor, 'MMMM yyyy')}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMonthCursor(startOfMonth(new Date()))
              setSelectedDate(toDateKey(new Date()))
            }}
          >
            Today
          </Button>
        </div>
        <Button variant="ghost" size="sm" icon={<IconChevronRight width={18} height={18} />} onClick={() => setMonthCursor((m) => addMonths(m, 1))}>
          <span className="sr-only">Next month</span>
        </Button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-xs font-semibold text-primary-muted">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {gridDays.map((day) => {
          const dateKey = toDateKey(day)
          const dayOccurrences = occurrencesByDate.get(dateKey) ?? []
          const inMonth = isSameMonth(day, monthCursor)
          const selected = dateKey === selectedDate
          return (
            <button
              key={dateKey}
              onClick={() => setSelectedDate(dateKey)}
              className={
                'flex aspect-square flex-col items-center justify-start gap-1 rounded-[var(--radius-control)] border p-1 pt-1.5 text-sm transition-colors ' +
                (selected
                  ? 'border-secondary bg-secondary-tint'
                  : 'border-transparent hover:bg-primary-tint') +
                (!inMonth ? ' opacity-40' : '')
              }
            >
              <span
                className={
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ' +
                  (isToday(day) ? 'bg-secondary text-white' : 'text-primary')
                }
              >
                {format(day, 'd')}
              </span>
              <div className="flex gap-0.5">
                {dayOccurrences.slice(0, 4).map((occ, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[assignmentStyle(occ.assignment).tone]}`}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-bold text-primary-strong">
          {format(parseISO(selectedDate), 'EEEE, MMMM d')}
          {isToday(parseISO(selectedDate)) && <span className="ml-2 text-xs font-normal text-primary-muted">Today</span>}
        </h3>

        {selectedOccurrences.length === 0 ? (
          <EmptyState icon={<IconMoon />} title="Nothing scheduled" description="No workout, recovery, or rest day planned for this date." />
        ) : (
          <div className="flex flex-col gap-3">
            {selectedOccurrences.map((occ, i) => {
              const style = assignmentStyle(occ.assignment)
              return (
                <Card key={`${occ.scheduleId}-${occ.originalDate}-${i}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <Badge tone={style.tone === 'neutral' ? 'neutral' : style.tone}>
                      {style.icon}
                      {style.label}
                    </Badge>
                    {occ.status !== 'planned' && <Badge tone="warning">{occ.status}</Badge>}
                  </div>
                  <h4 className="mb-2 text-base font-bold text-primary-strong">{routineName(occ.assignment)}</h4>
                  <div className="flex gap-2">
                    {occ.assignment.kind !== 'rest' && occ.assignment.kind !== 'off' && occ.status === 'planned' && (
                      <Button size="sm" icon={<IconPlay width={16} height={16} />} onClick={() => startOccurrence(navigate, occ)}>
                        {occ.sessionId ? 'Continue' : 'Start'}
                      </Button>
                    )}
                    {occ.assignment.kind !== 'off' && (
                      <Button size="sm" variant="ghost" onClick={() => setMenuOccurrence(occ)}>
                        Options
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <OccurrenceActionsSheet occurrence={menuOccurrence} onClose={() => setMenuOccurrence(null)} />
    </div>
  )
}
