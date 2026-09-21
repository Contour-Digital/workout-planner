import type { ReactElement } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import { IconDumbbell, IconLeaf, IconMoon } from '../../components/ui/icons'
import type { DayAssignment, ResolvedOccurrence } from '../../models/schedule'
import type { RecoveryRoutineTemplate } from '../../models/recovery'
import type { RoutineTemplate } from '../../models/routine'

export function assignmentStyle(assignment: DayAssignment): {
  tone: 'secondary' | 'recovery' | 'rest' | 'neutral'
  label: string
  icon: ReactElement
} {
  if (assignment.kind === 'workout') return { tone: 'secondary', label: 'Workout', icon: <IconDumbbell width={16} height={16} /> }
  if (assignment.kind === 'recovery') return { tone: 'recovery', label: 'Recovery', icon: <IconLeaf width={16} height={16} /> }
  if (assignment.kind === 'rest') return { tone: 'rest', label: 'Rest day', icon: <IconMoon width={16} height={16} /> }
  return { tone: 'neutral', label: 'Off', icon: <IconMoon width={16} height={16} /> }
}

export function makeRoutineNameResolver(routines: RoutineTemplate[], recoveryRoutines: RecoveryRoutineTemplate[]) {
  return (assignment: DayAssignment): string => {
    if (assignment.kind === 'workout') return routines.find((r) => r.id === assignment.routineTemplateId)?.name ?? 'Workout'
    if (assignment.kind === 'recovery') return recoveryRoutines.find((r) => r.id === assignment.routineTemplateId)?.name ?? 'Recovery'
    if (assignment.kind === 'rest') return 'Full Rest Day'
    return 'No plan'
  }
}

export function startOccurrence(navigate: NavigateFunction, occurrence: ResolvedOccurrence): void {
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
