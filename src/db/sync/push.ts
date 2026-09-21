import { db } from '../db'
import { supabase } from '../../lib/supabaseClient'
import { SYNC_CONFIG_BY_TABLE } from './syncConfig'

/** Drains the outbox to Supabase. Safe to call repeatedly/concurrently-ish: each
 *  entry that fails (offline, transient error) is simply left in place for the
 *  next call. Entries are processed oldest-first but independently, so one
 *  failure doesn't block others. Returns true if every entry was flushed. */
export async function flushOutbox(userId: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false

  const entries = await db.syncOutbox.orderBy('enqueuedAt').toArray()
  let allOk = true

  for (const entry of entries) {
    const config = SYNC_CONFIG_BY_TABLE[entry.table]
    if (!config) {
      await db.syncOutbox.delete(entry.key)
      continue
    }
    try {
      if (entry.op === 'delete') {
        const remoteId = config.singleton ? userId : entry.recordId
        const { error } = await supabase.from(config.remoteTable).delete().eq('id', remoteId)
        if (error) throw error
      } else {
        const localRow = await config.localTable().get(entry.recordId)
        if (!localRow) {
          // Record was deleted locally again before this upsert flushed — nothing to push.
          await db.syncOutbox.delete(entry.key)
          continue
        }
        const remoteRow = config.toRemote(localRow, userId)
        const { error } = await supabase.from(config.remoteTable).upsert(remoteRow)
        if (error) throw error
      }
      await db.syncOutbox.delete(entry.key)
    } catch {
      allOk = false
      // Leave this entry in the outbox; the next scheduled flush retries it.
    }
  }

  return allOk
}
