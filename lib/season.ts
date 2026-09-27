/**
 * Season boundaries, derived from club_settings.season_start_month (a month
 * NAME string, e.g. "June" — set once during onboarding, see
 * app/onboarding/page.tsx's `seasonMonth` state).
 *
 * There's no dedicated `seasons` table in the schema — a "season" is a
 * rolling 12-month window that starts on that month each year. e.g. with
 * season_start_month = "June": on any date from Jun 2026 through May 2027,
 * the "current season" started 2026-06-01 and (implicitly) runs until the
 * next June 1st. This resets rankings (Top Performers, etc.) automatically
 * every year with zero extra setup — no admin action needed to "start a new
 * season".
 */

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/**
 * Returns the start of the CURRENT season as an ISO date string
 * ("YYYY-MM-DD"), suitable for a `.gte('match_date', ...)` / `.gte('session_date', ...)`
 * filter. Falls back to `defaultMonth` (January, i.e. calendar-year) if
 * `seasonStartMonth` is missing or unrecognised, so callers always get a
 * usable boundary rather than having to special-case "no season configured".
 */
export function getCurrentSeasonStart(seasonStartMonth: string | null | undefined, now: Date = new Date()): string {
  const monthIndex = seasonStartMonth
    ? MONTH_NAMES.indexOf(seasonStartMonth.trim().toLowerCase())
    : -1
  const startMonth = monthIndex >= 0 ? monthIndex : 0 // default: January

  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  // If we're at or past the start month this calendar year, the season
  // began this year; otherwise it began last year and is still running.
  const seasonYear = currentMonth >= startMonth ? currentYear : currentYear - 1

  return `${seasonYear}-${String(startMonth + 1).padStart(2, '0')}-01`
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * Human-readable label for the CURRENT season, e.g. "2026 Season" when it
 * starts in January (a plain calendar year reads cleaner than "Jan 2026 –
 * Dec 2026"), or "Jun 2026 – May 2027" for any other start month. Used to
 * caption season-scoped rankings (e.g. the Top Performers card) so it's
 * clear which window the numbers cover, since the leaderboard resets every
 * year rather than staying all-time.
 */
export function getCurrentSeasonLabel(seasonStartMonth: string | null | undefined, now: Date = new Date()): string {
  const seasonStart = getCurrentSeasonStart(seasonStartMonth, now)
  const [yearStr, monthStr] = seasonStart.split('-')
  const startYear = parseInt(yearStr, 10)
  const startMonth = parseInt(monthStr, 10) - 1 // 0-indexed

  if (startMonth === 0) {
    return `${startYear} Season`
  }

  const endYear = startYear + 1
  const endMonth = (startMonth + 11) % 12 // the month right before startMonth, one year later
  return `${MONTH_LABELS[startMonth]} ${startYear} – ${MONTH_LABELS[endMonth]} ${endYear}`
}
