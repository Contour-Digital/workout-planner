import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { RoutinesListPage } from '../features/routines/RoutinesListPage'
import { RoutineEditorPage } from '../features/routines/RoutineEditorPage'
import { RecoveryRoutineEditorPage } from '../features/routines/RecoveryRoutineEditorPage'
import { ExerciseLibraryPage } from '../features/exercises/ExerciseLibraryPage'
import { HistoryPage } from '../features/history/HistoryPage'
import { HistoryDetailPage } from '../features/history/HistoryDetailPage'
import { ProfilePage } from '../features/profile/ProfilePage'
import { ExerciseNamesPage } from '../features/profile/ExerciseNamesPage'
import { SessionStartPage } from '../features/session/SessionStartPage'
import { ActiveWorkoutPage } from '../features/session/ActiveWorkoutPage'
import { RecoverySessionStartPage } from '../features/recovery/RecoverySessionStartPage'
import { RecoverySessionPage } from '../features/recovery/RecoverySessionPage'
import { ScheduleEditorPage } from '../features/schedule/ScheduleEditorPage'
import { CalendarPage } from '../features/schedule/CalendarPage'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/routines', element: <RoutinesListPage /> },
      { path: '/routines/new', element: <RoutineEditorPage /> },
      { path: '/routines/:id', element: <RoutineEditorPage /> },
      { path: '/recovery-routines/new', element: <RecoveryRoutineEditorPage /> },
      { path: '/recovery-routines/:id', element: <RecoveryRoutineEditorPage /> },
      { path: '/exercises', element: <ExerciseLibraryPage /> },
      { path: '/history', element: <HistoryPage /> },
      { path: '/history/:id', element: <HistoryDetailPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/settings/exercise-names', element: <ExerciseNamesPage /> },
      { path: '/session/start', element: <SessionStartPage /> },
      { path: '/session/:id', element: <ActiveWorkoutPage /> },
      { path: '/recovery-session/start', element: <RecoverySessionStartPage /> },
      { path: '/recovery-session/:id', element: <RecoverySessionPage /> },
      { path: '/schedules/new', element: <ScheduleEditorPage /> },
      { path: '/schedules/:id', element: <ScheduleEditorPage /> },
      { path: '/calendar', element: <CalendarPage /> },
    ],
  },
])
