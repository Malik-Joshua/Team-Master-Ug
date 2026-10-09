/**
 * Shared cleaning helpers for spreadsheet / form imports (onboarding squad +
 * staff import, and the /api/players endpoint). Spreadsheets arrive with
 * whatever the club typed — "Fly-half", "No. 10", "14/03/1998", an Excel date
 * serial — but the database only accepts a fixed set of position values and
 * ISO dates, so every importer funnels its input through here.
 */

export const POSITION_OPTIONS: { value: string; label: string; category: 'forwards' | 'backs' }[] = [
  { value: 'loosehead_prop', label: 'Loosehead Prop', category: 'forwards' },
  { value: 'hooker', label: 'Hooker', category: 'forwards' },
  { value: 'tighthead_prop', label: 'Tighthead Prop', category: 'forwards' },
  { value: 'prop', label: 'Prop (either side)', category: 'forwards' },
  { value: 'lock', label: 'Lock', category: 'forwards' },
  { value: 'blindside_flanker', label: 'Blindside Flanker', category: 'forwards' },
  { value: 'openside_flanker', label: 'Openside Flanker', category: 'forwards' },
  { value: 'flanker', label: 'Flanker (either side)', category: 'forwards' },
  { value: '8th_man', label: 'Number Eight', category: 'forwards' },
  { value: 'scrum_half', label: 'Scrum Half', category: 'backs' },
  { value: 'fly_half', label: 'Fly Half', category: 'backs' },
  { value: 'inside_center', label: 'Inside Centre', category: 'backs' },
  { value: 'outside_center', label: 'Outside Centre', category: 'backs' },
  { value: 'left_wing', label: 'Left Wing', category: 'backs' },
  { value: 'right_wing', label: 'Right Wing', category: 'backs' },
  { value: 'winger', label: 'Wing (either side)', category: 'backs' },
  { value: 'full_back', label: 'Full Back', category: 'backs' },
]

const POSITION_VALUES = new Set(POSITION_OPTIONS.map((p) => p.value))

// Alias → canonical value. Keys are pre-normalised (lowercase, words
// separated by single spaces — see squash()).
const POSITION_ALIASES: Record<string, string> = {
  prop: 'prop',
  'loosehead': 'loosehead_prop', 'loosehead prop': 'loosehead_prop', 'loose head': 'loosehead_prop', 'loose head prop': 'loosehead_prop', lhp: 'loosehead_prop', '1': 'loosehead_prop',
  'tighthead': 'tighthead_prop', 'tighthead prop': 'tighthead_prop', 'tight head': 'tighthead_prop', 'tight head prop': 'tighthead_prop', thp: 'tighthead_prop', '3': 'tighthead_prop',
  hooker: 'hooker', hk: 'hooker', '2': 'hooker',
  lock: 'lock', locks: 'lock', 'second row': 'lock', '2nd row': 'lock', 'second rower': 'lock', '4': 'lock', '5': 'lock',
  flanker: 'flanker', 'back row': 'flanker', backrow: 'flanker',
  'blindside': 'blindside_flanker', 'blindside flanker': 'blindside_flanker', 'blind side': 'blindside_flanker', 'blind side flanker': 'blindside_flanker', '6': 'blindside_flanker',
  'openside': 'openside_flanker', 'openside flanker': 'openside_flanker', 'open side': 'openside_flanker', 'open side flanker': 'openside_flanker', '7': 'openside_flanker',
  '8': '8th_man', 'number 8': '8th_man', 'number eight': '8th_man', 'no 8': '8th_man', 'no eight': '8th_man', 'eighth man': '8th_man', '8th man': '8th_man', 'eight man': '8th_man',
  'scrum half': 'scrum_half', scrumhalf: 'scrum_half', sh: 'scrum_half', '9': 'scrum_half',
  'fly half': 'fly_half', flyhalf: 'fly_half', fh: 'fly_half', 'stand off': 'fly_half', standoff: 'fly_half', 'outside half': 'fly_half', 'first five': 'fly_half', 'first five eighth': 'fly_half', '10': 'fly_half',
  'inside centre': 'inside_center', 'inside center': 'inside_center', 'first centre': 'inside_center', 'first center': 'inside_center', 'second five': 'inside_center', '12': 'inside_center',
  'outside centre': 'outside_center', 'outside center': 'outside_center', 'second centre': 'outside_center', 'second center': 'outside_center', '13': 'outside_center',
  'left wing': 'left_wing', 'left winger': 'left_wing', lw: 'left_wing', '11': 'left_wing',
  'right wing': 'right_wing', 'right winger': 'right_wing', rw: 'right_wing', '14': 'right_wing',
  wing: 'winger', winger: 'winger', wings: 'winger',
  'full back': 'full_back', fullback: 'full_back', fb: 'full_back', '15': 'full_back',
}

const FORWARDS = new Set(['prop', 'loosehead_prop', 'tighthead_prop', 'hooker', 'lock', 'flanker', 'blindside_flanker', 'openside_flanker', '8th_man'])

function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Map whatever a club typed ("Fly-half", "No. 10", "loosehead") to a position
 * the database accepts. Returns null when it can't be sure — a bare "Centre"
 * could be inside or outside, so the caller should ask a human instead of
 * guessing.
 */
export function normalizePosition(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = String(raw).trim()
  if (POSITION_VALUES.has(trimmed)) return trimmed
  let key = squash(trimmed)
  if (!key) return null
  // "No. 10" / "Number 10" / "#10" → "10"
  const numbered = key.match(/^(?:no|number|num|nr)\s*(\d{1,2})$/)
  if (numbered) key = numbered[1]
  return POSITION_ALIASES[key] || null
}

export function positionCategory(position: string): 'forwards' | 'backs' {
  return FORWARDS.has(position) ? 'forwards' : 'backs'
}

/**
 * Normalise a date cell to YYYY-MM-DD. Handles ISO, day-first (the Ugandan
 * convention) 14/03/1998, "14 Mar 1998", and Excel's date serial numbers —
 * spreadsheets store dates as numbers, which is what an .xlsx import yields.
 * Returns null if it can't be read, so the caller can drop the date instead of
 * failing the whole player.
 */
export function normalizeDate(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (!s) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  const valid = (y: number, m: number, d: number) => {
    if (y < 1900 || y > new Date().getFullYear()) return null
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    const dt = new Date(Date.UTC(y, m - 1, d))
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
    return `${y}-${pad(m)}-${pad(d)}`
  }

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return valid(+m[1], +m[2], +m[3])

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/)
  if (m) {
    let a = +m[1], b = +m[2]
    let y = +m[3]
    if (m[3].length === 2) y += y > new Date().getFullYear() % 100 ? 1900 : 2000
    // Day-first by default; flip only when the second number can't be a month.
    if (b > 12 && a <= 12) [a, b] = [b, a]
    return valid(y, b, a)
  }

  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(parseFloat(s))
    if (serial > 1 && serial < 80000) {
      const dt = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
      return valid(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
    }
  }

  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return valid(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate())
  return null
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

export const STAFF_ROLE_OPTIONS = [
  { id: 'coach', label: 'Head Coach' },
  { id: 'asst_coach', label: 'Asst. Coach' },
  { id: 'physio', label: 'Physiotherapist' },
  { id: 'data_admin', label: 'Team Manager' },
  { id: 'finance_admin', label: 'Finance Admin' },
  { id: 'admin', label: 'Admin' },
]

const STAFF_ROLE_ALIASES: Record<string, string> = {
  coach: 'coach', 'head coach': 'coach', headcoach: 'coach', 'main coach': 'coach',
  'asst coach': 'asst_coach', 'assistant coach': 'asst_coach', asst: 'asst_coach', assistant: 'asst_coach', 'asst. coach': 'asst_coach', 'assistant head coach': 'asst_coach',
  physio: 'physio', physiotherapist: 'physio', 'physical therapist': 'physio', 'medical': 'physio', 'team physio': 'physio',
  'team manager': 'data_admin', manager: 'data_admin', 'data admin': 'data_admin', 'team admin': 'data_admin', 'data_admin': 'data_admin',
  'finance admin': 'finance_admin', finance: 'finance_admin', accountant: 'finance_admin', treasurer: 'finance_admin', 'finance_admin': 'finance_admin',
  admin: 'admin', administrator: 'admin', owner: 'admin', 'club admin': 'admin',
}

/** Map a typed role ("Assistant Coach", "Physiotherapist") to a role id, or null. */
export function normalizeStaffRole(raw: string | null | undefined): string | null {
  if (!raw) return null
  const key = squash(String(raw))
  return STAFF_ROLE_ALIASES[key] || STAFF_ROLE_ALIASES[key.replace(/\s/g, '_')] || null
}
