import type { DayAssignment, RecurringSchedule } from '../models/schedule'

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function describeAssignment(assignment: DayAssignment, routineName: (id: string) => string): string {
  if (assignment.kind === 'workout') return routineName(assignment.routineTemplateId)
  if (assignment.kind === 'recovery') return routineName(assignment.routineTemplateId)
  if (assignment.kind === 'rest') return 'Rest day'
  return 'No plan'
}

/** A schedule is "simple" (single routine on a repeat frequency) if it fits one of
 *  the three shapes the schedule editor can create/edit: every-N-days, a fixed set
 *  of weekdays all pointing at the same assignment, or a single one-off date. Any
 *  other shape (a genuine multi-day cycle with different routines per day) is
 *  "complex" and only manageable by deleting/recreating for now. */
export interface SimpleScheduleShape {
  mode: 'interval' | 'weekday' | 'one_off'
  intervalDays?: number
  weekdays?: number[]
  assignment: DayAssignment
}

function sameAssignment(a: DayAssignment, b: DayAssignment): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'workout' && b.kind === 'workout') return a.routineTemplateId === b.routineTemplateId
  if (a.kind === 'recovery' && b.kind === 'recovery') return a.routineTemplateId === b.routineTemplateId
  return true
}

export function analyzeSimpleSchedule(schedule: RecurringSchedule): SimpleScheduleShape | null {
  const { pattern } = schedule
  if (pattern.type === 'one_off') {
    return { mode: 'one_off', assignment: pattern.assignment }
  }
  if (pattern.type === 'weekday') {
    const entries = Object.entries(pattern.assignments).filter(([, a]) => a && a.kind !== 'off')
    if (entries.length === 0) return null
    const first = entries[0][1]!
    if (!entries.every(([, a]) => sameAssignment(a!, first))) return null
    return { mode: 'weekday', weekdays: entries.map(([d]) => Number(d)), assignment: first }
  }
  // cycle
  const nonOffDays = pattern.days
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.kind !== 'off')
  if (nonOffDays.length !== 1 || nonOffDays[0].i !== 0) return null
  return { mode: 'interval', intervalDays: pattern.days.length, assignment: pattern.days[0] }
}

export function describeSchedule(schedule: RecurringSchedule, routineName: (id: string) => string): string {
  const shape = analyzeSimpleSchedule(schedule)
  if (!shape) {
    const kinds = schedule.pattern.type === 'cycle' ? schedule.pattern.days.length : undefined
    return kinds ? `Custom ${kinds}-day cycle` : 'Custom schedule'
  }
  const what = describeAssignment(shape.assignment, routineName)
  if (shape.mode === 'one_off') return `${what} · once on ${schedule.startDate}`
  if (shape.mode === 'weekday') {
    const days = [...(shape.weekdays ?? [])].sort().map((d) => WEEKDAY_SHORT[d]).join(', ')
    return `${what} · every ${days}`
  }
  const n = shape.intervalDays ?? 1
  return `${what} · every ${n === 1 ? 'day' : `${n} days`}`
}
