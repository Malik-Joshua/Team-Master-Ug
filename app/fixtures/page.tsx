'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { Users, Check, X, Save, Calendar, MapPin, Trophy, Plus, Eye, Trash2 } from 'lucide-react'
import RefreshButton from '@/components/RefreshButton'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db-helpers'
import { isActivityPast } from '@/lib/utils'

interface Player {
  user_id: string
  name: string
  email: string
  status: string
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
}

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
            // Get all matches first
            const { data: allMatches, error: matchesError } = await supabase
              .from('matches')
              .select('id, match_date, opponent, venue, tournament_type, status')
              .order('match_date', { ascending: false })
            
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
              const { data: allMatches, error: matchesError } = await supabase
                .from('matches')
                .select('id, match_date, opponent, venue, tournament_type, status')
                .order('match_date', { ascending: true })
              
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
          setSelectedMatchId(matchesData[0].id)
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
    const loadExistingSelection = async () => {
      if (!selectedMatchId) return

      try {
        // Use API route to fetch team selection (bypasses RLS)
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
          console.log('Loaded team selection from API:', selections.length, 'players')
        } else {
          console.error('Error loading team selection from API:', response.statusText)
          // Fallback to direct query
          try {
            const selections = await db.getFixtureTeamSelection(selectedMatchId)
            setExistingSelection(selections)
            
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
          } catch (fallbackError) {
            console.error('Error in fallback team selection query:', fallbackError)
          }
        }
      } catch (error) {
        console.error('Error loading existing selection:', error)
        // Fallback to direct query
        try {
          const selections = await db.getFixtureTeamSelection(selectedMatchId)
          setExistingSelection(selections)
          
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
        } catch (fallbackError) {
          console.error('Error in fallback team selection query:', fallbackError)
        }
      }
    }

    loadExistingSelection()
  }, [selectedMatchId])

  const togglePlayerSelection = (playerId: string, player: Player) => {
    const newSelections = new Map(teamSelections)
    
    if (newSelections.has(playerId)) {
      newSelections.delete(playerId)
    } else {
      newSelections.set(playerId, {
        player_id: playerId,
        position: player.players.position,
        jersey_number: player.players.jersey_number,
        is_starting: true,
        is_substitute: false,
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

    setCreatingFixture(true)
    try {
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
      const { data: matchesData, error: reloadError } = await supabase
        .from('matches')
        .select('id, match_date, opponent, venue, tournament_type')
        .order('match_date', { ascending: false })
        .limit(100)

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

  const handleSaveMatchStats = async () => {
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
      const { data: matchesData, error: reloadError } = await supabase
        .from('matches')
        .select('id, match_date, opponent, venue, tournament_type')
        .order('match_date', { ascending: false })
        .limit(100)

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

      // Load players using API route to bypass RLS
      try {
        const response = await fetch('/api/admin/players')
        if (response.ok) {
          const data = await response.json()
          if (data.players && data.players.length > 0) {
            // Transform to match the expected format
            setPlayers(data.players.map((p: any) => ({
              user_id: p.user_id,
              name: p.name,
            })))
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
            setPlayers(playersData)
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
            setPlayers(playersData)
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
  const selectedPlayers = Array.from(teamSelections.values())
  const startingPlayers = selectedPlayers.filter(p => p.is_starting && !p.is_substitute)
  const substitutes = selectedPlayers.filter(p => p.is_substitute)
  const statsEligibleMatches = matches.filter((match) => {
    const isPlayed = isActivityPast(match.match_date, null) || match.status === 'played'
    return !isPlayed
  })

  // For data_admin, show fixtures list with create and match stats options
  if (user?.role === 'data_admin') {
    return (
      <Layout pageTitle="Fixtures">
        <div className="space-y-6">
          {/* Header with Create Fixture and Enter Match Stats buttons */}
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-neutral-text flex items-center gap-2">
                <Trophy className="w-6 h-6 text-primary" />
                Fixtures
              </h2>
              <div className="flex items-center gap-3">
                <RefreshButton onRefresh={loadData} />
                <button
                  onClick={() => setShowCreateFixtureForm(true)}
                  className="bg-primary text-white px-6 py-2 rounded-button font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Fixture
                </button>
                <button
                  onClick={() => {
                    setSelectedMatchForStats('')
                    setShowMatchForm(true)
                  }}
                  className="bg-secondary text-white px-6 py-2 rounded-button font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Enter Match Stats
                </button>
              </div>
            </div>

            {/* Fixtures List */}
            {matches.length === 0 ? (
              <div className="text-center py-12 text-neutral-medium">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-neutral-light" />
                <p className="text-lg font-semibold">No fixtures created yet</p>
                <p className="text-sm mt-2">Click &quot;Create Fixture&quot; to add a new fixture</p>
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map((match) => {
                  const isUpcoming = !isActivityPast(match.match_date, null) && match.status !== 'played'
                  const isPlayed = !isUpcoming
                  
                  return (
                    <div
                      key={match.id}
                      className="border-2 border-neutral-light rounded-lg p-4 hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-neutral-text">
                              vs {match.opponent}
                            </h3>
                            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold capitalize">
                              {match.tournament_type.replace('_', ' ')}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              isUpcoming 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {isUpcoming ? 'Upcoming' : 'Played'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-neutral-medium">
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
                              className="px-4 py-2 bg-secondary text-white rounded-button font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center disabled:opacity-50"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Team
                            </button>
                          )}
                          {isUpcoming && (
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
                              className="px-4 py-2 bg-primary text-white rounded-button font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Match Stats
                            </button>
                          )}
                          {user?.role === 'data_admin' && (
                            <button
                              onClick={() => handleDeleteFixture(match.id)}
                              disabled={deletingFixtureId === match.id}
                              className="px-4 py-2 bg-red-600 text-white rounded-button font-semibold hover:bg-red-700 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center disabled:opacity-50"
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
              <div className="bg-white rounded-card shadow-large max-w-2xl w-full border border-neutral-light my-8 max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-neutral-light flex-shrink-0">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-neutral-text">Create New Fixture</h2>
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
                      className="text-neutral-medium hover:text-neutral-text"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4" style={{ maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-4">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> After creating a fixture, the coach will be able to select the team for this match on the Fixtures page.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-2">
                      Match Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={fixtureForm.match_date}
                      onChange={(e) => setFixtureForm({ ...fixtureForm, match_date: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-2">
                      Opponent <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fixtureForm.opponent}
                      onChange={(e) => setFixtureForm({ ...fixtureForm, opponent: e.target.value })}
                      placeholder="e.g., Heathens RFC"
                      className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-2">
                      Tournament Type
                    </label>
                    <select
                      value={fixtureForm.tournament_type}
                      onChange={(e) => setFixtureForm({ ...fixtureForm, tournament_type: e.target.value as any })}
                      className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    >
                      <option value="friendly">Friendly</option>
                      <option value="league">League</option>
                      <option value="uganda_cup">Uganda Cup</option>
                      <option value="sevens">Sevens</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-2">Venue</label>
                    <input
                      type="text"
                      value={fixtureForm.venue}
                      onChange={(e) => setFixtureForm({ ...fixtureForm, venue: e.target.value })}
                      placeholder="e.g., Kyadondo Rugby Club"
                      className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-2">Notes</label>
                    <textarea
                      value={fixtureForm.notes}
                      onChange={(e) => setFixtureForm({ ...fixtureForm, notes: e.target.value })}
                      rows={3}
                      placeholder="Additional fixture notes..."
                      className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                  </div>

                  {/* Staff Assignment Section */}
                  <div className="border-t-2 border-primary/30 pt-6 mt-6 bg-gray-50 rounded-lg p-4">
                    <h3 className="text-xl font-bold text-neutral-text mb-4 flex items-center gap-2">
                      <span>👥</span>
                      Assign Staff for Game Day
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-medium mb-2">
                          Physiotherapist
                        </label>
                        <select
                          value={fixtureForm.physio_id}
                          onChange={(e) => setFixtureForm({ ...fixtureForm, physio_id: e.target.value })}
                          className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
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
                        <label className="block text-sm font-medium text-neutral-medium mb-2">
                          Team Manager
                        </label>
                        <select
                          value={fixtureForm.team_manager_id}
                          onChange={(e) => setFixtureForm({ ...fixtureForm, team_manager_id: e.target.value })}
                          className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
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
                        <label className="block text-sm font-medium text-neutral-medium mb-2">
                          Coach
                        </label>
                        <select
                          value={fixtureForm.coach_id}
                          onChange={(e) => setFixtureForm({ ...fixtureForm, coach_id: e.target.value })}
                          className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
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

                  <div className="flex gap-3 pt-4 border-t border-neutral-light">
                    <button
                      onClick={handleCreateFixture}
                      disabled={creatingFixture}
                      className="flex-1 px-6 py-3 bg-club-gradient text-white rounded-button hover:opacity-90 transition-all duration-300 font-semibold shadow-soft hover:shadow-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
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
                      className="px-6 py-3 bg-neutral-light text-neutral-text rounded-button hover:bg-neutral-medium transition-all duration-300 font-semibold disabled:opacity-50"
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white rounded-card shadow-large max-w-6xl w-full border border-neutral-light max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b border-neutral-light flex-shrink-0">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-neutral-text">Enter Match Statistics</h2>
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
                      className="text-neutral-medium hover:text-neutral-text"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                  {/* Match Selection */}
                  {!selectedMatchForStats && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h3 className="text-lg font-semibold text-neutral-text mb-4">Select Match for Stats</h3>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-neutral-medium mb-2">
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
                          className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
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
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h3 className="text-lg font-semibold text-neutral-text mb-4">Match Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-medium mb-2">
                          Match Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={matchForm.match_date}
                          onChange={(e) => setMatchForm({ ...matchForm, match_date: e.target.value })}
                          className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-medium mb-2">
                          Opponent <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={matchForm.opponent}
                          onChange={(e) => setMatchForm({ ...matchForm, opponent: e.target.value })}
                          placeholder="e.g., Heathens RFC"
                          className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-medium mb-2">
                          Tournament Type
                        </label>
                        <select
                          value={matchForm.tournament_type}
                          onChange={(e) => setMatchForm({ ...matchForm, tournament_type: e.target.value as any })}
                          className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        >
                          <option value="friendly">Friendly</option>
                          <option value="league">League</option>
                          <option value="uganda_cup">Uganda Cup</option>
                          <option value="sevens">Sevens</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-medium mb-2">Venue</label>
                        <input
                          type="text"
                          value={matchForm.venue}
                          onChange={(e) => setMatchForm({ ...matchForm, venue: e.target.value })}
                          placeholder="e.g., Kyadondo Rugby Club"
                          className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-medium mb-2">Result</label>
                        <select
                          value={matchForm.result}
                          onChange={(e) => setMatchForm({ ...matchForm, result: e.target.value as any })}
                          className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        >
                          <option value="win">Win</option>
                          <option value="loss">Loss</option>
                          <option value="draw">Draw</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-neutral-medium mb-2">Our Score</label>
                          <input
                            type="number"
                            value={matchForm.score_our_team}
                            onChange={(e) => setMatchForm({ ...matchForm, score_our_team: e.target.value })}
                            min="0"
                            className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-medium mb-2">Opponent Score</label>
                          <input
                            type="number"
                            value={matchForm.score_opponent}
                            onChange={(e) => setMatchForm({ ...matchForm, score_opponent: e.target.value })}
                            min="0"
                            className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                          />
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-neutral-medium mb-2">Notes</label>
                        <textarea
                          value={matchForm.notes}
                          onChange={(e) => setMatchForm({ ...matchForm, notes: e.target.value })}
                          rows={3}
                          placeholder="Additional match notes..."
                          className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Staff Attendance */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h3 className="text-lg font-semibold text-neutral-text mb-4">Staff Attendance</h3>
                    {(matchStaff.coach || matchStaff.physio || matchStaff.team_manager) ? (
                      <div className="space-y-3">
                        {matchStaff.coach && (
                          <label className="flex items-center gap-3 text-sm text-neutral-text">
                            <input
                              type="checkbox"
                              checked={staffAttendance[matchStaff.coach.id] ?? true}
                              onChange={(e) =>
                                setStaffAttendance((prev) => ({
                                  ...prev,
                                  [matchStaff.coach!.id]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 rounded border-neutral-light text-primary focus:ring-primary"
                            />
                            Coach: {matchStaff.coach.name}
                          </label>
                        )}
                        {matchStaff.physio && (
                          <label className="flex items-center gap-3 text-sm text-neutral-text">
                            <input
                              type="checkbox"
                              checked={staffAttendance[matchStaff.physio.id] ?? true}
                              onChange={(e) =>
                                setStaffAttendance((prev) => ({
                                  ...prev,
                                  [matchStaff.physio!.id]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 rounded border-neutral-light text-primary focus:ring-primary"
                            />
                            Physio: {matchStaff.physio.name}
                          </label>
                        )}
                        {matchStaff.team_manager && (
                          <label className="flex items-center gap-3 text-sm text-neutral-text">
                            <input
                              type="checkbox"
                              checked={staffAttendance[matchStaff.team_manager.id] ?? true}
                              onChange={(e) =>
                                setStaffAttendance((prev) => ({
                                  ...prev,
                                  [matchStaff.team_manager!.id]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 rounded border-neutral-light text-primary focus:ring-primary"
                            />
                            Team Manager: {matchStaff.team_manager.name}
                          </label>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-medium">No staff assigned to this fixture.</p>
                    )}
                    <p className="text-xs text-neutral-medium mt-3">
                      Uncheck a staff member if they were not available on match day.
                    </p>
                  </div>

                  {/* Player Statistics */}
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-text mb-4">
                      Player Statistics {selectedMatchForStats && '(Only players in selected team can have stats)'}
                    </h3>
                    {selectedMatchForStats && (
                      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          <strong>Note:</strong> Match stats can only be entered for players who are in the selected team for this fixture.
                        </p>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1000px]">
                        <thead className="bg-neutral-light">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-bold text-neutral-text sticky left-0 bg-neutral-light z-10">
                              Player
                            </th>
                            <th className="px-3 py-3 text-center text-xs font-bold text-neutral-text">Tackles Made</th>
                            <th className="px-3 py-3 text-center text-xs font-bold text-neutral-text">Tackles Missed</th>
                            <th className="px-3 py-3 text-center text-xs font-bold text-neutral-text">Ball Handling Errors</th>
                            <th className="px-3 py-3 text-center text-xs font-bold text-neutral-text">Ball Carries</th>
                            <th className="px-3 py-3 text-center text-xs font-bold text-neutral-text">Tries Scored</th>
                            <th className="px-3 py-3 text-center text-xs font-bold text-neutral-text">Minutes Played</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-light">
                          {players.map((player, index) => {
                            const stats = playerStats[player.user_id] || {
                              player_id: player.user_id,
                              tackles_made: '0',
                              tackles_missed: '0',
                              ball_handling_errors: '0',
                              ball_carries: '0',
                              tries_scored: '0',
                              minutes_played: '0',
                            }
                            const isInSelectedTeam = selectedMatchForStats 
                              ? teamSelectionsForStats.some((s: any) => s.player_id === player.user_id)
                              : true
                            
                            return (
                              <tr 
                                key={player.user_id} 
                                className={`${index % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'} ${!isInSelectedTeam && selectedMatchForStats ? 'opacity-50' : ''}`}
                              >
                                <td className="px-4 py-3 text-sm font-medium text-neutral-text sticky left-0 bg-inherit z-10 border-r border-neutral-light">
                                  {player.name}
                                  {!isInSelectedTeam && selectedMatchForStats && (
                                    <span className="ml-2 text-xs text-neutral-medium">(Not in selected team)</span>
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="number"
                                    min="0"
                                    value={stats.tackles_made}
                                    onChange={(e) => updatePlayerStat(player.user_id, 'tackles_made', e.target.value)}
                                    disabled={!isInSelectedTeam && !!selectedMatchForStats}
                                    className="w-full px-2 py-1 border border-neutral-light rounded text-center text-sm disabled:bg-neutral-light disabled:cursor-not-allowed"
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="number"
                                    min="0"
                                    value={stats.tackles_missed}
                                    onChange={(e) => updatePlayerStat(player.user_id, 'tackles_missed', e.target.value)}
                                    disabled={!isInSelectedTeam && !!selectedMatchForStats}
                                    className="w-full px-2 py-1 border border-neutral-light rounded text-center text-sm disabled:bg-neutral-light disabled:cursor-not-allowed"
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="number"
                                    min="0"
                                    value={stats.ball_handling_errors}
                                    onChange={(e) => updatePlayerStat(player.user_id, 'ball_handling_errors', e.target.value)}
                                    disabled={!isInSelectedTeam && !!selectedMatchForStats}
                                    className="w-full px-2 py-1 border border-neutral-light rounded text-center text-sm disabled:bg-neutral-light disabled:cursor-not-allowed"
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="number"
                                    min="0"
                                    value={stats.ball_carries}
                                    onChange={(e) => updatePlayerStat(player.user_id, 'ball_carries', e.target.value)}
                                    disabled={!isInSelectedTeam && !!selectedMatchForStats}
                                    className="w-full px-2 py-1 border border-neutral-light rounded text-center text-sm disabled:bg-neutral-light disabled:cursor-not-allowed"
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="number"
                                    min="0"
                                    value={stats.tries_scored}
                                    onChange={(e) => updatePlayerStat(player.user_id, 'tries_scored', e.target.value)}
                                    disabled={!isInSelectedTeam && !!selectedMatchForStats}
                                    className="w-full px-2 py-1 border border-neutral-light rounded text-center text-sm disabled:bg-neutral-light disabled:cursor-not-allowed"
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
                                    className="w-full px-2 py-1 border border-neutral-light rounded text-center text-sm disabled:bg-neutral-light disabled:cursor-not-allowed"
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t border-neutral-light">
                    <button
                      onClick={handleSaveMatchStats}
                      disabled={savingMatchStats}
                      className="flex-1 px-6 py-3 bg-club-gradient text-white rounded-button hover:opacity-90 transition-all duration-300 font-semibold shadow-soft hover:shadow-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
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
                      className="px-6 py-3 bg-neutral-light text-neutral-text rounded-button hover:bg-neutral-medium transition-all duration-300 font-semibold disabled:opacity-50"
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
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-neutral-text flex items-center gap-2 mb-2">
                  <Trophy className="w-6 h-6 text-primary" />
                  Match Summaries
                </h2>
                <p className="text-neutral-medium">
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
              <div className="text-center py-12 text-neutral-medium">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-neutral-light" />
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
                    className="bg-gradient-to-br from-white to-blue-50/30 rounded-lg border border-neutral-light shadow-soft p-5 hover:shadow-medium transition-all"
                  >
                    {/* Match Header */}
                    <div className="mb-4 pb-4 border-b border-neutral-light">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-neutral-text">
                          vs {summary.opponent}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          summary.isUpcoming
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {summary.isUpcoming ? 'Upcoming' : 'Played'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-neutral-medium">
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
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-neutral-text">Result:</span>
                          <span className={`text-sm font-bold capitalize ${
                            summary.result === 'win' ? 'text-success' :
                            summary.result === 'loss' ? 'text-secondary' : 'text-neutral-medium'
                          }`}>
                            {summary.result}
                          </span>
                        </div>
                        {(summary.scoreOurTeam !== undefined && summary.scoreOpponent !== undefined) && (
                          <div className="mt-2 text-center text-lg font-bold text-neutral-text">
                            {summary.scoreOurTeam} - {summary.scoreOpponent}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stats Summary (for played matches) */}
                    {!summary.isUpcoming && (
                      <div>
                        <h4 className="text-sm font-semibold text-neutral-text mb-3">Match Statistics</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-green-50 rounded-lg p-2 border border-green-200">
                            <div className="text-xs text-neutral-medium">Players with Stats</div>
                            <div className="text-lg font-bold text-success">{summary.playersWithStats}</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
                            <div className="text-xs text-neutral-medium">Total Tries</div>
                            <div className="text-lg font-bold text-info">{summary.totalTries}</div>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-2 border border-purple-200 md:col-span-2">
                            <div className="text-xs text-neutral-medium">Total Tackles</div>
                            <div className="text-lg font-bold text-primary">{summary.totalTackles}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Upcoming Fixture Note */}
                    {summary.isUpcoming && (
                      <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 mb-4">
                        <p className="text-sm text-yellow-800 mb-2">
                          <strong>Upcoming:</strong> Team selection has been recorded for this fixture.
                        </p>
                        <button
                          onClick={() => handleViewTeam(summary.matchId)}
                          disabled={loadingTeamView && viewingTeamForMatch === summary.matchId}
                          className="w-full px-4 py-2 bg-secondary text-white rounded-button font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center justify-center disabled:opacity-50"
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
            <div className="bg-white rounded-card shadow-large max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-neutral-light">
              <div className="p-6 border-b border-neutral-light sticky top-0 bg-white z-10">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-neutral-text">Selected Team</h2>
                  <button
                    onClick={() => {
                      setShowTeamViewModal(false)
                      setViewingTeamForMatch('')
                      setViewedTeamSelection([])
                    }}
                    className="text-neutral-medium hover:text-neutral-text"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                {viewingTeamForMatch && (
                  <p className="text-sm text-neutral-medium mt-2">
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
                  <div className="text-center py-12 text-neutral-medium">
                    <Users className="w-16 h-16 mx-auto mb-4 text-neutral-light" />
                    <p className="text-lg font-semibold">No team selected yet</p>
                    <p className="text-sm mt-2">The coach has not selected a team for this fixture</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Starting Lineup */}
                    <div>
                      <h3 className="text-lg font-bold text-neutral-text mb-4 flex items-center gap-2">
                        <Check className="w-5 h-5 text-success" />
                        Starting Lineup ({viewedTeamSelection.filter((s: any) => s.is_starting && !s.is_substitute).length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {viewedTeamSelection
                          .filter((s: any) => s.is_starting && !s.is_substitute)
                          .map((selection: any) => (
                            <div key={selection.player_id} className="bg-neutral-light/50 rounded-lg p-3 border border-neutral-light">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <p className="font-semibold text-neutral-text">{selection.player_name || 'Unknown Player'}</p>
                                    {selection.is_captain && (
                                      <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                                        <Trophy className="w-3 h-3" />
                                        Captain
                                      </span>
                                    )}
                                    {selection.is_assistant_captain && (
                                      <span className="px-2 py-0.5 bg-gray-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                                        <Trophy className="w-3 h-3" />
                                        Asst. Captain
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-neutral-medium">{selection.position || 'N/A'}</p>
                                </div>
                                {selection.jersey_number && (
                                  <span className="px-3 py-1 bg-primary text-white rounded-full text-sm font-bold">
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
                        <h3 className="text-lg font-bold text-neutral-text mb-4 flex items-center gap-2">
                          <Users className="w-5 h-5 text-primary" />
                          Substitutes ({viewedTeamSelection.filter((s: any) => s.is_substitute).length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {viewedTeamSelection
                            .filter((s: any) => s.is_substitute)
                            .map((selection: any) => (
                              <div key={selection.player_id} className="bg-neutral-light/50 rounded-lg p-3 border border-neutral-light">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <p className="font-semibold text-neutral-text">{selection.player_name || 'Unknown Player'}</p>
                                      {selection.is_captain && (
                                        <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                                          <Trophy className="w-3 h-3" />
                                          Captain
                                        </span>
                                      )}
                                      {selection.is_assistant_captain && (
                                        <span className="px-2 py-0.5 bg-gray-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                                          <Trophy className="w-3 h-3" />
                                          Asst. Captain
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-neutral-medium">{selection.position || 'N/A'}</p>
                                  </div>
                                  {selection.jersey_number && (
                                    <span className="px-3 py-1 bg-primary text-white rounded-full text-sm font-bold">
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
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-neutral-text flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" />
              Select Team for Fixture
            </h2>
            <button
              onClick={handleSave}
              disabled={saving || teamSelections.size === 0}
              className="bg-club-gradient text-white px-6 py-2 rounded-button font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Team Selection'}
            </button>
          </div>

          {/* Match Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-neutral-text mb-2">
              Select Match
            </label>
            <select
              value={selectedMatchId}
              onChange={(e) => {
                setSelectedMatchId(e.target.value)
                setTeamSelections(new Map())
              }}
              className="w-full md:w-auto px-4 py-2 border border-neutral-light rounded-button focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">-- Select a match --</option>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>
                  {new Date(match.match_date).toLocaleDateString()} vs {match.opponent}
                </option>
              ))}
            </select>
          </div>

          {/* Match Info */}
          {selectedMatch && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-neutral-light rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-neutral-medium">Match Date</p>
                  <p className="text-sm font-semibold text-neutral-text">
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
                  <p className="text-xs text-neutral-medium">Opponent</p>
                  <p className="text-sm font-semibold text-neutral-text">{selectedMatch.opponent}</p>
                </div>
              </div>
              {selectedMatch.venue && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-success" />
                  <div>
                    <p className="text-xs text-neutral-medium">Venue</p>
                    <p className="text-sm font-semibold text-neutral-text">{selectedMatch.venue}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedMatchId && (
          <>
            {/* Selection Summary */}
            <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{startingPlayers.length}</p>
                  <p className="text-sm text-neutral-medium">Starting Players</p>
                </div>
                <div className="text-center p-4 bg-secondary/10 rounded-lg">
                  <p className="text-2xl font-bold text-secondary">{substitutes.length}</p>
                  <p className="text-sm text-neutral-medium">Substitutes</p>
                </div>
                <div className="text-center p-4 bg-success/10 rounded-lg">
                  <p className="text-2xl font-bold text-success">{teamSelections.size}</p>
                  <p className="text-sm text-neutral-medium">Total Selected</p>
                </div>
              </div>
            </div>

            {/* Players List */}
            <div className="bg-white rounded-card border border-neutral-light shadow-soft overflow-hidden">
              <div className="p-6 border-b border-neutral-light">
                <h3 className="text-xl font-bold text-neutral-text flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Available Players
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availablePlayers.map((player) => {
                    const isSelected = teamSelections.has(player.user_id)
                    const selection = teamSelections.get(player.user_id)
                    
                    return (
                      <div
                        key={player.user_id}
                        className={`border-2 rounded-lg p-4 transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-medium'
                            : 'border-neutral-light hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-neutral-text">{player.name}</h4>
                            <p className="text-xs text-neutral-medium capitalize">
                              {player.players.position.replace('_', ' ')} • {player.players.category}
                            </p>
                            {player.players.jersey_number && (
                              <p className="text-xs text-neutral-medium">
                                Jersey: #{player.players.jersey_number}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => togglePlayerSelection(player.user_id, player)}
                            className={`p-2 rounded-lg transition-colors ${
                              isSelected
                                ? 'bg-primary text-white'
                                : 'bg-neutral-light text-neutral-medium hover:bg-primary/10'
                            }`}
                          >
                            {isSelected ? (
                              <Check className="w-5 h-5" />
                            ) : (
                              <X className="w-5 h-5" />
                            )}
                          </button>
                        </div>

                        {isSelected && (
                          <div className="space-y-2 mt-3 pt-3 border-t border-neutral-light">
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
                              <label className="text-sm text-neutral-text">Starting Player</label>
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
                              <label className="text-sm text-neutral-text">Substitute</label>
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
                              className="w-full px-2 py-1 text-sm border border-neutral-light rounded focus:outline-none focus:ring-1 focus:ring-primary"
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
                              <label className="text-sm text-neutral-text font-semibold">Captain</label>
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
                              <label className="text-sm text-neutral-text font-semibold">Assistant Captain</label>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* View Team Selection Modal */}
        {showTeamViewModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-card shadow-large max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-neutral-light">
              <div className="p-6 border-b border-neutral-light sticky top-0 bg-white z-10">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-neutral-text">Selected Team</h2>
                  <button
                    onClick={() => {
                      setShowTeamViewModal(false)
                      setViewingTeamForMatch('')
                      setViewedTeamSelection([])
                    }}
                    className="text-neutral-medium hover:text-neutral-text"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                {viewingTeamForMatch && (
                  <p className="text-sm text-neutral-medium mt-2">
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
                  <div className="text-center py-12 text-neutral-medium">
                    <Users className="w-16 h-16 mx-auto mb-4 text-neutral-light" />
                    <p className="text-lg font-semibold">No team selected yet</p>
                    <p className="text-sm mt-2">The coach has not selected a team for this fixture</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Starting Lineup */}
                    <div>
                      <h3 className="text-lg font-bold text-neutral-text mb-4 flex items-center gap-2">
                        <Check className="w-5 h-5 text-success" />
                        Starting Lineup ({viewedTeamSelection.filter((s: any) => s.is_starting && !s.is_substitute).length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {viewedTeamSelection
                          .filter((s: any) => s.is_starting && !s.is_substitute)
                          .map((selection: any) => (
                            <div key={selection.player_id} className="bg-neutral-light/50 rounded-lg p-3 border border-neutral-light">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-neutral-text">{selection.player_name || 'Unknown Player'}</p>
                                  <p className="text-sm text-neutral-medium">{selection.position || 'N/A'}</p>
                                </div>
                                {selection.jersey_number && (
                                  <span className="px-3 py-1 bg-primary text-white rounded-full text-sm font-bold">
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
                        <h3 className="text-lg font-bold text-neutral-text mb-4 flex items-center gap-2">
                          <Users className="w-5 h-5 text-primary" />
                          Substitutes ({viewedTeamSelection.filter((s: any) => s.is_substitute).length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {viewedTeamSelection
                            .filter((s: any) => s.is_substitute)
                            .map((selection: any) => (
                              <div key={selection.player_id} className="bg-neutral-light/50 rounded-lg p-3 border border-neutral-light">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-neutral-text">{selection.player_name || 'Unknown Player'}</p>
                                    <p className="text-sm text-neutral-medium">{selection.position || 'N/A'}</p>
                                  </div>
                                  {selection.jersey_number && (
                                    <span className="px-3 py-1 bg-primary text-white rounded-full text-sm font-bold">
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
      </div>
    </Layout>
  )
}
