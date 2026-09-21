import { db } from '../db'
import { supabase } from '../../lib/supabaseClient'
import { SYNC_TABLE_CONFIGS, type SyncTableConfig } from './syncConfig'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { SEED_LIBRARY_EXERCISES } from '../seedExercises'

/** Applies a remote row locally using last-write-wins on `updatedAt` where present.
 *  Rows without an `updatedAt` (weight/height log entries) are append-only, so any
 *  remote copy is applied unconditionally — there's nothing to conflict with. */
async function mergeRemoteRow(config: SyncTableConfig, remoteRow: Record<string, unknown>, userId: string) {
  const localRow = config.fromRemote(remoteRow, userId)
  const table = config.localTable()
  const existing = await table.get(localRow.id as string)
  if (!existing) {
    await table.put(localRow)
    return
  }
  const remoteUpdated = localRow.updatedAt as string | undefined
  const localUpdated = (existing as Record<string, unknown>).updatedAt as string | undefined
  if (!remoteUpdated || !localUpdated || remoteUpdated >= localUpdated) {
    await table.put(localRow)
  }
}

/** Full initial pull of every user-owned table, run once right after sign-in
 *  (and after reconnecting from a long offline stretch). Cheap even for a
 *  returning user with lots of history — Postgres/Supabase easily returns
 *  a few thousand small JSON rows in well under a second. */
export async function pullAll(userId: string): Promise<void> {
  for (const config of SYNC_TABLE_CONFIGS) {
    const filterColumn = config.singleton ? 'id' : 'user_id'
    const { data, error } = await supabase.from(config.remoteTable).select('*').eq(filterColumn, userId)
    if (error || !data) continue
    for (const remoteRow of data) {
      await mergeRemoteRow(config, remoteRow, userId)
    }
  }
}

/** Shared reference data — no user scoping, no push. Pulled once at startup and
 *  falls back to the bundled seed list if the network/table is unreachable, so
 *  the library is never empty even on a first load with a flaky connection. */
export async function pullLibraryExercises(): Promise<void> {
  const { data, error } = await supabase.from('library_exercises').select('*')
  if (error || !data || data.length === 0) {
    if ((await db.libraryExercises.count()) === 0) {
      await db.libraryExercises.bulkAdd(SEED_LIBRARY_EXERCISES)
    }
    return
  }
  const rows = data.map((r) => ({
    id: r.id,
    source: 'library' as const,
    name: r.name,
    category: r.category,
    primaryMuscles: r.primary_muscles ?? [],
    secondaryMuscles: r.secondary_muscles ?? [],
    equipment: r.equipment ?? [],
    instructions: r.instructions ?? [],
    techniqueTips: r.technique_tips ?? [],
    commonMistakes: r.common_mistakes ?? [],
    media: r.media,
    notes: r.notes ?? undefined,
  }))
  await db.libraryExercises.bulkPut(rows)
}

let channels: RealtimeChannel[] = []

/** Live updates from other devices/tabs signed into the same account. Applying a
 *  remote change here calls the local table directly (not the repo layer), so it
 *  never re-enters the outbox — there's no push/pull feedback loop. */
export function subscribeRealtime(userId: string): void {
  unsubscribeRealtime()
  for (const config of SYNC_TABLE_CONFIGS) {
    const filterColumn = config.singleton ? 'id' : 'user_id'
    const channel = supabase
      .channel(`sync:${config.remoteTable}:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: config.remoteTable, filter: `${filterColumn}=eq.${userId}` },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Record<string, unknown>
            const localId = config.singleton ? 'singleton' : (oldRow.id as string)
            if (localId) await config.localTable().delete(localId)
            return
          }
          await mergeRemoteRow(config, payload.new as Record<string, unknown>, userId)
        },
      )
      .subscribe()
    channels.push(channel)
  }
}

export function unsubscribeRealtime(): void {
  for (const channel of channels) supabase.removeChannel(channel)
  channels = []
}
