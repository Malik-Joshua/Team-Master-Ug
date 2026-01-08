'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import BirthdayAlert from '@/components/BirthdayAlert'
import { Users, Activity, Calendar, Trophy, MapPin, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RefreshButton from '@/components/RefreshButton'

interface Player {
  user_id: string
  name: string
  position?: string
}

export default function ClubCaptainDashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<Player[]>([])
  const [activePlayersCount, setActivePlayersCount] = useState(0)
  const [matchesCount, setMatchesCount] = useState(0)
  const [trainingSessionsCount, setTrainingSessionsCount] = useState(0)
  const [recentGymSchedules, setRecentGymSchedules] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [teamSelections, setTeamSelections] = useState<any[]>([])
  const [selectedMatchForView, setSelectedMatchForView] = useState<string>('')
  const [loadingTeamSelection, setLoadingTeamSelection] = useState(false)

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
              const activePlayers = playersData.players.filter((p: any) => p.status === 'active').length
              setActivePlayersCount(activePlayers)
            }
          }
        } catch (playersError) {
          console.error('Error fetching players:', playersError)
        }

        // Fetch matches count using API route
        try {
          const statsResponse = await fetch('/api/admin/statistics')
          if (statsResponse.ok) {
            const statsData = await statsResponse.json()
            setMatchesCount(statsData.totalMatches || 0)
            setTrainingSessionsCount(statsData.totalTrainingSessions || 0)
          }
        } catch (statsError) {
          console.error('Error fetching statistics:', statsError)
        }

        // Load matches for viewing
        try {
          const { data: matchesData, error: matchesError } = await supabase
            .from('matches')
            .select('id, match_date, opponent, venue, tournament_type')
            .order('match_date', { ascending: false })
            .limit(100)

          if (matchesError) {
            console.error('Error loading matches:', matchesError)
          } else if (matchesData) {
            setMatches(matchesData)
          }
        } catch (matchesErr) {
          console.error('Error in matches loading:', matchesErr)
        }

        // Load recent gym schedules
        try {
          const { data: gymSchedules, error: gymError } = await supabase
            .from('gym_schedules')
            .select(`
              *,
              coach:user_profiles!gym_schedules_coach_id_fkey(name)
            `)
            .order('schedule_date', { ascending: false })
            .limit(5)

          if (!gymError && gymSchedules) {
            setRecentGymSchedules(gymSchedules)
          }
        } catch (gymErr) {
          console.error('Error loading gym schedules:', gymErr)
        }
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const loadTeamSelection = async (matchId: string) => {
    if (!matchId) return
    
    setLoadingTeamSelection(true)
    try {
      const response = await fetch(`/api/fixtures/team-selection?matchId=${matchId}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.selections && data.selections.length > 0) {
          setTeamSelections(data.selections)
        } else {
          setTeamSelections([])
        }
      } else {
        setTeamSelections([])
      }
    } catch (error) {
      console.error('Error loading team selection:', error)
      setTeamSelections([])
    } finally {
      setLoadingTeamSelection(false)
    }
  }

  if (loading) {
    return (
      <Layout pageTitle="Club Captain Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!user) return null

  return (
    <Layout pageTitle="Club Captain Dashboard">
      <div className="space-y-6">
        <BirthdayAlert />
        {/* Header */}
        <div className="bg-club-gradient rounded-card p-6 text-white shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Club Captain Dashboard</h1>
              <p className="text-blue-100">View team information, matches, and training schedules (Read-only)</p>
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
        </div>

        {/* View Selected Team for Fixture */}
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

        {/* Read-only Notice */}
        <div className="bg-blue-50 rounded-card p-6 border border-blue-200">
          <div className="flex items-start gap-3">
            <Eye className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Read-Only Access</h3>
              <p className="text-sm text-blue-800">
                As Club Captain, you have view-only access to team information. You can view players, matches, training schedules, and team selections, but cannot edit or create new records. 
                You can send messages to players, coaches, admins, and data managers, and you can add performance resources for players.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
