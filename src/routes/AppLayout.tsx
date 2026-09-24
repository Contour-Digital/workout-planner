import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { IconDashboard, IconDumbbell, IconHistory, IconUser } from '../components/ui/icons'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/routines', label: 'Workouts', icon: IconDumbbell, end: false },
  { to: '/history', label: 'History', icon: IconHistory, end: false },
  { to: '/profile', label: 'Profile', icon: IconUser, end: false },
]

export function AppLayout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col bg-bg sm:flex-row">
      <nav
        aria-label="Primary"
        className="hidden w-56 shrink-0 flex-col gap-1 border-r border-primary-border p-4 sm:flex"
      >
        <div className="mb-4 px-2 text-lg font-bold text-primary-strong">Workout Planner</div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium',
                isActive ? 'bg-secondary-tint text-secondary' : 'text-primary hover:bg-primary-tint',
              )
            }
          >
            <item.icon width={20} height={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 pb-28 sm:pb-8">
        <Outlet />
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-primary-border bg-surface/95 px-2 backdrop-blur sm:hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.625rem)' }}
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                'flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium',
                isActive ? 'text-secondary' : 'text-primary-muted',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon width={22} height={22} strokeWidth={isActive ? 2.4 : 2} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
