'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { Users, Check, X, Save, Calendar, MapPin, Trophy, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db-helpers'

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
}

interface TeamSelection {
  player_id: string
  position?: string
  jersey_number?: number
  is_starting: boolean
  is_substitute: boolean
  notes?: string
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

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        
        if (!authUser) {
          router.push('/dev-login')
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

        // Load matches - for data_admin, load all matches; for coach/admin, load upcoming only
        let matchesData
        if (profile.role === 'data_admin') {
          // Data admin can see all matches
          const { data: allMatches, error: matchesError } = await supabase
            .from('matches')
            .select('id, match_date, opponent, venue, tournament_type')
            .order('match_date', { ascending: false })
          
          if (matchesError) {
            console.error('Error loading matches:', matchesError)
            matchesData = []
          } else {
            matchesData = allMatches || []
          }
        } else {
          matchesData = await db.getUpcomingMatches()
        }

        setMatches(matchesData)

        // Only load players for coach/admin (data_admin doesn't select teams)
        if (profile.role !== 'data_admin') {
          const playersData = await db.getAvailablePlayers()
          // Transform players data to match Player interface
          const transformedPlayers = (playersData || []).map((p: any) => ({
            user_id: p.user_id,
            name: p.name,
            email: p.email,
            status: p.status,
            players: Array.isArray(p.players) ? p.players[0] : p.players,
          }))
          setAvailablePlayers(transformedPlayers as Player[])
        }

        if (matchesData.length > 0) {
          setSelectedMatchId(matchesData[0].id)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  useEffect(() => {
    const loadExistingSelection = async () => {
      if (!selectedMatchId) return

      try {

        const selections = await db.getFixtureTeamSelection(selectedMatchId)
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
            notes: sel.notes,
          })
        })
        setTeamSelections(selectionsMap)
      } catch (error) {
        console.error('Error loading existing selection:', error)
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
      await db.saveFixtureTeamSelection(selectedMatchId, selectionsArray)
      
      alert('Team selection saved successfully!')
      // Reload existing selection
      const selections = await db.getFixtureTeamSelection(selectedMatchId)
      setExistingSelection(selections)
    } catch (error) {
      console.error('Error saving team selection:', error)
      alert('Error saving team selection. Please try again.')
    } finally {
      setSaving(false)
    }
  }

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

  // For data_admin, show fixtures list with create and match stats options
  if (user?.role === 'data_admin') {
    const today = new Date().toISOString().split('T')[0]
    
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
                <button
                  onClick={() => {
                    // Navigate to create fixture - we'll add this functionality
                    alert('Create Fixture functionality - to be implemented in modal or separate page')
                  }}
                  className="bg-primary text-white px-6 py-2 rounded-button font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Fixture
                </button>
                <button
                  onClick={() => {
                    // Navigate to enter match stats - we'll add this functionality
                    alert('Enter Match Stats functionality - to be implemented in modal or separate page')
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
                  const isUpcoming = match.match_date >= today
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
                        {isUpcoming && (
                          <button
                            onClick={() => {
                              // Navigate to enter match stats for this fixture
                              alert(`Enter Match Stats for ${match.opponent} - to be implemented`)
                            }}
                            className="ml-4 px-4 py-2 bg-primary text-white rounded-button font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Match Stats
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Layout>
    )
  }

  // For coach/admin, show team selection interface
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
      </div>
    </Layout>
  )
}
