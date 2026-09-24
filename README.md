# Workout Planner

A mobile-first workout planning and tracking app: build reusable routines (with
optional warm-up/cool-down sections), schedule them on flexible recurring
cycles alongside recovery and rest days, run active workout sessions with
persistent progress, review effort/feelings after each session, and track a
configurable workout streak. Backed by Supabase for accounts and cross-device
sync, with an offline-first local cache so it keeps working without a
connection.

## Stack

- **React 19 + TypeScript + Vite**, mobile-first responsive layout (works up
  to desktop), packaged as an installable PWA (`vite-plugin-pwa`).
- **Supabase** for auth (email/password) and Postgres storage. Every
  user-owned table has row-level security scoped to `auth.uid()`, so one
  user can never read or write another's data even though they share the
  same database.
- **Dexie.js (IndexedDB)** as the local-first cache — the UI always reads
  and writes here first, so the app stays fast and fully usable offline; a
  sync engine reconciles it with Supabase in the background.
- **Zustand** for small global UI state (auth/settings/sync status);
  everything else reads live from IndexedDB via `dexie-react-hooks`'
  `useLiveQuery`, so local storage is the single source of truth for the UI
  — there's no separate in-memory copy of session state to fall out of sync
  or duplicate on restore.
- **React Router** for navigation, **Tailwind CSS v4** for styling with the
  brand palette expressed as design tokens (`src/index.css`), **date-fns** /
  **date-fns-tz** for calendar-safe recurrence math, **Vitest** for tests.

## Project structure

```
src/
  models/       Domain types (exercise, routine, recovery, schedule, session, profile, settings, units)
  db/           Dexie schema + repository functions + business-logic actions + seed data
  db/sync/      Outbox-based push, pull + realtime, and sync engine orchestration (Dexie <-> Supabase)
  lib/          Pure, tested logic: recurrence.ts (scheduling engine), streak.ts (streak engine), useNow.ts, supabaseClient.ts
  store/        Zustand stores (auth, settings/theme, sync status)
  components/ui Reusable design-system primitives (Button, Card, Sheet, ProgressBar, Badge, icons, …)
  features/     Screens, grouped by domain (auth, dashboard, routines, exercises, session, recovery, history, profile, schedule)
  routes/       App shell (nav) + route table
supabase/       (schema lives in the Supabase project itself — see "Database schema" below)
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

### Sync architecture

The app requires signing in (email/password via Supabase Auth), but every
read and write still goes through Dexie first — the UI never waits on a
network round-trip. Two independent mechanisms keep IndexedDB and Supabase
in agreement, both in `src/db/sync/`:

- **Push (outbox):** every write in the repository layer (`src/db/*Repo.ts`,
  `sessionActions.ts`) finishes by calling `enqueueSync(table, id, op)`
  (`src/db/sync/outbox.ts`), which upserts a tiny pending-change marker into
  a local `syncOutbox` table, keyed by `` `${table}:${id}` `` — repeated
  edits to the same record coalesce into one pending entry instead of
  piling up. `flushOutbox()` drains it to Supabase, re-reading each
  record's *current* local state at send time (so only the latest edit is
  ever pushed), retrying failed entries on the next pass rather than
  blocking on them.
- **Pull:** `pullAll()` does a full fetch of the signed-in user's rows
  across every table right after sign-in; after that, a Supabase Realtime
  subscription per table (`subscribeRealtime()`) applies live inserts/
  updates/deletes from other devices/tabs as they happen. Both paths merge
  through the same `mergeRemoteRow()` using last-write-wins on `updatedAt` —
  a remote change only overwrites a local row if it's newer (or the local
  row doesn't exist yet). Applying a pulled row writes straight to the
  Dexie table, bypassing the repo layer, so it never re-enters the outbox —
  there's no push/pull feedback loop.
- **Library exercises** are shared reference data, not user-owned: they're
  seeded once into Supabase (read-only for clients via RLS) and pulled into
  a local cache on every app start, falling back to a bundled copy if the
  network is unreachable.
- **New accounts** get seeded with example routines/recovery routines and an
  8-day training cycle — but only after the initial pull comes back empty,
  so a returning user signing in on a second device doesn't get a duplicate
  set of demo content next to their real data.

`src/features/profile/ProfilePage.tsx` shows live sync status (idle/
syncing/offline/error) and pending-change count, and a **Sign out** button.

## Environment variables

The app needs a Supabase project's URL and anon/publishable key. Copy
`.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
# then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
# (Supabase dashboard -> Settings -> API)
```

| Variable | Where to find it | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project Settings -> API -> Project URL | e.g. `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase project Settings -> API -> anon/publishable key | Safe to expose client-side — access is enforced by Postgres RLS, not by keeping this secret |

### Deploying on Vercel

Set the same two variables under **Project Settings -> Environment
Variables** (for Production, Preview, and Development as you prefer), then
deploy — no other configuration is needed:

- **Framework preset:** Vite (auto-detected)
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm install`

Nothing else in the app reads `process.env`/`import.meta.env`, so these two
variables are the entire environment-variable surface.

## AI routine generator

The "From notes" button on the Workouts tab lets you paste a workout you
wrote elsewhere (notes app, text, spreadsheet) and generates a structured
routine from it, which lands in the routine editor pre-filled for you to
review and edit — nothing is saved until you hit **Save routine**.

This is powered by a Supabase Edge Function (`supabase/functions/parse-workout`)
that calls the Anthropic API. It requires an Anthropic API key set as an Edge
Function secret — this can't be done from the client, so it's a one-time
manual step:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

(or Supabase dashboard -> Edge Functions -> `parse-workout` -> Secrets). Get
a key from [console.anthropic.com](https://console.anthropic.com). Without
this secret set, the "From notes" flow returns an error but the rest of the
app is unaffected.

Exercise names from the parsed notes are fuzzy-matched against your existing
library; anything unmatched becomes a new custom exercise automatically.

## AI assistant (chat)

A floating sparkle button — bottom-right in the routine editor and during an
active workout session — opens a chat window for exercise ideas, warm-up/
cool-down stretch suggestions, and general training questions. When it
suggests a specific exercise, an "Add" button on that suggestion adds it
straight to the routine (or, mid-workout, to the session) using the same
fuzzy-match/auto-create-custom-exercise logic as "From notes".

Conversation history is kept per routine/session in `sessionStorage`, so it
survives navigating around the app but clears when the browser tab/app is
closed. It's powered by a second Edge Function, `supabase/functions/assistant-chat`,
sharing the same `ANTHROPIC_API_KEY` secret as `parse-workout` above — no
extra setup needed if that's already configured.

## Database schema

The Postgres schema (tables, indexes, row-level security policies, and the
realtime publication) was applied directly to the Supabase project via
migrations — there's no separate schema file checked into this repo. To
recreate it elsewhere (or inspect it), pull the schema from the project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db pull        # writes supabase/migrations/*.sql
```

At a glance: `library_exercises` (shared, read-only to clients) plus 12
user-owned tables — `profiles`, `settings`, `custom_exercises`, `routines`,
`recovery_routines`, `schedules`, `occurrence_overrides`, `personal_events`,
`workout_sessions`, `recovery_sessions`, `rest_day_sessions`, `weight_entries`,
`height_entries` — each with a `user_id` (or, for the two singleton tables `profiles`/
`settings`, an `id`) referencing `auth.users(id)`, RLS restricting all
access to `auth.uid()`, and complex nested data (sets, exercise entries,
recovery activities, schedule patterns, reviews) stored as `jsonb` rather
than further normalized, mirroring the shape Dexie already uses locally.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's URL + anon key
npm run dev                  # start the dev server
npm run build                # typecheck + production build
npm run preview              # preview the production build
npm test                     # run the Vitest suite once
npx vitest                   # watch mode
```

On first sign-up, the app seeds itself with a sample exercise library
(pulled from Supabase), five workout routines, two recovery routines, and
an 8-day training cycle (push/pull/lower/recovery/upper/conditioning/
active-recovery/full-rest) starting today, so there's always something on
the Dashboard to try.

## Tests

`npm test` covers pure logic that doesn't require a live Supabase connection:

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
host (Vercel, Netlify, GitHub Pages, S3+CloudFront, etc.) — the app itself
has no server component; Supabase is the only backend dependency, reached
directly from the browser. See **Environment variables** above for what the
host needs configured.
