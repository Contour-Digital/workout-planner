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

**Rest timer**: there's a global default (duration + on/off) under Profile,
but `SessionStartPage` also asks at the top of every "start workout" flow —
before the session is created — letting you set a duration or turn the timer
off for just that session. The choice is stored on the session itself
(`restTimerEnabled`/`restTimerSeconds`), overriding both the global toggle
and each exercise's own configured rest duration for the rest of that
workout.

When a rest period ends, `RestTimerBar` shows a system notification via
`lib/notify.ts`'s `showNotification()` (gated behind the "Notifications"
toggle under Profile, which requests permission the first time it's turned
on). That helper goes through the registered service worker's
`showNotification()` first — required on Android Chrome, where the
page-level `Notification` constructor throws outright — falling back to
that constructor only where no service worker is registered. It's a local
notification (no server round-trip), which is the right fit here: the
countdown is already tracked client-side down to the second, and a real
push notification's delivery isn't timely enough for something that fires
within seconds. True push (e.g. a reminder before a scheduled workout, sent
even while the app's fully closed) would need separate infrastructure — a
stored Web Push subscription per device and a server-side sender — and
isn't built yet.

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

## Renaming library exercises

Custom exercises are already fully editable. Built-in library exercises
aren't — they're shared reference data pulled from the `library_exercises`
Supabase table, the same for every user — but Profile -> Library -> "Rename
exercises" lets you change just a built-in exercise's title, for yourself.
That's stored as a separate per-user row in `library_exercise_overrides`
(`src/db/exercisesRepo.ts`'s `setLibraryExerciseName`/`resetLibraryExerciseName`),
applied on top of the shared name wherever exercises are read
(`getAllExercises`/`getExercise`) — the shared library row itself is never
touched, so a rename can't affect other users or survive a "Reset".

## Muscle diagrams

`MuscleDiagram` (used in `ExerciseDetailSheet`) shows a front and back body
with the exercise's primary muscles highlighted at near-full opacity and
secondary muscles at ~40% opacity — same color, different transparency, so
it reads as "how much" a muscle is worked at a glance. Muscles the exercise
doesn't touch render in a flat neutral tone, so the whole body still shows
as a complete silhouette rather than empty space.

The body outline and muscle regions (`src/components/ui/bodyMusclePaths.ts`)
are real anatomical SVG path data, vendored from
[body-muscles](https://github.com/vulovix/body-muscles) by Ivan Vulović
(Apache License 2.0 — full text and required NOTICE in
`THIRD_PARTY_NOTICES.md`), trimmed to just each shape's id and path data.
`MuscleDiagram.tsx`'s `MUSCLE_ID_TO_GROUP` maps the vendored library's ~90
fine-grained shape ids (e.g. `chest-upper-left`, `lats-mid-right`) onto this
app's own `MuscleGroup` type; shapes with no mapping (head, hands, feet,
knees, …) still render in the neutral tone, since no exercise here targets
them specifically.

## AI assistant ("Spot")

A "Spot" trigger opens a chat window for exercise ideas, warm-up/cool-down
stretch suggestions, and general training questions. It has two layouts
(`AssistantChat`'s `floating` prop): inline — a "Spot" button placed in the
page's own layout, used inline in the active workout session (between
"Save as reusable routine" and "Session notes") — and floating — a small
round icon fixed bottom-right, used on the Dashboard, the Workouts tab, and
the routine editor, none of which have a natural bottom-bar slot for an
inline trigger (the routine editor's Cancel/Save bar is its own fixed
footer, so Spot floats above it there via `floatingPositionClassName`,
which overrides the default position to clear it). Each instance opens with a
short greeting bubble tailored to where it was opened from, so it's clear
what it can actually do there before you type anything; the Workouts tab's
greeting also surfaces a "Generate a routine from notes" quick-action chip
(replacing the header's old standalone "From notes" button) that opens the
same notes-parsing sheet described above. When Spot suggests a specific
exercise, an "Add" button on that suggestion adds it straight to the
routine (or, mid-workout, to the session) using the same
fuzzy-match/auto-create-custom-exercise logic as "From notes".

Conversation history is kept per routine/session in `sessionStorage`, so it
survives navigating around the app but clears when the browser tab/app is
closed. It's powered by a second Edge Function, `supabase/functions/assistant-chat`,
sharing the same `ANTHROPIC_API_KEY` secret as `parse-workout` above — no
extra setup needed if that's already configured.

## Post-workout review

Finishing a workout computes two things for free, no AI involved: any
exercises left with unchecked sets ("missed"), and any exercise where this
session's best set (by weight, then distance, duration, or reps — whichever
the exercise tracks) beat your last time doing it ("achievements" — real
progressive-overload PBs, not guessed). Both show up in the review sheet and
stay attached to the session in history.

From there, a "Generate" button on the review sheet can ask the AI to write
a short recap of the session and estimate perceived effort (RPE 1-10) —
fed the exact facts computed above (durations, best sets, misses,
achievements) so it's synthesizing a write-up, not inventing numbers. The
same call can also surface a couple of general coaching tips (pacing, rest,
recovery) and up to two specific exercise suggestions worth adding next
time (e.g. a missing warm-up, balancing push/pull volume) — both only when
something genuinely stands out, not padded out for the sake of it. A
suggested exercise can be added straight to the session's routine with one
tap ("Add to routine"), reusing the same fuzzy-match-or-create flow as the
AI assistant's suggestions; the button only appears when the session came
from a saved routine. Powered by a third Edge Function,
`supabase/functions/workout-summary`, on the same `ANTHROPIC_API_KEY`
secret. It's opt-in per session (a button, not automatic) so it never runs
— or costs anything — unless asked for.

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
