/**
 * "Is this happening right now?" checks used to badge session/fixture cards
 * (gym, training, fixtures) in real time — see hooks/useNow.ts for the
 * re-render tick that keeps these accurate without a page refresh.
 */

/** Parses a "YYYY-MM-DD" date + "HH:MM" or "HH:MM:SS" time into a Date. */
function combineDateTime(dateStr: string, timeStr: string): Date | null {
  const datePart = dateStr.slice(0, 10)
  const timePart = timeStr.slice(0, 5)
  const d = new Date(`${datePart}T${timePart}:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * True when `now` falls within [start, finish) for a session on `date`.
 * Requires BOTH a start and a finish time — a session with only a start
 * time has no known duration, so we can't say whether it's still running,
 * and deliberately don't guess with an arbitrary default length.
 */
export function isSessionLiveNow(
  date: string | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  now: Date
): boolean {
  if (!date || !startTime || !endTime) return false
  const start = combineDateTime(date, startTime)
  const end = combineDateTime(date, endTime)
  if (!start || !end || end <= start) return false
  return now >= start && now < end
}

/**
 * True when `date` is today — the closest thing to "happening now" fixtures
 * can express, since matches only store a date (no kickoff time) anywhere
 * in the schema. Not a time-window check like isSessionLiveNow.
 *
 * Compares using LOCAL calendar date components (not toISOString, which is
 * UTC) — `date` represents the day a coach picked in their own timezone, so
 * comparing it against `now`'s UTC date could be off by one near midnight.
 */
export function isMatchDayToday(date: string | null | undefined, now: Date): boolean {
  if (!date) return false
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return date.slice(0, 10) === todayLocal
}
