'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { readTabularFile } from '@/lib/tabular-import'
import {
  POSITION_OPTIONS,
  STAFF_ROLE_OPTIONS,
  normalizePosition,
  normalizeDate,
  normalizeStaffRole,
  isValidEmail,
} from '@/lib/import-normalize'
import ClubColorPicker from '@/components/ui/ClubColorPicker'
import SportBallsBackground from '@/components/SportBallsBackground'
// @ts-ignore - themeEngine is a JS module
import { PRESETS, getPresetThemeName } from '@/themeEngine'
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Upload,
  ImageIcon,
  Globe,
  Calendar,
  Users,
  UserPlus,
  FileSpreadsheet,
  Plus,
  X,
  ChevronDown,
  Trophy,
  Mail,
  Shield,
  HeartPulse,
  Briefcase,
  CheckCircle2,
  Download,
  AlertTriangle,
} from 'lucide-react'

/* ─── Constants ─────────────────────────────────────────────── */
const STEPS = [
  { label: 'Club Profile', icon: ImageIcon },
  { label: 'Sport Setup', icon: Trophy },
  { label: 'Squad', icon: Users },
  { label: 'Invite Staff', icon: UserPlus },
]

const SPORTS = ['Rugby', 'Football', 'Basketball', 'Cricket', 'Athletics', 'Netball', 'Volleyball', 'Swimming', 'Boxing', 'Tennis']

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// "Analyst" was dropped — it was never a real role anywhere else in the
// system (not in ROLE_LIMITS, no dashboard, no permission checks), so
// offering it here only produced accounts that couldn't actually be
// created. asst_coach IS real (see lib/role-limits.ts + the coach-parity
// work in app/dashboard/page.tsx) — the assistant shares the Head Coach's
// dashboard and gets notified whenever the Head Coach records a team
// selection or match-day attendance, so the two never make conflicting
// entries.
const STAFF_ROLES = [
  { id: 'coach', label: 'Head Coach', icon: Shield },
  { id: 'asst_coach', label: 'Asst. Coach', icon: Shield },
  { id: 'physio', label: 'Physiotherapist', icon: HeartPulse },
  { id: 'data_admin', label: 'Team Manager', icon: Briefcase },
  { id: 'finance_admin', label: 'Finance Admin', icon: Briefcase },
  { id: 'admin', label: 'Admin', icon: Shield },
]

/* ─── Shared input style ─────────────────────────────────────── */
const inp = 'w-full bg-[#16273d] border border-[#27405c] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#0ea5e9] transition-colors'
// Same style WITHOUT w-full, for inputs placed directly in a flex row (avoids
// width conflicts that collapsed the field so typed text wasn't visible).
const inpRow = 'bg-[#16273d] border border-[#27405c] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#0ea5e9] transition-colors'
const lbl = 'text-[13px] font-medium text-white mb-1.5 block'

/* ─── Component ─────────────────────────────────────────────── */
export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  /* Step 1 — Club Profile */
  const [badgePreview, setBadgePreview] = useState<string | null>(null)
  // Keep the actual File in state — the file <input> unmounts when the user
  // navigates to later steps, so we cannot read it from the ref at finish().
  const [badgeFile, setBadgeFile] = useState<File | null>(null)
  // Single club colour — the whole app theme is derived from it.
  const [primaryColor, setPrimaryColor] = useState('#0ea5e9')
  const [clubNickname, setClubNickname] = useState('')
  // Kept separate from the club name — the slogan is used to hype players/
  // teams (e.g. shown on a player's dashboard when selected for a fixture).
  const [clubSlogan, setClubSlogan] = useState('')
  const [yearFounded, setYearFounded] = useState('')
  const [website, setWebsite] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  /* Step 2 — Sport Config */
  const [league, setLeague] = useState('')
  const [multipleTeams, setMultipleTeams] = useState(false)
  const [teams, setTeams] = useState<string[]>(['First Team'])
  const [seasonMonth, setSeasonMonth] = useState('')

  /* Step 3 — Squad */
  const [squadMode, setSquadMode] = useState<'csv' | 'manual' | null>(null)
  const [squadSize, setSquadSize] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  // Rows parsed from the uploaded spreadsheet — one per player, editable in a
  // preview table before they get committed. The `include` flag lets the user
  // deselect obvious junk rows without editing the file.
  type CsvPlayerRow = {
    name: string
    position: string
    date_of_birth: string
    email: string
    jersey_number: string
    include: boolean
    error?: string
  }
  const [csvParsedRows, setCsvParsedRows] = useState<CsvPlayerRow[]>([])
  const [csvParsing, setCsvParsing] = useState(false)
  const [csvParseError, setCsvParseError] = useState<string | null>(null)
  // Progress + result of the actual "create players" pass that runs in finish().
  const [savingSquad, setSavingSquad] = useState(false)
  const [squadSaveProgress, setSquadSaveProgress] = useState<{ done: number; total: number; failed: { name: string; reason: string }[] } | null>(null)
  const [manualPlayers, setManualPlayers] = useState<{ name: string; position: string; email: string }[]>([])
  const [newPlayer, setNewPlayer] = useState({ name: '', position: '', email: '' })
  const csvRef = useRef<HTMLInputElement>(null)

  /* Step 4 — Staff */
  const [staffInvites, setStaffInvites] = useState<{ name: string; email: string; role: string }[]>([])
  const [newStaff, setNewStaff] = useState({ name: '', email: '', role: 'coach' })
  // Progress + per-invite result of the actual account-creation pass that
  // runs in finish() — mirrors the squad-import progress UI in Step 3, so
  // both async passes give the same "N/M, here's what failed" feedback.
  const [savingStaff, setSavingStaff] = useState(false)
  const staffCsvRef = useRef<HTMLInputElement>(null)
  const [staffImportNote, setStaffImportNote] = useState<{ added: number; problems: string[] } | null>(null)
  // Outcome of the create-accounts pass, shown on the final screen so the admin
  // can see exactly who was invited, who wasn't, and why — instead of the page
  // jumping to the dashboard with failures only in the console.
  type SetupRow = { kind: 'player' | 'staff'; name: string; email: string; roleLabel: string; status: 'emailed' | 'not_emailed' | 'failed'; detail?: string; tempPassword?: string }
  const [setupRows, setSetupRows] = useState<SetupRow[] | null>(null)
  const [setupRunning, setSetupRunning] = useState(false)
  const [staffSaveProgress, setStaffSaveProgress] = useState<{ done: number; total: number; failed: { email: string; reason: string }[] } | null>(null)

  /* ─── Handlers ─── */
  function handleBadgeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBadgeFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setBadgePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function addTeam() {
    setTeams([...teams, `Team ${teams.length + 1}`])
  }

  function removeTeam(i: number) {
    setTeams(teams.filter((_, idx) => idx !== i))
  }

  function addPlayer() {
    if (!newPlayer.name.trim() || !normalizePosition(newPlayer.position)) {
      setError('Enter the player\'s name and pick a position.')
      return
    }
    if (newPlayer.email.trim() && !isValidEmail(newPlayer.email)) {
      setError('That email address does not look right.')
      return
    }
    setError(null)
    setManualPlayers([...manualPlayers, { ...newPlayer, email: newPlayer.email.trim().toLowerCase() }])
    setNewPlayer({ name: '', position: '', email: '' })
  }

  function removePlayer(i: number) {
    setManualPlayers(manualPlayers.filter((_, idx) => idx !== i))
  }

  // Turn a header like "Date Of Birth" into a stable normalised key ("date_of_birth")
  // so we can accept a broad range of column-name spellings ("DOB", "Position",
  // "Player Name", "Email Address", etc.) with one lookup table.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

  // Parse the uploaded spreadsheet (CSV / TSV / .xlsx / .xls) and turn it into
  // a list of preview rows. The header row is used to find the right columns
  // regardless of order. Missing optional columns → empty strings. Rows with
  // no name are dropped silently (blank spreadsheet padding).
  // Why a squad row can't be imported yet, or null if it's good to go.
  function rowIssue(r: { name: string; position: string; email: string }, all: { email: string }[]): string | null {
    if (!r.name.trim()) return 'Name missing'
    if (!normalizePosition(r.position)) return r.position.trim() ? `Position "${r.position}" not recognised — choose one` : 'Choose a position'
    const email = r.email.trim()
    if (email && !isValidEmail(email)) return 'Invalid email'
    if (email && all.filter((o) => o.email.trim().toLowerCase() === email.toLowerCase()).length > 1) return 'Duplicate email in this file'
    return null
  }

  async function handleCsvUpload(file: File) {
    setCsvFile(file)
    setCsvParseError(null)
    setCsvParsedRows([])
    setSquadSaveProgress(null)
    setCsvParsing(true)
    try {
      const rows = await readTabularFile(file)
      if (rows.length === 0) {
        setCsvParseError('The file appears to be empty.')
        return
      }
      // Locate columns from the header row. We look for common aliases so a
      // manager doesn't have to match our template exactly.
      const header = rows[0].map((h) => norm(String(h || '')))
      const alias: Record<keyof Omit<CsvPlayerRow, 'include' | 'error'>, string[]> = {
        name:          ['name', 'player_name', 'full_name', 'player', 'names'],
        position:      ['position', 'pos', 'playing_position', 'role'],
        date_of_birth: ['date_of_birth', 'dob', 'birth_date', 'birthdate', 'd_o_b'],
        email:         ['email', 'email_address', 'e_mail', 'mail'],
        jersey_number: ['jersey_number', 'jersey', 'shirt_number', 'shirt', 'number', 'no'],
      }
      const idx: Record<string, number> = {}
      ;(Object.keys(alias) as Array<keyof typeof alias>).forEach((k) => {
        idx[k] = header.findIndex((h) => alias[k].includes(h))
      })
      if (idx.name < 0) {
        setCsvParseError('Could not find a "Name" column in the header row. Please include a Name column and try again.')
        return
      }
      const parsed: CsvPlayerRow[] = []
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r]
        const name = String(row[idx.name] || '').trim()
        if (!name) continue // silently skip blank rows
        // Clean each cell to what the database accepts. "Fly-half" / "No. 10"
        // become fly_half; an unrecognised position stays as typed so the
        // preview can flag it and ask the admin to pick one.
        const rawPosition = idx.position >= 0 ? String(row[idx.position] || '').trim() : ''
        const rawDob = idx.date_of_birth >= 0 ? String(row[idx.date_of_birth] || '').trim() : ''
        parsed.push({
          name,
          position: normalizePosition(rawPosition) || rawPosition,
          date_of_birth: normalizeDate(rawDob) || '',
          email: idx.email >= 0 ? String(row[idx.email] || '').trim().toLowerCase() : '',
          jersey_number: idx.jersey_number >= 0 ? String(row[idx.jersey_number] || '').trim() : '',
          include: true,
        })
      }
      if (parsed.length === 0) {
        setCsvParseError('No player rows found. Make sure the file has at least one row under the header.')
        return
      }
      // Rows with a problem start unticked, so nothing broken is imported by
      // accident; fix the cell in the preview and tick the row to include it.
      setCsvParsedRows(parsed.map((r) => ({ ...r, include: !rowIssue(r, parsed) })))
    } catch (err: any) {
      console.error('CSV parse error:', err)
      setCsvParseError(err?.message || 'Could not read the file. Make sure it is a valid CSV or Excel file.')
    } finally {
      setCsvParsing(false)
    }
  }

  function updateCsvRow(i: number, patch: Partial<CsvPlayerRow>) {
    setCsvParsedRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function removeCsvRow(i: number) {
    setCsvParsedRows((rows) => rows.filter((_, idx) => idx !== i))
  }
  function clearCsv() {
    setCsvFile(null)
    setCsvParsedRows([])
    setCsvParseError(null)
    setSquadSaveProgress(null)
    if (csvRef.current) csvRef.current.value = ''
  }

  // Build a tiny CSV template and trigger a download. Same headers we accept.
  function downloadSquadTemplate() {
    const csv = [
      'Name,Position,Date of Birth,Email,Jersey Number',
      'John Doe,Prop,1998-03-14,john@example.com,1',
      'Jane Smith,Fly-half,2001-07-02,jane@example.com,10',
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'squad-template.csv'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  // Import staff from a spreadsheet (Name, Email, Role). Roles are matched
  // loosely ("Assistant Coach", "Physiotherapist"); anything we can't place or
  // that has a bad/duplicate email is reported rather than silently dropped.
  async function handleStaffFile(file: File) {
    setStaffImportNote(null)
    try {
      const rows = await readTabularFile(file)
      if (rows.length < 2) {
        setStaffImportNote({ added: 0, problems: ['The file has no staff rows under the header.'] })
        return
      }
      const header = rows[0].map((h) => norm(String(h || '')))
      const find = (names: string[]) => header.findIndex((h) => names.includes(h))
      const iName = find(['name', 'full_name', 'staff_name', 'names'])
      const iEmail = find(['email', 'email_address', 'e_mail', 'mail'])
      const iRole = find(['role', 'position', 'title', 'job', 'job_title'])
      if (iName < 0 || iEmail < 0) {
        setStaffImportNote({ added: 0, problems: ['Could not find "Name" and "Email" columns in the header row.'] })
        return
      }
      const problems: string[] = []
      const additions: { name: string; email: string; role: string }[] = []
      const seen = new Set(staffInvites.map((s) => s.email.toLowerCase()))
      for (let r = 1; r < rows.length; r++) {
        const name = String(rows[r][iName] || '').trim()
        const email = String(rows[r][iEmail] || '').trim().toLowerCase()
        if (!name && !email) continue
        const rawRole = iRole >= 0 ? String(rows[r][iRole] || '').trim() : ''
        const role = rawRole ? normalizeStaffRole(rawRole) : 'coach'
        if (!name) { problems.push(`Row ${r + 1}: name missing`); continue }
        if (!isValidEmail(email)) { problems.push(`${name}: invalid or missing email`); continue }
        if (!role) { problems.push(`${name}: role "${rawRole}" not recognised (use Coach, Asst. Coach, Physio, Team Manager, Finance Admin or Admin)`); continue }
        if (seen.has(email)) { problems.push(`${name}: ${email} is already in the list`); continue }
        seen.add(email)
        additions.push({ name, email, role })
      }
      setStaffInvites((prev) => [...prev, ...additions])
      setStaffImportNote({ added: additions.length, problems })
    } catch (err: any) {
      setStaffImportNote({ added: 0, problems: [err?.message || 'Could not read the file.'] })
    }
  }

  function downloadStaffTemplate() {
    const csv = ['Name,Email,Role', 'Jane Coach,jane@example.com,Head Coach', 'Sam Physio,sam@example.com,Physiotherapist'].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'staff-template.csv'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  function addStaff() {
    if (!newStaff.name.trim() || !newStaff.email.trim()) return
    if (!isValidEmail(newStaff.email)) { setError('That staff email address does not look right.'); return }
    setError(null)
    setStaffInvites([...staffInvites, { ...newStaff, email: newStaff.email.trim().toLowerCase() }])
    setNewStaff({ name: '', email: '', role: 'coach' })
  }

  function removeStaff(i: number) {
    setStaffInvites(staffInvites.filter((_, idx) => idx !== i))
  }

  function next() {
    setError(null)
    if (step === 1 && !league.trim()) { setError('Please enter your competition or league name.'); return }
    if (step === 1 && !seasonMonth) { setError('Please select a season start month.'); return }
    if (step < STEPS.length) setStep(step + 1)
  }

  function back() {
    setError(null)
    if (step > 0) setStep(step - 1)
  }

  async function finish() {
    if (setupRunning) return
    const hasImports =
      csvParsedRows.some((r) => r.include) ||
      manualPlayers.some((p) => p.name.trim()) ||
      staffInvites.length > 0
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // The app derives its full palette from a single club colour.
        // We still persist a secondary_color (the derived accent) for the
        // existing schema, but only primary_color drives the theme.
        const derivedAccent = (PRESETS as any)[getPresetThemeName(primaryColor)].acc as string

        console.log('[Onboarding] Saving club settings with colour:', {
          primary: primaryColor,
          derivedAccent,
          clubName: clubNickname
        })

        // Upload badge via server route (uses service role, bypasses storage RLS).
        // Use the File kept in state (the input may have unmounted with its step).
        let badgeUrl: string | null = null
        if (badgeFile) {
          try {
            const fd = new FormData()
            fd.append('file', badgeFile)
            const res = await fetch('/api/club/upload-badge', { method: 'POST', body: fd })
            if (res.ok) {
              const { url } = await res.json()
              badgeUrl = url
            } else {
              const err = await res.json().catch(() => ({}))
              console.error('[Onboarding] Badge upload failed:', err.error || res.status)
            }
          } catch (e) {
            console.error('[Onboarding] Badge upload error:', e)
          }
        }

        // Save club branding + sport config to club_settings
        const clubSettingsPayload: Record<string, any> = {
          admin_user_id: user.id,
          primary_color: primaryColor,
          secondary_color: derivedAccent,
          club_nickname: clubNickname || null,
          club_slogan: clubSlogan || null,
          year_founded: yearFounded ? parseInt(yearFounded) : null,
          website: website || null,
          badge_url: badgeUrl,
          league: league || null,
          season_start_month: seasonMonth || null,
          multiple_teams: multipleTeams,
          teams: multipleTeams ? teams : [],
          squad_size: squadSize ? parseInt(squadSize) : null,
          updated_at: new Date().toISOString(),
        }

        let { error: upsertError } = await supabase
          .from('club_settings')
          .upsert(clubSettingsPayload, { onConflict: 'admin_user_id' })

        // club_slogan is a newer column (migration 043). If it hasn't been
        // applied yet, retry without it so onboarding still completes.
        if (upsertError?.message?.includes('club_slogan')) {
          const { club_slogan, ...withoutSlogan } = clubSettingsPayload
          const retry = await supabase
            .from('club_settings')
            .upsert(withoutSlogan, { onConflict: 'admin_user_id' })
          upsertError = retry.error
        }

        if (upsertError) {
          console.error('[Onboarding] Error saving club settings:', upsertError)
        } else {
          console.log('[Onboarding] Club settings saved successfully')
        }

        // ── Create the players collected in Step 3 ────────────────────────
        //
        // CSV rows left ticked in the preview plus manually-added players are
        // POSTed one by one to /api/players, which creates the login, profile
        // and player record and emails them an activation link. We keep each
        // outcome (emailed / created-but-not-emailed / failed + reason) so the
        // final screen can show it — previously failures only hit the console.
        //
        // A player with no email can't be invited, so they get a placeholder
        // `@roster.local` address (the API skips emailing those); the admin
        // adds a real email later from the Players screen.
        const nameSlug = (n: string) =>
          n.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')
        const placeholder = (n: string) =>
          `${nameSlug(n)}.${Date.now()}${Math.floor(Math.random() * 1000)}@roster.local`

        const rows: SetupRow[] = []
        const posLabel = (v: string) => POSITION_OPTIONS.find((o) => o.value === v)?.label || v

        const csvPlayers = csvParsedRows
          .filter((r) => r.include)
          .map((r) => ({ r, issue: rowIssue(r, csvParsedRows) }))
        const toCreate: { name: string; email: string; position: string; jersey_number?: number; date_of_birth?: string; hasRealEmail: boolean }[] = []
        for (const { r, issue } of csvPlayers) {
          if (issue) {
            rows.push({ kind: 'player', name: r.name || '(no name)', email: r.email, roleLabel: 'Player', status: 'failed', detail: issue })
            continue
          }
          const jersey = parseInt(r.jersey_number)
          toCreate.push({
            name: r.name.trim(),
            email: r.email.trim() || placeholder(r.name),
            position: normalizePosition(r.position)!,
            jersey_number: isNaN(jersey) ? undefined : jersey,
            date_of_birth: r.date_of_birth || undefined,
            hasRealEmail: !!r.email.trim(),
          })
        }
        for (const p of manualPlayers.filter((p) => p.name.trim())) {
          toCreate.push({
            name: p.name.trim(),
            email: p.email.trim() || placeholder(p.name),
            position: normalizePosition(p.position) || p.position,
            hasRealEmail: !!p.email.trim(),
          })
        }

        const staffToCreate = staffInvites.map((s) => ({ ...s }))
        const totalSteps = toCreate.length + staffToCreate.length

        if (totalSteps > 0) {
          setSetupRunning(true)
          let done = 0
          const playerFailed: { name: string; reason: string }[] = []
          const staffFailed: { email: string; reason: string }[] = []
          setSavingSquad(toCreate.length > 0)
          setSquadSaveProgress({ done: 0, total: toCreate.length, failed: [] })

          for (const p of toCreate) {
            const { hasRealEmail, ...payload } = p
            try {
              const res = await fetch('/api/players', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              })
              const j = await res.json().catch(() => ({} as any))
              if (!res.ok) {
                const reason = j.error || `HTTP ${res.status}`
                playerFailed.push({ name: p.name, reason })
                rows.push({ kind: 'player', name: p.name, email: hasRealEmail ? p.email : '', roleLabel: posLabel(p.position), status: 'failed', detail: reason })
              } else if (j.data?.emailSent) {
                rows.push({ kind: 'player', name: p.name, email: p.email, roleLabel: posLabel(p.position), status: 'emailed' })
              } else {
                rows.push({
                  kind: 'player', name: p.name, email: hasRealEmail ? p.email : '', roleLabel: posLabel(p.position), status: 'not_emailed',
                  detail: hasRealEmail ? (j.data?.emailError || 'Email could not be sent') : 'No email address — add one on the Players screen',
                  tempPassword: hasRealEmail ? j.data?.tempPassword : undefined,
                })
              }
            } catch (e: any) {
              playerFailed.push({ name: p.name, reason: e?.message || 'Network error' })
              rows.push({ kind: 'player', name: p.name, email: p.email, roleLabel: posLabel(p.position), status: 'failed', detail: e?.message || 'Network error' })
            }
            done += 1
            setSquadSaveProgress({ done, total: toCreate.length, failed: [...playerFailed] })
          }
          setSavingSquad(false)

          // ── Staff collected in Step 4 (typed in or imported) ─────────────
          // Same pattern via /api/users/create, which also emails the invite.
          if (staffToCreate.length > 0) {
            setSavingStaff(true)
            let staffDone = 0
            setStaffSaveProgress({ done: 0, total: staffToCreate.length, failed: [] })
            for (const st of staffToCreate) {
              const roleLabel = STAFF_ROLES.find((r) => r.id === st.role)?.label || st.role
              try {
                const res = await fetch('/api/users/create', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: st.name, email: st.email, role: st.role }),
                })
                const j = await res.json().catch(() => ({} as any))
                if (!res.ok) {
                  const reason = j.error || `HTTP ${res.status}`
                  staffFailed.push({ email: st.email, reason })
                  rows.push({ kind: 'staff', name: st.name, email: st.email, roleLabel, status: 'failed', detail: reason })
                } else if (j.data?.emailSent) {
                  rows.push({ kind: 'staff', name: st.name, email: st.email, roleLabel, status: 'emailed' })
                } else {
                  rows.push({ kind: 'staff', name: st.name, email: st.email, roleLabel, status: 'not_emailed', detail: j.data?.emailError || 'Email could not be sent', tempPassword: j.data?.tempPassword })
                }
              } catch (e: any) {
                staffFailed.push({ email: st.email, reason: e?.message || 'Network error' })
                rows.push({ kind: 'staff', name: st.name, email: st.email, roleLabel, status: 'failed', detail: e?.message || 'Network error' })
              }
              staffDone += 1
              setStaffSaveProgress({ done: staffDone, total: staffToCreate.length, failed: [...staffFailed] })
            }
            setSavingStaff(false)
          }
          setSetupRows(rows)
        } else if (rows.length > 0) {
          setSetupRows(rows)
        }

        // Mark onboarding done
        await supabase
          .from('user_profiles')
          .update({ onboarding_completed: true })
          .eq('user_id', user.id)
      }
    } catch (err) {
      console.error('[Onboarding] Error during finish:', err)
      // non-blocking — proceed to dashboard regardless
    }
    setSetupRunning(false)
    // If accounts were created, stay on the final screen so the admin sees who
    // was invited and who needs attention; they continue with the button there.
    if (!hasImports) router.push('/dashboard')
  }

  // Hand-over sheet for anyone whose invitation email didn't go out: their
  // activation link plus the temporary password to give them directly.
  function downloadCredentials() {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = ['Name,Email,Role,Temporary password,Activation link']
    ;(setupRows || [])
      .filter((r) => r.status === 'not_emailed' && r.tempPassword && r.email)
      .forEach((r) => lines.push([r.name, r.email, r.roleLabel, r.tempPassword!, `${origin}/welcome?email=${encodeURIComponent(r.email)}`].map(esc).join(',')))
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'invite-credentials.csv'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  /* ─── Progress bar ─── */
  function renderProgress() {
    return (
      <div className="flex items-center justify-between mb-10 max-w-lg mx-auto">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="flex flex-col items-center flex-1 relative">
              {i < STEPS.length - 1 && (
                <div
                  className="absolute top-[14px] left-[50%] w-full h-[2px] transition-colors duration-500"
                  style={{ background: i < step ? '#0ea5e9' : '#27405c' }}
                />
              )}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium z-10 transition-all duration-300 ${
                  i < step ? 'bg-[#0ea5e9] text-white' : i === step ? 'bg-[#0ea5e9] text-white' : 'bg-[#16273d] text-gray-500 border border-[#27405c]'
                }`}
              >
                {i < step ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3 h-3" />}
              </div>
              <span className={`text-[11px] mt-1.5 text-center leading-tight ${i === step ? 'text-white font-medium' : 'text-gray-500'}`}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  /* ─── Step content ─── */
  function renderStep() {
    /* ── STEP 1: Club Profile ── */
    if (step === 0) return (
      <div>
        <div className="w-11 h-11 rounded-[10px] bg-sky-500/10 flex items-center justify-center mb-4">
          <ImageIcon className="w-5 h-5 text-sky-400" />
        </div>
        <h2 className="text-lg font-medium text-white mb-1">Club profile</h2>
        <p className="text-[13px] text-gray-400 mb-6">Set up your club&apos;s visual identity. You can always change this later.</p>

        <div className="grid grid-cols-[auto_1fr] gap-6 mb-5">
          {/* Badge upload */}
          <div>
            <label className={lbl}>Club badge</label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-[#27405c] hover:border-[#0ea5e9] flex flex-col items-center justify-center gap-1 transition-colors overflow-hidden"
            >
              {badgePreview ? (
                <img src={badgePreview} alt="badge" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Upload className="w-5 h-5 text-gray-500" />
                  <span className="text-[10px] text-gray-500">Upload</span>
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleBadgeUpload} />
          </div>

          {/* Live preview card — reflects the real (dark) app look with the chosen accent */}
          <div>
            <label className={lbl}>Live preview</label>
            <div
              className="h-24 rounded-xl flex items-center justify-between gap-3 px-4 transition-all duration-300 border"
              style={{
                background: (PRESETS as any)[getPresetThemeName(primaryColor)].p9,
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-3">
                {badgePreview
                  ? <img src={badgePreview} alt="badge" className="w-10 h-10 rounded-lg object-cover" />
                  : <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: primaryColor }}><ImageIcon className="w-5 h-5" style={{ color: (PRESETS as any)[getPresetThemeName(primaryColor)].btnTxt }} /></div>
                }
                <span className="font-semibold text-sm" style={{ color: (PRESETS as any)[getPresetThemeName(primaryColor)].t1 }}>
                  {clubNickname || 'Your Club'}
                </span>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md" style={{ background: primaryColor, color: (PRESETS as any)[getPresetThemeName(primaryColor)].btnTxt }}>
                Accent
              </span>
            </div>
          </div>
        </div>

        {/* Single club colour — drives the whole app theme */}
        <div className="mb-4">
          <label className={lbl}>Club colour</label>
          <p className="text-[12px] text-gray-400 mb-2.5 -mt-0.5">Pick one colour — the app builds your entire look around it.</p>
          <ClubColorPicker value={primaryColor} onChange={setPrimaryColor} />
        </div>

        <div className="mb-4">
          <label className={lbl}>Club name <span className="font-normal text-gray-500">(optional)</span></label>
          <input type="text" value={clubNickname} onChange={(e) => setClubNickname(e.target.value)}
            placeholder="e.g. The Heathens" className={inp} />
        </div>

        <div className="mb-4">
          <label className={lbl}>Club slogan <span className="font-normal text-gray-500">(optional)</span></label>
          <p className="text-[12px] text-gray-400 mb-2.5 -mt-0.5">
            A rallying line for the team — shown to players when they&apos;re selected for a fixture.
          </p>
          <input type="text" value={clubSlogan} onChange={(e) => setClubSlogan(e.target.value)}
            placeholder="e.g. Strength. Unity. Victory." className={inp} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Year founded <span className="font-normal text-gray-500">(optional)</span></label>
            <input type="number" value={yearFounded} onChange={(e) => setYearFounded(e.target.value)}
              placeholder="e.g. 1998" min="1800" max={new Date().getFullYear()} className={inp} />
          </div>
          <div>
            <label className={lbl}>Club website <span className="font-normal text-gray-500">(optional)</span></label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourclub.ug" className={`${inp} pl-8`} />
            </div>
          </div>
        </div>
      </div>
    )

    /* ── STEP 2: Sport Configuration ── */
    if (step === 1) return (
      <div>
        <div className="w-11 h-11 rounded-[10px] bg-[#FEF3C7] flex items-center justify-center mb-4">
          <Trophy className="w-5 h-5 text-[#92400E]" />
        </div>
        <h2 className="text-lg font-medium text-white mb-1">Sport configuration</h2>
        <p className="text-[13px] text-gray-400 mb-6">Tell us about your competition structure so Team Master can set up the right tools.</p>

        <div className="mb-4">
          <label className={lbl}>Competition / league</label>
          <input type="text" value={league} onChange={(e) => setLeague(e.target.value)}
            placeholder="e.g. Uganda Rugby Premiership" className={inp} />
        </div>

        <div className="mb-5">
          <label className={lbl}>Season start month</label>
          <div className="relative">
            <select value={seasonMonth} onChange={(e) => setSeasonMonth(e.target.value)}
              className={`${inp} appearance-none pr-8`}>
              <option value="">Select month...</option>
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Multiple teams toggle */}
        <div className="mb-4">
          <div className="flex items-center justify-between py-3 border-b border-[#16273d]">
            <div>
              <p className="text-[13px] font-medium text-white">Multiple teams</p>
              <p className="text-[12px] text-gray-500">Do you run more than one team? (e.g. First XV, Under-20s)</p>
            </div>
            <button
              type="button"
              onClick={() => setMultipleTeams(!multipleTeams)}
              className={`w-9 h-5 rounded-full relative transition-colors ${multipleTeams ? 'bg-[#0ea5e9]' : 'bg-[#555]'}`}
            >
              <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${multipleTeams ? 'left-[18px]' : 'left-[2px]'}`} />
            </button>
          </div>

          {multipleTeams && (
            <div className="mt-3 space-y-2">
              {teams.map((team, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={team}
                    onChange={(e) => {
                      const updated = [...teams]
                      updated[i] = e.target.value
                      setTeams(updated)
                    }}
                    className={`${inpRow} flex-1 min-w-0`}
                    placeholder={`Team ${i + 1}`}
                  />
                  {teams.length > 1 && (
                    <button type="button" onClick={() => removeTeam(i)}
                      className="text-gray-500 hover:text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addTeam}
                className="flex items-center gap-1.5 text-[13px] text-[#0ea5e9] hover:text-[#0284c7] transition-colors mt-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add another team
              </button>
            </div>
          )}
        </div>
      </div>
    )

    /* ── STEP 3: Squad ── */
    if (step === 2) return (
      <div>
        <div className="w-11 h-11 rounded-[10px] bg-sky-500/10 flex items-center justify-center mb-4">
          <Users className="w-5 h-5 text-[#0284c7]" />
        </div>
        <h2 className="text-lg font-medium text-white mb-1">Build your squad</h2>
        <p className="text-[13px] text-gray-400 mb-6">Import your players now or add them manually. You can always do this later from the dashboard.</p>

        {/* Mode selector */}
        {!squadMode && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button type="button" onClick={() => setSquadMode('csv')}
              className="flex flex-col items-center gap-2 p-4 border-2 border-[#27405c] rounded-xl hover:border-[#0ea5e9] hover:bg-[#0ea5e9]/5 hover:shadow-lg hover:shadow-sky-500/20 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300">
              <FileSpreadsheet className="w-7 h-7 text-[#0ea5e9]" />
              <span className="text-[13px] font-medium text-white">Import CSV</span>
              <span className="text-[11px] text-gray-500 text-center">Upload a spreadsheet of your squad</span>
            </button>
            <button type="button" onClick={() => setSquadMode('manual')}
              className="flex flex-col items-center gap-2 p-4 border-2 border-[#27405c] rounded-xl hover:border-[#0ea5e9] hover:bg-[#0ea5e9]/5 hover:shadow-lg hover:shadow-sky-500/20 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300">
              <Plus className="w-7 h-7 text-[#0ea5e9]" />
              <span className="text-[13px] font-medium text-white">Add manually</span>
              <span className="text-[11px] text-gray-500 text-center">Enter players one by one</span>
            </button>
          </div>
        )}

        {/* CSV mode — upload a spreadsheet, parse it live, show a preview
            table where the manager can review, tweak, and deselect rows
            before we create the players. */}
        {squadMode === 'csv' && (
          <div>
            <button type="button" onClick={() => { setSquadMode(null); clearCsv() }}
              className="text-[12px] text-gray-500 hover:text-gray-300 mb-3 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Change method
            </button>

            {/* Drop / browse zone — hidden once we have parsed rows to save
                screen space for the preview table. */}
            {csvParsedRows.length === 0 && (
              <div
                onClick={() => csvRef.current?.click()}
                className="border-2 border-dashed border-[#27405c] hover:border-[#0ea5e9] rounded-xl p-8 text-center cursor-pointer transition-colors mb-3"
              >
                <FileSpreadsheet className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                {csvParsing ? (
                  <p className="text-[13px] text-[#0ea5e9] font-medium">Reading {csvFile?.name || 'your file'}…</p>
                ) : csvFile ? (
                  <p className="text-[13px] text-[#0ea5e9] font-medium">{csvFile.name}</p>
                ) : (
                  <>
                    <p className="text-[13px] text-gray-300 font-medium">Drop your spreadsheet here or click to browse</p>
                    <p className="text-[12px] text-gray-500 mt-1">Accepts .csv, .xlsx, .xls · Columns: Name, Position, Date of Birth, Email, Jersey Number</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={csvRef}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f) }}
            />

            {csvParseError && (
              <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
                {csvParseError}
              </div>
            )}

            {/* Parsed preview — the whole point of this step: the manager
                sees exactly what will be imported before they commit. */}
            {csvParsedRows.length > 0 && (
              <div className="mb-3 rounded-xl border border-[#27405c] bg-[#0f1d2f] overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#27405c] bg-[#16273d] px-3 py-2">
                  <div className="text-[12px] text-gray-300">
                    <span className="font-semibold text-white">{csvParsedRows.filter((r) => r.include).length}</span>
                    {' of '}
                    <span className="font-semibold text-white">{csvParsedRows.length}</span>
                    {' players will be added'}
                    {csvFile && <span className="text-gray-500"> — from {csvFile.name}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => csvRef.current?.click()}
                      className="text-[11px] text-sky-400 hover:text-sky-300"
                    >Replace file</button>
                    <button
                      type="button"
                      onClick={clearCsv}
                      className="text-[11px] text-gray-400 hover:text-gray-200"
                    >Clear</button>
                  </div>
                </div>
                <div className="max-h-[320px] overflow-auto">
                  <table className="w-full min-w-[720px] text-[12px]">
                    <thead className="bg-[#16273d] text-gray-300 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left w-8">
                          <input
                            type="checkbox"
                            aria-label="Toggle all"
                            checked={csvParsedRows.every((r) => r.include)}
                            onChange={(e) => setCsvParsedRows((rows) => rows.map((r) => ({ ...r, include: e.target.checked })))}
                          />
                        </th>
                        <th className="px-2 py-1.5 text-left">Name</th>
                        <th className="px-2 py-1.5 text-left">Position</th>
                        <th className="px-2 py-1.5 text-left">Date of Birth</th>
                        <th className="px-2 py-1.5 text-left">Email</th>
                        <th className="px-2 py-1.5 text-left w-14">#</th>
                        <th className="w-6"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvParsedRows.map((r, i) => (
                        <tr key={i} className={r.include ? '' : 'opacity-50'}>
                          <td className="px-2 py-1 border-t border-[#27405c]">
                            <input
                              type="checkbox"
                              checked={r.include}
                              onChange={(e) => updateCsvRow(i, { include: e.target.checked })}
                              aria-label={`Include ${r.name}`}
                            />
                          </td>
                          <td className="px-1 py-1 border-t border-[#27405c]">
                            <input value={r.name} onChange={(e) => updateCsvRow(i, { name: e.target.value })}
                              className="w-full bg-transparent text-white px-2 py-1 rounded border border-transparent hover:border-[#27405c] focus:border-[#0ea5e9] focus:outline-none" />
                            {rowIssue(r, csvParsedRows) && (
                              <p className="px-2 text-[10px] leading-tight text-amber-400">{rowIssue(r, csvParsedRows)}</p>
                            )}
                          </td>
                          <td className="px-1 py-1 border-t border-[#27405c]">
                            <select
                              value={normalizePosition(r.position) || ''}
                              onChange={(e) => updateCsvRow(i, { position: e.target.value, include: true })}
                              className={`w-full bg-[#16273d] px-1.5 py-1 rounded border focus:outline-none focus:border-[#0ea5e9] ${normalizePosition(r.position) ? 'text-white border-transparent' : 'text-amber-300 border-amber-500/50'}`}
                            >
                              <option value="">Choose…</option>
                              {POSITION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td className="px-1 py-1 border-t border-[#27405c]">
                            <input value={r.date_of_birth} onChange={(e) => updateCsvRow(i, { date_of_birth: e.target.value })}
                              placeholder="YYYY-MM-DD"
                              className="w-full bg-transparent text-white px-2 py-1 rounded border border-transparent hover:border-[#27405c] focus:border-[#0ea5e9] focus:outline-none" />
                          </td>
                          <td className="px-1 py-1 border-t border-[#27405c]">
                            <input value={r.email} onChange={(e) => updateCsvRow(i, { email: e.target.value })}
                              placeholder="(optional)"
                              className="w-full bg-transparent text-white px-2 py-1 rounded border border-transparent hover:border-[#27405c] focus:border-[#0ea5e9] focus:outline-none" />
                          </td>
                          <td className="px-1 py-1 border-t border-[#27405c]">
                            <input value={r.jersey_number} onChange={(e) => updateCsvRow(i, { jersey_number: e.target.value })}
                              className="w-full bg-transparent text-white px-2 py-1 rounded border border-transparent hover:border-[#27405c] focus:border-[#0ea5e9] focus:outline-none" />
                          </td>
                          <td className="px-1 py-1 border-t border-[#27405c] text-right">
                            <button type="button" onClick={() => removeCsvRow(i)} aria-label={`Remove ${r.name}`}>
                              <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="px-3 py-2 text-[11px] text-gray-500 border-t border-[#27405c]">
                  Each player with an email gets an invitation to activate their account and choose a password. Players without an email are still added, but can&apos;t be invited until you add one on the Players screen. Rows flagged in amber start unticked — fix them, then tick to include.
                </p>
              </div>
            )}

            {/* Progress + result of the actual create-players pass (runs
                when the user clicks Finish). */}
            {squadSaveProgress && (
              <div className="mb-3 rounded-lg border border-[#27405c] bg-[#0f1d2f] px-3 py-2">
                <div className="flex items-center justify-between text-[12px] text-gray-300 mb-1">
                  <span>Adding players…</span>
                  <span className="font-semibold text-white">{squadSaveProgress.done}/{squadSaveProgress.total}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#16273d] overflow-hidden">
                  <div className="h-full bg-[#0ea5e9] transition-all" style={{ width: `${(squadSaveProgress.done / Math.max(1, squadSaveProgress.total)) * 100}%` }} />
                </div>
                {squadSaveProgress.failed.length > 0 && (
                  <p className="mt-2 text-[11px] text-red-300">
                    {squadSaveProgress.failed.length} could not be added — you can fix them on the Players screen after finishing.
                  </p>
                )}
              </div>
            )}

            <button type="button" onClick={downloadSquadTemplate}
              className="text-[12px] text-sky-400 hover:text-sky-300 transition-colors">
              Download CSV template
            </button>
          </div>
        )}

        {/* Manual mode */}
        {squadMode === 'manual' && (
          <div>
            <button type="button" onClick={() => setSquadMode(null)}
              className="text-[12px] text-gray-500 hover:text-gray-300 mb-3 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Change method
            </button>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <input type="text" value={newPlayer.name} onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPlayer() } }}
                placeholder="Player name" className={`${inpRow} sm:flex-1 min-w-0`} />
              <input type="email" value={newPlayer.email} onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPlayer() } }}
                placeholder="Email (to send their invite)" className={`${inpRow} sm:flex-1 min-w-0`} />
              <select value={normalizePosition(newPlayer.position) || ''} onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value })}
                className={`${inpRow} sm:w-40 flex-shrink-0`}>
                <option value="">Position…</option>
                {POSITION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button type="button" onClick={addPlayer}
                className="px-3 py-2 bg-[#0ea5e9] rounded-lg text-white hover:bg-[#0284c7] transition-colors flex-shrink-0 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {manualPlayers.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto mb-3">
                {manualPlayers.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#16273d] rounded-lg px-3 py-2">
                    <span className="text-[13px] text-white">{p.name}{' '}
                      <span className="text-gray-500">· {p.email || 'no email'}</span></span>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-gray-500">{POSITION_OPTIONS.find((o) => o.value === normalizePosition(p.position))?.label || p.position}</span>
                      <button type="button" onClick={() => removePlayer(i)}>
                        <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Squad size */}
        <div className="mt-4 pt-4 border-t border-[#16273d]">
          <label className={lbl}>Expected squad size</label>
          <input type="number" value={squadSize} onChange={(e) => setSquadSize(e.target.value)}
            placeholder="e.g. 30" min="1" max="200" className={inp} />
          <p className="text-[12px] text-gray-500 mt-1">This helps Team Master set limits and plan capacity.</p>
        </div>
      </div>
    )

    /* ── STEP 4: Invite Staff ── */
    if (step === 3) return (
      <div>
        <div className="w-11 h-11 rounded-[10px] bg-sky-500/10 flex items-center justify-center mb-4">
          <UserPlus className="w-5 h-5 text-sky-400" />
        </div>
        <h2 className="text-lg font-medium text-white mb-1">Invite your staff</h2>
        <p className="text-[13px] text-gray-400 mb-6">Add coaches, physios, and managers by name and email, or import a spreadsheet. When you finish setup each person is emailed a link to activate their account and choose their own password.</p>

        {/* Add staff row */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input type="text" value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
            placeholder="Full name" className={`${inp} sm:flex-1`} />
          <div className="relative sm:flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input type="email" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
              placeholder="staff@club.ug" className={`${inp} pl-8`} />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 sm:flex-initial">
              <select value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                className={`${inpRow} appearance-none pr-7 w-full sm:w-36`}>
                {STAFF_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            </div>
            <button type="button" onClick={addStaff}
              className="px-3 py-2 bg-[#0ea5e9] rounded-lg text-white hover:bg-[#0284c7] transition-colors flex-shrink-0">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Spreadsheet import — same idea as the squad import */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button type="button" onClick={() => staffCsvRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-[#27405c] hover:border-[#0ea5e9] rounded-lg text-[12px] text-gray-300 transition-colors">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Import staff from spreadsheet
          </button>
          <button type="button" onClick={downloadStaffTemplate} className="text-[12px] text-sky-400 hover:text-sky-300 transition-colors">
            Download template
          </button>
          <span className="text-[11px] text-gray-500">Columns: Name, Email, Role</span>
          <input ref={staffCsvRef} type="file" className="hidden"
            accept=".csv,.tsv,.txt,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleStaffFile(f); e.target.value = '' }} />
        </div>
        {staffImportNote && (
          <div className={`mb-4 rounded-lg border px-3 py-2 text-[12px] ${staffImportNote.problems.length ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
            <p className="font-medium">{staffImportNote.added} staff member{staffImportNote.added === 1 ? '' : 's'} added from the file.</p>
            {staffImportNote.problems.length > 0 && (
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                {staffImportNote.problems.slice(0, 8).map((m, i) => <li key={i}>{m}</li>)}
                {staffImportNote.problems.length > 8 && <li>…and {staffImportNote.problems.length - 8} more</li>}
              </ul>
            )}
          </div>
        )}

        {/* Invite list */}
        {staffInvites.length > 0 ? (
          <div className="space-y-2 mb-4">
            {staffInvites.map((s, i) => {
              const roleLabel = STAFF_ROLES.find((r) => r.id === s.role)?.label || s.role
              return (
                <div key={i} className="flex items-center justify-between bg-[#16273d] rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-[13px] text-white">{s.name} <span className="text-gray-500">· {s.email}</span></p>
                    <p className="text-[11px] text-gray-500">{roleLabel}</p>
                  </div>
                  <button type="button" onClick={() => removeStaff(i)}>
                    <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-[#16273d] rounded-lg p-4 text-center mb-4">
            <UserPlus className="w-6 h-6 text-gray-600 mx-auto mb-1" />
            <p className="text-[13px] text-gray-500">No staff invited yet. Add a name and email above.</p>
            <p className="text-[12px] text-gray-600 mt-0.5">You can skip this and invite staff from the dashboard later.</p>
          </div>
        )}

        {/* Progress + result of the actual account-creation pass (runs
            when the user clicks Finish) — same pattern as the squad
            import progress in Step 3. */}
        {staffSaveProgress && (
          <div className="rounded-lg border border-[#27405c] bg-[#0f1d2f] px-3 py-2">
            <div className="flex items-center justify-between text-[12px] text-gray-300 mb-1">
              <span>Creating staff accounts…</span>
              <span className="font-semibold text-white">{staffSaveProgress.done}/{staffSaveProgress.total}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#16273d] overflow-hidden">
              <div className="h-full bg-[#0ea5e9] transition-all" style={{ width: `${(staffSaveProgress.done / Math.max(1, staffSaveProgress.total)) * 100}%` }} />
            </div>
            {staffSaveProgress.failed.length > 0 && (
              <p className="mt-2 text-[11px] text-red-300">
                {staffSaveProgress.failed.length} could not be added — you can invite them again from the Staff screen after finishing.
              </p>
            )}
          </div>
        )}
      </div>
    )

    /* ── Done ── */
    if (step === 4) return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-sky-500/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-[#0ea5e9]" />
        </div>
        <h2 className="text-lg font-medium text-white mb-1">Your club is set up!</h2>
        <p className="text-[13px] text-gray-400 mb-6 leading-relaxed">
          Everything is in place. Head to your dashboard to start managing your club.
        </p>

        {/* Live progress while accounts are being created and emailed */}
        {setupRunning && (
          <div className="text-left mb-6 space-y-3">
            {squadSaveProgress && squadSaveProgress.total > 0 && (
              <div className="rounded-lg border border-[#27405c] bg-[#0f1d2f] px-3 py-2">
                <div className="flex items-center justify-between text-[12px] text-gray-300 mb-1">
                  <span>Adding players &amp; sending invites…</span>
                  <span className="font-semibold text-white">{squadSaveProgress.done}/{squadSaveProgress.total}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#16273d] overflow-hidden">
                  <div className="h-full bg-[#0ea5e9] transition-all" style={{ width: `${(squadSaveProgress.done / Math.max(1, squadSaveProgress.total)) * 100}%` }} />
                </div>
              </div>
            )}
            {staffSaveProgress && staffSaveProgress.total > 0 && (
              <div className="rounded-lg border border-[#27405c] bg-[#0f1d2f] px-3 py-2">
                <div className="flex items-center justify-between text-[12px] text-gray-300 mb-1">
                  <span>Creating staff accounts &amp; sending invites…</span>
                  <span className="font-semibold text-white">{staffSaveProgress.done}/{staffSaveProgress.total}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#16273d] overflow-hidden">
                  <div className="h-full bg-[#0ea5e9] transition-all" style={{ width: `${(staffSaveProgress.done / Math.max(1, staffSaveProgress.total)) * 100}%` }} />
                </div>
              </div>
            )}
            <p className="text-[11px] text-gray-500">Please keep this page open — large squads take a minute or two.</p>
          </div>
        )}

        {/* What happened to each invite */}
        {setupRows && !setupRunning && (() => {
          const emailed = setupRows.filter((r) => r.status === 'emailed')
          const notEmailed = setupRows.filter((r) => r.status === 'not_emailed')
          const failed = setupRows.filter((r) => r.status === 'failed')
          const hasCreds = notEmailed.some((r) => r.tempPassword)
          return (
            <div className="text-left mb-6 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 py-2">
                  <p className="text-xl font-semibold text-emerald-300">{emailed.length}</p>
                  <p className="text-[11px] text-emerald-200/80">Invited by email</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 py-2">
                  <p className="text-xl font-semibold text-amber-300">{notEmailed.length}</p>
                  <p className="text-[11px] text-amber-200/80">Added, no email sent</p>
                </div>
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 py-2">
                  <p className="text-xl font-semibold text-red-300">{failed.length}</p>
                  <p className="text-[11px] text-red-200/80">Not added</p>
                </div>
              </div>

              {notEmailed.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-[12px] font-medium text-amber-200 flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Added, but they weren&apos;t emailed
                  </p>
                  <ul className="max-h-32 overflow-y-auto space-y-0.5 text-[12px] text-gray-300">
                    {notEmailed.map((r, i) => (
                      <li key={i}><span className="text-white">{r.name}</span> — {r.detail}</li>
                    ))}
                  </ul>
                  {hasCreds && (
                    <button type="button" onClick={downloadCredentials}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/20 text-amber-100 text-[12px] hover:bg-amber-500/30 transition-colors">
                      <Download className="w-3.5 h-3.5" /> Download sign-in details to hand over
                    </button>
                  )}
                </div>
              )}

              {failed.length > 0 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <p className="text-[12px] font-medium text-red-200 mb-1">Couldn&apos;t be added — fix and add them from the Players or Staff screen</p>
                  <ul className="max-h-32 overflow-y-auto space-y-0.5 text-[12px] text-gray-300">
                    {failed.map((r, i) => (
                      <li key={i}><span className="text-white">{r.name}</span>{r.email ? ` (${r.email})` : ''} — {r.detail}</li>
                    ))}
                  </ul>
                </div>
              )}

              {emailed.length > 0 && (
                <p className="text-[12px] text-gray-400">
                  Everyone invited by email gets a link to activate their account and choose their own password.
                </p>
              )}
            </div>
          )
        })()}

        <ul className={`text-left space-y-0 mb-6 ${setupRunning || setupRows ? 'hidden' : ''}`}>
          {[
            badgePreview ? 'Club badge uploaded' : 'Club badge — you can upload later',
            `Club colours configured`,
            league ? `League: ${league}` : 'Sport configuration saved',
            multipleTeams ? `${teams.length} team(s) configured` : 'Single team structure set',
            squadMode === 'csv' && csvParsedRows.filter((r) => r.include).length > 0
              ? `${csvParsedRows.filter((r) => r.include).length} player(s) will be imported from ${csvFile?.name || 'your CSV'}`
              : squadMode === 'manual' && manualPlayers.length > 0
                ? `${manualPlayers.length} player(s) added`
                : 'Squad — add players from the dashboard',
            staffInvites.length > 0 ? `${staffInvites.length} staff account(s) will be created and emailed` : 'Staff — invite from the dashboard anytime',
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 py-2.5 border-b border-[#16273d] last:border-b-0">
              <Check className="w-4 h-4 text-[#0ea5e9] flex-shrink-0" />
              <span className="text-[13px] text-gray-300">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    )

    return null
  }

  /* ─── Render ─── */
  return (
    <div className="relative min-h-screen bg-[#0d1b2e] flex flex-col items-center justify-center p-4 overflow-hidden">
      <SportBallsBackground />

      {/* Top badge */}
      <div className="relative z-10 mb-8">
        <span className="inline-block border border-sky-400/40 text-sky-300 text-xs tracking-widest uppercase px-4 py-1.5 rounded-full">
          Team Master — Club Setup
        </span>
      </div>

      <div className="relative z-10 w-full max-w-xl">
        {renderProgress()}

        {/* Card */}
        <div className="bg-[#141e2d]/90 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/40">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-[13px] text-red-300">
              {error}
            </div>
          )}

          {renderStep()}

          {/* Navigation */}
          {step < 4 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#1e3450]">
              {step > 0 ? (
                <button type="button" onClick={back}
                  className="flex items-center gap-1.5 px-4 py-2.5 border border-[#27405c] rounded-lg text-sm text-gray-300 hover:bg-[#16273d] transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              ) : (
                <button type="button" onClick={() => router.push('/dashboard')}
                  className="text-[13px] text-gray-500 hover:text-gray-300 transition-colors">
                  Skip setup for now
                </button>
              )}

              {step === 3 ? (
                <button type="button" onClick={() => setStep(4)}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-[#0ea5e9] rounded-lg text-sm font-medium text-white hover:bg-[#0284c7] transition-colors">
                  {staffInvites.length > 0 ? 'Send invites' : 'Finish setup'} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button type="button" onClick={next}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-[#0ea5e9] rounded-lg text-sm font-medium text-white hover:bg-[#0284c7] transition-colors">
                  Continue <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Done CTA — disabled while we're still POSTing players/staff so
              the page can't navigate away mid-import. */}
          {step === 4 && (
            <button
              type="button"
              onClick={setupRows ? () => router.push('/dashboard') : finish}
              disabled={setupRunning || savingSquad || savingStaff}
              className="w-full flex items-center justify-center gap-1.5 px-5 py-3 bg-[#0ea5e9] rounded-lg text-sm font-medium text-white hover:bg-[#0284c7] transition-all duration-200 hover:shadow-[0_0_18px_rgba(14,165,233,0.45)] hover:scale-[1.01] active:scale-100 mt-4 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingSquad && squadSaveProgress
                ? <>Adding players {squadSaveProgress.done}/{squadSaveProgress.total}…</>
                : savingStaff && staffSaveProgress
                  ? <>Creating staff accounts {staffSaveProgress.done}/{staffSaveProgress.total}…</>
                  : setupRows
                    ? <>Go to dashboard <ArrowRight className="w-3.5 h-3.5" /></>
                    : csvParsedRows.some((r) => r.include) || manualPlayers.length > 0 || staffInvites.length > 0
                      ? <>Create accounts &amp; send invites <ArrowRight className="w-3.5 h-3.5" /></>
                      : <>Go to dashboard <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          )}
        </div>

        {/* Step indicator */}
        {step < 4 && (
          <p className="text-center text-[12px] text-gray-600 mt-4">
            Step {step + 1} of {STEPS.length}
          </p>
        )}
      </div>
    </div>
  )
}
