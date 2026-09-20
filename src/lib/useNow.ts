import { useEffect, useState } from 'react'

/** Re-renders the caller every `intervalMs`. Combined with stored timestamps
 *  (startedAt, pauseIntervals, restTimerEndsAt), this gives correct elapsed/remaining
 *  time even after the tab was backgrounded — the math always derives from Date.now(),
 *  never from an accumulating in-memory counter. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
