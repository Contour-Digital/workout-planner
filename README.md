# Workout Planner

A mobile-first workout planning and tracking app: build reusable routines (with
optional warm-up/cool-down sections), schedule them on flexible recurring
cycles alongside recovery and rest days, run active workout sessions with
persistent progress, review effort/feelings after each session, and track a
configurable workout streak.

## Stack

- **React 19 + TypeScript + Vite**, mobile-first responsive layout (works up
  to desktop), packaged as an installable PWA (`vite-plugin-pwa`).
- **Dexie.js (IndexedDB)** as the local-first data layer — offline by
  default. The repository layer in `src/db/` is the only place that touches
  Dexie directly, so a backend/sync layer can be added later without
  reworking feature code.
- **Zustand** for small global UI state (settings/theme); everything else
  reads live from IndexedDB via `dexie-react-hooks`' `useLiveQuery`, so the
  database is the single source of truth — there's no separate in-memory
  copy of session state to fall out of sync or duplicate on restore.
- **React Router** for navigation, **Tailwind CSS v4** for styling with the
  brand palette expressed as design tokens (`src/index.css`), **date-fns** /
  **date-fns-tz** for calendar-safe recurrence math, **Vitest** for tests.

## Project structure

```
src/
  models/       Domain types (exercise, routine, recovery, schedule, session, profile, settings, units)
  db/           Dexie schema + repository functions + business-logic actions (sessionActions.ts, scheduleRepo.ts) + seed data
  lib/          Pure, tested logic: recurrence.ts (scheduling engine), streak.ts (streak engine), useNow.ts
  store/        Zustand stores (settings/theme)
  components/ui Reusable design-system primitives (Button, Card, Sheet, ProgressBar, Badge, icons, …)
  features/     Screens, grouped by domain (dashboard, routines, exercises, session, recovery, history, profile, schedule)
  routes/       App shell (nav) + route table
```

### Data model

Reusable templates (`RoutineTemplate`, `RecoveryRoutineTemplate`) are kept
separate from the recurring schedule that places them on the calendar
(`RecurringSchedule`), which is separate again from what actually happened
(`WorkoutSession` / `RecoverySession` / `RestDaySession`). Editing a template
never rewrites history, because sessions snapshot exercise names and targets
at start time.

**Scheduling** uses a "virtual occurrence" model instead of a fixed list of
duplicated future workouts: `RecurringSchedule` stores a pattern (a
multi-day cycle, a weekday selection, or a one-off date) plus a start/end
date, and `src/lib/recurrence.ts` resolves the actual dates on demand for
any date range. Editing "this occurrence only" writes a small
`OccurrenceOverride` row keyed by the occurrence's original date (reschedule
/ skip / mark missed / delete / swap that day's routine). Editing "this and
all future occurrences" splits the schedule in two at that date
(`splitScheduleAtDate`): the original is truncated with an `endDate`, and a
new schedule takes over from that date with the cycle phase preserved, so
untouched future days don't shift. All recurrence math is calendar-day based
(`differenceInCalendarDays`/`addDays` on Y-M-D), which sidesteps DST
entirely rather than trying to account for it with offsets.

**Streaks** are computed by `src/lib/streak.ts` from the distinct calendar
days that have a completed/partial workout (so multiple sessions on one day
count once), grouped into configurable periods (rolling or fixed-weekday),
each of which needs N qualifying days to keep the streak.

**Active session persistence**: a session's elapsed time is derived from
stored timestamps (`startedAt`, `pauseIntervals`, `restTimerEndsAt`) via
`elapsedSeconds()`, not an in-memory counter, so it's correct after
backgrounding or a full reload. Starting a workout is idempotent — if a
session already exists for a given schedule occurrence, `startWorkoutSession`
returns it instead of creating a duplicate, which is what makes app-restore
safe.

## Running it

```bash
npm install
npm run dev       # start the dev server
npm run build      # typecheck + production build
npm run preview    # preview the production build
npm test           # run the Vitest suite once
npx vitest         # watch mode
```

The app seeds itself on first run with a sample exercise library, five
workout routines, two recovery routines, and an 8-day training cycle
(push/pull/lower/recovery/upper/conditioning/active-recovery/full-rest)
starting today, so there's always something on the Dashboard to try.

## Tests

`npm test` covers:

- `src/lib/__tests__/recurrence.test.ts` — every-N-days cycles, weekday
  patterns, one-off dates, a DST spring-forward boundary, reschedule/skip/
  delete overrides not affecting other occurrences, and this-and-future
  schedule splitting.
- `src/lib/__tests__/streak.test.ts` — same-day dedup, goal-met detection,
  multi-period streak counting and breaking, and a weekday-anchored period.
- `src/models/__tests__/units.test.ts` — kg/lb and cm/(ft,in) round-trips.

## Deploying

`npm run build` produces a static `dist/` folder (including a service
worker/manifest from `vite-plugin-pwa`) that can be hosted on any static
host (Netlify, Vercel, GitHub Pages, S3+CloudFront, etc.) — there's no
server component. Because all data lives in the browser's IndexedDB, each
browser/device currently has its own independent data; the repository layer
in `src/db/` is the intended integration point for adding a backend and
sync later without touching feature code.
