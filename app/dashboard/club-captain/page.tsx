'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import BirthdayAlert from '@/components/BirthdayAlert'
import { Users, Activity, Calendar, Trophy, MapPin, Eye, AlertCircle, Dumbbell, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RefreshButton from '@/components/RefreshButton'
import Link from 'next/link'

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
  const [recentTrainingSchedules, setRecentTrainingSchedules] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [teamSelections, setTeamSelections] = useState<any[]>([])
  const [selectedMatchForView, setSelectedMatchForView] = useState<string>('')
  const [loadingTeamSelection, setLoadingTeamSelection] = useState(false)
  const [playerFixtureSelection, setPlayerFixtureSelection] = useState<any>(null)
  const [loadingPlayerFixture, setLoadingPlayerFixture] = useState(false)
  const [activeInjuriesView, setActiveInjuriesView] = useState<any[]>([])
  const [loadingActiveInjuries, setLoadingActiveInjuries] = useState(false)
  const [bestGymMetrics, setBestGymMetrics] = useState<any>(null)
  const [loadingBestMetrics, setLoadingBestMetrics] = useState(false)
  const [topPerformers, setTopPerformers] = useState<any[]>([])

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (!authUser) {
      setLoading(false)
      return
    }

    if (authUser) {
      // First, get the current user's profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .single()

      if (profile) {
        // If user is a player, check if they have a linked club_captain account
        if (profile.role === 'player') {
          const { data: clubCaptainProfile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('role', 'club_captain')
            .eq('linked_player_id', authUser.id)
            .single()
          
          // If club captain account exists, use that profile for display
          if (clubCaptainProfile) {
            // Store the club captain profile with reference to player profile
            setUser({ ...clubCaptainProfile, linkedPlayerProfile: profile })
          } else {
            // Player doesn't have a linked club captain account - redirect to player dashboard
            setLoading(false)
            window.location.href = '/dashboard'
            return
          }
        } else if (profile.role === 'club_captain') {
          // User is logged in with club captain account directly
          setUser(profile)
        } else {
          // User doesn't have club captain access - redirect
          setLoading(false)
          window.location.href = '/dashboard'
          return
        }

        // Get the linked player ID for fixture selection check
        const linkedPlayerId = profile.role === 'player' ? authUser.id : (profile.linked_player_id || null)

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
            setTopPerformers(statsData.topPerformers || [])
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

        // Load recent gym schedules using API route to bypass RLS
        try {
          const gymSchedulesResponse = await fetch('/api/gym-schedules', {
            cache: 'no-store',
          })
          
          if (gymSchedulesResponse.ok) {
            const gymSchedulesData = await gymSchedulesResponse.json()
            if (gymSchedulesData.schedules && gymSchedulesData.schedules.length > 0) {
              // Get the 5 most recent schedules
              const recentSchedules = gymSchedulesData.schedules
                .sort((a: any, b: any) => 
                  new Date(b.schedule_date).getTime() - new Date(a.schedule_date).getTime()
                )
                .slice(0, 5)
              setRecentGymSchedules(recentSchedules)
            } else {
              setRecentGymSchedules([])
            }
          } else {
            console.error('Error fetching gym schedules via API:', gymSchedulesResponse.status)
            setRecentGymSchedules([])
          }
        } catch (gymErr) {
          console.error('Error loading gym schedules:', gymErr)
          setRecentGymSchedules([])
        }

        // Load recent training schedules
        try {
          const { data: trainingSchedules, error: trainingError } = await supabase
            .from('training_sessions')
            .select('*')
            .order('session_date', { ascending: false })
            .limit(5)

          if (!trainingError && trainingSchedules) {
            setRecentTrainingSchedules(trainingSchedules)
          }
        } catch (trainingErr) {
          console.error('Error loading training schedules:', trainingErr)
        }

        // Load player fixture selection if they have a linked player account
        if (linkedPlayerId) {
          setLoadingPlayerFixture(true)
          try {
            const response = await fetch(`/api/fixtures/team-selection?playerId=${linkedPlayerId}`)
            if (response.ok) {
              const data = await response.json()
              if (data.isSelected || data.match) {
                setPlayerFixtureSelection({
                  isSelected: data.isSelected || false,
                  selection: data.selection,
                  match: data.match,
                  teammates: data.teammates || [],
                  captain: data.captain,
                  assistantCaptain: data.assistantCaptain,
                })
              } else {
                setPlayerFixtureSelection(null)
              }
            } else {
              setPlayerFixtureSelection(null)
            }
          } catch (error) {
            console.error('Error loading player fixture selection:', error)
            setPlayerFixtureSelection(null)
          } finally {
            setLoadingPlayerFixture(false)
          }
        }

        // Load active injuries (read-only view)
        setLoadingActiveInjuries(true)
        try {
          const response = await fetch('/api/admin/injuries', {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            }
          })
          if (response.ok) {
            const data = await response.json()
            setActiveInjuriesView(data.injuries || [])
          } else {
            setActiveInjuriesView([])
          }
        } catch (error) {
          console.error('Error loading active injuries:', error)
          setActiveInjuriesView([])
        } finally {
          setLoadingActiveInjuries(false)
        }

        // Load best gym metrics
        setLoadingBestMetrics(true)
        try {
          const { db } = await import('@/lib/db-helpers')
          const bestMetrics = await db.getBestGymMetricsOfWeek()
          setBestGymMetrics(bestMetrics)
        } catch (error) {
          console.error('Error loading best gym metrics:', error)
          setBestGymMetrics(null)
        } finally {
          setLoadingBestMetrics(false)
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
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[20px] font-medium text-tm-text-1">Club Captain Dashboard</h1>
            <p className="mt-[2px] text-[13px] text-tm-text-3">View team information, matches, and training schedules (Read-only)</p>
          </div>
          <RefreshButton onRefresh={loadData} size="sm" />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
          <StatCard title="Total Players" value={players.length} icon={Users} iconColor="bg-primary" href="/players" />
        </div>

        {/* Player Fixture Selection (if they're selected) */}
        {user.linkedPlayerProfile && (
          <>
            {loadingPlayerFixture ? (
              <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              </div>
            ) : playerFixtureSelection ? (
              <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-full bg-tm-secondary flex items-center justify-center">
                      <Trophy className="w-8 h-8 text-tm-on-secondary" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-tm-text-1 mb-3">Your Upcoming Fixture</h3>
                    {playerFixtureSelection.isSelected ? (
                      <div className="bg-success/10 border-2 border-success rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-3">
                          <Trophy className="w-5 h-5 text-success" />
                          <div>
                            <h4 className="text-sm font-semibold text-tm-text-1 mb-1">You have been selected!</h4>
                            <p className="text-xs text-tm-text-3">
                              {playerFixtureSelection.selection?.is_starting && !playerFixtureSelection.selection?.is_substitute
                                ? 'Starting Lineup'
                                : playerFixtureSelection.selection?.is_substitute
                                ? 'Substitute'
                                : 'Selected'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-3">
                          <Trophy className="w-5 h-5 text-warning" />
                          <div>
                            <h4 className="text-sm font-semibold text-tm-text-1 mb-1">You have not been selected</h4>
                            <p className="text-xs text-tm-text-3">Check back later for updates on team selection.</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="bg-tm-surface-hover rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-tm-text-3 uppercase mb-1">Match Date</p>
                          <p className="text-sm font-semibold text-tm-text-1">
                            {new Date(playerFixtureSelection.match.match_date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-tm-text-3 uppercase mb-1">Opponent</p>
                          <p className="text-sm font-semibold text-tm-text-1">{playerFixtureSelection.match.opponent}</p>
                        </div>
                        {playerFixtureSelection.match.venue && (
                          <div>
                            <p className="text-xs font-semibold text-tm-text-3 uppercase mb-1">Venue</p>
                            <p className="text-sm font-semibold text-tm-text-1">{playerFixtureSelection.match.venue}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Show Captain and Assistant Captain */}
                    {(playerFixtureSelection.captain || playerFixtureSelection.assistantCaptain) && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-tm-text-1 mb-3">Team Leadership</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {playerFixtureSelection.captain && (
                            <div className="bg-warning/10 border-2 border-warning/40 rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-warning" />
                                <div>
                                  <p className="text-xs font-semibold text-warning uppercase">Team Captain</p>
                                  <p className="text-sm font-bold text-warning">{playerFixtureSelection.captain.name}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {playerFixtureSelection.assistantCaptain && (
                            <div className="bg-tm-surface-hover border-2 border-tm-border rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-tm-text-2" />
                                <div>
                                  <p className="text-xs font-semibold text-tm-text-1 uppercase">Assistant Captain</p>
                                  <p className="text-sm font-bold text-tm-text-1">{playerFixtureSelection.assistantCaptain.name}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Show Teammates */}
                    {playerFixtureSelection.teammates && playerFixtureSelection.teammates.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-tm-border">
                        <h4 className="text-sm font-semibold text-tm-text-1 mb-3">Your Teammates ({playerFixtureSelection.teammates.length})</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {playerFixtureSelection.teammates.map((teammate: any) => (
                            <div key={teammate.player_id} className="bg-tm-surface-hover rounded-lg p-2 text-sm">
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="font-medium text-tm-text-1 text-xs truncate">{teammate.name}</span>
                                    {teammate.is_captain && (
                                      <span className="px-1.5 py-0.5 bg-warning/100 text-white text-xs font-bold rounded flex-shrink-0">
                                        <Trophy className="w-3 h-3 inline" />
                                      </span>
                                    )}
                                    {teammate.is_assistant_captain && (
                                      <span className="px-1.5 py-0.5 bg-tm-surface-hover0 text-white text-xs font-bold rounded flex-shrink-0">
                                        <Trophy className="w-3 h-3 inline" />
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {teammate.jersey_number && (
                                  <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0">#{teammate.jersey_number}</span>
                                )}
                              </div>
                              {teammate.position && (
                                <p className="text-xs text-tm-text-3 mt-1 capitalize">{teammate.position.replace(/_/g, ' ')}</p>
                              )}
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {teammate.is_starting && !teammate.is_substitute && (
                                  <span className="text-xs bg-success/20 text-success px-1.5 py-0.5 rounded">Starting</span>
                                )}
                                {teammate.is_substitute && (
                                  <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">Sub</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* View Selected Team for Fixture */}
        <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
          <h2 className="text-2xl font-bold text-tm-text-1 mb-6 flex items-center">
            <Trophy className="w-6 h-6 mr-2 text-primary" />
            View Selected Team for Fixture
          </h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-tm-text-3 mb-2">
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
              className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
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
                  <p className="text-sm text-tm-text-3">Starting Players</p>
                </div>
                <div className="text-center p-4 bg-secondary/10 rounded-lg">
                  <p className="text-2xl font-bold text-secondary">
                    {teamSelections.filter((s: any) => s.is_substitute).length}
                  </p>
                  <p className="text-sm text-tm-text-3">Substitutes</p>
                </div>
                <div className="text-center p-4 bg-success/10 rounded-lg">
                  <p className="text-2xl font-bold text-success">{teamSelections.length}</p>
                  <p className="text-sm text-tm-text-3">Total Selected</p>
                </div>
              </div>

              {/* Starting Lineup Summary */}
              <div>
                <h3 className="text-lg font-semibold text-tm-text-1 mb-4">Starting Lineup</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {teamSelections
                    .filter((s: any) => s.is_starting && !s.is_substitute)
                    .map((selection: any) => (
                      <div key={selection.player_id} className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                        <p className="font-semibold text-tm-text-1">{selection.player_name || 'Unknown'}</p>
                        {selection.position && (
                          <p className="text-sm text-tm-text-3 capitalize">
                            {selection.position.replace('_', ' ')}
                          </p>
                        )}
                        {selection.jersey_number && (
                          <p className="text-sm text-tm-text-3">Jersey #{selection.jersey_number}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Substitutes Summary */}
              {teamSelections.filter((s: any) => s.is_substitute).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-tm-text-1 mb-4">Substitutes</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {teamSelections
                      .filter((s: any) => s.is_substitute)
                      .map((selection: any) => (
                        <div key={selection.player_id} className="p-3 bg-secondary/5 border border-secondary/20 rounded-lg">
                          <p className="font-semibold text-tm-text-1">{selection.player_name || 'Unknown'}</p>
                          {selection.position && (
                            <p className="text-sm text-tm-text-3 capitalize">
                              {selection.position.replace('_', ' ')}
                            </p>
                          )}
                          {selection.jersey_number && (
                            <p className="text-sm text-tm-text-3">Jersey #{selection.jersey_number}</p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {teamSelections.length === 0 && !loadingTeamSelection && selectedMatchForView && (
            <div className="text-center py-8 text-tm-text-3">
              <p>No team has been selected for this match yet.</p>
              <p className="text-sm mt-2">The coach will select the team on the Fixtures page.</p>
            </div>
          )}

          {!selectedMatchForView && (
            <div className="text-center py-8 text-tm-text-3">
              <p>Select a match above to view the selected team.</p>
            </div>
          )}
        </div>

        {/* Active Injuries View (Read-Only) */}
        {activeInjuriesView.length > 0 && (
          <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft">
            <div className="p-6 border-b border-tm-border">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-tm-text-1 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-secondary" />
                  Active Player Injuries
                </h3>
                <span className="text-sm text-tm-text-3">{activeInjuriesView.length} active injury{activeInjuriesView.length !== 1 ? 'ies' : ''}</span>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {activeInjuriesView.map((injury: any) => {
                  const playerName = injury.player?.name || 'Unknown Player'
                  const returnDate = injury.return_to_play_date || injury.return_to_training_date
                  return (
                    <div key={injury.id} className="border border-secondary/20 bg-secondary/5 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-tm-text-1 text-lg mb-1">{playerName}</h4>
                          <p className="text-sm text-tm-text-3">Injured on {new Date(injury.injury_date).toLocaleDateString()}</p>
                        </div>
                        <span className="px-3 py-1 bg-secondary text-tm-on-secondary rounded-full text-xs font-medium">
                          ACTIVE
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-tm-text-3 uppercase mb-1">Cause</p>
                          <p className="text-sm text-tm-text-1">{injury.cause}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-tm-text-3 uppercase mb-1">Diagnosis</p>
                          <p className="text-sm text-tm-text-1 font-medium">{injury.diagnosis}</p>
                        </div>
                        {returnDate && (
                          <div>
                            <p className="text-xs font-semibold text-tm-text-3 uppercase mb-1">Expected Return</p>
                            <p className="text-sm text-tm-text-1 font-medium">
                              {new Date(returnDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Best Gym Metrics of the Week */}
        {bestGymMetrics && (
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Trophy className="w-6 h-6 text-warning mr-2" />
                <h3 className="text-xl font-bold text-tm-text-1">Best Gym Metrics of the Week</h3>
              </div>
              {bestGymMetrics.weekStart && bestGymMetrics.weekEnd && (
                <div className="text-sm text-tm-text-3">
                  {new Date(bestGymMetrics.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(bestGymMetrics.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              )}
            </div>
            
            {loadingBestMetrics ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (!bestGymMetrics.benchPress && !bestGymMetrics.squat && !bestGymMetrics.deadlift && !bestGymMetrics.pullUp) ? (
              <div className="text-center py-8">
                <Dumbbell className="w-12 h-12 mx-auto mb-4 text-tm-text-3" />
                <p className="text-tm-text-3">No gym metrics recorded for this week yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {bestGymMetrics.benchPress && (
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 border border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-tm-text-3 uppercase tracking-wide">Bench Press</h4>
                      <Dumbbell className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-3xl font-bold text-tm-text-1">
                      {bestGymMetrics.benchPress.value || 0} kg
                    </p>
                    <p className="text-sm text-primary font-medium mt-1">{bestGymMetrics.benchPress.playerName || 'N/A'}</p>
                  </div>
                )}
                {bestGymMetrics.squat && (
                  <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-lg p-6 border border-secondary/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-tm-text-3 uppercase tracking-wide">Squat</h4>
                      <Dumbbell className="w-5 h-5 text-secondary" />
                    </div>
                    <p className="text-3xl font-bold text-tm-text-1">
                      {bestGymMetrics.squat.value || 0} kg
                    </p>
                    <p className="text-sm text-secondary font-medium mt-1">{bestGymMetrics.squat.playerName || 'N/A'}</p>
                  </div>
                )}
                {bestGymMetrics.deadlift && (
                  <div className="bg-gradient-to-br from-success/10 to-success/5 rounded-lg p-6 border border-success/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-tm-text-3 uppercase tracking-wide">Deadlift</h4>
                      <Dumbbell className="w-5 h-5 text-success" />
                    </div>
                    <p className="text-3xl font-bold text-tm-text-1">
                      {bestGymMetrics.deadlift.value || 0} kg
                    </p>
                    <p className="text-sm text-success font-medium mt-1">{bestGymMetrics.deadlift.playerName || 'N/A'}</p>
                  </div>
                )}
                {bestGymMetrics.pullUp && (
                  <div className="bg-gradient-to-br from-info/10 to-info/5 rounded-lg p-6 border border-info/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-tm-text-3 uppercase tracking-wide">Pull-ups</h4>
                      <Dumbbell className="w-5 h-5 text-info" />
                    </div>
                    <p className="text-3xl font-bold text-tm-text-1">
                      {bestGymMetrics.pullUp.value || 0} reps
                    </p>
                    <p className="text-sm text-info font-medium mt-1">{bestGymMetrics.pullUp.playerName || 'N/A'}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Top Performers Table */}
        {topPerformers.length > 0 && (
          <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft overflow-hidden">
            <div className="p-6 border-b border-tm-border">
              <h3 className="text-xl font-bold text-tm-text-1">Top Performers</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-tm-surface-hover">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Player</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Position</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Games</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Tries</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Tackles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tm-border">
                  {topPerformers.map((player: any) => (
                    <tr key={player.playerId || player.user_id || player.id} className="hover:bg-tm-surface-hover transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-tm-text-1">{player.name || 'Unknown'}</td>
                      <td className="px-6 py-4 text-sm text-tm-text-3 capitalize">
                        {player.position?.replace(/_/g, ' ') || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-tm-text-3">{player.totalMatches || 0}</td>
                      <td className="px-6 py-4 text-sm text-tm-text-3">{player.totalTries || 0}</td>
                      <td className="px-6 py-4 text-sm text-tm-text-3">{player.totalTackles || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-tm-border">
              <Link
                href="/players"
                className="px-6 py-2 bg-tm-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-opacity inline-block"
              >
                View All Players
              </Link>
            </div>
          </div>
        )}

        {/* Recent Training Schedules */}
        {recentTrainingSchedules.length > 0 && (
          <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft">
            <div className="p-6 border-b border-tm-border">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-tm-text-1 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Recent Training Schedules
                </h3>
                <Link
                  href="/training"
                  className="text-primary hover:underline text-sm font-medium"
                >
                  View All →
                </Link>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {recentTrainingSchedules.map((session: any) => (
                  <div key={session.id} className="border border-tm-border rounded-lg p-4 hover:bg-tm-surface-hover/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-tm-text-1">
                            {session.description || `Training Session ${session.session_number}`}
                          </h4>
                          <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                            Session #{session.session_number}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-tm-text-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(session.session_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                          {session.session_time && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {session.session_time}
                            </div>
                          )}
                          {session.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {session.location}
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

        {/* Recent Gym Schedules */}
        {recentGymSchedules.length > 0 && (
          <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft">
            <div className="p-6 border-b border-tm-border">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-tm-text-1 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-secondary" />
                  Recent Gym Schedules
                </h3>
                <Link
                  href="/training"
                  className="text-secondary hover:underline text-sm font-medium"
                >
                  View All →
                </Link>
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

        {/* Read-only Notice */}
        <div className="bg-tm-surface-hover rounded-card p-6 border border-tm-border">
          <div className="flex items-start gap-3">
            <Eye className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-primary mb-2">Read-Only Access</h3>
              <p className="text-sm text-primary">
                As Club Captain, you have view-only access to team information. You can view players, matches, training schedules, and team selections, but cannot edit or create new records. 
                You can send messages to players, coaches, admins, and data managers (but not finance), and you can add performance resources for players.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
