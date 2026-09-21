import { db } from '../db'

/** Called at the end of every local write in the repo layer. Cheap and safe to
 *  call even when sync isn't active yet (e.g. before sign-in resolves) — the
 *  outbox just accumulates and gets drained once the sync engine starts. */
export async function enqueueSync(table: string, recordId: string, op: 'upsert' | 'delete'): Promise<void> {
  await db.syncOutbox.put({
    key: `${table}:${recordId}`,
    table,
    recordId,
    op,
    enqueuedAt: new Date().toISOString(),
  })
}
