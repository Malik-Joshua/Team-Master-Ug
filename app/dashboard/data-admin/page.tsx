'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { Users, Activity, BarChart3, Calendar, Trophy, Plus, X, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
  const [showMatchForm, setShowMatchForm] = useState(false)
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

  useEffect(() => {
    const loadData = async () => {
      // Check for dev mode
      if (typeof window !== 'undefined') {
        const devUser = localStorage.getItem('dev_user')
        if (devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            
            // Mock players for dev mode
            setPlayers([
              { user_id: '1', name: 'John Doe', position: 'Fly Half' },
              { user_id: '2', name: 'Jane Smith', position: 'Prop' },
              { user_id: '3', name: 'Mike Johnson', position: 'Wing' },
            ])
            setLoading(false)
            return
          } catch (e) {
            // Fall through
          }
        }
      }

      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (authUser) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (profile) {
          setUser(profile)

          // Fetch players
          const { data: playersData } = await supabase
            .from('user_profiles')
            .select('user_id, name')
            .eq('role', 'player')
            .order('name', { ascending: true })

          if (playersData) {
            setPlayers(playersData as Player[])
          }
        }
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const handleSaveMatch = async () => {
    if (!matchForm.match_date || !matchForm.opponent) {
      alert('Please fill in match date and opponent')
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

      // Create match record
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert({
          match_date: matchForm.match_date,
          opponent: matchForm.opponent,
          tournament_type: matchForm.tournament_type,
          venue: matchForm.venue || null,
          result: matchForm.result || null,
          score_our_team: parseInt(matchForm.score_our_team) || 0,
          score_opponent: parseInt(matchForm.score_opponent) || 0,
          notes: matchForm.notes || null,
          created_by: authUser.id,
        })
        .select('id')
        .single()

      if (matchError) throw matchError

      // Create match stats for each player
      const statsToInsert = Object.entries(playerStats)
        .filter(([playerId, stats]) => {
          // Only include players with at least one stat entered
          return (
            parseInt(stats.tackles_made) > 0 ||
            parseInt(stats.tackles_missed) > 0 ||
            parseInt(stats.ball_handling_errors) > 0 ||
            parseInt(stats.ball_carries) > 0 ||
            parseInt(stats.tries_scored) > 0 ||
            parseInt(stats.minutes_played) > 0
          )
        })
        .map(([playerId, stats]) => ({
          match_id: match.id,
          player_id: playerId,
          tackles_made: parseInt(stats.tackles_made) || 0,
          tackles_missed: parseInt(stats.tackles_missed) || 0,
          ball_handling_errors: parseInt(stats.ball_handling_errors) || 0,
          ball_carries: parseInt(stats.ball_carries) || 0,
          tries_scored: parseInt(stats.tries_scored) || 0,
          minutes_played: parseInt(stats.minutes_played) || 0,
        }))

      if (statsToInsert.length > 0) {
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
        {/* Header */}
        <div className="bg-club-gradient rounded-card p-6 text-white shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Team Manager Control Center</h1>
              <p className="text-blue-100">Manage players, training attendance, and match statistics</p>
            </div>
            <button
              onClick={() => setShowMatchForm(true)}
              className="bg-white text-primary px-6 py-3 rounded-button font-semibold hover:bg-blue-50 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Enter Match Stats
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="Total Players" value={players.length} icon={Users} iconColor="bg-primary" />
          <StatCard title="Active Players" value={players.length} icon={Activity} iconColor="bg-success" />
          <StatCard title="Matches Logged" value={0} icon={Trophy} iconColor="bg-warning" />
          <StatCard title="Training Sessions" value={0} icon={Calendar} iconColor="bg-info" />
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
                  <h3 className="text-lg font-semibold text-neutral-text mb-4">Player Statistics</h3>
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
                          return (
                            <tr key={player.user_id} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
                              <td className="px-4 py-3 text-sm font-medium text-neutral-text sticky left-0 bg-inherit z-10 border-r border-neutral-light">
                                {player.name}
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={stats.tackles_made}
                                  onChange={(e) => updatePlayerStat(player.user_id, 'tackles_made', e.target.value)}
                                  className="w-full px-2 py-1 border border-neutral-light rounded text-center text-sm"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={stats.tackles_missed}
                                  onChange={(e) => updatePlayerStat(player.user_id, 'tackles_missed', e.target.value)}
                                  className="w-full px-2 py-1 border border-neutral-light rounded text-center text-sm"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={stats.ball_handling_errors}
                                  onChange={(e) => updatePlayerStat(player.user_id, 'ball_handling_errors', e.target.value)}
                                  className="w-full px-2 py-1 border border-neutral-light rounded text-center text-sm"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={stats.ball_carries}
                                  onChange={(e) => updatePlayerStat(player.user_id, 'ball_carries', e.target.value)}
                                  className="w-full px-2 py-1 border border-neutral-light rounded text-center text-sm"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={stats.tries_scored}
                                  onChange={(e) => updatePlayerStat(player.user_id, 'tries_scored', e.target.value)}
                                  className="w-full px-2 py-1 border border-neutral-light rounded text-center text-sm"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="80"
                                  value={stats.minutes_played}
                                  onChange={(e) => updatePlayerStat(player.user_id, 'minutes_played', e.target.value)}
                                  className="w-full px-2 py-1 border border-neutral-light rounded text-center text-sm"
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
