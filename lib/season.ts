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
 * Human-readable label for the CURRENT season, e.g. "Monday, September 28,
 * 2026 · Season 2026". Displays the current date and the season year so the
 * Top Performers card is clear on both when the rankings were calculated and
 * which season they cover.
 */
export function getCurrentSeasonLabel(seasonStartMonth: string | null | undefined, now: Date = new Date()): string {
  const seasonStart = getCurrentSeasonStart(seasonStartMonth, now)
  const [yearStr] = seasonStart.split('-')
  const seasonYear = parseInt(yearStr, 10)

  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
  const formattedDate = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return `${dayName}, ${formattedDate} · Season ${seasonYear}`
}

export interface SeasonWindow {
  /** The year this season is named after (its start year). */
  year: number
  /** Inclusive start date, "YYYY-MM-DD". */
  start: string
  /** Exclusive end date, "YYYY-MM-DD" (the next season's start). */
  end: string
  /** Short label, e.g. "2026 Season" or "Jun 2026 – May 2027". */
  label: string
}

function startMonthIndex(seasonStartMonth: string | null | undefined): number {
  const i = seasonStartMonth ? MONTH_NAMES.indexOf(seasonStartMonth.trim().toLowerCase()) : -1
  return i >= 0 ? i : 0
}

/**
 * The start/end window for the season identified by its start year. A season
 * runs 12 months from `startMonth` of `year`. e.g. year 2026 + June start →
 * 2026-06-01 inclusive to 2027-06-01 exclusive. January start collapses to a
 * plain calendar year. `end` is exclusive so it pairs with `.lt('date', end)`.
 */
export function getSeasonWindow(seasonStartMonth: string | null | undefined, year: number): SeasonWindow {
  const m = startMonthIndex(seasonStartMonth)
  const pad = (n: number) => String(n).padStart(2, '0')
  const start = `${year}-${pad(m + 1)}-01`
  const end = `${year + 1}-${pad(m + 1)}-01`
  let label: string
  if (m === 0) {
    label = `${year} Season`
  } else {
    const endMonth = (m + 11) % 12
    label = `${MONTH_LABELS[m]} ${year} – ${MONTH_LABELS[endMonth]} ${year + 1}`
  }
  return { year, start, end, label }
}

/** The start year of the season containing `date` (an ISO "YYYY-MM-DD"). */
export function seasonYearOfDate(seasonStartMonth: string | null | undefined, date: string): number {
  const m = startMonthIndex(seasonStartMonth)
  const [y, mm] = date.split('-').map((n) => parseInt(n, 10))
  // Before the start month, the date belongs to the season that began last year.
  return (mm - 1) >= m ? y : y - 1
}

/** The start year of the current season. */
export function getCurrentSeasonYear(seasonStartMonth: string | null | undefined, now: Date = new Date()): number {
  return parseInt(getCurrentSeasonStart(seasonStartMonth, now).split('-')[0], 10)
}

/**
 * Season start-years to offer in a selector: every season from the earliest
 * date given up to the current one, newest first. Always includes the current
 * season even with no data, so the selector is never empty.
 */
export function listSeasonYears(
  seasonStartMonth: string | null | undefined,
  dates: (string | null | undefined)[],
  now: Date = new Date(),
): number[] {
  const current = getCurrentSeasonYear(seasonStartMonth, now)
  let earliest = current
  for (const d of dates) {
    if (!d) continue
    const y = seasonYearOfDate(seasonStartMonth, d)
    if (y < earliest) earliest = y
  }
  const years: number[] = []
  for (let y = current; y >= earliest; y--) years.push(y)
  return years
}
