import { useEffect, useState } from 'react'

/**
 * Returns the current time, re-rendering the component every `intervalMs`
 * so time-sensitive UI (e.g. "this session is happening right now") stays
 * accurate without the user having to refresh the page.
 *
 * Defaults to 30s — frequent enough that a session's live/not-live badge
 * flips within half a minute of actually starting or ending, without
 * re-rendering so often it's wasteful.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
