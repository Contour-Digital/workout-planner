import { liveQuery } from 'dexie'
import { db } from '../db'
import { useSyncStore } from '../../store/syncStore'
import { flushOutbox } from './push'
import { pullAll, pullLibraryExercises, subscribeRealtime, unsubscribeRealtime } from './pull'

const FLUSH_INTERVAL_MS = 8000

let flushTimer: ReturnType<typeof setInterval> | null = null
let outboxSubscription: { unsubscribe: () => void } | null = null
let currentUserId: string | null = null

async function attemptFlush() {
  if (!currentUserId) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    useSyncStore.getState().setState('offline')
    return
  }
  useSyncStore.getState().setState('syncing')
  try {
    const ok = await flushOutbox(currentUserId)
    useSyncStore.getState().setState(ok ? 'idle' : 'error')
    if (!ok) useSyncStore.getState().setError('Some changes could not be synced yet — will retry.')
  } catch (e) {
    useSyncStore.getState().setError(e instanceof Error ? e.message : 'Sync failed')
  }
}

function handleOnline() {
  attemptFlush()
}
function handleOffline() {
  useSyncStore.getState().setState('offline')
}

/** Starts syncing for a freshly authenticated user: pulls the shared exercise
 *  library and the user's own data down, drains anything queued while signed
 *  out, subscribes to realtime updates, and begins periodic outbox flushes. */
export async function startSync(userId: string): Promise<void> {
  currentUserId = userId
  useSyncStore.getState().setState('syncing')

  outboxSubscription = liveQuery(() => db.syncOutbox.count()).subscribe({
    next: (count) => useSyncStore.getState().setPendingCount(count),
  })

  try {
    await pullLibraryExercises()
    await pullAll(userId)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      useSyncStore.getState().setState('offline')
    } else {
      const ok = await flushOutbox(userId)
      if (ok) useSyncStore.getState().setState('idle')
      else useSyncStore.getState().setError('Some changes could not be synced yet — will retry.')
    }
  } catch (e) {
    useSyncStore.getState().setError(e instanceof Error ? e.message : 'Initial sync failed')
  }

  subscribeRealtime(userId)
  flushTimer = setInterval(attemptFlush, FLUSH_INTERVAL_MS)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
}

export function stopSync(): void {
  currentUserId = null
  unsubscribeRealtime()
  if (flushTimer) clearInterval(flushTimer)
  flushTimer = null
  outboxSubscription?.unsubscribe()
  outboxSubscription = null
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  useSyncStore.getState().setState('idle')
}
