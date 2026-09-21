import { create } from 'zustand'

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error'

interface SyncStoreState {
  state: SyncState
  lastError: string | null
  pendingCount: number
  setState: (state: SyncState) => void
  setError: (message: string) => void
  setPendingCount: (count: number) => void
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  state: 'idle',
  lastError: null,
  pendingCount: 0,
  setState: (state) => set({ state, ...(state !== 'error' && { lastError: null }) }),
  setError: (message) => set({ state: 'error', lastError: message }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
}))
