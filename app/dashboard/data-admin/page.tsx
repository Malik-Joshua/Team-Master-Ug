'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import BirthdayAlert from '@/components/BirthdayAlert'
import { Users, Activity, BarChart3, Calendar, Trophy, Plus, X, Save, MapPin, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RefreshButton from '@/components/RefreshButton'
import { isActivityPast } from '@/lib/utils'

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
}

export default function DataAdminDashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
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
  const [selectedMatchForStats, setSelectedMatchForStats] = useState<string>('')
  const [teamSelections, setTeamSelections] = useState<any[]>([])
  const [selectedMatchForView, setSelectedMatchForView] = useState<string>('')
  const [loadingTeamSelection, setLoadingTeamSelection] = useState(false)
  const [matchWithStaff, setMatchWithStaff] = useState<any>(null)

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
              .select('id, match_date, opponent, venue, tournament_type, physio_id, team_manager_id, coach_id')
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
          } catch (matchesErr) {
            console.error('Error in matches loading:', matchesErr)
          }
      }
    }
    setLoading(false)
  }, [])

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
          // Only include players who are in the selected team (if team exists) AND have at least one stat entered
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

  const updatePlayerStat = (playerId: string, field: keyof PlayerStats, value: string) => {
    setPlayerStats((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: value,
      },
    }))
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

  return (
    <Layout pageTitle="Team Manager Dashboard">
      <div className="space-y-6">
        <BirthdayAlert />
        {/* Header */}
        <div className="bg-club-gradient rounded-card p-6 text-white shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Team Manager Control Center</h1>
              <p className="text-blue-100">Manage players, training attendance, and match statistics</p>
            </div>
            <RefreshButton onRefresh={loadData} size="sm" className="bg-white/20 hover:bg-white/30 border-white/30 text-white" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="Total Players" value={players.length} icon={Users} iconColor="bg-primary" />
          <StatCard title="Active Players" value={activePlayersCount} icon={Activity} iconColor="bg-success" />
          <StatCard title="Matches Logged" value={matchesCount} icon={Trophy} iconColor="bg-warning" />
          <StatCard title="Training Sessions" value={trainingSessionsCount} icon={Calendar} iconColor="bg-info" />
          <StatCard title="Matches Attended" value={staffMatchesAttended} icon={CheckCircle} iconColor="bg-primary" />
        </div>

        {/* Match Stats Entry Form Modal */}
        {showMatchForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-card shadow-large max-w-6xl w-full border border-neutral-light my-8">
              <div className="p-6 border-b border-neutral-light sticky top-0 bg-white z-10">
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
                    }}
                    className="text-neutral-medium hover:text-neutral-text"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Show selected match info if a match is pre-selected */}
                {selectedMatchForStats && (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-text mb-2">
                          Entering Stats for: vs {matchForm.opponent}
                        </h3>
                        <p className="text-sm text-neutral-medium">
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
                        className="text-neutral-medium hover:text-neutral-text"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Match Selection - Only show if no match is pre-selected */}
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
                        className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      >
                        <option value="">Select a match...</option>
                        {matches.map((match) => (
                          <option key={match.id} value={match.id}>
                            {new Date(match.match_date).toLocaleDateString()} - vs {match.opponent} ({match.tournament_type})
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-sm text-blue-700">
                      <strong>Note:</strong> To create a new fixture or enter match stats, go to the Fixtures page.
                    </p>
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

                {/* Player Statistics */}
                <div>
                  <h3 className="text-lg font-semibold text-neutral-text mb-4">
                    Player Statistics {selectedMatchForStats && '(Only players in selected team can have stats)'}
                  </h3>
                  {selectedMatchForStats && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> Match stats can only be entered for players who are in the selected team for this fixture. 
                        Make sure the team has been selected in the Fixtures page first.
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
                          // Check if player is in selected team (if match is selected)
                          const isInSelectedTeam = selectedMatchForStats 
                            ? teamSelections.some((s: any) => s.player_id === player.user_id)
                            : true // If no match selected, allow all players
                          
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
                    onClick={handleSaveMatch}
                    disabled={saving}
                    className="flex-1 px-6 py-3 bg-club-gradient text-white rounded-button hover:opacity-90 transition-all duration-300 font-semibold shadow-soft hover:shadow-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
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
                    className="px-6 py-3 bg-neutral-light text-neutral-text rounded-button hover:bg-neutral-medium transition-all duration-300 font-semibold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Fixture Modal */}
        {showCreateFixtureForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-card shadow-large max-w-2xl w-full border border-neutral-light">
              <div className="p-6 border-b border-neutral-light">
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

              <div className="p-6 space-y-4">
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

                <div className="border-t border-neutral-light pt-4 mt-4">
                  <h3 className="text-lg font-semibold text-neutral-text mb-4">Assign Staff for Game Day</h3>
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

        {/* View Selected Team for Fixture - Summary */}
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <h2 className="text-2xl font-bold text-neutral-text mb-6 flex items-center">
            <Trophy className="w-6 h-6 mr-2 text-primary" />
            View Selected Team for Fixture
          </h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-medium mb-2">
              Select Match/Fixture
            </label>
            <select
              value={selectedMatchForView}
              onChange={(e) => {
                setSelectedMatchForView(e.target.value)
                if (e.target.value) {
                  loadTeamSelection(e.target.value)
                } else {
                  setTeamSelections([])
                }
              }}
              className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            >
              <option value="">Select a match...</option>
              {matches.map((match) => {
                const today = new Date().toISOString().split('T')[0]
                const isUpcoming = match.match_date >= today
                return (
                  <option key={match.id} value={match.id}>
                    {new Date(match.match_date).toLocaleDateString()} - vs {match.opponent} ({match.tournament_type}) {isUpcoming ? '(Upcoming)' : '(Played)'}
                  </option>
                )
              })}
            </select>
          </div>

          {loadingTeamSelection && selectedMatchForView && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          )}

          {teamSelections.length > 0 && !loadingTeamSelection && (
            <div className="space-y-4">
              {/* Staff Assignment Information */}
              {matchWithStaff && (matchWithStaff.physio || matchWithStaff.team_manager || matchWithStaff.coach) && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-6">
                  <h3 className="text-lg font-semibold text-neutral-text mb-3">Assigned Staff for Game Day</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {matchWithStaff.physio && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-medium">Physiotherapist:</span>
                        <span className="text-sm text-neutral-text font-semibold">
                          {typeof matchWithStaff.physio === 'object' ? matchWithStaff.physio.name : 'Assigned'}
                        </span>
                      </div>
                    )}
                    {matchWithStaff.team_manager && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-medium">Team Manager:</span>
                        <span className="text-sm text-neutral-text font-semibold">
                          {typeof matchWithStaff.team_manager === 'object' ? matchWithStaff.team_manager.name : 'Assigned'}
                        </span>
                      </div>
                    )}
                    {matchWithStaff.coach && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-medium">Coach:</span>
                        <span className="text-sm text-neutral-text font-semibold">
                          {typeof matchWithStaff.coach === 'object' ? matchWithStaff.coach.name : 'Assigned'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <p className="text-2xl font-bold text-primary">
                    {teamSelections.filter((s: any) => s.is_starting && !s.is_substitute).length}
                  </p>
                  <p className="text-sm text-neutral-medium">Starting Players</p>
                </div>
                <div className="text-center p-4 bg-secondary/10 rounded-lg">
                  <p className="text-2xl font-bold text-secondary">
                    {teamSelections.filter((s: any) => s.is_substitute).length}
                  </p>
                  <p className="text-sm text-neutral-medium">Substitutes</p>
                </div>
                <div className="text-center p-4 bg-success/10 rounded-lg">
                  <p className="text-2xl font-bold text-success">{teamSelections.length}</p>
                  <p className="text-sm text-neutral-medium">Total Selected</p>
                </div>
              </div>

              {/* Starting Lineup Summary */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-text mb-4">Starting Lineup</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {teamSelections
                    .filter((s: any) => s.is_starting && !s.is_substitute)
                    .map((selection: any) => (
                      <div key={selection.player_id} className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                        <p className="font-semibold text-neutral-text">{selection.player_name || 'Unknown'}</p>
                        {selection.position && (
                          <p className="text-sm text-neutral-medium capitalize">
                            {selection.position.replace('_', ' ')}
                          </p>
                        )}
                        {selection.jersey_number && (
                          <p className="text-sm text-neutral-medium">Jersey #{selection.jersey_number}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Substitutes Summary */}
              {teamSelections.filter((s: any) => s.is_substitute).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-neutral-text mb-4">Substitutes</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {teamSelections
                      .filter((s: any) => s.is_substitute)
                      .map((selection: any) => (
                        <div key={selection.player_id} className="p-3 bg-secondary/5 border border-secondary/20 rounded-lg">
                          <p className="font-semibold text-neutral-text">{selection.player_name || 'Unknown'}</p>
                          {selection.position && (
                            <p className="text-sm text-neutral-medium capitalize">
                              {selection.position.replace('_', ' ')}
                            </p>
                          )}
                          {selection.jersey_number && (
                            <p className="text-sm text-neutral-medium">Jersey #{selection.jersey_number}</p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {teamSelections.length === 0 && !loadingTeamSelection && selectedMatchForView && (
            <div className="text-center py-8 text-neutral-medium">
              <p>No team has been selected for this match yet.</p>
              <p className="text-sm mt-2">The coach will select the team on the Fixtures page.</p>
            </div>
          )}

          {!selectedMatchForView && (
            <div className="text-center py-8 text-neutral-medium">
              <p>Select a match above to view the selected team.</p>
            </div>
          )}
        </div>

        {/* Recent Gym Schedules */}
        {recentGymSchedules.length > 0 && (
          <div className="bg-white rounded-card border border-neutral-light shadow-soft">
            <div className="p-6 border-b border-neutral-light">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-text flex items-center gap-2">
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
                  <div key={schedule.id} className="border border-neutral-light rounded-lg p-4 hover:bg-neutral-light/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-neutral-text">
                            {schedule.description}
                          </h4>
                          <span className="px-2 py-1 bg-secondary/10 text-secondary rounded text-xs font-medium">
                            Gym Session
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-neutral-medium">
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
                            <div className="mt-2 pt-2 border-t border-neutral-light">
                              <p className="text-xs font-semibold text-neutral-medium mb-1">Exercises:</p>
                              <p className="text-sm text-neutral-text whitespace-pre-line">{schedule.exercises}</p>
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

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift">
            <div className="flex items-center space-x-4">
              <div className="bg-primary w-12 h-12 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-text">Manage Players</h3>
                <p className="text-sm text-neutral-medium">View and edit player information</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift">
            <div className="flex items-center space-x-4">
              <div className="bg-success w-12 h-12 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-text">Training Attendance</h3>
                <p className="text-sm text-neutral-medium">Record and track training sessions</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift">
            <div className="flex items-center space-x-4">
              <div className="bg-warning w-12 h-12 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-text">Match Statistics</h3>
                <p className="text-sm text-neutral-medium">Log match performance data</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
