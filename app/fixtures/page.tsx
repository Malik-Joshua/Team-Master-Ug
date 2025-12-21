'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { Users, Check, X, Save, Calendar, MapPin, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db-helpers'
import Link from 'next/link'

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
      if (typeof window !== 'undefined') {
        const devUser = localStorage.getItem('dev_user')
        if (devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            
            // Mock data for dev mode
            setMatches([
              {
                id: '1',
                match_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                opponent: 'Kampala RFC',
                venue: 'Home Ground',
                tournament_type: 'league',
              },
              {
                id: '2',
                match_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                opponent: 'Heathens RFC',
                venue: 'Away',
                tournament_type: 'uganda_cup',
              },
            ])
            
            setAvailablePlayers([
              {
                user_id: 'player1',
                name: 'John Doe',
                email: 'john@example.com',
                status: 'active',
                players: { position: 'fly_half', category: 'backs', jersey_number: 10 },
              },
              {
                user_id: 'player2',
                name: 'Jane Smith',
                email: 'jane@example.com',
                status: 'active',
                players: { position: 'prop', category: 'forwards', jersey_number: 1 },
              },
              {
                user_id: 'player3',
                name: 'Mike Johnson',
                email: 'mike@example.com',
                status: 'active',
                players: { position: 'winger', category: 'backs', jersey_number: 11 },
              },
            ])
            
            setLoading(false)
            return
          } catch (e) {
            console.error('Error parsing dev user data:', e)
          }
        }
      }

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

        // Allow coach, admin, and data_admin (team manager) to access
        if (!profile || (profile.role !== 'coach' && profile.role !== 'admin' && profile.role !== 'data_admin')) {
          router.push('/dashboard')
          return
        }

        setUser(profile)

        // Load matches
        const matchesData = await db.getUpcomingMatches()
        setMatches(matchesData)

        // Load players via API route (bypasses RLS)
        const playersResponse = await fetch('/api/players?role=player&status=active&includePlayerData=true')
        if (playersResponse.ok) {
          const playersData = await playersResponse.json()
          if (playersData.players && playersData.players.length > 0) {
            // Transform players data to match Player interface
            const transformedPlayers = playersData.players
              .filter((p: any) => p.players) // Only include players with position data
              .map((p: any) => ({
                user_id: p.user_id,
                name: p.name,
                email: p.email,
                status: p.status,
                players: Array.isArray(p.players) ? p.players[0] : p.players,
              }))
            setAvailablePlayers(transformedPlayers as Player[])
            console.log('Loaded players:', transformedPlayers.length)
          } else {
            console.warn('No players returned from API')
            setAvailablePlayers([])
          }
        } else {
          console.error('Failed to fetch players from API:', await playersResponse.text())
          // Fallback to direct query if API fails
          try {
            const playersData = await db.getAvailablePlayers()
            const transformedPlayers = (playersData || [])
              .filter((p: any) => p.players) // Only include players with position data
              .map((p: any) => ({
                user_id: p.user_id,
                name: p.name,
                email: p.email,
                status: p.status,
                players: Array.isArray(p.players) ? p.players[0] : p.players,
              }))
            setAvailablePlayers(transformedPlayers as Player[])
          } catch (fallbackError) {
            console.error('Fallback player fetch also failed:', fallbackError)
            setAvailablePlayers([])
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
    }

    loadData()
  }, [router])

  useEffect(() => {
    const loadExistingSelection = async () => {
      if (!selectedMatchId) return

      try {
        if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
          // Dev mode - skip
          return
        }

        const selections = await db.getFixtureTeamSelection(selectedMatchId)
        setExistingSelection(selections)
        
        // Populate teamSelections map
        const selectionsMap = new Map<string, TeamSelection>()
        selections.forEach((sel: any) => {
          selectionsMap.set(sel.player_id, {
            player_id: sel.player_id,
            position: sel.position || undefined,
            jersey_number: sel.jersey_number || undefined,
            is_starting: sel.is_starting,
            is_substitute: sel.is_substitute,
            notes: sel.notes || undefined,
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
    if (!player || !player.players) {
      console.error('Invalid player data:', player)
      alert('Player data is incomplete. Please refresh the page.')
      return
    }

    const newSelections = new Map(teamSelections)
    
    if (newSelections.has(playerId)) {
      newSelections.delete(playerId)
    } else {
      newSelections.set(playerId, {
        player_id: playerId,
        position: player.players?.position || undefined,
        jersey_number: player.players?.jersey_number || undefined,
        is_starting: true,
        is_substitute: false,
      })
    }
    
    setTeamSelections(newSelections)
    console.log('Team selections updated:', newSelections.size, 'players selected')
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
      if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
        // Dev mode - just show success
        alert('Team selection saved successfully! (Dev mode)')
        setSaving(false)
        return
      }

      const selectionsArray = Array.from(teamSelections.values())
      
      // Save via API route
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

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save team selection')
      }
      
      alert('Team selection saved successfully!')
      // Reload existing selection
      const selections = await db.getFixtureTeamSelection(selectedMatchId)
      setExistingSelection(selections)
    } catch (error: any) {
      console.error('Error saving team selection:', error)
      alert(`Error saving team selection: ${error.message}`)
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

  // Allow coach, admin, and data_admin (team manager) to access
  if (!user || (user.role !== 'coach' && user.role !== 'admin' && user.role !== 'data_admin')) {
    return null
  }

  const selectedMatch = matches.find(m => m.id === selectedMatchId)
  const selectedPlayers = Array.from(teamSelections.values())
  const startingPlayers = selectedPlayers.filter(p => p.is_starting && !p.is_substitute)
  const substitutes = selectedPlayers.filter(p => p.is_substitute)

  return (
    <Layout pageTitle="Fixture Team Selection">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-neutral-text flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" />
              {user.role === 'data_admin' ? 'Fixtures Management' : 'Select Team for Fixture'}
            </h2>
            <div className="flex items-center gap-3">
              {user.role === 'data_admin' && (
                <Link
                  href="/fixtures/create"
                  className="bg-primary text-white px-6 py-2 rounded-button font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  Create Fixture
                </Link>
              )}
              {(user.role === 'coach' || user.role === 'admin') && (
                <button
                  onClick={handleSave}
                  disabled={saving || teamSelections.size === 0}
                  className="bg-club-gradient text-white px-6 py-2 rounded-button font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Team Selection'}
                </button>
              )}
            </div>
          </div>

          {/* Match Selector - Only show for coaches and admins */}
          {(user.role === 'coach' || user.role === 'admin') && (
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
          )}

          {/* Fixtures List for Team Managers */}
          {user.role === 'data_admin' && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-neutral-text mb-4">Upcoming Fixtures</h3>
              {matches.length === 0 ? (
                <div className="text-center py-8 bg-neutral-light rounded-lg">
                  <Trophy className="w-12 h-12 mx-auto mb-4 text-neutral-medium opacity-50" />
                  <p className="text-neutral-medium">No upcoming fixtures</p>
                  <p className="text-sm text-neutral-medium mt-2">Create a new fixture to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matches.map((match) => (
                    <div
                      key={match.id}
                      className="bg-neutral-light rounded-lg p-4 border border-neutral-light hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-neutral-text">
                            vs {match.opponent}
                          </h4>
                          <div className="flex items-center gap-4 mt-2 text-sm text-neutral-medium">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(match.match_date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </div>
                            {match.venue && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {match.venue}
                              </div>
                            )}
                            <span className="capitalize bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-medium">
                              {match.tournament_type.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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

        {/* Show team selection only for coaches and admins */}
        {selectedMatchId && (user.role === 'coach' || user.role === 'admin') && (
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
                {availablePlayers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-neutral-medium mx-auto mb-4 opacity-50" />
                    <p className="text-neutral-medium font-medium">No players available</p>
                    <p className="text-sm text-neutral-medium mt-2">Make sure players are active and have position data.</p>
                  </div>
                ) : (
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
                            {player.players?.position && (
                              <p className="text-xs text-neutral-medium capitalize">
                                {player.players.position.replace(/_/g, ' ')} {player.players.category ? `• ${player.players.category}` : ''}
                              </p>
                            )}
                            {player.players?.jersey_number && (
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
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
