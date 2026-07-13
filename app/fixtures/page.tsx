'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { Users, Check, X, Save, Calendar, MapPin, Trophy, Plus, Eye, Trash2 } from 'lucide-react'
import RefreshButton from '@/components/RefreshButton'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db-helpers'
import { isActivityPast } from '@/lib/utils'
import TeamPitchView from '@/components/TeamPitchView'

// Rugby position metadata used to group the squad roster by playing position.
// Forwards (1-8) are listed before backs (9-15); legacy values are included so
// older player rows still group correctly.
const POSITION_META: Record<string, { label: string; num: string; category: 'forwards' | 'backs' }> = {
  loosehead_prop:    { label: 'Loosehead Prop',    num: '1',   category: 'forwards' },
  prop:              { label: 'Prop',              num: '1',   category: 'forwards' },
  hooker:            { label: 'Hooker',            num: '2',   category: 'forwards' },
  tighthead_prop:    { label: 'Tighthead Prop',    num: '3',   category: 'forwards' },
  lock:              { label: 'Lock',              num: '4/5', category: 'forwards' },
  blindside_flanker: { label: 'Blindside Flanker', num: '6',   category: 'forwards' },
  openside_flanker:  { label: 'Openside Flanker',  num: '7',   category: 'forwards' },
  flanker:           { label: 'Flanker',           num: '6/7', category: 'forwards' },
  '8th_man':         { label: 'Number Eight',      num: '8',   category: 'forwards' },
  scrum_half:        { label: 'Scrum Half',        num: '9',   category: 'backs'    },
  fly_half:          { label: 'Fly Half',          num: '10',  category: 'backs'    },
  left_wing:         { label: 'Left Wing',         num: '11',  category: 'backs'    },
  winger:            { label: 'Winger',            num: '11/14', category: 'backs'  },
  inside_center:     { label: 'Inside Center',     num: '12',  category: 'backs'    },
  outside_center:    { label: 'Outside Center',    num: '13',  category: 'backs'    },
  right_wing:        { label: 'Right Wing',        num: '14',  category: 'backs'    },
  full_back:         { label: 'Full-Back',         num: '15',  category: 'backs'    },
}

// Canonical display order (forwards 1-8, then backs 9-15).
const POSITION_ORDER = [
  'loosehead_prop', 'prop', 'hooker', 'tighthead_prop', 'lock',
  'blindside_flanker', 'openside_flanker', 'flanker', '8th_man',
  'scrum_half', 'fly_half', 'left_wing', 'winger',
  'inside_center', 'outside_center', 'right_wing', 'full_back',
]

interface Player {
  user_id: string
  name: string
  email: string
  status: string
  profile_picture_url?: string | null
  players: {
    position: string
    category: string
    jersey_number?: number
  }
}

interface Match {
  id: string
  match_date: string
  opponent: string
  venue?: string
  tournament_type: string
  status?: string
  squad_size?: number | null
}

// A fixture's "squad format" controls how the coach's selection roster and the
// saved-team pitch view behave. 'sevens' = 12-player squad, 7 on the field
// (World Rugby Sevens); 'fifteens' = standard 23-player matchday squad, 15 on
// the field. tournament_type === 'sevens' always forces sevens; otherwise a
// custom tournament with a small specified squad_size (<=12) is also treated
// as sevens, since that's the only sensible way to field a squad that size.
type SquadFormat = 'sevens' | 'fifteens'
const getSquadFormat = (match?: { tournament_type?: string; squad_size?: number | null } | null): SquadFormat => {
  if (!match) return 'fifteens'
  if (match.tournament_type === 'sevens') return 'sevens'
  if (match.squad_size != null && match.squad_size <= 12) return 'sevens'
  return 'fifteens'
}
const getMaxSquadSize = (match?: { tournament_type?: string; squad_size?: number | null } | null): number => {
  if (match?.squad_size != null) return match.squad_size
  return getSquadFormat(match) === 'sevens' ? 12 : 23
}
const getMaxStarting = (format: SquadFormat) => (format === 'sevens' ? 7 : 15)

interface TeamSelection {
  player_id: string
  position?: string
  jersey_number?: number
  is_starting: boolean
  is_substitute: boolean
  is_captain?: boolean
  is_assistant_captain?: boolean
  notes?: string
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
}

export default function FixturesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState<Match[]>([])
  const [selectedMatchId, setSelectedMatchId] = useState<string>('')
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([])
  const [teamSelections, setTeamSelections] = useState<Map<string, TeamSelection>>(new Map())
  const [saving, setSaving] = useState(false)
  const [existingSelection, setExistingSelection] = useState<any[]>([])
  
  // For data_admin: Create Fixture and Enter Match Stats
  const [showCreateFixtureForm, setShowCreateFixtureForm] = useState(false)
  const [showMatchForm, setShowMatchForm] = useState(false)
  const [fixtureForm, setFixtureForm] = useState({
    match_date: '',
    opponent: '',
    // 'other' is a UI-only sentinel; the actual saved tournament_type comes
    // from custom_tournament_type when 'other' is selected.
    tournament_type: 'friendly' as 'uganda_cup' | 'league' | 'sevens' | 'friendly' | 'other',
    custom_tournament_type: '',
    squad_size: '23',
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
  const [deletingFixtureId, setDeletingFixtureId] = useState<string | null>(null)
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
  const [savingMatchStats, setSavingMatchStats] = useState(false)
  const [selectedMatchForStats, setSelectedMatchForStats] = useState<string>('')
  const [players, setPlayers] = useState<any[]>([])
  const [injuredPlayerIds, setInjuredPlayerIds] = useState<string[]>([])
  // Per-player selection stats (attendance %, caps) keyed by user_id. Empty until
  // a club has generated training/match data — the card shows "no data yet" then.
  const [selectionStats, setSelectionStats] = useState<Record<string, { attendanceRate: number | null; sessions: number; present: number; caps: number }>>({})
  // Past fixtures that have a saved squad, so the coach can copy one as a starting point.
  const [previousSquads, setPreviousSquads] = useState<{ match_id: string; match_date: string; opponent: string; playerCount: number }[]>([])
  const [applyingSquad, setApplyingSquad] = useState(false)
  // After a squad is saved the roster collapses into a saved-team view; the coach
  // can then view it, edit it, or delete it and start over.
  const [editingRoster, setEditingRoster] = useState(true)
  const [showSavedTeam, setShowSavedTeam] = useState(false)
  const [deletingSquad, setDeletingSquad] = useState(false)
  // Tracks the match whose collapsed/expanded view mode has been initialised, so
  // background reloads don't reset the coach's Edit/View choice.
  const viewModeMatch = useRef<string | null>(null)
  // Club slogan — shown on the "Team selection saved" header to hype the squad.
  const [clubSlogan, setClubSlogan] = useState<string | null>(null)
  const [teamSelectionsForStats, setTeamSelectionsForStats] = useState<any[]>([])
  const [matchStaff, setMatchStaff] = useState<{
    coach: { id: string; name: string } | null
    physio: { id: string; name: string } | null
    team_manager: { id: string; name: string } | null
  }>({
    coach: null,
    physio: null,
    team_manager: null,
  })
  const [staffAttendance, setStaffAttendance] = useState<Record<string, boolean>>({})
  // For admin match summaries
  const [matchSummaries, setMatchSummaries] = useState<Array<{
    matchId: string
    matchDate: string
    opponent: string
    venue?: string
    tournamentType: string
    result?: string
    scoreOurTeam?: number
    scoreOpponent?: number
    playersWithStats: number
    totalTries: number
    totalTackles: number
    isUpcoming: boolean
  }>>([])
  const [loadingSummaries, setLoadingSummaries] = useState(true)
  const [showTeamViewModal, setShowTeamViewModal] = useState(false)
  const [viewingTeamForMatch, setViewingTeamForMatch] = useState<string>('')
  const [viewedTeamSelection, setViewedTeamSelection] = useState<any[]>([])
  const [loadingTeamView, setLoadingTeamView] = useState(false)

  const loadData = useCallback(async () => {
      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        
        if (!authUser) {
          router.push('/login')
          return
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (!profile || (profile.role !== 'coach' && profile.role !== 'admin' && profile.role !== 'data_admin')) {
          router.push('/dashboard')
          return
        }

        setUser(profile)

        // Load matches - different logic for admin vs data_admin/coach
        let matchesData: Match[] = []
        if (profile.role === 'admin') {
          // For admin: Only show played matches with stats OR upcoming fixtures with team selections
          const today = new Date().toISOString().split('T')[0]
          
          try {
            // Get all matches first. squad_size is a newer column (migration 042);
            // fall back to selecting without it if that migration hasn't run yet,
            // so this page keeps working either way.
            let allMatches: any[] | null
            let matchesError: any
            ;({ data: allMatches, error: matchesError } = await supabase
              .from('matches')
              .select('id, match_date, opponent, venue, tournament_type, status, squad_size')
              .order('match_date', { ascending: false }))
            if (matchesError?.message?.includes('squad_size')) {
              const retry = await supabase
                .from('matches')
                .select('id, match_date, opponent, venue, tournament_type, status')
                .order('match_date', { ascending: false })
              allMatches = retry.data
              matchesError = retry.error
            }

            if (matchesError) {
              console.error('Error loading matches:', matchesError)
              matchesData = []
            } else if (allMatches && allMatches.length > 0) {
              // Get match IDs that have stats (played matches with stats)
              const { data: matchesWithStats } = await supabase
                .from('match_stats')
                .select('match_id')
              
              const matchIdsWithStats = new Set(matchesWithStats?.map((s: any) => s.match_id) || [])
              
              // Get match IDs that have team selections (upcoming fixtures with selections)
              const { data: teamSelections } = await supabase
                .from('fixture_team_selections')
                .select('match_id')
              
              const matchIdsWithSelections = new Set(teamSelections?.map((s: any) => s.match_id) || [])
              
              // Filter matches:
              // 1. Played matches (match_date < today) that have stats
              // 2. Upcoming matches (match_date >= today) that have team selections
              matchesData = allMatches
                .filter((m: any) => {
                  const isPlayed = m.match_date < today
                  const isUpcoming = m.match_date >= today
                  
                  if (isPlayed) {
                    // Only include if it has stats
                    return matchIdsWithStats.has(m.id)
                  } else if (isUpcoming) {
                    // Only include if it has team selections
                    return matchIdsWithSelections.has(m.id)
                  }
                  return false
                })
                .map((m: any) => ({
                  id: m.id,
                  match_date: m.match_date,
                  opponent: m.opponent,
                  venue: m.venue || undefined,
                  tournament_type: m.tournament_type,
                  squad_size: m.squad_size,
                  status: m.status,
                }))
              
              console.log(`Loaded ${matchesData.length} matches for admin (played with stats or upcoming with selections)`)
            }
          } catch (error) {
            console.error('Error loading admin matches:', error)
            matchesData = []
          }
        } else if (profile.role === 'data_admin' || profile.role === 'coach') {
          // For data_admin and coach: load all matches so they can see newly created fixtures
          // Use API route with all=true parameter to get all matches (bypasses RLS)
          try {
            const matchesResponse = await fetch('/api/fixtures?all=true', { cache: 'no-store' })
            if (matchesResponse.ok) {
              const matchesApiData = await matchesResponse.json()
              if (matchesApiData.fixtures && Array.isArray(matchesApiData.fixtures)) {
                matchesData = matchesApiData.fixtures.map((m: any) => ({
                  id: m.id,
                  match_date: m.match_date,
                  opponent: m.opponent,
                  venue: m.venue || undefined,
                  tournament_type: m.tournament_type,
                  squad_size: m.squad_size,
                  status: m.status,
                }))
                console.log('Loaded matches from API:', matchesData.length)
              }
            } else {
              const errorData = await matchesResponse.json().catch(() => ({ error: matchesResponse.statusText }))
              console.error('Error loading matches from API:', errorData)
            }
          } catch (apiError) {
            console.error('Error loading matches from API:', apiError)
          }
          
          // Fallback to direct query if API fails
          if (matchesData.length === 0) {
            try {
              let allMatches: any[] | null
              let matchesError: any
              ;({ data: allMatches, error: matchesError } = await supabase
                .from('matches')
                .select('id, match_date, opponent, venue, tournament_type, status, squad_size')
                .order('match_date', { ascending: true }))
              if (matchesError?.message?.includes('squad_size')) {
                const retry = await supabase
                  .from('matches')
                  .select('id, match_date, opponent, venue, tournament_type, status')
                  .order('match_date', { ascending: true })
                allMatches = retry.data
                matchesError = retry.error
              }

              if (matchesError) {
                console.error('Error loading matches:', matchesError)
                matchesData = []
              } else {
                matchesData = (allMatches || []).map((m: any) => ({
                  id: m.id,
                  match_date: m.match_date,
                  opponent: m.opponent,
                  venue: m.venue || undefined,
                  tournament_type: m.tournament_type,
                  squad_size: m.squad_size,
                  status: m.status,
                }))
                console.log('Loaded matches from direct query:', matchesData.length)
              }
            } catch (directError) {
              console.error('Error in direct matches query:', directError)
              matchesData = []
            }
          }
        } else {
          matchesData = await db.getUpcomingMatches()
        }

        setMatches(matchesData)

        // Only load players for coach/admin (data_admin doesn't select teams)
        if (profile.role !== 'data_admin') {
          // Use API route to fetch players (bypasses RLS)
          try {
            const playersResponse = await fetch('/api/admin/players', { cache: 'no-store' })
            if (playersResponse.ok) {
              const playersApiData = await playersResponse.json()
              if (playersApiData.players && Array.isArray(playersApiData.players)) {
                // Transform players data to match Player interface
                const transformedPlayers = playersApiData.players
                  .filter((p: any) => p.status === 'active') // Filter active players
                  .map((p: any) => ({
                    user_id: p.user_id,
                    name: p.name,
                    email: p.email || '',
                    status: p.status || 'active',
                    profile_picture_url: p.profile_picture_url || null,
                    players: {
                      position: p.position || '',
                      category: p.category || '',
                      jersey_number: p.jersey_number || undefined,
                    },
                  }))
                setAvailablePlayers(transformedPlayers as Player[])
                console.log('Loaded players from API:', transformedPlayers.length)
              }
            } else {
              console.error('Error loading players from API:', playersResponse.status)
              // Fallback to direct query
              try {
                const playersData = await db.getAvailablePlayers()
                const transformedPlayers = (playersData || []).map((p: any) => ({
                  user_id: p.user_id,
                  name: p.name,
                  email: p.email,
                  status: p.status,
                  players: Array.isArray(p.players) ? p.players[0] : p.players,
                }))
                setAvailablePlayers(transformedPlayers as Player[])
              } catch (fallbackError) {
                console.error('Error in fallback players query:', fallbackError)
                setAvailablePlayers([])
              }
            }
          } catch (apiError) {
            console.error('Error loading players from API:', apiError)
            // Fallback to direct query
            try {
              const playersData = await db.getAvailablePlayers()
              const transformedPlayers = (playersData || []).map((p: any) => ({
                user_id: p.user_id,
                name: p.name,
                email: p.email,
                status: p.status,
                players: Array.isArray(p.players) ? p.players[0] : p.players,
              }))
              setAvailablePlayers(transformedPlayers as Player[])
            } catch (fallbackError) {
              console.error('Error in fallback players query:', fallbackError)
              setAvailablePlayers([])
            }
          }
        }

        if (matchesData.length > 0) {
          if (profile.role === 'coach') {
            const nextUpcoming = matchesData.find((match) => !isActivityPast(match.match_date, null) && match.status !== 'played')
            setSelectedMatchId(nextUpcoming?.id || '')
          } else {
            setSelectedMatchId(matchesData[0].id)
          }
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
  }, [router])
  
  useEffect(() => {
    loadData()
  }, [loadData])

  // Load per-player selection stats (attendance %, caps) once. Fails soft:
  // on any error the map stays empty and cards show "no data yet".
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/players/selection-stats', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data?.stats) setSelectionStats(data.stats)
      } catch {
        /* keep empty stats */
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Load the list of previous squads so the coach can copy one.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/fixtures/previous-squads', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data?.squads)) setPreviousSquads(data.squads)
      } catch {
        /* keep empty */
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Load the club's slogan for the "Team selection saved" header. Isolated so
  // a failure here never blocks anything else on the page.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        let { data, error } = await supabase
          .from('club_settings')
          .select('club_slogan')
          .order('updated_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        // club_slogan is a newer column (migration 043) — fall back quietly
        // if it hasn't been applied yet.
        if (error?.message?.includes('club_slogan')) {
          if (!cancelled) setClubSlogan(null)
          return
        }
        if (!cancelled) setClubSlogan(data?.club_slogan || null)
      } catch {
        if (!cancelled) setClubSlogan(null)
      }
    })()
    return () => { cancelled = true }
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

  const handleViewTeam = async (matchId: string) => {
    setViewingTeamForMatch(matchId)
    setLoadingTeamView(true)
    try {
      const response = await fetch(`/api/fixtures/team-selection?matchId=${matchId}`, { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setViewedTeamSelection(data.selections || [])
        setShowTeamViewModal(true)
      } else {
        alert('Failed to load team selection')
      }
    } catch (error) {
      console.error('Error loading team selection:', error)
      alert('Error loading team selection')
    } finally {
      setLoadingTeamView(false)
    }
  }

  useEffect(() => {
    if (!selectedMatchId) return
    const matchId = selectedMatchId

    const apply = (selections: any[]) => {
      setExistingSelection(selections)
      const map = new Map<string, TeamSelection>()
      selections.forEach((sel: any) => {
        map.set(sel.player_id, {
          player_id: sel.player_id,
          position: sel.position,
          jersey_number: sel.jersey_number,
          is_starting: sel.is_starting,
          is_substitute: sel.is_substitute,
          is_captain: sel.is_captain || false,
          is_assistant_captain: sel.is_assistant_captain || false,
          notes: sel.notes,
        })
      })
      setTeamSelections(map)
      // Initialise the view mode once per match, so background reloads don't
      // fight the coach's Edit/View choice: a saved squad opens collapsed, an
      // empty one opens the roster to build from.
      if (viewModeMatch.current !== matchId) {
        viewModeMatch.current = matchId
        setEditingRoster(map.size === 0)
        setShowSavedTeam(false)
      }
    }

    const loadExistingSelection = async () => {
      try {
        const response = await fetch(`/api/fixtures/team-selection?matchId=${matchId}`, { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          apply(data.selections || [])
        } else {
          apply(await db.getFixtureTeamSelection(matchId))
        }
      } catch (error) {
        console.error('Error loading existing selection:', error)
        try {
          apply(await db.getFixtureTeamSelection(matchId))
        } catch (fallbackError) {
          console.error('Error in fallback team selection query:', fallbackError)
        }
      }
    }

    loadExistingSelection()
  }, [selectedMatchId])

  // Copy a previous fixture's squad into the current (unsaved) selection so the
  // coach can start from it and tweak. Players no longer available are skipped.
  const applyPreviousSquad = async (sourceMatchId: string) => {
    if (!sourceMatchId) return
    if (teamSelections.size > 0 && !confirm('Replace your current selection with this previous squad? You can still make changes before saving.')) {
      return
    }
    setApplyingSquad(true)
    try {
      const res = await fetch(`/api/fixtures/team-selection?matchId=${sourceMatchId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load previous squad')
      const data = await res.json()
      const selections = data.selections || []
      const availableIds = new Set(availablePlayers.map((p) => p.user_id))
      const map = new Map<string, TeamSelection>()
      let skipped = 0
      selections.forEach((sel: any) => {
        if (!availableIds.has(sel.player_id)) { skipped += 1; return }
        map.set(sel.player_id, {
          player_id: sel.player_id,
          position: sel.position,
          jersey_number: sel.jersey_number,
          is_starting: sel.is_starting,
          is_substitute: sel.is_substitute,
          is_captain: sel.is_captain || false,
          is_assistant_captain: sel.is_assistant_captain || false,
          notes: sel.notes,
        })
      })
      setTeamSelections(map)
      setEditingRoster(true)
      setShowSavedTeam(false)
      const src = previousSquads.find((s) => s.match_id === sourceMatchId)
      alert(
        `Loaded ${map.size} player${map.size === 1 ? '' : 's'} from ${src ? 'vs ' + src.opponent : 'previous squad'}` +
        (skipped ? ` (${skipped} no longer available and were skipped)` : '') +
        `. Adjust as needed, then Save.`
      )
    } catch (e: any) {
      alert(e.message || 'Could not load previous squad')
    } finally {
      setApplyingSquad(false)
    }
  }

  // Delete the whole saved squad for the current match and reopen an empty roster.
  const handleDeleteSquad = async () => {
    if (!selectedMatchId) return
    if (!confirm('Delete the entire selected squad for this fixture and start over? This cannot be undone.')) {
      return
    }
    setDeletingSquad(true)
    try {
      const res = await fetch(`/api/fixtures/team-selection?matchId=${selectedMatchId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete squad')
      }
      setTeamSelections(new Map())
      setExistingSelection([])
      setShowSavedTeam(false)
      setEditingRoster(true)
    } catch (e: any) {
      alert(e.message || 'Could not delete the squad')
    } finally {
      setDeletingSquad(false)
    }
  }

  const togglePlayerSelection = (playerId: string, player: Player) => {
    const newSelections = new Map(teamSelections)

    if (newSelections.has(playerId)) {
      newSelections.delete(playerId)
    } else {
      // Enforce the fixture's squad cap (e.g. 12 for Sevens, or a custom
      // tournament's specified size) before adding a new player.
      const match = matches.find((m) => m.id === selectedMatchId)
      const cap = getMaxSquadSize(match)
      if (newSelections.size >= cap) {
        alert(`This fixture's squad is capped at ${cap} players. Remove someone first, or edit the fixture's squad size.`)
        return
      }
      const format = getSquadFormat(match)
      const currentStarting = Array.from(newSelections.values()).filter((s) => s.is_starting && !s.is_substitute).length
      const startingCap = getMaxStarting(format)
      // New picks default to "starting" unless that's already full, in which
      // case default to the bench so the coach isn't blocked mid-selection.
      const startAsStarting = currentStarting < startingCap
      newSelections.set(playerId, {
        player_id: playerId,
        position: player.players.position,
        jersey_number: player.players.jersey_number,
        is_starting: startAsStarting,
        is_substitute: !startAsStarting,
        is_captain: false,
        is_assistant_captain: false,
      })
    }

    setTeamSelections(newSelections)
  }

  const updatePlayerSelection = (playerId: string, updates: Partial<TeamSelection>) => {
    const newSelections = new Map(teamSelections)
    const existing = newSelections.get(playerId)

    if (existing) {
      // If this update moves the player into the starting lineup, enforce the
      // fixture's on-field cap (7 for Sevens, 15 for standard 15s).
      if (updates.is_starting && !updates.is_substitute) {
        const match = matches.find((m) => m.id === selectedMatchId)
        const startingCap = getMaxStarting(getSquadFormat(match))
        const currentStarting = Array.from(newSelections.values())
          .filter((s) => s.is_starting && !s.is_substitute && s.player_id !== playerId).length
        if (currentStarting >= startingCap) {
          alert(`Only ${startingCap} players can start for this fixture. Move someone to the bench first.`)
          return
        }
      }
      newSelections.set(playerId, { ...existing, ...updates })
      setTeamSelections(newSelections)
    }
  }

  const handleSave = async () => {
    if (!selectedMatchId) {
      alert('Please select a match first')
      return
    }

    if (teamSelections.size === 0) {
      alert('Please select at least one player')
      return
    }

    setSaving(true)

    try {
      const selectionsArray = Array.from(teamSelections.values())
      console.log('Saving team selection:', {
        matchId: selectedMatchId,
        selectionsCount: selectionsArray.length,
        selections: selectionsArray
      })
      
      const response = await fetch('/api/fixtures/team-selection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId: selectedMatchId,
          selections: selectionsArray,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }))
        console.error('Error saving team selection:', errorData)
        throw new Error(errorData.error || `Failed to save team selection: ${response.status}`)
      }

      const result = await response.json()
      console.log('Team selection saved successfully:', result)
      
      alert('Team selection saved successfully!')
      // Collapse the roster into the saved-team view, with the team shown.
      setEditingRoster(false)
      setShowSavedTeam(true)
      // Reload existing selection using API route
      try {
        const response = await fetch(`/api/fixtures/team-selection?matchId=${selectedMatchId}`, { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          const selections = data.selections || []
          setExistingSelection(selections)
          
          // Populate teamSelections map
          const selectionsMap = new Map<string, TeamSelection>()
          selections.forEach((sel: any) => {
            selectionsMap.set(sel.player_id, {
              player_id: sel.player_id,
              position: sel.position,
              jersey_number: sel.jersey_number,
              is_starting: sel.is_starting,
              is_substitute: sel.is_substitute,
              is_captain: sel.is_captain || false,
              is_assistant_captain: sel.is_assistant_captain || false,
              notes: sel.notes,
            })
          })
          setTeamSelections(selectionsMap)
        } else {
          // Fallback to direct query
          const selections = await db.getFixtureTeamSelection(selectedMatchId)
          setExistingSelection(selections)
        }
      } catch (reloadError) {
        console.error('Error reloading team selection:', reloadError)
        // Fallback to direct query
        try {
          const selections = await db.getFixtureTeamSelection(selectedMatchId)
          setExistingSelection(selections)
        } catch (fallbackError) {
          console.error('Error in fallback reload:', fallbackError)
        }
      }
    } catch (error: any) {
      console.error('Error saving team selection:', error)
      const errorMessage = error?.message || 'Unknown error occurred'
      alert(`Error saving team selection: ${errorMessage}. Please check the console for details.`)
    } finally {
      setSaving(false)
    }
  }

  // Handlers for data_admin
  const handleCreateFixture = async () => {
    if (!fixtureForm.match_date || !fixtureForm.opponent) {
      alert('Please fill in match date and opponent')
      return
    }
    if (fixtureForm.tournament_type === 'other' && !fixtureForm.custom_tournament_type.trim()) {
      alert('Please enter the tournament name')
      return
    }
    const squadSizeNum = fixtureForm.squad_size ? parseInt(fixtureForm.squad_size, 10) : null
    if (squadSizeNum != null && (Number.isNaN(squadSizeNum) || squadSizeNum < 1)) {
      alert('Squad size must be a positive number')
      return
    }

    setCreatingFixture(true)
    try {
      const finalTournamentType =
        fixtureForm.tournament_type === 'other'
          ? fixtureForm.custom_tournament_type.trim()
          : fixtureForm.tournament_type

      const response = await fetch('/api/fixtures/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          match_date: fixtureForm.match_date,
          opponent: fixtureForm.opponent,
          tournament_type: finalTournamentType,
          squad_size: squadSizeNum,
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
        custom_tournament_type: '',
        squad_size: '23',
        venue: '',
        notes: '',
        physio_id: '',
        team_manager_id: '',
        coach_id: '',
      })
      
      // Reload matches
      const supabase = createClient()
      let matchesData: any[] | null
      let reloadError: any
      ;({ data: matchesData, error: reloadError } = await supabase
        .from('matches')
        .select('id, match_date, opponent, venue, tournament_type, squad_size')
        .order('match_date', { ascending: false })
        .limit(100))
      if (reloadError?.message?.includes('squad_size')) {
        const retry = await supabase
          .from('matches')
          .select('id, match_date, opponent, venue, tournament_type')
          .order('match_date', { ascending: false })
          .limit(100)
        matchesData = retry.data
        reloadError = retry.error
      }

      if (!reloadError && matchesData) {
        setMatches(matchesData)
      }
    } catch (error: any) {
      console.error('Error creating fixture:', error)
      alert(`Error creating fixture: ${error.message}`)
    } finally {
      setCreatingFixture(false)
    }
  }

  const handleDeleteFixture = async (matchId: string) => {
    if (!confirm('Delete this fixture? This will remove team selections, match stats, and staff attendance for this match.')) {
      return
    }

    setDeletingFixtureId(matchId)
    try {
      const response = await fetch(`/api/fixtures/${matchId}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete fixture')
      }

      setMatches((prev) => prev.filter((m) => m.id !== matchId))
      if (selectedMatchForStats === matchId) {
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
        setMatchStaff({ coach: null, physio: null, team_manager: null })
        setStaffAttendance({})
      }
    } catch (error: any) {
      console.error('Error deleting fixture:', error)
      alert(`Error deleting fixture: ${error.message}`)
    } finally {
      setDeletingFixtureId(null)
    }
  }

  const isWithinStatsWindow = (matchDate: string) => {
    if (!matchDate) return false
    const start = new Date(`${matchDate}T00:00:00`)
    const end = new Date(start)
    end.setDate(end.getDate() + 2)
    const now = new Date()
    return now >= start && now <= end
  }

  const handleSaveMatchStats = async () => {
    if (!selectedMatchForStats) {
      alert('Please select a match first')
      return
    }

    if (user?.role !== 'data_admin') {
      alert('Only the team manager can enter match stats.')
      return
    }

    if (!matchForm.match_date || !matchForm.opponent) {
      alert('Please fill in match date and opponent')
      return
    }

    // Allow stats entry only on game day and up to 2 days after
    if (!isWithinStatsWindow(matchForm.match_date)) {
      const matchStart = new Date(`${matchForm.match_date}T00:00:00`)
      const windowEnd = new Date(matchStart)
      windowEnd.setDate(windowEnd.getDate() + 2)
      const now = new Date()
      if (now < matchStart) {
        alert('Match stats can only be entered on or after game day.')
      } else {
        alert('Match stats entry is closed 2 days after game day.')
      }
      return
    }

    setSavingMatchStats(true)
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

      // Save staff attendance for this match
      const assignedStaff = [matchStaff.coach, matchStaff.physio, matchStaff.team_manager].filter(Boolean) as Array<{
        id: string
        name: string
      }>
      if (assignedStaff.length > 0) {
        const attendanceRecords = assignedStaff.map((staff) => ({
          match_id: selectedMatchForStats,
          staff_id: staff.id,
          attendance_status: staffAttendance[staff.id] === false ? 'A' : 'P',
          recorded_by: authUser.id,
        }))

        const { error: attendanceError } = await supabase
          .from('match_staff_attendance')
          .upsert(attendanceRecords, { onConflict: 'match_id,staff_id' })

        if (attendanceError) throw attendanceError
      }

      // Get selected team for this match (if exists)
      const { data: teamSelectionData } = await supabase
        .from('fixture_team_selections')
        .select('player_id')
        .eq('match_id', selectedMatchForStats)

      const selectedPlayerIds = teamSelectionData?.map((s: any) => s.player_id) || []

      // Create match stats only for selected players (if team is selected)
      const statsToInsert = Object.entries(playerStats)
        .filter(([playerId, stats]) => {
          const isInSelectedTeam = selectedPlayerIds.length === 0 || selectedPlayerIds.includes(playerId)
          return (
            isInSelectedTeam &&
            (
              parseInt(stats.tackles_made) > 0 ||
              parseInt(stats.tackles_missed) > 0 ||
              parseInt(stats.ball_handling_errors) > 0 ||
              parseInt(stats.ball_carries) > 0 ||
              parseInt(stats.tries_scored) > 0 ||
              parseInt(stats.minutes_played) > 0
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
        }))

      if (statsToInsert.length > 0) {
        // Delete existing stats for this match first
        await supabase
          .from('match_stats')
          .delete()
          .eq('match_id', selectedMatchForStats)

        const { error: statsError } = await supabase
          .from('match_stats')
          .insert(statsToInsert)

        if (statsError) throw statsError
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
      setMatchStaff({ coach: null, physio: null, team_manager: null })
      setStaffAttendance({})
      
      // Reload matches
      let matchesData: any[] | null
      let reloadError: any
      ;({ data: matchesData, error: reloadError } = await supabase
        .from('matches')
        .select('id, match_date, opponent, venue, tournament_type, squad_size')
        .order('match_date', { ascending: false })
        .limit(100))
      if (reloadError?.message?.includes('squad_size')) {
        const retry = await supabase
          .from('matches')
          .select('id, match_date, opponent, venue, tournament_type')
          .order('match_date', { ascending: false })
          .limit(100)
        matchesData = retry.data
        reloadError = retry.error
      }

      if (!reloadError && matchesData) {
        setMatches(matchesData)
      }
    } catch (error: any) {
      console.error('Error saving match stats:', error)
      alert(`Error saving match stats: ${error.message}`)
    } finally {
      setSavingMatchStats(false)
    }
  }

  const updatePlayerStat = (playerId: string, field: keyof PlayerStats, value: string) => {
    setPlayerStats((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: value,
      },
    }))
  }

  // Load players and team selection when match is selected for stats
  useEffect(() => {
    const loadDataForMatchStats = async () => {
      if (!showMatchForm) return
      const supabase = createClient()

      let activeInjuredIds: string[] = []
      try {
        const injuriesResponse = await fetch('/api/admin/injuries', { cache: 'no-store' })
        if (injuriesResponse.ok) {
          const injuriesData = await injuriesResponse.json()
          activeInjuredIds = (injuriesData.injuries || [])
            .map((injury: any) => injury.player_id)
            .filter(Boolean)
          setInjuredPlayerIds(activeInjuredIds)
        } else {
          setInjuredPlayerIds([])
        }
      } catch (error) {
        console.error('Error loading injuries:', error)
        setInjuredPlayerIds([])
      }

      // Load players using API route to bypass RLS
      try {
        const response = await fetch('/api/admin/players')
        if (response.ok) {
          const data = await response.json()
          if (data.players && data.players.length > 0) {
            // Transform to match the expected format
            const nextPlayers = data.players
              .map((p: any) => ({
                user_id: p.user_id,
                name: p.name,
              }))
              .filter((p: any) => !activeInjuredIds.includes(p.user_id))
            setPlayers(nextPlayers)
            console.log('Loaded players for match stats:', data.players.length)
          } else {
            setPlayers([])
          }
        } else {
          console.error('Error loading players from API:', response.statusText)
          // Fallback to direct query
          const { data: playersData, error: playersError } = await supabase
            .from('user_profiles')
            .select('user_id, name')
            .eq('role', 'player')
            .eq('status', 'active')

          if (!playersError && playersData) {
            const filteredPlayers = playersData.filter((p: any) => !activeInjuredIds.includes(p.user_id))
            setPlayers(filteredPlayers)
          }
        }
      } catch (error) {
        console.error('Error loading players:', error)
        // Fallback to direct query
        try {
          const { data: playersData, error: playersError } = await supabase
            .from('user_profiles')
            .select('user_id, name')
            .eq('role', 'player')
            .eq('status', 'active')

          if (!playersError && playersData) {
            const filteredPlayers = playersData.filter((p: any) => !activeInjuredIds.includes(p.user_id))
            setPlayers(filteredPlayers)
          }
        } catch (fallbackError) {
          console.error('Error in fallback player query:', fallbackError)
        }
      }

      // Load team selection only if a match is selected
      if (selectedMatchForStats) {
        try {
          const response = await fetch(`/api/fixtures/team-selection?matchId=${selectedMatchForStats}`)
          if (response.ok) {
            const data = await response.json()
            if (data.selections && data.selections.length > 0) {
              setTeamSelectionsForStats(data.selections)
              console.log('Loaded team selections:', data.selections.length)
            } else {
              setTeamSelectionsForStats([])
            }

            const matchDetails = data.match
            const nextMatchStaff = {
              coach: matchDetails?.coach_id
                ? { id: matchDetails.coach_id, name: matchDetails.coach?.name || 'Coach' }
                : null,
              physio: matchDetails?.physio_id
                ? { id: matchDetails.physio_id, name: matchDetails.physio?.name || 'Physio' }
                : null,
              team_manager: matchDetails?.team_manager_id
                ? { id: matchDetails.team_manager_id, name: matchDetails.team_manager?.name || 'Team Manager' }
                : null,
            }
            setMatchStaff(nextMatchStaff)

            const { data: staffAttendanceRows } = await supabase
              .from('match_staff_attendance')
              .select('staff_id, attendance_status')
              .eq('match_id', selectedMatchForStats)

            const attendanceMap: Record<string, boolean> = {}
            staffAttendanceRows?.forEach((row: any) => {
              attendanceMap[row.staff_id] = row.attendance_status === 'P'
            })

            ;[nextMatchStaff.coach, nextMatchStaff.physio, nextMatchStaff.team_manager].forEach((staff) => {
              if (staff && attendanceMap[staff.id] === undefined) {
                attendanceMap[staff.id] = true
              }
            })

            setStaffAttendance(attendanceMap)
          }
        } catch (error) {
          console.error('Error loading team selection:', error)
          setTeamSelectionsForStats([])
          setMatchStaff({ coach: null, physio: null, team_manager: null })
          setStaffAttendance({})
        }
      } else {
        setTeamSelectionsForStats([])
        setMatchStaff({ coach: null, physio: null, team_manager: null })
        setStaffAttendance({})
      }
    }

    loadDataForMatchStats()
  }, [selectedMatchForStats, showMatchForm])

  // Load match summaries for admin
  useEffect(() => {
    const loadMatchSummaries = async () => {
      // Only load if user is admin and matches are loaded
      if (user?.role !== 'admin' || loading || matches.length === 0) {
        if (user?.role === 'admin' && !loading) {
          setLoadingSummaries(false)
        }
        return
      }

      setLoadingSummaries(true)
      const today = new Date().toISOString().split('T')[0]
      
      try {
        const supabase = createClient()
        console.log('Loading match summaries for', matches.length, 'matches')
        
        const summaries = await Promise.all(
          matches.map(async (match) => {
            const isUpcoming = match.match_date >= today
            
            // Get match details
            const { data: matchDetails, error: matchError } = await supabase
              .from('matches')
              .select('result, score_our_team, score_opponent')
              .eq('id', match.id)
              .single()

            if (matchError) {
              console.error('Error fetching match details:', matchError)
            }

            // Get match stats for played matches
            let playersWithStats = 0
            let totalTries = 0
            let totalTackles = 0

            if (!isUpcoming) {
              const { data: stats, error: statsError } = await supabase
                .from('match_stats')
                .select('tries_scored, tackles_made')
                .eq('match_id', match.id)

              if (statsError) {
                console.error('Error fetching match stats:', statsError)
              } else if (stats) {
                playersWithStats = stats.length
                totalTries = stats.reduce((sum, s) => sum + (s.tries_scored || 0), 0)
                totalTackles = stats.reduce((sum, s) => sum + (s.tackles_made || 0), 0)
              }
            }

            return {
              matchId: match.id,
              matchDate: match.match_date,
              opponent: match.opponent,
              venue: match.venue,
              tournamentType: match.tournament_type,
              result: matchDetails?.result,
              scoreOurTeam: matchDetails?.score_our_team,
              scoreOpponent: matchDetails?.score_opponent,
              playersWithStats,
              totalTries,
              totalTackles,
              isUpcoming,
            }
          })
        )

        console.log('Loaded match summaries:', summaries.length)
        setMatchSummaries(summaries)
      } catch (error) {
        console.error('Error loading match summaries:', error)
        setMatchSummaries([])
      } finally {
        setLoadingSummaries(false)
      }
    }

    loadMatchSummaries()
  }, [matches, user?.role, loading])

  if (loading) {
    return (
      <Layout pageTitle="Fixture Team Selection">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!user || (user.role !== 'coach' && user.role !== 'admin' && user.role !== 'data_admin')) {
    return null
  }

  const selectedMatch = matches.find(m => m.id === selectedMatchId)
  const squadFormat = getSquadFormat(selectedMatch)
  const maxSquadSize = getMaxSquadSize(selectedMatch)
  const maxStarting = getMaxStarting(squadFormat)
  const selectedPlayers = Array.from(teamSelections.values())
  const startingPlayers = selectedPlayers.filter(p => p.is_starting && !p.is_substitute)
  const substitutes = selectedPlayers.filter(p => p.is_substitute)

  // Group the available-players roster by playing position (forwards 1-8 first,
  // then backs 9-15) as a flat list of header + player items, so the coach can
  // see at a glance how many of each position (9s, 1s, 10s, 15s...) they have.
  // For a compact format (Sevens etc.) the granular 1-15 breakdown doesn't
  // apply — group by Forwards/Backs only instead.
  type RosterItem =
    | { type: 'header'; key: string; label: string; num: string; count: number; category: 'forwards' | 'backs'; firstOfCategory: boolean }
    | { type: 'player'; player: Player }
  const orderedRosterItems: RosterItem[] = (() => {
    const items: RosterItem[] = []
    if (squadFormat === 'sevens') {
      const isForwardSlug = (slug: string) => POSITION_META[slug]?.category === 'forwards'
      const forwards = availablePlayers.filter((p) => isForwardSlug(p.players?.position || ''))
      const backs = availablePlayers.filter((p) => !isForwardSlug(p.players?.position || ''))
      if (forwards.length) {
        items.push({ type: 'header', key: '__forwards', label: 'Forwards', num: '1-3', count: forwards.length, category: 'forwards', firstOfCategory: true })
        forwards.forEach((player) => items.push({ type: 'player', player }))
      }
      if (backs.length) {
        items.push({ type: 'header', key: '__backs', label: 'Backs', num: '4-7', count: backs.length, category: 'backs', firstOfCategory: true })
        backs.forEach((player) => items.push({ type: 'player', player }))
      }
      return items
    }
    const known = new Set(POSITION_ORDER)
    let lastCategory: string | null = null
    for (const slug of POSITION_ORDER) {
      const group = availablePlayers.filter((p) => (p.players?.position || '') === slug)
      if (!group.length) continue
      const meta = POSITION_META[slug]
      items.push({
        type: 'header', key: slug, label: meta.label, num: meta.num,
        count: group.length, category: meta.category,
        firstOfCategory: meta.category !== lastCategory,
      })
      lastCategory = meta.category
      group.forEach((player) => items.push({ type: 'player', player }))
    }
    const unassigned = availablePlayers.filter((p) => !known.has(p.players?.position || ''))
    if (unassigned.length) {
      items.push({ type: 'header', key: '__unassigned', label: 'Unassigned', num: '—', count: unassigned.length, category: 'backs', firstOfCategory: false })
      unassigned.forEach((player) => items.push({ type: 'player', player }))
    }
    return items
  })()

  const statsEligibleMatches = matches.filter((match) => isWithinStatsWindow(match.match_date))
  const coachUpcomingMatches = matches.filter((match) => !isActivityPast(match.match_date, null) && match.status !== 'played')
  const selectedTeamIds = new Set(teamSelectionsForStats.map((selection: any) => selection.player_id))
  const statsPlayers = selectedMatchForStats
    ? players.filter((player) => selectedTeamIds.has(player.user_id))
    : players
  const matchStatsModal = showMatchForm ? (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50 backdrop-blur-sm">
      <div className="bg-tm-surface rounded-card shadow-large w-full max-w-[95vw] sm:max-w-6xl border border-tm-border max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-tm-border flex-shrink-0">
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
                setSelectedMatchForStats('')
                setMatchStaff({ coach: null, physio: null, team_manager: null })
                setStaffAttendance({})
              }}
              className="modal-close-btn"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Match Selection */}
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
                  {statsEligibleMatches.map((match) => (
                    <option key={match.id} value={match.id}>
                      {new Date(match.match_date).toLocaleDateString()} - vs {match.opponent} ({match.tournament_type})
                    </option>
                  ))}
                </select>
              </div>
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

          {/* Staff Attendance */}
          <div className="bg-tm-surface-hover rounded-lg p-4 border border-tm-border">
            <h3 className="text-lg font-semibold text-tm-text-1 mb-4">Staff Attendance</h3>
            {(matchStaff.coach || matchStaff.physio || matchStaff.team_manager) ? (
              <div className="space-y-3">
                {matchStaff.coach && (
                  <label className="flex items-center gap-3 text-sm text-tm-text-1">
                    <input
                      type="checkbox"
                      checked={staffAttendance[matchStaff.coach.id] ?? true}
                      onChange={(e) =>
                        setStaffAttendance((prev) => ({
                          ...prev,
                          [matchStaff.coach!.id]: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-tm-border text-primary focus:ring-primary"
                    />
                    Coach: {matchStaff.coach.name}
                  </label>
                )}
                {matchStaff.physio && (
                  <label className="flex items-center gap-3 text-sm text-tm-text-1">
                    <input
                      type="checkbox"
                      checked={staffAttendance[matchStaff.physio.id] ?? true}
                      onChange={(e) =>
                        setStaffAttendance((prev) => ({
                          ...prev,
                          [matchStaff.physio!.id]: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-tm-border text-primary focus:ring-primary"
                    />
                    Physio: {matchStaff.physio.name}
                  </label>
                )}
                {matchStaff.team_manager && (
                  <label className="flex items-center gap-3 text-sm text-tm-text-1">
                    <input
                      type="checkbox"
                      checked={staffAttendance[matchStaff.team_manager.id] ?? true}
                      onChange={(e) =>
                        setStaffAttendance((prev) => ({
                          ...prev,
                          [matchStaff.team_manager!.id]: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-tm-border text-primary focus:ring-primary"
                    />
                    Team Manager: {matchStaff.team_manager.name}
                  </label>
                )}
              </div>
            ) : (
              <p className="text-sm text-tm-text-3">No staff assigned to this fixture.</p>
            )}
            <p className="text-xs text-tm-text-3 mt-3">
              Uncheck a staff member if they were not available on match day.
            </p>
          </div>

          {/* Player Statistics */}
          <div>
            <h3 className="text-lg font-semibold text-tm-text-1 mb-4">
              Player Statistics
            </h3>
            {injuredPlayerIds.length > 0 && (
              <div className="mb-4 p-3 bg-[#E05757]/10 border border-[#E05757]/30 rounded-lg">
                <p className="text-sm text-[#E05757]">
                  <strong>Note:</strong> Injured players are hidden from the stats sheet.
                </p>
              </div>
            )}
            {selectedMatchForStats && selectedTeamIds.size === 0 ? (
              <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
                No team selection found for this fixture. Select the team first to enter stats.
              </div>
            ) : (
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tm-border">
                    {statsPlayers.map((player, index) => {
                      const stats = playerStats[player.user_id] || {
                        player_id: player.user_id,
                        tackles_made: '0',
                        tackles_missed: '0',
                        ball_handling_errors: '0',
                        ball_carries: '0',
                        tries_scored: '0',
                        minutes_played: '0',
                      }

                      return (
                        <tr
                          key={player.user_id}
                          className={index % 2 === 0 ? 'bg-tm-surface' : 'bg-tm-surface-hover'}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-tm-text-1 sticky left-0 bg-inherit z-10 border-r border-tm-border">
                            {player.name}
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              value={stats.tackles_made}
                              onChange={(e) => updatePlayerStat(player.user_id, 'tackles_made', e.target.value)}
                              className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              value={stats.tackles_missed}
                              onChange={(e) => updatePlayerStat(player.user_id, 'tackles_missed', e.target.value)}
                              className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              value={stats.ball_handling_errors}
                              onChange={(e) => updatePlayerStat(player.user_id, 'ball_handling_errors', e.target.value)}
                              className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              value={stats.ball_carries}
                              onChange={(e) => updatePlayerStat(player.user_id, 'ball_carries', e.target.value)}
                              className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              value={stats.tries_scored}
                              onChange={(e) => updatePlayerStat(player.user_id, 'tries_scored', e.target.value)}
                              className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              max="80"
                              value={stats.minutes_played}
                              onChange={(e) => updatePlayerStat(player.user_id, 'minutes_played', e.target.value)}
                              className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-tm-border">
            <button
              onClick={handleSaveMatchStats}
              disabled={savingMatchStats}
              className="flex-1 px-6 py-3 bg-tm-secondary text-tm-on-secondary rounded-[6px] hover:opacity-90 transition-all duration-300 font-semibold shadow-soft hover:shadow-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
            >
              <Save className="w-5 h-5 mr-2" />
              {savingMatchStats ? 'Saving...' : 'Save Match Stats'}
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
                setMatchStaff({ coach: null, physio: null, team_manager: null })
                setStaffAttendance({})
              }}
              disabled={savingMatchStats}
              className="px-6 py-3 bg-tm-surface-hover text-tm-text-1 rounded-[6px] hover:bg-tm-surface-hover transition-all duration-300 font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null

  // For data_admin, show fixtures list with create and match stats options
  if (user?.role === 'data_admin') {
    return (
      <Layout pageTitle="Fixtures">
        <div className="space-y-6">
          {/* Header with Create Fixture and Enter Match Stats buttons */}
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-tm-text-1 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-primary" />
                Fixtures
              </h2>
              <div className="flex items-center gap-3">
                <RefreshButton onRefresh={loadData} />
                <button
                  onClick={() => setShowCreateFixtureForm(true)}
                  className="bg-primary text-tm-on-secondary px-6 py-2 rounded-[6px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Fixture
                </button>
                <button
                  onClick={() => {
                    setSelectedMatchForStats('')
                    setShowMatchForm(true)
                  }}
                  className="bg-secondary text-tm-on-secondary px-6 py-2 rounded-[6px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Enter Match Stats
                </button>
              </div>
            </div>

            {/* Fixtures List */}
            {matches.length === 0 ? (
              <div className="text-center py-12 text-tm-text-3">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-tm-text-3" />
                <p className="text-lg font-semibold">No fixtures created yet</p>
                <p className="text-sm mt-2">Click &quot;Create Fixture&quot; to add a new fixture</p>
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map((match) => {
                  const isUpcoming = !isActivityPast(match.match_date, null) && match.status !== 'played'
                  const isPlayed = !isUpcoming
                  const canEnterStats = isWithinStatsWindow(match.match_date)
                  
                  return (
                    <div
                      key={match.id}
                      className="border-2 border-tm-border rounded-lg p-4 hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-tm-text-1">
                              vs {match.opponent}
                            </h3>
                            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold capitalize">
                              {match.tournament_type.replace('_', ' ')}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              isUpcoming 
                                ? 'bg-success/15 text-success' 
                                : 'bg-tm-surface-hover text-tm-text-2'
                            }`}>
                              {isUpcoming ? 'Upcoming' : 'Played'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-tm-text-3">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(match.match_date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}</span>
                            </div>
                            {match.venue && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                <span>{match.venue}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {isUpcoming && user?.role === 'admin' && (
                            <button
                              onClick={() => handleViewTeam(match.id)}
                              disabled={loadingTeamView && viewingTeamForMatch === match.id}
                              className="px-4 py-2 bg-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center disabled:opacity-50"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Team
                            </button>
                          )}
                          {canEnterStats && (
                            <button
                              onClick={() => {
                                setSelectedMatchForStats(match.id)
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
                                setShowMatchForm(true)
                              }}
                              className="px-4 py-2 bg-primary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Match Stats
                            </button>
                          )}
                          {user?.role === 'data_admin' && (
                            <button
                              onClick={() => handleDeleteFixture(match.id)}
                              disabled={deletingFixtureId === match.id}
                              className="px-4 py-2 bg-red-600 text-white rounded-[6px] font-semibold hover:bg-red-700 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {deletingFixtureId === match.id ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Create Fixture Modal */}
          {showCreateFixtureForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
              <div className="bg-tm-surface rounded-card shadow-large max-w-2xl w-full border border-tm-border my-8 max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-tm-border flex-shrink-0">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-tm-text-1">Create New Fixture</h2>
                    <button
                      onClick={() => {
                        setShowCreateFixtureForm(false)
                        setFixtureForm({
                          match_date: '',
                          opponent: '',
                          tournament_type: 'friendly',
                          custom_tournament_type: '',
                          squad_size: '23',
                          venue: '',
                          notes: '',
                          physio_id: '',
                          team_manager_id: '',
                          coach_id: '',
                        })
                      }}
                      className="modal-close-btn"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4" style={{ maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
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
                      onChange={(e) => {
                        const value = e.target.value as typeof fixtureForm.tournament_type
                        // Suggest a sensible default squad size per format; the
                        // team manager can still override it.
                        const suggestedSquadSize = value === 'sevens' ? '12' : value === 'other' ? '' : '23'
                        setFixtureForm({ ...fixtureForm, tournament_type: value, squad_size: suggestedSquadSize })
                      }}
                      className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    >
                      <option value="friendly">Friendly</option>
                      <option value="league">League</option>
                      <option value="uganda_cup">Uganda Cup</option>
                      <option value="sevens">Sevens</option>
                      <option value="other">Other (specify)…</option>
                    </select>
                  </div>

                  {fixtureForm.tournament_type === 'other' && (
                    <div>
                      <label className="block text-sm font-medium text-tm-text-3 mb-2">
                        Tournament Name
                      </label>
                      <input
                        type="text"
                        value={fixtureForm.custom_tournament_type}
                        onChange={(e) => setFixtureForm({ ...fixtureForm, custom_tournament_type: e.target.value })}
                        placeholder="e.g., Invitational Tens, School Cup..."
                        className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-2">
                      Squad Size <span className="font-normal text-tm-text-3">(total players allowed)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={fixtureForm.squad_size}
                      onChange={(e) => setFixtureForm({ ...fixtureForm, squad_size: e.target.value })}
                      placeholder="e.g., 23 for 15s, 12 for Sevens"
                      className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                    <p className="mt-1 text-xs text-tm-text-3">
                      A squad of 12 or fewer switches team selection and the pitch view to a
                      compact (Sevens-style) format — 7 players on the field instead of 15.
                    </p>
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

                  {/* Staff Assignment Section */}
                  <div className="border-t-2 border-primary/30 pt-6 mt-6 bg-tm-surface-hover rounded-lg p-4">
                    <h3 className="text-xl font-bold text-tm-text-1 mb-4 flex items-center gap-2">
                      <span>👥</span>
                      Assign Staff for Game Day
                    </h3>
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
                          custom_tournament_type: '',
                          squad_size: '23',
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

          {/* Enter Match Stats Modal */}
          {showMatchForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50 backdrop-blur-sm">
              <div className="bg-tm-surface rounded-card shadow-large w-full max-w-[95vw] sm:max-w-6xl border border-tm-border max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b border-tm-border flex-shrink-0">
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
                        setSelectedMatchForStats('')
                        setMatchStaff({ coach: null, physio: null, team_manager: null })
                        setStaffAttendance({})
                      }}
                      className="modal-close-btn"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                  {/* Match Selection */}
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
                          {statsEligibleMatches.map((match) => (
                            <option key={match.id} value={match.id}>
                              {new Date(match.match_date).toLocaleDateString()} - vs {match.opponent} ({match.tournament_type})
                            </option>
                          ))}
                        </select>
                      </div>
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

                  {/* Staff Attendance */}
                  <div className="bg-tm-surface-hover rounded-lg p-4 border border-tm-border">
                    <h3 className="text-lg font-semibold text-tm-text-1 mb-4">Staff Attendance</h3>
                    {(matchStaff.coach || matchStaff.physio || matchStaff.team_manager) ? (
                      <div className="space-y-3">
                        {matchStaff.coach && (
                          <label className="flex items-center gap-3 text-sm text-tm-text-1">
                            <input
                              type="checkbox"
                              checked={staffAttendance[matchStaff.coach.id] ?? true}
                              onChange={(e) =>
                                setStaffAttendance((prev) => ({
                                  ...prev,
                                  [matchStaff.coach!.id]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 rounded border-tm-border text-primary focus:ring-primary"
                            />
                            Coach: {matchStaff.coach.name}
                          </label>
                        )}
                        {matchStaff.physio && (
                          <label className="flex items-center gap-3 text-sm text-tm-text-1">
                            <input
                              type="checkbox"
                              checked={staffAttendance[matchStaff.physio.id] ?? true}
                              onChange={(e) =>
                                setStaffAttendance((prev) => ({
                                  ...prev,
                                  [matchStaff.physio!.id]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 rounded border-tm-border text-primary focus:ring-primary"
                            />
                            Physio: {matchStaff.physio.name}
                          </label>
                        )}
                        {matchStaff.team_manager && (
                          <label className="flex items-center gap-3 text-sm text-tm-text-1">
                            <input
                              type="checkbox"
                              checked={staffAttendance[matchStaff.team_manager.id] ?? true}
                              onChange={(e) =>
                                setStaffAttendance((prev) => ({
                                  ...prev,
                                  [matchStaff.team_manager!.id]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 rounded border-tm-border text-primary focus:ring-primary"
                            />
                            Team Manager: {matchStaff.team_manager.name}
                          </label>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-tm-text-3">No staff assigned to this fixture.</p>
                    )}
                    <p className="text-xs text-tm-text-3 mt-3">
                      Uncheck a staff member if they were not available on match day.
                    </p>
                  </div>

                  {/* Player Statistics */}
                  <div>
                    <h3 className="text-lg font-semibold text-tm-text-1 mb-4">
                      Player Statistics
                    </h3>
                    {injuredPlayerIds.length > 0 && (
                      <div className="mb-4 p-3 bg-[#E05757]/10 border border-[#E05757]/30 rounded-lg">
                        <p className="text-sm text-[#E05757]">
                          <strong>Note:</strong> Injured players are hidden from the stats sheet.
                        </p>
                      </div>
                    )}
                    {selectedMatchForStats && selectedTeamIds.size === 0 ? (
                      <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
                        No team selection found for this fixture. Select the team first to enter stats.
                      </div>
                    ) : (
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
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-tm-border">
                            {statsPlayers.map((player, index) => {
                              const stats = playerStats[player.user_id] || {
                                player_id: player.user_id,
                                tackles_made: '0',
                                tackles_missed: '0',
                                ball_handling_errors: '0',
                                ball_carries: '0',
                                tries_scored: '0',
                                minutes_played: '0',
                              }

                              return (
                                <tr
                                  key={player.user_id}
                                  className={index % 2 === 0 ? 'bg-tm-surface' : 'bg-tm-surface-hover'}
                                >
                                  <td className="px-4 py-3 text-sm font-medium text-tm-text-1 sticky left-0 bg-inherit z-10 border-r border-tm-border">
                                    {player.name}
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      min="0"
                                      value={stats.tackles_made}
                                      onChange={(e) => updatePlayerStat(player.user_id, 'tackles_made', e.target.value)}
                                      className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      min="0"
                                      value={stats.tackles_missed}
                                      onChange={(e) => updatePlayerStat(player.user_id, 'tackles_missed', e.target.value)}
                                      className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      min="0"
                                      value={stats.ball_handling_errors}
                                      onChange={(e) => updatePlayerStat(player.user_id, 'ball_handling_errors', e.target.value)}
                                      className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      min="0"
                                      value={stats.ball_carries}
                                      onChange={(e) => updatePlayerStat(player.user_id, 'ball_carries', e.target.value)}
                                      className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      min="0"
                                      value={stats.tries_scored}
                                      onChange={(e) => updatePlayerStat(player.user_id, 'tries_scored', e.target.value)}
                                      className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      min="0"
                                      max="80"
                                      value={stats.minutes_played}
                                      onChange={(e) => updatePlayerStat(player.user_id, 'minutes_played', e.target.value)}
                                      className="w-full px-2 py-1 border border-tm-border rounded text-center text-sm"
                                    />
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t border-tm-border">
                    <button
                      onClick={handleSaveMatchStats}
                      disabled={savingMatchStats}
                      className="flex-1 px-6 py-3 bg-tm-secondary text-tm-on-secondary rounded-[6px] hover:opacity-90 transition-all duration-300 font-semibold shadow-soft hover:shadow-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                    >
                      <Save className="w-5 h-5 mr-2" />
                      {savingMatchStats ? 'Saving...' : 'Save Match Stats'}
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
                        setMatchStaff({ coach: null, physio: null, team_manager: null })
                        setStaffAttendance({})
                      }}
                      disabled={savingMatchStats}
                      className="px-6 py-3 bg-tm-surface-hover text-tm-text-1 rounded-[6px] hover:bg-tm-surface-hover transition-all duration-300 font-semibold disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    )
  }

  // For admin, show match summaries with stats
  if (user?.role === 'admin') {
    return (
      <Layout pageTitle="Fixtures Summary">
        <div className="space-y-6">
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-tm-text-1 flex items-center gap-2 mb-2">
                  <Trophy className="w-6 h-6 text-primary" />
                  Match Summaries
                </h2>
                <p className="text-tm-text-3">
                  Summary of played matches with stats and upcoming fixtures with team selections
                </p>
              </div>
              <RefreshButton onRefresh={loadData} />
            </div>

            {loadingSummaries ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : matchSummaries.length === 0 ? (
              <div className="text-center py-12 text-tm-text-3">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-tm-text-3" />
                <p className="text-lg font-semibold">No matches found</p>
                <p className="text-sm mt-2">
                  Matches will appear here once they have stats (for played matches) or team selections (for upcoming fixtures)
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {matchSummaries.map((summary) => (
                  <div
                    key={summary.matchId}
                    className="bg-tm-surface rounded-lg border border-tm-border shadow-soft p-5 hover:shadow-medium transition-all"
                  >
                    {/* Match Header */}
                    <div className="mb-4 pb-4 border-b border-tm-border">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-tm-text-1">
                          vs {summary.opponent}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          summary.isUpcoming
                            ? 'bg-success/15 text-success'
                            : 'bg-tm-surface-hover text-tm-text-2'
                        }`}>
                          {summary.isUpcoming ? 'Upcoming' : 'Played'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-tm-text-3">
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(summary.matchDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        {summary.venue && (
                          <div className="flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {summary.venue}
                          </div>
                        )}
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded-full capitalize">
                          {summary.tournamentType.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Match Result (for played matches) */}
                    {!summary.isUpcoming && summary.result && (
                      <div className="mb-4 p-3 bg-tm-surface-hover rounded-lg border border-tm-border">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-tm-text-1">Result:</span>
                          <span className={`text-sm font-bold capitalize ${
                            summary.result === 'win' ? 'text-success' :
                            summary.result === 'loss' ? 'text-secondary' : 'text-tm-text-3'
                          }`}>
                            {summary.result}
                          </span>
                        </div>
                        {(summary.scoreOurTeam !== undefined && summary.scoreOpponent !== undefined) && (
                          <div className="mt-2 text-center text-lg font-bold text-tm-text-1">
                            {summary.scoreOurTeam} - {summary.scoreOpponent}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stats Summary (for played matches) */}
                    {!summary.isUpcoming && (
                      <div>
                        <h4 className="text-sm font-semibold text-tm-text-1 mb-3">Match Statistics</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-success/10 rounded-lg p-2 border border-success/30">
                            <div className="text-xs text-tm-text-3">Players with Stats</div>
                            <div className="text-lg font-bold text-success">{summary.playersWithStats}</div>
                          </div>
                          <div className="bg-tm-surface-hover rounded-lg p-2 border border-tm-border">
                            <div className="text-xs text-tm-text-3">Total Tries</div>
                            <div className="text-lg font-bold text-info">{summary.totalTries}</div>
                          </div>
                          <div className="bg-info/10 rounded-lg p-2 border border-info/30 md:col-span-2">
                            <div className="text-xs text-tm-text-3">Total Tackles</div>
                            <div className="text-lg font-bold text-primary">{summary.totalTackles}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Upcoming Fixture Note */}
                    {summary.isUpcoming && (
                      <div className="p-3 bg-warning/10 rounded-lg border border-warning/30 mb-4">
                        <p className="text-sm text-warning mb-2">
                          <strong>Upcoming:</strong> Team selection has been recorded for this fixture.
                        </p>
                        <button
                          onClick={() => handleViewTeam(summary.matchId)}
                          disabled={loadingTeamView && viewingTeamForMatch === summary.matchId}
                          className="w-full px-4 py-2 bg-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center justify-center disabled:opacity-50"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          {loadingTeamView && viewingTeamForMatch === summary.matchId ? 'Loading...' : 'View Selected Team'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* View Team Selection Modal */}
        {showTeamViewModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-tm-surface rounded-card shadow-large max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-tm-border">
              <div className="p-6 border-b border-tm-border sticky top-0 bg-tm-surface z-10">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-tm-text-1">Selected Team</h2>
                  <button
                    onClick={() => {
                      setShowTeamViewModal(false)
                      setViewingTeamForMatch('')
                      setViewedTeamSelection([])
                    }}
                    className="modal-close-btn"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {viewingTeamForMatch && (
                  <p className="text-sm text-tm-text-3 mt-2">
                    {matches.find(m => m.id === viewingTeamForMatch)?.opponent && 
                      `vs ${matches.find(m => m.id === viewingTeamForMatch)?.opponent} - ${new Date(matches.find(m => m.id === viewingTeamForMatch)?.match_date || '').toLocaleDateString()}`
                    }
                  </p>
                )}
              </div>
              <div className="p-6">
                {loadingTeamView ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : viewedTeamSelection.length === 0 ? (
                  <div className="text-center py-12 text-tm-text-3">
                    <Users className="w-16 h-16 mx-auto mb-4 text-tm-text-3" />
                    <p className="text-lg font-semibold">No team selected yet</p>
                    <p className="text-sm mt-2">The coach has not selected a team for this fixture</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Starting Lineup */}
                    <div>
                      <h3 className="text-lg font-bold text-tm-text-1 mb-4 flex items-center gap-2">
                        <Check className="w-5 h-5 text-success" />
                        Starting Lineup ({viewedTeamSelection.filter((s: any) => s.is_starting && !s.is_substitute).length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {viewedTeamSelection
                          .filter((s: any) => s.is_starting && !s.is_substitute)
                          .map((selection: any) => (
                            <div key={selection.player_id} className="bg-tm-surface-hover/50 rounded-lg p-3 border border-tm-border">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <p className="font-semibold text-tm-text-1">{selection.player_name || 'Unknown Player'}</p>
                                    {selection.is_captain && (
                                      <span className="px-2 py-0.5 bg-warning/100 text-white text-xs font-bold rounded-full flex items-center gap-1">
                                        <Trophy className="w-3 h-3" />
                                        Captain
                                      </span>
                                    )}
                                    {selection.is_assistant_captain && (
                                      <span className="px-2 py-0.5 bg-tm-surface-hover0 text-white text-xs font-bold rounded-full flex items-center gap-1">
                                        <Trophy className="w-3 h-3" />
                                        Asst. Captain
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-tm-text-3">{selection.position || 'N/A'}</p>
                                </div>
                                {selection.jersey_number && (
                                  <span className="px-3 py-1 bg-primary text-tm-on-secondary rounded-full text-sm font-bold">
                                    #{selection.jersey_number}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Substitutes */}
                    {viewedTeamSelection.filter((s: any) => s.is_substitute).length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-tm-text-1 mb-4 flex items-center gap-2">
                          <Users className="w-5 h-5 text-primary" />
                          Substitutes ({viewedTeamSelection.filter((s: any) => s.is_substitute).length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {viewedTeamSelection
                            .filter((s: any) => s.is_substitute)
                            .map((selection: any) => (
                              <div key={selection.player_id} className="bg-tm-surface-hover/50 rounded-lg p-3 border border-tm-border">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <p className="font-semibold text-tm-text-1">{selection.player_name || 'Unknown Player'}</p>
                                      {selection.is_captain && (
                                        <span className="px-2 py-0.5 bg-warning/100 text-white text-xs font-bold rounded-full flex items-center gap-1">
                                          <Trophy className="w-3 h-3" />
                                          Captain
                                        </span>
                                      )}
                                      {selection.is_assistant_captain && (
                                        <span className="px-2 py-0.5 bg-tm-surface-hover0 text-white text-xs font-bold rounded-full flex items-center gap-1">
                                          <Trophy className="w-3 h-3" />
                                          Asst. Captain
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-tm-text-3">{selection.position || 'N/A'}</p>
                                  </div>
                                  {selection.jersey_number && (
                                    <span className="px-3 py-1 bg-primary text-tm-on-secondary rounded-full text-sm font-bold">
                                      #{selection.jersey_number}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Layout>
    )
  }

  // For coach, show team selection interface
  return (
    <Layout pageTitle="Fixture Team Selection">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-tm-text-1 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" />
              Select Team for Fixture
            </h2>
            {selectedMatchId && editingRoster && (
              <button
                onClick={handleSave}
                disabled={saving || teamSelections.size === 0}
                className="bg-tm-secondary text-tm-on-secondary px-6 py-2 rounded-[6px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Team Selection'}
              </button>
            )}
          </div>

          {/* Match Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-tm-text-1 mb-2">
              Select Match
            </label>
            <select
              value={selectedMatchId}
              onChange={(e) => {
                const v = e.target.value
                if (v === selectedMatchId) return // same match — don't clear the loaded squad
                viewModeMatch.current = null // let the new match initialise its view mode
                setSelectedMatchId(v)
                setTeamSelections(new Map())
                setShowSavedTeam(false)
              }}
              className="w-full md:w-auto px-4 py-2 border border-tm-border rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">-- Select a match --</option>
              {coachUpcomingMatches.map((match) => (
                <option key={match.id} value={match.id}>
                  {new Date(match.match_date).toLocaleDateString()} vs {match.opponent}
                </option>
              ))}
            </select>
          </div>

          {/* Match Info */}
          {selectedMatch && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-tm-surface-hover rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-tm-text-3">Match Date</p>
                  <p className="text-sm font-semibold text-tm-text-1">
                    {new Date(selectedMatch.match_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-secondary" />
                <div>
                  <p className="text-xs text-tm-text-3">Opponent</p>
                  <p className="text-sm font-semibold text-tm-text-1">{selectedMatch.opponent}</p>
                </div>
              </div>
              {selectedMatch.venue && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-success" />
                  <div>
                    <p className="text-xs text-tm-text-3">Venue</p>
                    <p className="text-sm font-semibold text-tm-text-1">{selectedMatch.venue}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedMatchId && (
          <>
            {/* Selection Summary */}
            <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
              {squadFormat === 'sevens' && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="rounded bg-tm-secondary px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-tm-on-secondary">
                    Sevens format
                  </span>
                  <span className="text-xs text-tm-text-3">
                    Max {maxSquadSize} in the squad · {maxStarting} on the field at once
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{startingPlayers.length}<span className="text-base font-medium text-tm-text-3">/{maxStarting}</span></p>
                  <p className="text-sm text-tm-text-3">Starting Players</p>
                </div>
                <div className="text-center p-4 bg-secondary/10 rounded-lg">
                  <p className="text-2xl font-bold text-secondary">{substitutes.length}</p>
                  <p className="text-sm text-tm-text-3">Substitutes</p>
                </div>
                <div className="text-center p-4 bg-success/10 rounded-lg">
                  <p className="text-2xl font-bold text-success">{teamSelections.size}<span className="text-base font-medium text-tm-text-3">/{maxSquadSize}</span></p>
                  <p className="text-sm text-tm-text-3">Total Selected</p>
                </div>
              </div>
            </div>

            {/* Saved-team view — after saving, the roster collapses to this.
                The coach can view the team, edit it, or delete it and start over. */}
            {!editingRoster && teamSelections.size > 0 && (
              <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft overflow-hidden">
                <div className="p-6 border-b border-tm-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success">
                      <Check className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-tm-text-1">Team selection saved</h3>
                      <p className="text-xs text-tm-text-3">
                        {startingPlayers.length} starting · {substitutes.length} substitutes · {teamSelections.size} total
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowSavedTeam((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-tm-border bg-tm-surface-hover px-3 py-2 text-sm font-medium text-tm-text-1 transition-colors hover:bg-tm-surface"
                    >
                      <Eye className="h-4 w-4" /> {showSavedTeam ? 'Hide team' : 'View team'}
                    </button>
                    <button
                      onClick={() => { setEditingRoster(true); setShowSavedTeam(false) }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-tm-border bg-tm-surface-hover px-3 py-2 text-sm font-medium text-tm-text-1 transition-colors hover:bg-tm-surface"
                    >
                      Edit selection
                    </button>
                    <button
                      onClick={handleDeleteSquad}
                      disabled={deletingSquad}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" /> {deletingSquad ? 'Deleting…' : 'Delete & start over'}
                    </button>
                  </div>
                </div>

                {/* Club slogan — hypes the squad ahead of the fixture */}
                {clubSlogan && (
                  <div className="border-b border-tm-border px-6 py-3">
                    <p className="font-semibold italic text-primary">&ldquo;{clubSlogan}&rdquo;</p>
                  </div>
                )}

                {showSavedTeam && (
                  <div className="p-6">
                    <TeamPitchView
                      starting={existingSelection.filter((s: any) => s.is_starting && !s.is_substitute)}
                      substitutes={existingSelection.filter((s: any) => s.is_substitute)}
                      stats={selectionStats}
                      format={squadFormat}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Players List — the editable roster (hidden once a squad is saved) */}
            {editingRoster && (
            <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft overflow-hidden">
              <div className="p-6 border-b border-tm-border">
                <h3 className="text-xl font-bold text-tm-text-1 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Available Players
                </h3>
                <p className="mt-1 text-xs text-tm-text-3">
                  {squadFormat === 'sevens'
                    ? `Sevens format — grouped by Forwards/Backs. Squad capped at ${maxSquadSize}, ${maxStarting} on the field at once.`
                    : 'Grouped by position. Selection stats (attendance & caps) fill in as your club logs training sessions and matches.'}
                </p>

                {/* Quick-start: copy a previous squad, then edit the roster below */}
                {previousSquads.filter((s) => s.match_id !== selectedMatchId).length > 0 && (
                  <div className="mt-4 flex flex-col gap-2 rounded-lg border border-tm-border bg-tm-surface-hover p-3 sm:flex-row sm:items-center">
                    <label className="text-sm font-medium text-tm-text-1 whitespace-nowrap">
                      Start from a previous squad
                    </label>
                    <select
                      value=""
                      disabled={applyingSquad}
                      onChange={(e) => {
                        const v = e.target.value
                        e.target.value = ''
                        if (v) applyPreviousSquad(v)
                      }}
                      className="w-full rounded-md border border-tm-border bg-tm-surface px-3 py-2 text-sm text-tm-text-1 focus:outline-none focus:ring-2 focus:ring-primary sm:ml-auto sm:w-auto sm:min-w-[260px]"
                    >
                      <option value="">{applyingSquad ? 'Loading…' : '— Copy a past selection… —'}</option>
                      {previousSquads
                        .filter((s) => s.match_id !== selectedMatchId)
                        .map((s) => (
                          <option key={s.match_id} value={s.match_id}>
                            {new Date(s.match_date).toLocaleDateString('en-GB')} · vs {s.opponent} ({s.playerCount})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {orderedRosterItems.map((item) => {
                    if (item.type === 'header') {
                      return (
                        <div key={item.key} className="col-span-full">
                          {item.firstOfCategory && (
                            <div className="mt-4 first:mt-0 mb-2 pb-1 border-b border-tm-border text-sm font-bold uppercase tracking-wider text-tm-secondary">
                              {item.category === 'forwards' ? 'Forwards · 1–8' : 'Backs · 9–15'}
                            </div>
                          )}
                          <div className="flex items-center gap-2 py-1">
                            <span className="inline-flex items-center justify-center min-w-[2.25rem] h-7 px-2 rounded-md bg-tm-secondary/15 text-tm-secondary text-xs font-bold border border-tm-secondary/30">
                              {item.num}
                            </span>
                            <h4 className="font-semibold text-tm-text-1">{item.label}</h4>
                            <span className="text-xs text-tm-text-3">· {item.count} available</span>
                          </div>
                        </div>
                      )
                    }
                    const player = item.player
                    const isSelected = teamSelections.has(player.user_id)
                    const selection = teamSelections.get(player.user_id)

                    return (
                      <div
                        key={player.user_id}
                        className={`border-2 rounded-lg p-4 transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-medium'
                            : 'border-tm-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex flex-1 min-w-0 items-start gap-3">
                            {/* Avatar: uploaded photo if available, otherwise
                                initials — ring colour matches Forwards/Backs,
                                same visual language as the pitch-view cards. */}
                            <div
                              className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ${
                                player.players.category === 'forwards' ? 'ring-tm-secondary' : 'ring-tm-primary'
                              } bg-tm-surface-hover`}
                            >
                              {player.profile_picture_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={player.profile_picture_url}
                                  alt={player.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-bold text-tm-text-1">
                                  {player.name
                                    .trim()
                                    .split(/\s+/)
                                    .map((w) => w[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="truncate font-semibold text-tm-text-1">{player.name}</h4>
                              <p className="truncate text-xs text-tm-text-3 capitalize">
                                {player.players.position.replace('_', ' ')} • {player.players.category}
                              </p>
                              {player.players.jersey_number && (
                                <p className="text-xs text-tm-text-3">
                                  Jersey: #{player.players.jersey_number}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => togglePlayerSelection(player.user_id, player)}
                            className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                              isSelected
                                ? 'bg-primary text-tm-on-secondary'
                                : 'bg-tm-surface-hover text-tm-text-3 hover:bg-primary/10'
                            }`}
                          >
                            {isSelected ? (
                              <Check className="w-5 h-5" />
                            ) : (
                              <X className="w-5 h-5" />
                            )}
                          </button>
                        </div>

                        {/* Selection stats — real data where available, graceful
                            "—" until the club logs training/matches. */}
                        {(() => {
                          const st = selectionStats[player.user_id]
                          const injured = injuredPlayerIds.includes(player.user_id)
                          return (
                            <div className="mb-3 grid grid-cols-3 gap-1.5 text-center">
                              <div className="rounded-md bg-tm-surface-hover py-1.5">
                                <p className="text-[10px] uppercase tracking-wide text-tm-text-3">Status</p>
                                <p className={`text-xs font-bold ${injured ? 'text-red-500' : 'text-success'}`}>
                                  {injured ? 'Injured' : 'Fit'}
                                </p>
                              </div>
                              <div className="rounded-md bg-tm-surface-hover py-1.5" title="Training attendance rate">
                                <p className="text-[10px] uppercase tracking-wide text-tm-text-3">Attend.</p>
                                <p className="text-xs font-bold text-tm-text-1">
                                  {st?.attendanceRate != null ? `${st.attendanceRate}%` : '—'}
                                </p>
                              </div>
                              <div className="rounded-md bg-tm-surface-hover py-1.5" title="Matches with recorded stats">
                                <p className="text-[10px] uppercase tracking-wide text-tm-text-3">Caps</p>
                                <p className="text-xs font-bold text-tm-text-1">
                                  {st && st.caps > 0 ? st.caps : '—'}
                                </p>
                              </div>
                            </div>
                          )
                        })()}

                        {isSelected && (
                          <div className="space-y-2 mt-3 pt-3 border-t border-tm-border">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selection?.is_starting && !selection?.is_substitute}
                                onChange={(e) => {
                                  updatePlayerSelection(player.user_id, {
                                    is_starting: e.target.checked,
                                    is_substitute: !e.target.checked,
                                  })
                                }}
                                className="rounded"
                              />
                              <label className="text-sm text-tm-text-1">Starting Player</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selection?.is_substitute || false}
                                onChange={(e) => {
                                  updatePlayerSelection(player.user_id, {
                                    is_substitute: e.target.checked,
                                    is_starting: !e.target.checked,
                                  })
                                }}
                                className="rounded"
                              />
                              <label className="text-sm text-tm-text-1">Substitute</label>
                            </div>
                            <input
                              type="number"
                              placeholder="Jersey #"
                              value={selection?.jersey_number || ''}
                              onChange={(e) => {
                                updatePlayerSelection(player.user_id, {
                                  jersey_number: e.target.value ? parseInt(e.target.value) : undefined,
                                })
                              }}
                              className="w-full px-2 py-1 text-sm border border-tm-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            {/* Captain Selection */}
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="captain"
                                checked={selection?.is_captain || false}
                                onChange={(e) => {
                                  // Unset captain for all other players
                                  const newSelections = new Map(teamSelections)
                                  newSelections.forEach((sel, pid) => {
                                    if (pid !== player.user_id) {
                                      newSelections.set(pid, { ...sel, is_captain: false })
                                    }
                                  })
                                  // Set captain for this player
                                  const current = newSelections.get(player.user_id)
                                  if (current) {
                                    newSelections.set(player.user_id, {
                                      ...current,
                                      is_captain: e.target.checked,
                                      is_assistant_captain: e.target.checked ? false : current.is_assistant_captain,
                                    })
                                  }
                                  setTeamSelections(newSelections)
                                }}
                                className="rounded"
                              />
                              <label className="text-sm text-tm-text-1 font-semibold">Captain</label>
                            </div>
                            {/* Assistant Captain Selection */}
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="assistant_captain"
                                checked={selection?.is_assistant_captain || false}
                                onChange={(e) => {
                                  // Unset assistant captain for all other players
                                  const newSelections = new Map(teamSelections)
                                  newSelections.forEach((sel, pid) => {
                                    if (pid !== player.user_id) {
                                      newSelections.set(pid, { ...sel, is_assistant_captain: false })
                                    }
                                  })
                                  // Set assistant captain for this player
                                  const current = newSelections.get(player.user_id)
                                  if (current) {
                                    newSelections.set(player.user_id, {
                                      ...current,
                                      is_assistant_captain: e.target.checked,
                                      is_captain: e.target.checked ? false : current.is_captain,
                                    })
                                  }
                                  setTeamSelections(newSelections)
                                }}
                                className="rounded"
                              />
                              <label className="text-sm text-tm-text-1 font-semibold">Assistant Captain</label>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            )}
          </>
        )}

      </div>
      {matchStatsModal}
    </Layout>
  )
}
