'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
  Layers,
  Mail,
  Shield,
  HeartPulse,
  Briefcase,
  CheckCircle2,
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

const STAFF_ROLES = [
  { id: 'coach', label: 'Head Coach', icon: Shield },
  { id: 'asst_coach', label: 'Asst. Coach', icon: Shield },
  { id: 'physio', label: 'Physiotherapist', icon: HeartPulse },
  { id: 'data_admin', label: 'Team Manager', icon: Briefcase },
  { id: 'analyst', label: 'Analyst', icon: Layers },
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
  const [manualPlayers, setManualPlayers] = useState<{ name: string; position: string }[]>([])
  const [newPlayer, setNewPlayer] = useState({ name: '', position: '' })
  const csvRef = useRef<HTMLInputElement>(null)

  /* Step 4 — Staff */
  const [staffInvites, setStaffInvites] = useState<{ email: string; role: string }[]>([])
  const [newStaff, setNewStaff] = useState({ email: '', role: 'coach' })

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
    if (!newPlayer.name.trim()) return
    setManualPlayers([...manualPlayers, newPlayer])
    setNewPlayer({ name: '', position: '' })
  }

  function removePlayer(i: number) {
    setManualPlayers(manualPlayers.filter((_, idx) => idx !== i))
  }

  function addStaff() {
    if (!newStaff.email.trim()) return
    setStaffInvites([...staffInvites, newStaff])
    setNewStaff({ email: '', role: 'coach' })
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
    router.push('/dashboard')
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

        {/* CSV mode */}
        {squadMode === 'csv' && (
          <div>
            <button type="button" onClick={() => setSquadMode(null)}
              className="text-[12px] text-gray-500 hover:text-gray-300 mb-3 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Change method
            </button>
            <div
              onClick={() => csvRef.current?.click()}
              className="border-2 border-dashed border-[#27405c] hover:border-[#0ea5e9] rounded-xl p-8 text-center cursor-pointer transition-colors mb-3"
            >
              <FileSpreadsheet className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              {csvFile ? (
                <p className="text-[13px] text-[#0ea5e9] font-medium">{csvFile.name}</p>
              ) : (
                <>
                  <p className="text-[13px] text-gray-300 font-medium">Drop your CSV here or click to browse</p>
                  <p className="text-[12px] text-gray-500 mt-1">Columns: Name, Position, Date of Birth</p>
                </>
              )}
            </div>
            <input ref={csvRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
            <a href="#" className="text-[12px] text-sky-400 hover:text-sky-300 transition-colors">
              Download CSV template
            </a>
          </div>
        )}

        {/* Manual mode */}
        {squadMode === 'manual' && (
          <div>
            <button type="button" onClick={() => setSquadMode(null)}
              className="text-[12px] text-gray-500 hover:text-gray-300 mb-3 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Change method
            </button>
            <div className="flex gap-2 mb-3">
              <input type="text" value={newPlayer.name} onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPlayer() } }}
                placeholder="Player name" className={`${inpRow} flex-1 min-w-0`} />
              <input type="text" value={newPlayer.position} onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPlayer() } }}
                placeholder="Position" className={`${inpRow} w-28 flex-shrink-0`} />
              <button type="button" onClick={addPlayer}
                className="px-3 py-2 bg-[#0ea5e9] rounded-lg text-white hover:bg-[#0284c7] transition-colors flex-shrink-0">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {manualPlayers.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto mb-3">
                {manualPlayers.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#16273d] rounded-lg px-3 py-2">
                    <span className="text-[13px] text-white">{p.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-gray-500">{p.position}</span>
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
        <p className="text-[13px] text-gray-400 mb-6">Add coaches, physios, and managers by email. They&apos;ll receive an invitation to join your club on Team Master.</p>

        {/* Add staff row */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input type="email" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
              placeholder="staff@club.ug" className={`${inp} pl-8`} />
          </div>
          <div className="relative">
            <select value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
              className={`${inpRow} appearance-none pr-7 w-36`}>
              {STAFF_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          </div>
          <button type="button" onClick={addStaff}
            className="px-3 py-2 bg-[#0ea5e9] rounded-lg text-white hover:bg-[#0284c7] transition-colors flex-shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Invite list */}
        {staffInvites.length > 0 ? (
          <div className="space-y-2 mb-4">
            {staffInvites.map((s, i) => {
              const roleLabel = STAFF_ROLES.find((r) => r.id === s.role)?.label || s.role
              return (
                <div key={i} className="flex items-center justify-between bg-[#16273d] rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-[13px] text-white">{s.email}</p>
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
            <p className="text-[13px] text-gray-500">No staff invited yet. Add emails above.</p>
            <p className="text-[12px] text-gray-600 mt-0.5">You can skip this and invite staff from the dashboard later.</p>
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

        <ul className="text-left space-y-0 mb-6">
          {[
            badgePreview ? 'Club badge uploaded' : 'Club badge — you can upload later',
            `Club colours configured`,
            league ? `League: ${league}` : 'Sport configuration saved',
            multipleTeams ? `${teams.length} team(s) configured` : 'Single team structure set',
            squadMode === 'csv' && csvFile ? `Squad CSV uploaded: ${csvFile.name}` : squadMode === 'manual' && manualPlayers.length > 0 ? `${manualPlayers.length} player(s) added` : 'Squad — add players from the dashboard',
            staffInvites.length > 0 ? `${staffInvites.length} staff invite(s) sent` : 'Staff — invite from the dashboard anytime',
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

          {/* Done CTA */}
          {step === 4 && (
            <button type="button" onClick={finish}
              className="w-full flex items-center justify-center gap-1.5 px-5 py-3 bg-[#0ea5e9] rounded-lg text-sm font-medium text-white hover:bg-[#0284c7] transition-all duration-200 hover:shadow-[0_0_18px_rgba(14,165,233,0.45)] hover:scale-[1.01] active:scale-100 mt-4">
              Go to dashboard <ArrowRight className="w-3.5 h-3.5" />
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
