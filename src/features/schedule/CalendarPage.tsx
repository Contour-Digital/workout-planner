import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { CategoryBadge } from '../../components/ui/CategoryBadge'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { IconChevronLeft, IconChevronRight, IconMoon, IconPlay, IconPlus } from '../../components/ui/icons'
import { db } from '../../db/db'
import { getOccurrencesInRange } from '../../db/scheduleRepo'
import { getAllPersonalEvents } from '../../db/personalEventsRepo'
import { toDateKey } from '../../lib/recurrence'
import { resolvePersonalEventsInRange, type ResolvedPersonalEvent } from '../../lib/personalEvents'
import { assignmentColor, assignmentStyle, dropRedundantOffOccurrences, makeRoutineNameResolver, startOccurrence } from './occurrenceDisplay'
import { OccurrenceActionsSheet } from './OccurrenceActionsSheet'
import { PersonalEventSheet } from './PersonalEventSheet'
import { useSettingsStore } from '../../store/settingsStore'
import type { ResolvedOccurrence } from '../../models/schedule'
import type { PersonalEvent } from '../../models/calendarEvent'
import type { CalendarCategoryColors } from '../../models/settings'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const CATEGORY_LEGEND: { key: keyof CalendarCategoryColors; label: string }[] = [
  { key: 'workout', label: 'Workout' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'rest', label: 'Rest day' },
  { key: 'event', label: 'Event (default)' },
]

type EventSheetState = { event: PersonalEvent | null; date: string }

export function CalendarPage() {
  const navigate = useNavigate()
  const { settings, update } = useSettingsStore()
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()))
  const [menuOccurrence, setMenuOccurrence] = useState<ResolvedOccurrence | null>(null)
  const [eventSheet, setEventSheet] = useState<EventSheetState | null>(null)

  const gridStart = startOfWeek(startOfMonth(monthCursor))
  const gridEnd = endOfWeek(endOfMonth(monthCursor))
  const gridDays = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd])
  const fromKey = toDateKey(gridStart)
  const toKey = toDateKey(gridEnd)

  const occurrences = useLiveQuery(() => getOccurrencesInRange(fromKey, toKey), [fromKey, toKey], []) ?? []
  const personalEvents = useLiveQuery(getAllPersonalEvents, [], []) ?? []
  const routines = useLiveQuery(() => db.routines.toArray(), [], []) ?? []
  const recoveryRoutines = useLiveQuery(() => db.recoveryRoutines.toArray(), [], []) ?? []
  const routineName = useMemo(() => makeRoutineNameResolver(routines, recoveryRoutines), [routines, recoveryRoutines])

  const resolvedEvents = useMemo(() => resolvePersonalEventsInRange(personalEvents, fromKey, toKey), [personalEvents, fromKey, toKey])

  const occurrencesByDate = useMemo(() => {
    const map = new Map<string, ResolvedOccurrence[]>()
    for (const occ of occurrences) {
      const list = map.get(occ.date)
      if (list) list.push(occ)
      else map.set(occ.date, [occ])
    }
    for (const [date, list] of map) map.set(date, dropRedundantOffOccurrences(list))
    return map
  }, [occurrences])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ResolvedPersonalEvent[]>()
    for (const re of resolvedEvents) {
      const list = map.get(re.date)
      if (list) list.push(re)
      else map.set(re.date, [re])
    }
    return map
  }, [resolvedEvents])

  const colors = settings.calendarColors
  const selectedOccurrences = occurrencesByDate.get(selectedDate) ?? []
  const selectedEvents = eventsByDate.get(selectedDate) ?? []

  function setCategoryColor(key: keyof CalendarCategoryColors, value: string) {
    update({ calendarColors: { ...colors, [key]: value } })
  }

  return (
    <div className="p-4 pb-10 sm:p-6">
      <PageHeader title="Calendar" />

      <div className="mb-4 flex flex-wrap gap-3">
        {CATEGORY_LEGEND.map((c) => (
          <label key={c.key} className="flex items-center gap-1.5 text-xs text-primary-muted">
            <span className="h-5 w-5 overflow-hidden rounded-full border border-primary-border">
              <input
                type="color"
                value={colors[c.key]}
                onChange={(e) => setCategoryColor(c.key, e.target.value)}
                className="h-8 w-8 -m-1.5 cursor-pointer border-none p-0"
                aria-label={`${c.label} colour`}
              />
            </span>
            {c.label}
          </label>
        ))}
      </div>

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
          const dayEvents = eventsByDate.get(dateKey) ?? []
          const dotColors = [
            ...dayOccurrences.map((occ) => assignmentColor(occ.assignment, colors)),
            ...dayEvents.map((re) => re.event.color),
          ]
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
                {dotColors.slice(0, 4).map((color, i) => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-primary-strong">
            {format(parseISO(selectedDate), 'EEEE, MMMM d')}
            {isToday(parseISO(selectedDate)) && <span className="ml-2 text-xs font-normal text-primary-muted">Today</span>}
          </h3>
          <Button
            size="sm"
            variant="secondary"
            icon={<IconPlus width={16} height={16} />}
            onClick={() => setEventSheet({ event: null, date: selectedDate })}
          >
            Add event
          </Button>
        </div>

        {selectedOccurrences.length === 0 && selectedEvents.length === 0 ? (
          <EmptyState icon={<IconMoon />} title="Nothing here" description="No workout, recovery, rest day, or personal event planned for this date." />
        ) : (
          <div className="flex flex-col gap-3">
            {selectedOccurrences.map((occ, i) => {
              const style = assignmentStyle(occ.assignment)
              const color = assignmentColor(occ.assignment, colors)
              return (
                <Card key={`${occ.scheduleId}-${occ.originalDate}-${i}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <CategoryBadge color={color} icon={style.icon}>
                      {style.label}
                    </CategoryBadge>
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

            {selectedEvents.map((re) => (
              <Card key={re.event.id}>
                <div className="mb-2 flex items-center justify-between">
                  <CategoryBadge color={re.event.color}>Event</CategoryBadge>
                </div>
                <h4 className="mb-2 text-base font-bold text-primary-strong">{re.event.title}</h4>
                {re.event.notes && <p className="mb-3 text-sm text-primary-muted">{re.event.notes}</p>}
                <Button size="sm" variant="ghost" onClick={() => setEventSheet({ event: re.event, date: re.date })}>
                  Options
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <OccurrenceActionsSheet occurrence={menuOccurrence} onClose={() => setMenuOccurrence(null)} />
      <PersonalEventSheet
        open={!!eventSheet}
        event={eventSheet?.event ?? null}
        occurrenceDate={eventSheet?.date ?? selectedDate}
        defaultColor={colors.event}
        onClose={() => setEventSheet(null)}
      />
    </div>
  )
}
