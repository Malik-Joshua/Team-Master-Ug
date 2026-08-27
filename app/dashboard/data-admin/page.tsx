'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import BirthdayAlert from '@/components/BirthdayAlert'
import FixtureCard from '@/components/FixtureCard'
import MatchDayModal from '@/components/MatchDayModal'
import { Users, Activity, BarChart3, Calendar, Trophy, Plus, X, Save, MapPin, CheckCircle, Upload, FileText, CheckCircle2, AlertCircle, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RefreshButton from '@/components/RefreshButton'
import { isActivityPast } from '@/lib/utils'
import { readTabularFile } from '@/lib/tabular-import'

// Same helpers used by the admin/coach dashboards' "Next fixture" card, so
// the team manager's version renders identically.
const formatDateSafe = (dateString: string | null | undefined, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!dateString) return 'TBD'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'TBD'
  return date.toLocaleDateString('en-US', options)
}

const formatTimeSafe = (dateString: string | null | undefined) => {
  if (!dateString) return 'TBD'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'TBD'
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

interface Player {
  user_id: string
  name: string
  position?: string
}

interface MatchForm {
  match_date: string
  opponent: string
  tournament_type: 'uganda_cup' | 'league' | 'sevens' | 'friendly'
  venue: string
  result: 'win' | 'loss' | 'draw'
  score_our_team: string
  score_opponent: string
  notes: string
}

interface PlayerStats {
  player_id: string
  tackles_made: string
  tackles_missed: string
  ball_handling_errors: string
  ball_carries: string
  tries_scored: string
  minutes_played: string
  // On-field discipline. Modeled as two independent booleans (a 2nd-yellow →
  // red typically means BOTH get recorded), but the UI treats them as
  // mutually exclusive toggles for clarity.
  yellow_card: boolean
  red_card: boolean
}

export default function DataAdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // Club slogan — shown on the "Next fixture" card to hype the squad.
  const [clubSlogan, setClubSlogan] = useState<string | null>(null)
  const [clubBadge, setClubBadge] = useState<string | null>(null)
  // Club's actual name — read live from club_settings so a rename by the
  // admin instantly shows everywhere (fixture cards, match day modal, etc.)
  const [clubName, setClubName] = useState<string | null>(null)
  const [showMatchDayModal, setShowMatchDayModal] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [activePlayersCount, setActivePlayersCount] = useState(0)
  const [matchesCount, setMatchesCount] = useState(0)
  const [trainingSessionsCount, setTrainingSessionsCount] = useState(0)
  const [staffMatchesAttended, setStaffMatchesAttended] = useState(0)
  const [recentGymSchedules, setRecentGymSchedules] = useState<any[]>([])
  const [showMatchForm, setShowMatchForm] = useState(false)
  const [showCreateFixtureForm, setShowCreateFixtureForm] = useState(false)
  const [fixtureForm, setFixtureForm] = useState({
    match_date: '',
    opponent: '',
    tournament_type: 'friendly' as 'uganda_cup' | 'league' | 'sevens' | 'friendly',
    venue: '',
    notes: '',
    physio_id: '',
    team_manager_id: '',
    coach_id: '',
  })
  const [availablePhysios, setAvailablePhysios] = useState<any[]>([])
  const [availableTeamManagers, setAvailableTeamManagers] = useState<any[]>([])
  const [availableCoaches, setAvailableCoaches] = useState<any[]>([])
  const [creatingFixture, setCreatingFixture] = useState(false)
  const [matchForm, setMatchForm] = useState<MatchForm>({
    match_date: '',
    opponent: '',
    tournament_type: 'friendly',
    venue: '',
    result: 'win',
    score_our_team: '0',
    score_opponent: '0',
    notes: '',
  })
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({})
  const [saving, setSaving] = useState(false)
  const [matches, setMatches] = useState<any[]>([])
  // Set of match ids that already have at least one player-stat row recorded,
  // so we can flag played matches that are still missing their stats.
  const [matchesWithStats, setMatchesWithStats] = useState<Set<string>>(new Set())
  const [selectedMatchForStats, setSelectedMatchForStats] = useState<string>('')
  const [teamSelections, setTeamSelections] = useState<any[]>([])
  const [loadingTeamSelection, setLoadingTeamSelection] = useState(false)
  const [matchWithStaff, setMatchWithStaff] = useState<any>(null)

  // CSV match-stats import state
  const [showStatsImport, setShowStatsImport] = useState(false)
  const [statsImportFile, setStatsImportFile] = useState<File | null>(null)
  const [statsImportProgress, setStatsImportProgress] = useState(0)
  const [statsImportStep, setStatsImportStep] = useState('')
  const [statsImporting, setStatsImporting] = useState(false)
  const [statsImportRows, setStatsImportRows] = useState<Array<{
    name: string
    matchedPlayer: Player | null
    confidence: 'exact' | 'fuzzy' | 'none'
    tackles_made: number
    tackles_missed: number
    ball_handling_errors: number
    ball_carries: number
    tries_scored: number
    minutes_played: number
  }>>([])
  const [showStatsPreview, setShowStatsPreview] = useState(false)

  // ── Sevens tournaments ──
  const [tournaments, setTournaments] = useState<any[]>([])
  const [showTournaments, setShowTournaments] = useState(false)
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null)
  // When entering stats for a tournament game we hide the tracker, then pop it
  // back open (and reload) once the stats modal closes.
  const [reopenTrackerFor, setReopenTrackerFor] = useState<string | null>(null)
  const [tournamentsUnavailable, setTournamentsUnavailable] = useState(false)
  // Opponent typed in when adding the next knockout / placement game.
  const [advanceOpponent, setAdvanceOpponent] = useState('')

  const loadTournaments = useCallback(async () => {
    try {
      const res = await fetch('/api/tournaments')
      const data = await res.json()
      if (!res.ok) {
        if (data.needsMigration) setTournamentsUnavailable(true)
        console.error('Error loading tournaments:', data.error)
        return
      }
      setTournaments(data.tournaments || [])
      setTournamentsUnavailable(false)
    } catch (err) {
      console.error('Error loading tournaments:', err)
    }
  }, [])

  const loadData = useCallback(async () => {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        setLoading(false)
        return
      }

      if (authUser) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (profile) {
          setUser(profile)

          // Fetch players using API route to bypass RLS
          try {
            const playersResponse = await fetch('/api/admin/players')
            if (playersResponse.ok) {
              const playersData = await playersResponse.json()
              if (playersData.players) {
                setPlayers(playersData.players.map((p: any) => ({
                  user_id: p.user_id,
                  name: p.name,
                  position: p.position,
                })))
                // Calculate active players (status === 'active')
                const activePlayers = playersData.players.filter((p: any) => p.status === 'active').length
                setActivePlayersCount(activePlayers)
              }
            } else {
              // Fallback to direct query
              const { data: playersData } = await supabase
                .from('user_profiles')
                .select('user_id, name, status')
                .eq('role', 'player')
                .order('name', { ascending: true })

              if (playersData) {
                setPlayers(playersData.map((p: any) => ({
                  user_id: p.user_id,
                  name: p.name,
                })))
                const activePlayers = playersData.filter((p: any) => p.status === 'active').length
                setActivePlayersCount(activePlayers)
              }
            }
          } catch (playersError) {
            console.error('Error fetching players:', playersError)
            // Fallback to direct query
          const { data: playersData } = await supabase
            .from('user_profiles')
              .select('user_id, name, status')
            .eq('role', 'player')
            .order('name', { ascending: true })

          if (playersData) {
              setPlayers(playersData.map((p: any) => ({
                user_id: p.user_id,
                name: p.name,
              })))
              const activePlayers = playersData.filter((p: any) => p.status === 'active').length
              setActivePlayersCount(activePlayers)
            }
          }

          // Fetch matches count using API route
          try {
            const statsResponse = await fetch('/api/admin/statistics')
            if (statsResponse.ok) {
              const statsData = await statsResponse.json()
              setMatchesCount(statsData.totalMatches || 0)
              setTrainingSessionsCount(statsData.totalTrainingSessions || 0)
            } else {
              // Fallback to direct queries
              const { count: matchesCount, error: matchesError } = await supabase
                .from('matches')
                .select('*', { count: 'exact', head: true })

              if (!matchesError && matchesCount !== null) {
                setMatchesCount(matchesCount)
              }

              const { count: trainingCount, error: trainingError } = await supabase
                .from('training_sessions')
                .select('*', { count: 'exact', head: true })

              if (!trainingError && trainingCount !== null) {
                setTrainingSessionsCount(trainingCount)
              }
            }
          } catch (statsError) {
            console.error('Error fetching statistics:', statsError)
            // Fallback to direct queries
            const { count: matchesCount, error: matchesError } = await supabase
              .from('matches')
              .select('*', { count: 'exact', head: true })

            if (!matchesError && matchesCount !== null) {
              setMatchesCount(matchesCount)
            }

            const { count: trainingCount, error: trainingError } = await supabase
              .from('training_sessions')
              .select('*', { count: 'exact', head: true })

            if (!trainingError && trainingCount !== null) {
              setTrainingSessionsCount(trainingCount)
            }
          }

          // Fetch staff match attendance for this user
          try {
            const { count: attendedMatches } = await supabase
              .from('match_staff_attendance')
              .select('match_id, matches!inner(status)', { count: 'exact', head: true })
              .eq('staff_id', authUser.id)
              .eq('attendance_status', 'P')
              .eq('matches.status', 'played')
            setStaffMatchesAttended(attendedMatches || 0)
          } catch (attendanceError) {
            console.error('Error fetching staff match attendance:', attendanceError)
            setStaffMatchesAttended(0)
          }

          // Fetch available physios, team managers, and coaches for fixture staff assignment
          try {
            const usersResponse = await fetch('/api/messages/users')
            if (usersResponse.ok) {
              const usersData = await usersResponse.json()
              if (usersData.users) {
                setAvailablePhysios(usersData.users.filter((u: any) => u.role === 'physio'))
                setAvailableTeamManagers(usersData.users.filter((u: any) => u.role === 'data_admin'))
                setAvailableCoaches(usersData.users.filter((u: any) => u.role === 'coach'))
              }
            }
          } catch (staffError) {
            console.error('Error fetching staff members:', staffError)
          }

          // Load matches for match stats and team selection viewing (all matches, not just upcoming)
          try {
            const { data: matchesData, error: matchesError } = await supabase
              .from('matches')
              .select('id, match_date, opponent, venue, tournament_type, status, notes, physio_id, team_manager_id, coach_id')
              .order('match_date', { ascending: false })
              .limit(100)

            if (matchesError) {
              console.error('Error loading matches:', matchesError)
              // Try using API route as fallback
              try {
                const response = await fetch('/api/fixtures')
                if (response.ok) {
                  const apiData = await response.json()
                  if (apiData.fixtures) {
                    setMatches(apiData.fixtures)
                    console.log('Loaded matches via API:', apiData.fixtures.length)
                  }
                }
              } catch (apiErr) {
                console.error('Error loading matches via API:', apiErr)
              }
            } else if (matchesData) {
              setMatches(matchesData)
              console.log('Loaded matches for viewing:', matchesData.length)
            }

            // Work out which of those matches already have player stats recorded,
            // so the dashboard can flag played matches that still need stats.
            try {
              const { data: statRows } = await supabase
                .from('match_stats')
                .select('match_id')
              setMatchesWithStats(new Set((statRows || []).map((r: any) => r.match_id)))
            } catch (statErr) {
              console.error('Error loading match_stats coverage:', statErr)
            }
          } catch (matchesErr) {
            console.error('Error in matches loading:', matchesErr)
          }
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    loadTournaments()
  }, [loadData, loadTournaments])

  // Reopen the tournament tracker (and refresh) whenever the stats modal
  // closes after being launched from a tournament game.
  useEffect(() => {
    if (!showMatchForm && reopenTrackerFor) {
      const id = reopenTrackerFor
      setReopenTrackerFor(null)
      setActiveTournamentId(id)
      setShowTournaments(true)
      loadTournaments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMatchForm])

  // Load the club's slogan for the "Next fixture" card. Isolated so a
  // failure here never blocks the rest of the dashboard.
  useEffect(() => {
    const loadClubSlogan = async () => {
      try {
        const supabase = createClient()
        let { data, error } = await supabase
          .from('club_settings')
          .select('club_slogan, badge_url, club_nickname')
          .order('updated_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        // club_slogan and badge_url are newer columns — fall back quietly
        // if they haven't been applied yet.
        if (error?.message?.includes('club_slogan') || error?.message?.includes('badge_url')) {
          setClubSlogan(null)
          setClubBadge(null)
          setClubName(null)
          return
        }
        setClubSlogan(data?.club_slogan || null)
        setClubBadge(data?.badge_url || null)
        setClubName(data?.club_nickname || null)
      } catch {
        setClubSlogan(null)
      }
    }
    loadClubSlogan()
  }, [])

  // Load staff members when fixture form is opened
  useEffect(() => {
    const loadStaffMembers = async () => {
      if (showCreateFixtureForm) {
        try {
          console.log('Loading staff members for fixture form...')
          const usersResponse = await fetch('/api/messages/users')
          if (usersResponse.ok) {
            const usersData = await usersResponse.json()
            console.log('Staff members data received:', usersData)
            if (usersData.users) {
              const physios = usersData.users.filter((u: any) => u.role === 'physio')
              const teamManagers = usersData.users.filter((u: any) => u.role === 'data_admin')
              const coaches = usersData.users.filter((u: any) => u.role === 'coach')
              console.log('Filtered staff:', { physios: physios.length, teamManagers: teamManagers.length, coaches: coaches.length })
              setAvailablePhysios(physios)
              setAvailableTeamManagers(teamManagers)
              setAvailableCoaches(coaches)
            }
          } else {
            console.error('Failed to fetch staff members:', usersResponse.status)
          }
        } catch (staffError) {
          console.error('Error fetching staff members:', staffError)
        }
      }
    }
    loadStaffMembers()
  }, [showCreateFixtureForm])

  const handleSaveMatch = async () => {
    if (!selectedMatchForStats) {
      alert('Please select a match first')
      return
    }

    if (!matchForm.match_date || !matchForm.opponent) {
      alert('Please fill in match date and opponent')
      return
    }

    // Validate that the match date has passed
    if (!isActivityPast(matchForm.match_date, null)) {
      alert('Cannot enter match stats for a future match. The match must have occurred before stats can be entered.')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        alert('Please log in to save match stats')
        return
      }

      // Update existing match record with stats and mark as played
      const { error: matchError } = await supabase
        .from('matches')
        .update({
          match_date: matchForm.match_date,
          opponent: matchForm.opponent,
          tournament_type: matchForm.tournament_type,
          venue: matchForm.venue || null,
          result: matchForm.result || null,
          score_our_team: parseInt(matchForm.score_our_team) || 0,
          score_opponent: parseInt(matchForm.score_opponent) || 0,
          notes: matchForm.notes || null,
          status: 'played', // Mark match as played when stats are entered
        })
        .eq('id', selectedMatchForStats)

      if (matchError) throw matchError

      // Get selected team for this match (if exists)
      const { data: teamSelectionData } = await supabase
        .from('fixture_team_selections')
        .select('player_id')
        .eq('match_id', selectedMatchForStats)

      const selectedPlayerIds = teamSelectionData?.map((s: any) => s.player_id) || []

      // Create match stats only for selected players (if team is selected)
      // If no team selected, allow all players
      const statsToInsert = Object.entries(playerStats)
        .filter(([playerId, stats]) => {
          // Only include players who are in the selected team (if team exists) AND
          // have at least one stat entered — OR carry a discipline card, since a
          // carded player with no other stats still needs a row to persist it.
          const isInSelectedTeam = selectedPlayerIds.length === 0 || selectedPlayerIds.includes(playerId)
          return (
            isInSelectedTeam &&
            (
              parseInt(stats.tackles_made) > 0 ||
              parseInt(stats.tackles_missed) > 0 ||
              parseInt(stats.ball_handling_errors) > 0 ||
              parseInt(stats.ball_carries) > 0 ||
              parseInt(stats.tries_scored) > 0 ||
              parseInt(stats.minutes_played) > 0 ||
              stats.yellow_card || stats.red_card
            )
          )
        })
        .map(([playerId, stats]) => ({
          match_id: selectedMatchForStats,
          player_id: playerId,
          tackles_made: parseInt(stats.tackles_made) || 0,
          tackles_missed: parseInt(stats.tackles_missed) || 0,
          ball_handling_errors: parseInt(stats.ball_handling_errors) || 0,
          ball_carries: parseInt(stats.ball_carries) || 0,
          tries_scored: parseInt(stats.tries_scored) || 0,
          minutes_played: parseInt(stats.minutes_played) || 0,
          yellow_card: !!stats.yellow_card,
          red_card: !!stats.red_card,
        }))

      if (statsToInsert.length > 0) {
        // Delete existing stats for this match first
        await supabase
          .from('match_stats')
          .delete()
          .eq('match_id', selectedMatchForStats)

        let { error: statsError } = await supabase
          .from('match_stats')
          .insert(statsToInsert)

        // Graceful degrade: if migration 049 (card columns) hasn't run yet
        // on this database, re-insert without the card fields so the manager
        // can still record the numeric stats. We'll surface a note at the end.
        let cardColumnsMissing = false
        if (statsError && /yellow_card|red_card/i.test(statsError.message || '')) {
          cardColumnsMissing = true
          const stripped = statsToInsert.map(({ yellow_card, red_card, ...rest }: any) => rest)
          const retry = await supabase.from('match_stats').insert(stripped)
          statsError = retry.error
        }

        if (statsError) throw statsError

        // This match now has stats — drop it from the "needs stats" alert.
        setMatchesWithStats((prev) => new Set(prev).add(selectedMatchForStats))

        // Fire discipline notifications for every carded player. See
        // /api/match-stats/notify-cards for the exact recipient set (player +
        // admins + coaches + owner). Non-blocking: even if it fails, the
        // stats are already saved.
        const carded = statsToInsert.filter((s: any) => s.yellow_card || s.red_card)
        if (carded.length > 0 && !cardColumnsMissing) {
          try {
            await fetch('/api/match-stats/notify-cards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                matchId: selectedMatchForStats,
                cards: carded.map((s: any) => ({
                  player_id: s.player_id,
                  yellow_card: s.yellow_card,
                  red_card: s.red_card,
                })),
              }),
            })
          } catch (e) { console.warn('Card notifications failed:', e) }
        }

        if (cardColumnsMissing) {
          alert('Match stats saved. Note: red/yellow cards were not recorded — please run migration 049 in Supabase to enable the card feature.')
        }
      }

      alert('Match stats saved successfully!')
      setShowMatchForm(false)
      setMatchForm({
        match_date: '',
        opponent: '',
        tournament_type: 'friendly',
        venue: '',
        result: 'win',
        score_our_team: '0',
        score_opponent: '0',
        notes: '',
      })
      setPlayerStats({})
      setSelectedMatchForStats('')
      
      // Reload matches to refresh the list
      try {
        const { data: matchesData, error: reloadError } = await supabase
          .from('matches')
          .select('id, match_date, opponent, venue, tournament_type')
          .order('match_date', { ascending: false })
          .limit(100)

        if (reloadError) {
          console.error('Error reloading matches:', reloadError)
        } else if (matchesData) {
          setMatches(matchesData)
        }
      } catch (reloadErr) {
        console.error('Error reloading matches:', reloadErr)
      }
      
      // Reload matches
      try {
        const { data: matchesData, error: reloadError } = await supabase
          .from('matches')
          .select('id, match_date, opponent, venue, tournament_type')
          .order('match_date', { ascending: false })
          .limit(100)

        if (reloadError) {
          console.error('Error reloading matches:', reloadError)
        } else if (matchesData) {
          setMatches(matchesData)
          console.log('Reloaded matches after save:', matchesData.length)
        }
      } catch (reloadErr) {
        console.error('Error reloading matches:', reloadErr)
      }
      
      // Refresh statistics
      try {
        const statsResponse = await fetch('/api/admin/statistics')
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setMatchesCount(statsData.totalMatches || 0)
          setTrainingSessionsCount(statsData.totalTrainingSessions || 0)
        }
      } catch (refreshError) {
        console.error('Error refreshing statistics:', refreshError)
      }
    } catch (error: any) {
      console.error('Error saving match stats:', error)
      alert(`Error saving match stats: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // ── CSV match-stats import ─────────────────────────────────────────────
  const handleStatsCSVImport = async (file: File) => {
    setStatsImporting(true)
    setStatsImportProgress(0)
    setShowStatsPreview(false)
    setStatsImportRows([])
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    try {
      // Step 1 — read (CSV, TSV, or Excel)
      setStatsImportStep('Reading file…')
      setStatsImportProgress(10)
      const grid = await readTabularFile(file)
      await sleep(300)
      setStatsImportProgress(25)

      // Step 2 — parse
      setStatsImportStep('Parsing player stats…')
      await sleep(200)

      // Detect header
      const HEADER_WORDS = ['player', 'name', 'tackle', 'carries', 'tries', 'minutes']
      const firstLower = (grid[0]?.join(' ') ?? '').toLowerCase()
      const hasHeader = HEADER_WORDS.some(w => firstLower.includes(w))
      const dataRows = hasHeader ? grid.slice(1) : grid

      type RawRow = {
        name: string
        tackles_made: number; tackles_missed: number; ball_handling_errors: number
        ball_carries: number; tries_scored: number; minutes_played: number
      }
      const rawRows: RawRow[] = []
      for (const parts of dataRows) {
        if (!parts[0]) continue
        rawRows.push({
          name: parts[0],
          tackles_made:        parseInt(parts[1]) || 0,
          tackles_missed:      parseInt(parts[2]) || 0,
          ball_handling_errors: parseInt(parts[3]) || 0,
          ball_carries:        parseInt(parts[4]) || 0,
          tries_scored:        parseInt(parts[5]) || 0,
          minutes_played:      parseInt(parts[6]) || 0,
        })
      }
      setStatsImportProgress(50)
      await sleep(300)

      // Step 3 — match names to roster
      setStatsImportStep('Matching players to roster…')
      const matched = []
      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i]
        const nameLower = row.name.toLowerCase()

        let player = players.find(p => p.name.toLowerCase() === nameLower) ?? null
        let confidence: 'exact' | 'fuzzy' | 'none' = player ? 'exact' : 'none'

        if (!player) {
          const words = nameLower.split(/\s+/).filter(Boolean)
          player = players.find(p => {
            const pn = p.name.toLowerCase()
            return words.length > 0 && words.every(w => pn.includes(w))
          }) ?? null
          if (player) confidence = 'fuzzy'
        }

        matched.push({ ...row, matchedPlayer: player, confidence })
        setStatsImportProgress(50 + Math.round(((i + 1) / rawRows.length) * 35))
        await sleep(60)
      }
      setStatsImportProgress(90)
      await sleep(200)

      setStatsImportStep('Done — review below')
      setStatsImportProgress(100)
      await sleep(250)

      setStatsImportRows(matched)
      setShowStatsPreview(true)
    } catch (err: any) {
      console.error('Stats CSV parse error', err)
      alert(`Could not read file: ${err.message}`)
    } finally {
      setStatsImporting(false)
    }
  }

  const applyStatsCSVToGrid = () => {
    const updates: Record<string, PlayerStats> = {}
    for (const row of statsImportRows) {
      if (row.matchedPlayer) {
        updates[row.matchedPlayer.user_id] = {
          player_id: row.matchedPlayer.user_id,
          tackles_made: String(row.tackles_made),
          tackles_missed: String(row.tackles_missed),
          ball_handling_errors: String(row.ball_handling_errors),
          ball_carries: String(row.ball_carries),
          tries_scored: String(row.tries_scored),
          minutes_played: String(row.minutes_played),
          // CSV template doesn't carry cards — default to none. Manager can
          // still toggle them per player after import.
          yellow_card: false,
          red_card: false,
        }
      }
    }
    if (Object.keys(updates).length === 0) {
      alert('No matched players found. Check the CSV format and player names.')
      return
    }
    setPlayerStats(prev => ({ ...prev, ...updates }))
    // Close import UI
    setShowStatsImport(false)
    setStatsImportFile(null)
    setShowStatsPreview(false)
    setStatsImportRows([])
    setStatsImportProgress(0)
    setStatsImportStep('')
  }

  const resetStatsImport = () => {
    setShowStatsImport(false)
    setStatsImportFile(null)
    setShowStatsPreview(false)
    setStatsImportRows([])
    setStatsImportProgress(0)
    setStatsImportStep('')
    setStatsImporting(false)
  }
  // ─────────────────────────────────────────────────────────────────────────

  const updatePlayerStat = (playerId: string, field: keyof PlayerStats, value: string) => {
    setPlayerStats((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: value,
      },
    }))
  }

  // Toggle a discipline card. Yellow and red are treated as mutually exclusive
  // in the UI: turning one on turns the other off, and clicking the same one
  // again clears it (a second click = "no card").
  const togglePlayerCard = (playerId: string, kind: 'yellow' | 'red') => {
    setPlayerStats((prev) => {
      const current = prev[playerId] || {
        player_id: playerId,
        tackles_made: '0', tackles_missed: '0', ball_handling_errors: '0',
        ball_carries: '0', tries_scored: '0', minutes_played: '0',
        yellow_card: false, red_card: false,
      }
      const wasYellow = !!current.yellow_card
      const wasRed = !!current.red_card
      return {
        ...prev,
        [playerId]: {
          ...current,
          yellow_card: kind === 'yellow' ? !wasYellow : false,
          red_card:    kind === 'red'    ? !wasRed    : false,
        },
      }
    })
  }

  const loadTeamSelection = async (matchId: string) => {
    if (!matchId) return
    
    setLoadingTeamSelection(true)
    try {
      const response = await fetch(`/api/fixtures/team-selection?matchId=${matchId}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.selections && data.selections.length > 0) {
          // Player names are now included in the API response
          setTeamSelections(data.selections)
          console.log('Loaded team selections:', data.selections.length, 'players')
        } else {
          setTeamSelections([])
        }
        // Store match information including staff assignments
        if (data.match) {
          setMatchWithStaff(data.match)
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }))
        console.error('Error loading team selection:', errorData)
        setTeamSelections([])
        setMatchWithStaff(null)
      }
    } catch (error) {
      console.error('Error loading team selection:', error)
      setTeamSelections([])
      setMatchWithStaff(null)
    } finally {
      setLoadingTeamSelection(false)
    }
  }

  // Load team selection when match is selected for stats
  useEffect(() => {
    if (selectedMatchForStats) {
      loadTeamSelection(selectedMatchForStats)
    } else {
      setTeamSelections([])
    }
  }, [selectedMatchForStats])

  const handleCreateFixture = async () => {
    if (!fixtureForm.match_date || !fixtureForm.opponent) {
      alert('Please fill in match date and opponent')
      return
    }

    setCreatingFixture(true)
    try {
      // Use API route to create fixture (bypasses RLS)
      const response = await fetch('/api/fixtures/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          match_date: fixtureForm.match_date,
          opponent: fixtureForm.opponent,
          tournament_type: fixtureForm.tournament_type,
          venue: fixtureForm.venue || null,
          notes: fixtureForm.notes || null,
          physio_id: fixtureForm.physio_id || null,
          team_manager_id: fixtureForm.team_manager_id || null,
          coach_id: fixtureForm.coach_id || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create fixture')
      }

      alert('Fixture created successfully! The coach can now select the team for this fixture.')
      setShowCreateFixtureForm(false)
      setFixtureForm({
        match_date: '',
        opponent: '',
        tournament_type: 'friendly',
        venue: '',
        notes: '',
        physio_id: '',
        team_manager_id: '',
        coach_id: '',
      })
      
      // Reload matches
      const supabase = createClient()
      try {
        const { data: matchesData, error: reloadError } = await supabase
          .from('matches')
          .select('id, match_date, opponent, venue, tournament_type')
          .order('match_date', { ascending: false })
          .limit(100)

        if (reloadError) {
          console.error('Error reloading matches:', reloadError)
        } else if (matchesData) {
          setMatches(matchesData)
          console.log('Reloaded matches after creating fixture:', matchesData.length)
        }
      } catch (reloadErr) {
        console.error('Error reloading matches:', reloadErr)
      }

      // Refresh statistics
      try {
        const statsResponse = await fetch('/api/admin/statistics')
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setMatchesCount(statsData.totalMatches || 0)
        }
      } catch (refreshError) {
        console.error('Error refreshing statistics:', refreshError)
      }
    } catch (error: any) {
      console.error('Error creating fixture:', error)
      alert(`Error creating fixture: ${error.message}`)
    } finally {
      setCreatingFixture(false)
    }
  }

  if (loading) {
    return (
      <Layout pageTitle="Team Manager Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!user) return null

  // Next upcoming fixture, for the "Next fixture" card below.
  const today = new Date().toISOString().split('T')[0]
  const nextUpcomingMatch = matches
    .filter((m: any) => m.match_date >= today)
    .sort((a: any, b: any) => a.match_date.localeCompare(b.match_date))[0]

  // A match counts as "played but unrecorded" when its date has passed yet
  // no player-stat rows exist for it. These are the matches the manager needs
  // to be nudged about — nobody's captured the stats for them yet.
  const playedMatchesMissingStats = matches.filter(
    (m: any) => isActivityPast(m.match_date, null) && !matchesWithStats.has(m.id)
  )

  // Open the Enter Match Statistics modal pre-selected to a specific match.
  const openStatsForMatch = (match: any) => {
    setSelectedMatchForStats(match.id)
    setMatchForm({
      match_date: match.match_date,
      opponent: match.opponent,
      tournament_type: (match.tournament_type as any) || 'friendly',
      venue: match.venue || '',
      result: (match.result as any) || 'win',
      score_our_team: String(match.score_our_team ?? 0),
      score_opponent: String(match.score_opponent ?? 0),
      notes: match.notes || '',
    })
    setPlayerStats({})
    setShowMatchForm(true)
  }

  // ── Tournament progression helpers ──────────────────────────────────────
  const STAGE_LABEL: Record<string, string> = {
    group: 'Group', quarter: 'Quarter-final', semi: 'Semi-final', final: 'Final', placement: 'Placement',
  }

  // Given a tournament (with .games and .group_outcome), work out what the
  // manager needs to do next. Drives the tracker's prompts & buttons.
  const getProgress = (t: any) => {
    const games = [...(t.games || [])].sort((a, b) => (a.game_order || 0) - (b.game_order || 0))
    const group = games.filter((g) => g.stage === 'group')
    const knockout = games.filter((g) => g.stage !== 'group')
    const groupComplete = group.length >= 3 && group.every((g) => g.result)
    const wins = games.filter((g) => g.result === 'win').length
    const losses = games.filter((g) => g.result === 'loss').length
    const latest = knockout.length ? knockout[knockout.length - 1] : null

    let phase: 'group' | 'branch' | 'awaiting_result' | 'advance' | 'done' = 'group'
    let next: { stage: string; bracket: string | null; order: number } | null = null

    if (!groupComplete) {
      phase = 'group'
    } else if (!t.group_outcome) {
      phase = 'branch'
    } else if (!latest) {
      // group done + bracket chosen but no QF yet
      phase = 'advance'
      next = { stage: 'quarter', bracket: t.group_outcome, order: 4 }
    } else if (!latest.result) {
      phase = 'awaiting_result'
    } else if (latest.stage === 'final' || (latest.game_order || 0) >= 6) {
      phase = 'done'
    } else {
      phase = 'advance'
      const order = (latest.game_order || 3) + 1
      if (latest.stage === 'quarter') {
        next = latest.result === 'win'
          ? { stage: 'semi', bracket: t.group_outcome, order }
          : { stage: 'placement', bracket: 'placement', order }
      } else if (latest.stage === 'semi') {
        next = latest.result === 'win'
          ? { stage: 'final', bracket: t.group_outcome, order }
          : { stage: 'placement', bracket: 'placement', order }
      } else {
        next = { stage: 'placement', bracket: 'placement', order }
      }
    }
    return { games, group, knockout, groupComplete, wins, losses, latest, phase, next }
  }

  const patchTournament = async (id: string, patch: any) => {
    const res = await fetch(`/api/tournaments/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Update failed') }
  }

  const addTournamentGame = async (id: string, slot: { stage: string; bracket: string | null; order: number }, opponent?: string) => {
    const res = await fetch(`/api/tournaments/${id}/games`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: slot.stage, bracket: slot.bracket, day_number: 2, game_order: slot.order, opponent: opponent?.trim() || undefined }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Could not add game') }
  }

  const handleSetGroupOutcome = async (id: string, outcome: 'cup' | 'challenger') => {
    try {
      await patchTournament(id, { group_outcome: outcome, status: 'in_progress' })
      await addTournamentGame(id, { stage: 'quarter', bracket: outcome, order: 4 }, advanceOpponent)
      setAdvanceOpponent('')
      await loadTournaments()
    } catch (err: any) { alert(`Error: ${err.message}`) }
  }

  const handleAdvance = async (id: string, slot: { stage: string; bracket: string | null; order: number }) => {
    try {
      await addTournamentGame(id, slot, advanceOpponent)
      setAdvanceOpponent('')
      await loadTournaments()
    } catch (err: any) { alert(`Error: ${err.message}`) }
  }

  const handleCompleteTournament = async (id: string, placement: string) => {
    try {
      await patchTournament(id, { final_placement: placement, status: 'completed' })
      await loadTournaments()
    } catch (err: any) { alert(`Error: ${err.message}`) }
  }

  const handleDeleteTournament = async (id: string) => {
    if (!confirm('Delete this tournament and all its games/stats? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/tournaments/${id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Delete failed') }
      if (activeTournamentId === id) setActiveTournamentId(null)
      await loadTournaments()
    } catch (err: any) { alert(`Error: ${err.message}`) }
  }

  // Enter stats for a tournament game: hide the tracker, open the stats modal;
  // the effect below reopens the tracker once the stats modal closes.
  const openStatsForTournamentGame = (tournamentId: string, game: any) => {
    setReopenTrackerFor(tournamentId)
    setShowTournaments(false)
    openStatsForMatch(game)
  }

  const activeTournament = tournaments.find((t) => t.id === activeTournamentId) || null

  const gameResultBadge = (g: any) => {
    if (!g.result) return <span className="text-[11px] text-tm-text-3">Not recorded</span>
    const map: Record<string, string> = {
      win: 'bg-success/15 text-success', loss: 'bg-[#E05757]/15 text-[#E05757]', draw: 'bg-tm-surface-hover text-tm-text-2',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[g.result] || ''}`}>
        {g.result === 'win' ? 'Won' : g.result === 'loss' ? 'Lost' : 'Draw'} {g.score_our_team}–{g.score_opponent}
      </span>
    )
  }

  const renderGameCard = (t: any, g: any) => {
    const title = g.stage === 'group'
      ? `Group Game ${g.game_order}`
      : `${STAGE_LABEL[g.stage] || g.stage}${g.bracket && g.bracket !== 'placement' ? ` · ${g.bracket === 'cup' ? 'Cup' : 'Challenger'}` : ''}`
    return (
      <div key={g.id} className="flex items-center justify-between gap-2 rounded-lg bg-tm-surface border border-tm-border px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-tm-text-1 truncate">{title}</p>
          <p className="text-[11px] text-tm-text-3 truncate">
            {g.opponent && !g.opponent.startsWith('Group Game') && g.opponent !== 'TBD' ? `vs ${g.opponent}` : 'Opponent TBD'}
            {'  ·  '}{gameResultBadge(g)}
          </p>
        </div>
        <button
          onClick={() => openStatsForTournamentGame(t.id, g)}
          className="px-3 py-1.5 rounded-[6px] text-xs font-semibold inline-flex items-center gap-1.5 flex-shrink-0 bg-secondary text-tm-on-secondary hover:opacity-90 transition-all"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          {g.result ? 'Edit' : 'Record'}
        </button>
      </div>
    )
  }

  const renderTracker = (t: any) => {
    const p = getProgress(t)
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button onClick={() => setActiveTournamentId(null)} className="text-[12px] text-tm-text-3 hover:text-tm-text-1 mb-1 inline-flex items-center gap-1">
              ← All tournaments
            </button>
            <h3 className="text-lg font-bold text-tm-text-1 truncate">{t.name}</h3>
            <p className="text-[12px] text-tm-text-3">
              {t.venue ? `${t.venue} · ` : ''}
              {new Date(t.day1_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
              {t.day2_date ? ` – ${new Date(t.day2_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${t.status === 'completed' ? 'bg-success/15 text-success' : t.status === 'in_progress' ? 'bg-warning/15 text-warning' : 'bg-tm-surface-hover text-tm-text-3'}`}>
              {t.status === 'in_progress' ? 'In progress' : t.status === 'completed' ? 'Completed' : 'Upcoming'}
            </span>
            <span className="text-[11px] text-tm-text-3">Won {p.wins} · Lost {p.losses}</span>
          </div>
        </div>

        {t.final_placement && (
          <div className="rounded-lg bg-success/10 border border-success/30 px-3 py-2 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-success flex-shrink-0" />
            <span className="text-sm font-semibold text-tm-text-1">Final result: {t.final_placement}</span>
          </div>
        )}

        {/* Day 1 — Group stage */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-tm-text-3 mb-2">Day 1 · Group stage</p>
          <div className="space-y-2">
            {p.group.map((g) => renderGameCard(t, g))}
          </div>
        </div>

        {/* Branch prompt */}
        {p.phase === 'branch' && (
          <div className="rounded-lg bg-info/10 border border-info/30 p-3">
            <p className="text-sm font-semibold text-tm-text-1 mb-2">How did you finish the group?</p>
            <p className="text-[12px] text-tm-text-3 mb-3">This decides your Day 2 path and creates your Quarter-final.</p>
            <input
              type="text"
              value={advanceOpponent}
              onChange={(e) => setAdvanceOpponent(e.target.value)}
              placeholder="Quarter-final opponent (optional)"
              className="w-full tm-input rounded-lg px-3 py-2 text-sm mb-2"
            />
            <div className="flex gap-2">
              <button onClick={() => handleSetGroupOutcome(t.id, 'cup')} className="flex-1 px-3 py-2 bg-secondary text-tm-on-secondary rounded-[6px] text-sm font-semibold hover:opacity-90">
                Top 2 → Cup
              </button>
              <button onClick={() => handleSetGroupOutcome(t.id, 'challenger')} className="flex-1 px-3 py-2 bg-info text-white rounded-[6px] text-sm font-semibold hover:opacity-90">
                Below 2 → Challenger
              </button>
            </div>
          </div>
        )}

        {/* Day 2 — knockout / placement */}
        {p.knockout.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-tm-text-3 mb-2">
              Day 2 · {t.group_outcome === 'cup' ? 'Cup' : 'Challenger'} path
            </p>
            <div className="space-y-2">
              {p.knockout.map((g) => renderGameCard(t, g))}
            </div>
          </div>
        )}

        {/* Advance / next-game guidance */}
        {p.phase === 'awaiting_result' && (
          <div className="rounded-lg bg-warning/10 border border-warning/30 px-3 py-2.5">
            <p className="text-[12px] text-warning">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
              Record the result of your last game to unlock the next one.
            </p>
          </div>
        )}
        {p.phase === 'advance' && p.next && (
          <div className="rounded-lg bg-tm-surface-hover border border-tm-border p-3">
            <p className="text-sm font-medium text-tm-text-1 mb-2">
              Next up: <span className="font-semibold">{STAGE_LABEL[p.next.stage]}</span>
              {p.next.bracket && p.next.bracket !== 'placement' ? ` (${p.next.bracket === 'cup' ? 'Cup' : 'Challenger'})` : p.next.stage === 'placement' ? ' (placement playoff)' : ''}
            </p>
            <input
              type="text"
              value={advanceOpponent}
              onChange={(e) => setAdvanceOpponent(e.target.value)}
              placeholder="Opponent for this game (optional)"
              className="w-full tm-input rounded-lg px-3 py-2 text-sm mb-2"
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleAdvance(t.id, p.next!)} className="px-3 py-2 bg-secondary text-tm-on-secondary rounded-[6px] text-sm font-semibold hover:opacity-90 inline-flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add {STAGE_LABEL[p.next.stage]}
              </button>
              {p.next.stage !== 'placement' && (
                <button onClick={() => handleAdvance(t.id, { stage: 'placement', bracket: 'placement', order: p.next!.order })} className="px-3 py-2 bg-tm-surface text-tm-text-1 border border-tm-border rounded-[6px] text-sm font-semibold hover:bg-tm-surface-hover">
                  Add placement instead
                </button>
              )}
            </div>
          </div>
        )}

        {/* Completion */}
        {(p.phase === 'done' || p.knockout.length >= 3) && t.status !== 'completed' && (
          <div className="rounded-lg bg-info/10 border border-info/30 p-3">
            <p className="text-sm font-semibold text-tm-text-1 mb-2">Wrap up the tournament</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id={`placement-${t.id}`}
                type="text"
                placeholder="Final placement, e.g. Cup Winners, 5th"
                defaultValue={t.final_placement || ''}
                className="flex-1 tm-input rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={() => {
                  const el = document.getElementById(`placement-${t.id}`) as HTMLInputElement | null
                  handleCompleteTournament(t.id, el?.value?.trim() || 'Completed')
                }}
                className="px-4 py-2 bg-success text-white rounded-[6px] text-sm font-semibold hover:opacity-90 inline-flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" /> Mark completed
              </button>
            </div>
          </div>
        )}

        <button onClick={() => handleDeleteTournament(t.id)} className="text-[12px] text-[#E05757] hover:underline">
          Delete tournament
        </button>
      </div>
    )
  }

  const renderTournamentsModal = () => {
    if (!showTournaments) return null
    return (
      <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 backdrop-blur-sm">
        <div className="bg-tm-surface rounded-t-2xl sm:rounded-card shadow-large w-full sm:max-w-lg border border-tm-border max-h-[92vh] flex flex-col">
          <div className="p-5 border-b border-tm-border flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold text-tm-text-1 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-info" /> Sevens Tournaments
              </h2>
              <p className="text-xs text-tm-text-3 mt-0.5">Group stage → Cup/Challenger → knockouts</p>
            </div>
            <button onClick={() => { setShowTournaments(false); setActiveTournamentId(null) }} className="modal-close-btn">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto flex-1">
            {tournamentsUnavailable ? (
              <div className="text-center py-8">
                <AlertCircle className="w-10 h-10 text-warning mx-auto mb-3" />
                <p className="text-sm font-semibold text-tm-text-1 mb-1">Tournaments aren&apos;t enabled yet</p>
                <p className="text-xs text-tm-text-3">Ask your admin to run database migration 048 in Supabase, then reload.</p>
              </div>
            ) : activeTournament ? (
              renderTracker(activeTournament)
            ) : (
              <div className="space-y-3">
                {tournaments.length === 0 && (
                  <div className="text-center py-8">
                    <Trophy className="w-10 h-10 text-tm-text-3 mx-auto mb-3" />
                    <p className="text-sm text-tm-text-3 mb-1">No tournaments yet.</p>
                    <p className="text-xs text-tm-text-3">Create one from the <span className="font-semibold text-tm-text-2">Fixtures</span> page — hit <span className="font-semibold text-tm-text-2">Create Fixture</span> and choose <span className="font-semibold text-tm-text-2">Sevens</span>.</p>
                  </div>
                )}
                {tournaments.map((t) => {
                  const p = getProgress(t)
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTournamentId(t.id)}
                      className="w-full text-left rounded-lg bg-tm-surface-hover border border-tm-border px-3 py-3 hover:border-primary transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-tm-text-1 truncate">{t.name}</p>
                          <p className="text-[11px] text-tm-text-3">
                            {new Date(t.day1_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' · '}Won {p.wins} · Lost {p.losses}
                            {t.final_placement ? ` · ${t.final_placement}` : ''}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${t.status === 'completed' ? 'bg-success/15 text-success' : t.status === 'in_progress' ? 'bg-warning/15 text-warning' : 'bg-tm-surface text-tm-text-3 border border-tm-border'}`}>
                          {t.status === 'in_progress' ? 'In progress' : t.status === 'completed' ? 'Done' : 'Upcoming'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {!activeTournament && !tournamentsUnavailable && (
            <div className="p-5 border-t border-tm-border flex-shrink-0">
              <Link
                href="/fixtures"
                className="w-full px-4 py-2.5 bg-info text-white rounded-[6px] font-semibold text-sm hover:opacity-90 inline-flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> New tournament (Fixtures → Sevens)
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Layout pageTitle="Team Manager Dashboard">
      <div className="space-y-6">
        <BirthdayAlert />
        {/* Header */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[20px] font-medium text-tm-text-1">Team Manager Control Center</h1>
            <p className="mt-[2px] text-[13px] text-tm-text-3">Manage players, training attendance, and match statistics</p>
          </div>
          <RefreshButton onRefresh={loadData} size="sm" />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-5">
          <StatCard title="Total Players" value={players.length} icon={Users} iconColor="bg-primary" href="/players" />
          <StatCard title="Matches Attended" value={staffMatchesAttended} icon={CheckCircle} iconColor="bg-primary" href="/fixtures" />
        </div>

        {/* Alert: played matches with no stats recorded yet */}
        {playedMatchesMissingStats.length > 0 && (
          <div className="rounded-card border border-warning/40 bg-warning/10 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-warning/20 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-tm-text-1">
                  {playedMatchesMissingStats.length} played {playedMatchesMissingStats.length === 1 ? 'match has' : 'matches have'} no stats recorded
                </h3>
                <p className="text-xs text-tm-text-3 mt-0.5">
                  These fixtures have already been played but no match or player statistics were entered. Record them so player performance and reports stay accurate.
                </p>
                <div className="mt-3 space-y-2">
                  {playedMatchesMissingStats.slice(0, 5).map((m: any) => (
                    <div
                      key={m.id}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-tm-surface border border-tm-border px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-tm-text-1 truncate">vs {m.opponent}</p>
                        <p className="text-[11px] text-tm-text-3">
                          {new Date(m.match_date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          {m.tournament_type ? ` · ${String(m.tournament_type).replace('_', ' ')}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => openStatsForMatch(m)}
                        className="px-3 py-1.5 bg-warning text-white rounded-[6px] text-xs font-semibold hover:opacity-90 transition-all inline-flex items-center justify-center gap-1.5 flex-shrink-0"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Enter stats
                      </button>
                    </div>
                  ))}
                  {playedMatchesMissingStats.length > 5 && (
                    <p className="text-[11px] text-tm-text-3">
                      +{playedMatchesMissingStats.length - 5} more — use the Match Statistics card below to record them.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Match Stats Entry Form Modal */}
        {showMatchForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-tm-surface rounded-card shadow-large max-w-6xl w-full border border-tm-border my-8">
              <div className="p-6 border-b border-tm-border sticky top-0 bg-tm-surface z-10">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-tm-text-1">Enter Match Statistics</h2>
                  <button
                    onClick={() => {
                      setShowMatchForm(false)
                      setMatchForm({
                        match_date: '',
                        opponent: '',
                        tournament_type: 'friendly',
                        venue: '',
                        result: 'win',
                        score_our_team: '0',
                        score_opponent: '0',
                        notes: '',
                      })
                      setPlayerStats({})
                    }}
                    className="text-tm-text-3 hover:text-tm-text-1"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Show selected match info if a match is pre-selected */}
                {selectedMatchForStats && (
                  <div className="bg-success/10 rounded-lg p-4 border border-success/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-tm-text-1 mb-2">
                          Entering Stats for: vs {matchForm.opponent}
                        </h3>
                        <p className="text-sm text-tm-text-3">
                          {new Date(matchForm.match_date).toLocaleDateString()} • {matchForm.tournament_type.replace('_', ' ')}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedMatchForStats('')
                          setMatchForm({
                            match_date: '',
                            opponent: '',
                            tournament_type: 'friendly',
                            venue: '',
                            result: 'win',
                            score_our_team: '0',
                            score_opponent: '0',
                            notes: '',
                          })
                          setPlayerStats({})
                        }}
                        className="text-tm-text-3 hover:text-tm-text-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Match Selection - Only show if no match is pre-selected */}
                {!selectedMatchForStats && (
                  <div className="bg-tm-surface-hover rounded-lg p-4 border border-tm-border">
                    <h3 className="text-lg font-semibold text-tm-text-1 mb-4">Select Match for Stats</h3>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-tm-text-3 mb-2">
                        Select Existing Match
                      </label>
                      <select
                        value={selectedMatchForStats}
                        onChange={(e) => {
                          setSelectedMatchForStats(e.target.value)
                          if (e.target.value) {
                            // Load match details
                            const match = matches.find(m => m.id === e.target.value)
                            if (match) {
                              setMatchForm({
                                match_date: match.match_date,
                                opponent: match.opponent,
                                tournament_type: match.tournament_type as any,
                                venue: match.venue || '',
                                result: 'win',
                                score_our_team: '0',
                                score_opponent: '0',
                                notes: '',
                              })
                            }
                          }
                          setPlayerStats({})
                        }}
                        className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      >
                        <option value="">Select a match...</option>
                        {matches.map((match) => {
                          const played = isActivityPast(match.match_date, null)
                          const hasStats = matchesWithStats.has(match.id)
                          const flag = played && !hasStats ? '  ⚠ needs stats' : hasStats ? '  ✓ recorded' : ''
                          return (
                            <option key={match.id} value={match.id}>
                              {new Date(match.match_date).toLocaleDateString()} - vs {match.opponent} ({match.tournament_type}){flag}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                    <p className="text-sm text-primary">
                      <strong>Note:</strong> To create a new fixture or enter match stats, go to the Fixtures page.
                    </p>
                  </div>
                )}

                {/* Match Information */}
                <div className="bg-tm-surface-hover rounded-lg p-4 border border-tm-border">
                  <h3 className="text-lg font-semibold text-tm-text-1 mb-4">Match Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-tm-text-3 mb-2">
                        Match Date <span className="text-[#E05757]">*</span>
                      </label>
                      <input
                        type="date"
                        value={matchForm.match_date}
                        onChange={(e) => setMatchForm({ ...matchForm, match_date: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-tm-text-3 mb-2">
                        Opponent <span className="text-[#E05757]">*</span>
                      </label>
                      <input
                        type="text"
                        value={matchForm.opponent}
                        onChange={(e) => setMatchForm({ ...matchForm, opponent: e.target.value })}
                        placeholder="e.g., Heathens RFC"
                        className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-tm-text-3 mb-2">
                        Tournament Type
                      </label>
                      <select
                        value={matchForm.tournament_type}
                        onChange={(e) => setMatchForm({ ...matchForm, tournament_type: e.target.value as any })}
                        className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      >
                        <option value="friendly">Friendly</option>
                        <option value="league">League</option>
                        <option value="uganda_cup">Uganda Cup</option>
                        <option value="sevens">Sevens</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-tm-text-3 mb-2">Venue</label>
                      <input
                        type="text"
                        value={matchForm.venue}
                        onChange={(e) => setMatchForm({ ...matchForm, venue: e.target.value })}
                        placeholder="e.g., Kyadondo Rugby Club"
                        className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-tm-text-3 mb-2">Result</label>
                      <select
                        value={matchForm.result}
                        onChange={(e) => setMatchForm({ ...matchForm, result: e.target.value as any })}
                        className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      >
                        <option value="win">Win</option>
                        <option value="loss">Loss</option>
                        <option value="draw">Draw</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-tm-text-3 mb-2">Our Score</label>
                        <input
                          type="number"
                          value={matchForm.score_our_team}
                          onChange={(e) => setMatchForm({ ...matchForm, score_our_team: e.target.value })}
                          min="0"
                          className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-tm-text-3 mb-2">Opponent Score</label>
                        <input
                          type="number"
                          value={matchForm.score_opponent}
                          onChange={(e) => setMatchForm({ ...matchForm, score_opponent: e.target.value })}
                          min="0"
                          className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-tm-text-3 mb-2">Notes</label>
                      <textarea
                        value={matchForm.notes}
                        onChange={(e) => setMatchForm({ ...matchForm, notes: e.target.value })}
                        rows={3}
                        placeholder="Additional match notes..."
                        className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Player Statistics */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="text-lg font-semibold text-tm-text-1">
                      Player Statistics {selectedMatchForStats && teamSelections.length > 0 && '(Only players in selected team can have stats)'}
                    </h3>
                    <button
                      onClick={() => setShowStatsImport(true)}
                      className="px-3 py-1.5 bg-info text-white rounded-[6px] text-xs font-semibold hover:opacity-90 transition-all inline-flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Import CSV / Excel
                    </button>
                  </div>
                  {selectedMatchForStats && teamSelections.length > 0 && (
                    <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                      <p className="text-sm text-warning">
                        <strong>Note:</strong> Match stats can only be entered for players who are in the selected team for this fixture.
                        Make sure the team has been selected in the Fixtures page first.
                      </p>
                    </div>
                  )}
                  {selectedMatchForStats && teamSelections.length === 0 && (
                    <div className="mb-4 p-3 bg-info/10 border border-info/30 rounded-lg">
                      <p className="text-sm text-info">
                        <strong>No squad was selected for this fixture.</strong> You can enter stats for any player below, or import them from a CSV/Excel file.
                      </p>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px]">
                      <thead className="bg-tm-surface-hover">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-bold text-tm-text-1 sticky left-0 bg-tm-surface-hover z-10">
                            Player
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-tm-text-1">Tackles Made</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-tm-text-1">Tackles Missed</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-tm-text-1">Ball Handling Errors</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-tm-text-1">Ball Carries</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-tm-text-1">Tries Scored</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-tm-text-1">Minutes Played</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-tm-text-1">Card</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-tm-border">
                        {players.map((player, index) => {
                          const stats = playerStats[player.user_id] || {
                            player_id: player.user_id,
                            tackles_made: '0',
                            tackles_missed: '0',
                            ball_handling_errors: '0',
                            ball_carries: '0',
                            tries_scored: '0',
                            minutes_played: '0',
                            yellow_card: false,
                            red_card: false,
                          }
                          // Check if player is in selected team (if match is selected).
                          // IMPORTANT: if a match was played but no squad was ever
                          // selected for it (teamSelections empty), we must NOT
                          // disable everyone — otherwise the manager can't enter
                          // stats at all for those exact "played but unrecorded"
                          // games. In that case allow every player, which also
                          // matches the save logic (it accepts all players when no
                          // team selection exists).
                          const noSquadSelected = teamSelections.length === 0
                          const isInSelectedTeam = !selectedMatchForStats || noSquadSelected
                            ? true
                            : teamSelections.some((s: any) => s.player_id === player.user_id)
                          
                          return (
                            <tr 
                              key={player.user_id} 
                              className={`${index % 2 === 0 ? 'bg-tm-surface' : 'bg-tm-surface-hover'} ${!isInSelectedTeam && selectedMatchForStats ? 'opacity-50' : ''}`}
                            >
                              <td className="px-4 py-3 text-sm font-medium text-tm-text-1 sticky left-0 bg-inherit z-10 border-r border-tm-border">
                                {player.name}
                                {!isInSelectedTeam && selectedMatchForStats && (
                                  <span className="ml-2 text-xs text-tm-text-3">(Not in selected team)</span>
                                )}
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={stats.tackles_made}
                                  onChange={(e) => updatePlayerStat(player.user_id, 'tackles_made', e.target.value)}
                                  disabled={!isInSelectedTeam && !!selectedMatchForStats}
                                  className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm disabled:bg-tm-surface-hover disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={stats.tackles_missed}
                                  onChange={(e) => updatePlayerStat(player.user_id, 'tackles_missed', e.target.value)}
                                  disabled={!isInSelectedTeam && !!selectedMatchForStats}
                                  className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm disabled:bg-tm-surface-hover disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={stats.ball_handling_errors}
                                  onChange={(e) => updatePlayerStat(player.user_id, 'ball_handling_errors', e.target.value)}
                                  disabled={!isInSelectedTeam && !!selectedMatchForStats}
                                  className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm disabled:bg-tm-surface-hover disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={stats.ball_carries}
                                  onChange={(e) => updatePlayerStat(player.user_id, 'ball_carries', e.target.value)}
                                  disabled={!isInSelectedTeam && !!selectedMatchForStats}
                                  className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm disabled:bg-tm-surface-hover disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={stats.tries_scored}
                                  onChange={(e) => updatePlayerStat(player.user_id, 'tries_scored', e.target.value)}
                                  disabled={!isInSelectedTeam && !!selectedMatchForStats}
                                  className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm disabled:bg-tm-surface-hover disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="80"
                                  value={stats.minutes_played}
                                  onChange={(e) => updatePlayerStat(player.user_id, 'minutes_played', e.target.value)}
                                  disabled={!isInSelectedTeam && !!selectedMatchForStats}
                                  className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm disabled:bg-tm-surface-hover disabled:cursor-not-allowed"
                                />
                              </td>
                              {/* Card entry — Y (yellow) / R (red). Mutually
                                  exclusive, click again to clear. Saving a
                                  card also alerts the player and staff. */}
                              <td className="px-2 py-2">
                                <div className="flex justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => togglePlayerCard(player.user_id, 'yellow')}
                                    disabled={!isInSelectedTeam && !!selectedMatchForStats}
                                    aria-label="Toggle yellow card"
                                    title="Yellow card"
                                    className={`h-7 w-6 rounded border text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                      stats.yellow_card
                                        ? 'border-yellow-500 bg-yellow-400 text-black shadow-inner'
                                        : 'border-tm-border bg-tm-surface text-tm-text-3 hover:bg-yellow-400/20'
                                    }`}
                                  >Y</button>
                                  <button
                                    type="button"
                                    onClick={() => togglePlayerCard(player.user_id, 'red')}
                                    disabled={!isInSelectedTeam && !!selectedMatchForStats}
                                    aria-label="Toggle red card"
                                    title="Red card"
                                    className={`h-7 w-6 rounded border text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                      stats.red_card
                                        ? 'border-red-600 bg-red-600 text-white shadow-inner'
                                        : 'border-tm-border bg-tm-surface text-tm-text-3 hover:bg-red-500/20'
                                    }`}
                                  >R</button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-tm-border">
                  <button
                    onClick={handleSaveMatch}
                    disabled={saving}
                    className="flex-1 px-6 py-3 bg-tm-secondary text-tm-on-secondary rounded-[6px] hover:opacity-90 transition-all duration-300 font-semibold shadow-soft hover:shadow-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                  >
                    <Save className="w-5 h-5 mr-2" />
                    {saving ? 'Saving...' : 'Save Match Stats'}
                  </button>
                  <button
                    onClick={() => {
                      setShowMatchForm(false)
                      setMatchForm({
                        match_date: '',
                        opponent: '',
                        tournament_type: 'friendly',
                        venue: '',
                        result: 'win',
                        score_our_team: '0',
                        score_opponent: '0',
                        notes: '',
                      })
                      setPlayerStats({})
                      setSelectedMatchForStats('')
                    }}
                    disabled={saving}
                    className="px-6 py-3 bg-tm-surface-hover text-tm-text-1 rounded-[6px] hover:bg-tm-surface-hover transition-all duration-300 font-semibold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CSV stats import modal ── */}
        {showStatsImport && (
          <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 z-[60] backdrop-blur-sm">
            <div className="bg-tm-surface rounded-t-2xl sm:rounded-card shadow-large w-full sm:max-w-lg border border-tm-border max-h-[92vh] flex flex-col">

              {/* Header */}
              <div className="p-5 border-b border-tm-border flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-tm-text-1">Import Player Stats</h2>
                  <p className="text-xs text-tm-text-3 mt-0.5">Upload a CSV or Excel file to auto-fill the stats grid</p>
                </div>
                <button onClick={resetStatsImport} disabled={statsImporting} className="modal-close-btn">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1">

                {/* Phase 1 — file picker */}
                {!statsImporting && !showStatsPreview && (
                  <>
                    <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-tm-border rounded-xl p-8 cursor-pointer hover:border-primary hover:bg-tm-surface-hover transition-all">
                      <Upload className="w-8 h-8 text-tm-text-3" />
                      <span className="text-sm font-medium text-tm-text-2">
                        {statsImportFile ? statsImportFile.name : 'Tap to choose a CSV or Excel file'}
                      </span>
                      {statsImportFile && (
                        <span className="text-xs text-tm-text-3">{(statsImportFile.size / 1024).toFixed(1)} KB</span>
                      )}
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        className="sr-only"
                        onChange={(e) => setStatsImportFile(e.target.files?.[0] || null)}
                      />
                    </label>

                    <div className="bg-tm-surface-hover rounded-lg p-3 border border-tm-border">
                      <p className="text-xs font-semibold text-info mb-1.5 uppercase tracking-wide">
                        CSV / Excel format
                      </p>
                      <p className="text-[11px] text-tm-text-3 leading-relaxed font-mono">
                        player, tackles_made, tackles_missed,<br />
                        &nbsp;&nbsp;ball_errors, carries, tries, minutes<br />
                        Patrick Allan, 8, 2, 1, 5, 1, 60<br />
                        John Smith, 5, 3, 0, 3, 0, 40
                      </p>
                      <p className="text-[10px] text-tm-text-3 mt-2">
                        Header row optional. Columns after player name are numeric stats in the order shown.
                      </p>
                    </div>
                  </>
                )}

                {/* Phase 2 — animated progress */}
                {statsImporting && (
                  <div className="py-6 space-y-6">
                    <div className="flex justify-center">
                      <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-tm-border" />
                        <div className="absolute inset-0 rounded-full border-4 border-secondary border-t-transparent animate-spin" style={{ animationDuration: '0.9s' }} />
                        <BarChart3 className="absolute inset-0 m-auto w-6 h-6 text-secondary" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-tm-text-1">{statsImportStep}</p>
                      <p className="text-xs text-tm-text-3 mt-1">Please wait…</p>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-tm-text-3 mb-1.5">
                        <span>Progress</span>
                        <span>{statsImportProgress}%</span>
                      </div>
                      <div className="h-2.5 bg-tm-surface-hover rounded-full overflow-hidden">
                        <div className="h-full bg-secondary rounded-full transition-all duration-300 ease-out" style={{ width: `${statsImportProgress}%` }} />
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] text-tm-text-3 px-1">
                      {['Reading', 'Parsing', 'Matching', 'Complete'].map((s, i) => {
                        const threshold = [10, 50, 85, 100][i]
                        const done = statsImportProgress >= threshold
                        return (
                          <span key={s} className={`flex flex-col items-center gap-1 transition-colors ${done ? 'text-secondary font-semibold' : ''}`}>
                            <span className={`w-3 h-3 rounded-full border-2 transition-all ${done ? 'bg-secondary border-secondary' : 'border-tm-border'}`} />
                            {s}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Phase 3 — preview */}
                {showStatsPreview && !statsImporting && (
                  <div className="space-y-4">
                    {/* Summary chips */}
                    <div className="flex flex-wrap gap-2">
                      {(['exact', 'fuzzy', 'none'] as const).map(c => {
                        const count = statsImportRows.filter(r => r.confidence === c).length
                        if (!count) return null
                        const cfg = { exact: { label: 'Matched', cls: 'bg-success/15 text-success border-success/30' }, fuzzy: { label: 'Fuzzy', cls: 'bg-warning/15 text-warning border-warning/30' }, none: { label: 'Not found', cls: 'bg-[#E05757]/15 text-[#E05757] border-[#E05757]/30' } }[c]
                        return (
                          <span key={c} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>{count} {cfg.label}</span>
                        )
                      })}
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-tm-surface-hover text-tm-text-3 border-tm-border">{statsImportRows.length} rows</span>
                    </div>

                    {/* Player rows with stats */}
                    <div className="rounded-xl border border-tm-border overflow-hidden">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-tm-text-3 bg-tm-surface-hover px-3 py-2 border-b border-tm-border grid grid-cols-[1fr_auto] gap-2">
                        <span>Player</span>
                        <span>Stats summary</span>
                      </div>
                      <div className="divide-y divide-tm-border max-h-64 overflow-y-auto">
                        {statsImportRows.map((row, i) => (
                          <div key={i} className="px-3 py-2.5 hover:bg-tm-surface-hover">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  {row.confidence === 'exact' && <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />}
                                  {row.confidence === 'fuzzy' && <AlertCircle className="w-3.5 h-3.5 text-warning flex-shrink-0" />}
                                  {row.confidence === 'none'  && <X className="w-3.5 h-3.5 text-[#E05757] flex-shrink-0" />}
                                  <span className="text-sm font-medium text-tm-text-1 truncate">{row.name}</span>
                                </div>
                                {row.matchedPlayer && row.matchedPlayer.name.toLowerCase() !== row.name.toLowerCase() && (
                                  <p className="text-[10px] text-tm-text-3 ml-5 truncate">&rarr; {row.matchedPlayer.name}</p>
                                )}
                              </div>
                              <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                {[
                                  { v: row.tackles_made, l: 'TM', c: 'text-success' },
                                  { v: row.tackles_missed, l: 'Tmiss', c: 'text-[#E05757]' },
                                  { v: row.ball_handling_errors, l: 'Err', c: 'text-warning' },
                                  { v: row.ball_carries, l: 'Car', c: 'text-info' },
                                  { v: row.tries_scored, l: 'Try', c: 'text-secondary' },
                                  { v: row.minutes_played, l: 'Min', c: 'text-tm-text-2' },
                                ].map(({ v, l, c }) => (
                                  <span key={l} className="text-[10px] font-mono">
                                    <span className={`font-semibold ${c}`}>{v}</span>
                                    <span className="text-tm-text-3 ml-0.5">{l}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {statsImportRows.some(r => r.confidence === 'none') && (
                      <p className="text-xs text-tm-text-3 bg-tm-surface-hover rounded-lg px-3 py-2 border border-tm-border">
                        <AlertCircle className="w-3.5 h-3.5 inline mr-1 text-warning" />
                        Unmatched players will be skipped. Check spelling or add them to the roster.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-tm-border flex-shrink-0">
                {!statsImporting && !showStatsPreview && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => statsImportFile && handleStatsCSVImport(statsImportFile)}
                      disabled={!statsImportFile}
                      className="flex-1 px-4 py-2.5 bg-secondary text-tm-on-secondary rounded-[6px] font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Import
                    </button>
                    <button onClick={resetStatsImport} className="px-4 py-2.5 bg-tm-surface-hover text-tm-text-1 rounded-[6px] font-semibold text-sm border border-tm-border">
                      Cancel
                    </button>
                  </div>
                )}
                {showStatsPreview && !statsImporting && (
                  <div className="flex gap-3">
                    <button
                      onClick={applyStatsCSVToGrid}
                      disabled={statsImportRows.filter(r => r.matchedPlayer).length === 0}
                      className="flex-1 px-4 py-2.5 bg-success text-white rounded-[6px] font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                    >
                      <UserCheck className="w-4 h-4" />
                      Fill {statsImportRows.filter(r => r.matchedPlayer).length} players
                    </button>
                    <button onClick={resetStatsImport} className="px-4 py-2.5 bg-tm-surface-hover text-tm-text-1 rounded-[6px] font-semibold text-sm border border-tm-border">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Fixture Modal */}
        {showCreateFixtureForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-tm-surface rounded-card shadow-large max-w-2xl w-full border border-tm-border">
              <div className="p-6 border-b border-tm-border">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-tm-text-1">Create New Fixture</h2>
                  <button
                    onClick={() => {
                      setShowCreateFixtureForm(false)
                      setFixtureForm({
                        match_date: '',
                        opponent: '',
                        tournament_type: 'friendly',
                        venue: '',
                        notes: '',
                        physio_id: '',
                        team_manager_id: '',
                        coach_id: '',
                      })
                    }}
                    className="text-tm-text-3 hover:text-tm-text-1"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-tm-surface-hover rounded-lg p-4 border border-tm-border mb-4">
                  <p className="text-sm text-primary">
                    <strong>Note:</strong> After creating a fixture, the coach will be able to select the team for this match on the Fixtures page.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">
                    Match Date <span className="text-[#E05757]">*</span>
                  </label>
                  <input
                    type="date"
                    value={fixtureForm.match_date}
                    onChange={(e) => setFixtureForm({ ...fixtureForm, match_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">
                    Opponent <span className="text-[#E05757]">*</span>
                  </label>
                  <input
                    type="text"
                    value={fixtureForm.opponent}
                    onChange={(e) => setFixtureForm({ ...fixtureForm, opponent: e.target.value })}
                    placeholder="e.g., Heathens RFC"
                    className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">
                    Tournament Type
                  </label>
                  <select
                    value={fixtureForm.tournament_type}
                    onChange={(e) => setFixtureForm({ ...fixtureForm, tournament_type: e.target.value as any })}
                    className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="friendly">Friendly</option>
                    <option value="league">League</option>
                    <option value="uganda_cup">Uganda Cup</option>
                    <option value="sevens">Sevens</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Venue</label>
                  <input
                    type="text"
                    value={fixtureForm.venue}
                    onChange={(e) => setFixtureForm({ ...fixtureForm, venue: e.target.value })}
                    placeholder="e.g., Kyadondo Rugby Club"
                    className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Notes</label>
                  <textarea
                    value={fixtureForm.notes}
                    onChange={(e) => setFixtureForm({ ...fixtureForm, notes: e.target.value })}
                    rows={3}
                    placeholder="Additional fixture notes..."
                    className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>

                <div className="border-t border-tm-border pt-4 mt-4">
                  <h3 className="text-lg font-semibold text-tm-text-1 mb-4">Assign Staff for Game Day</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-tm-text-3 mb-2">
                        Physiotherapist
                      </label>
                      <select
                        value={fixtureForm.physio_id}
                        onChange={(e) => setFixtureForm({ ...fixtureForm, physio_id: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      >
                        <option value="">Select physio...</option>
                        {availablePhysios.map((physio) => (
                          <option key={physio.user_id} value={physio.user_id}>
                            {physio.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-tm-text-3 mb-2">
                        Team Manager
                      </label>
                      <select
                        value={fixtureForm.team_manager_id}
                        onChange={(e) => setFixtureForm({ ...fixtureForm, team_manager_id: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      >
                        <option value="">Select team manager...</option>
                        {availableTeamManagers.map((tm) => (
                          <option key={tm.user_id} value={tm.user_id}>
                            {tm.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-tm-text-3 mb-2">
                        Coach
                      </label>
                      <select
                        value={fixtureForm.coach_id}
                        onChange={(e) => setFixtureForm({ ...fixtureForm, coach_id: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      >
                        <option value="">Select coach...</option>
                        {availableCoaches.map((coach) => (
                          <option key={coach.user_id} value={coach.user_id}>
                            {coach.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-tm-border">
                  <button
                    onClick={handleCreateFixture}
                    disabled={creatingFixture}
                    className="flex-1 px-6 py-3 bg-tm-secondary text-tm-on-secondary rounded-[6px] hover:opacity-90 transition-all duration-300 font-semibold shadow-soft hover:shadow-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                  >
                    <Save className="w-5 h-5 mr-2" />
                    {creatingFixture ? 'Creating...' : 'Create Fixture'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateFixtureForm(false)
                      setFixtureForm({
                        match_date: '',
                        opponent: '',
                        tournament_type: 'friendly',
                        venue: '',
                        notes: '',
                        physio_id: '',
                        team_manager_id: '',
                        coach_id: '',
                      })
                    }}
                    disabled={creatingFixture}
                    className="px-6 py-3 bg-tm-surface-hover text-tm-text-1 rounded-[6px] hover:bg-tm-surface-hover transition-all duration-300 font-semibold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Next fixture — same card the club owner and coach see. "View squad"
            sends the team manager to /fixtures, where the selected squad is
            now viewed (moved off this dashboard). "Match day" opens the same
            Match Day Details popup the club owner sees. */}
        {nextUpcomingMatch && (
          <FixtureCard
            label={`Next fixture · ${nextUpcomingMatch.tournament_type?.replace('_', ' ') || 'Match'}`}
            homeTeam={clubName || 'Team Master'}
            awayTeam={nextUpcomingMatch.opponent}
            date={formatDateSafe(nextUpcomingMatch.match_date)}
            time={formatTimeSafe(nextUpcomingMatch.match_date)}
            venue={nextUpcomingMatch.venue || 'TBD'}
            slogan={clubSlogan}
            clubBadgeUrl={clubBadge}
            onViewSquad={() => router.push('/fixtures')}
            onMatchDay={() => setShowMatchDayModal(true)}
          />
        )}

        {showMatchDayModal && (
          <MatchDayModal
            match={nextUpcomingMatch || null}
            onClose={() => setShowMatchDayModal(false)}
            manageHref="/fixtures"
            clubBadgeUrl={clubBadge}
            homeTeamName={clubName}
          />
        )}

        {/* Recent Gym Schedules */}
        {recentGymSchedules.length > 0 && (
          <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft">
            <div className="p-6 border-b border-tm-border">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-tm-text-1 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-secondary" />
                  Recent Gym Schedules
                </h3>
                <a
                  href="/training"
                  className="text-secondary hover:underline text-sm font-medium"
                >
                  View All →
                </a>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {recentGymSchedules.map((schedule: any) => (
                  <div key={schedule.id} className="border border-tm-border rounded-lg p-4 hover:bg-tm-surface-hover/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-tm-text-1">
                            {schedule.description}
                          </h4>
                          <span className="px-2 py-1 bg-[#E05757]/10 text-[#E05757] rounded text-xs font-medium">
                            Gym Session
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-tm-text-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(schedule.schedule_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            {schedule.schedule_time && <span>at {schedule.schedule_time}</span>}
                          </div>
                          {schedule.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              <span>{schedule.location}</span>
                            </div>
                          )}
                          {schedule.coach?.name && (
                            <div className="flex items-center gap-2">
                              <span>Created by {schedule.coach.name}</span>
                            </div>
                          )}
                          {schedule.exercises && (
                            <div className="mt-2 pt-2 border-t border-tm-border">
                              <p className="text-xs font-semibold text-tm-text-3 mb-1">Exercises:</p>
                              <p className="text-sm text-tm-text-1 whitespace-pre-line">{schedule.exercises}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions — each tile now actually goes somewhere */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/players" className="block bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft hover-lift cursor-pointer">
            <div className="flex items-center space-x-4">
              <div className="bg-primary w-12 h-12 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-tm-on-secondary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-tm-text-1">Manage Players</h3>
                <p className="text-sm text-tm-text-3">View and edit player information</p>
              </div>
            </div>
          </Link>
          <Link href="/training" className="block bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft hover-lift cursor-pointer">
            <div className="flex items-center space-x-4">
              <div className="bg-success w-12 h-12 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-tm-text-1">Training Attendance</h3>
                <p className="text-sm text-tm-text-3">Record and track training sessions</p>
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setShowMatchForm(true)}
            className="text-left w-full bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft hover-lift cursor-pointer"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-warning w-12 h-12 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-tm-text-1">Match Statistics</h3>
                <p className="text-sm text-tm-text-3">Log match performance data</p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setShowTournaments(true)}
            className="text-left w-full bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft hover-lift cursor-pointer"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-info w-12 h-12 rounded-xl flex items-center justify-center relative">
                <Trophy className="w-6 h-6 text-white" />
                {tournaments.some((t) => t.status !== 'completed') && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-warning text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {tournaments.filter((t) => t.status !== 'completed').length}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-tm-text-1">Sevens Tournaments</h3>
                <p className="text-sm text-tm-text-3">Track group + knockout games</p>
              </div>
            </div>
          </button>
        </div>

        {renderTournamentsModal()}
      </div>
    </Layout>
  )
}
