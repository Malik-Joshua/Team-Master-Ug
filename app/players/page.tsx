'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { Users, Search, Filter, UserPlus, Eye, Edit, AlertCircle, CheckCircle, X, Save, Dumbbell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Player {
  id: string
  user_id?: string
  name: string
  position: string
  status: string
  email: string
  phone?: string
  games_played?: number
  tries?: number
  tackles?: number
}

export default function PlayersPage() {
  const [user, setUser] = useState<any>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [saving, setSaving] = useState(false)
  const [playerForm, setPlayerForm] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    category: 'forwards' as 'forwards' | 'backs',
    jersey_number: '',
    date_of_birth: '',
    height_cm: '',
    weight_kg: '',
    status: 'active',
    benchPressPB: '',
    squatPB: '',
    deadliftPB: '',
    pullUpPB: '',
  })
  const [showGymMetricsModal, setShowGymMetricsModal] = useState(false)
  const [selectedPlayerForGym, setSelectedPlayerForGym] = useState<Player | null>(null)
  const [gymMetricsForm, setGymMetricsForm] = useState({
    benchPressPB: '',
    squatPB: '',
    deadliftPB: '',
    pullUpPB: '',
  })
  const [savingGymMetrics, setSavingGymMetrics] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      if (typeof window !== 'undefined') {
        const devUser = localStorage.getItem('dev_user')
        if (devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            setPlayers([
              { id: '1', name: 'John Doe', position: 'fly_half', status: 'active', email: 'john@example.com', phone: '+256 700 000 000', games_played: 15, tries: 8, tackles: 45 },
              { id: '2', name: 'Jane Smith', position: 'prop', status: 'active', email: 'jane@example.com', phone: '+256 700 000 001', games_played: 12, tries: 2, tackles: 38 },
              { id: '3', name: 'Mike Johnson', position: 'winger', status: 'injured', email: 'mike@example.com', phone: '+256 700 000 002', games_played: 10, tries: 5, tackles: 20 },
              { id: '4', name: 'Sarah Williams', position: 'scrum_half', status: 'active', email: 'sarah@example.com', phone: '+256 700 000 003', games_played: 18, tries: 3, tackles: 52 },
            ])
            setLoading(false)
            return
          } catch (e) {}
        }
      }

      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', authUser.id).single()
        if (profile) {
          setUser(profile)
          
          // Fetch players via API route (bypasses RLS)
          const playersResponse = await fetch('/api/players?role=player&status=active&includePlayerData=true')
          if (playersResponse.ok) {
            const playersData = await playersResponse.json()
            if (playersData.players) {
              // Transform players data to match Player interface
              const transformedPlayers = playersData.players.map((p: any) => ({
                id: p.user_id || p.id,
                user_id: p.user_id,
                name: p.name,
                position: p.players?.position || p.position || 'N/A',
                status: p.status || 'active',
                email: p.email,
                phone: p.phone,
                games_played: 0,
                tries: 0,
                tackles: 0,
              }))
              setPlayers(transformedPlayers as Player[])
            }
          } else {
            // Fallback to direct query if API fails
            const { data: playersData } = await supabase.from('user_profiles').select('*').eq('role', 'player')
            if (playersData) {
              const transformedPlayers = playersData.map((p: any) => ({
                id: p.user_id || p.id,
                user_id: p.user_id,
                name: p.name,
                position: 'N/A',
                status: p.status || 'active',
                email: p.email,
                phone: p.phone,
                games_played: 0,
                tries: 0,
                tackles: 0,
              }))
              setPlayers(transformedPlayers as Player[])
            }
          }
        }
      }
      setLoading(false)
    }
    loadData()
  }, [])

  const handleAddPlayer = async () => {
    setSaving(true)
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
        const newPlayer: Player = {
          id: Date.now().toString(),
          name: playerForm.name,
          email: playerForm.email,
          phone: playerForm.phone,
          position: playerForm.position,
          status: playerForm.status,
          games_played: 0,
          tries: 0,
          tackles: 0,
        }
        setPlayers([...players, newPlayer])
        setShowAddModal(false)
        alert('Player added successfully! (Dev Mode)')
        setSaving(false)
        return
      }

      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playerForm),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to add player')
      }

      const supabase = createClient()
      const { data: playersData } = await supabase.from('user_profiles').select('*').eq('role', 'player')
      if (playersData) setPlayers(playersData as Player[])
      setShowAddModal(false)
      alert('Player added successfully!')
    } catch (error: any) {
      console.error('Error adding player:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePlayer = async () => {
    if (!selectedPlayer) return
    setSaving(true)
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
        setPlayers(players.map(p => 
          p.id === selectedPlayer.id 
            ? { ...p, name: playerForm.name, email: playerForm.email, phone: playerForm.phone, status: playerForm.status }
            : p
        ))
        setShowEditModal(false)
        alert('Player updated successfully! (Dev Mode)')
        setSaving(false)
        return
      }

      const playerId = selectedPlayer.user_id || selectedPlayer.id
      const { db } = await import('@/lib/db-helpers')
      await db.updatePlayer(playerId, {
        name: playerForm.name,
        email: playerForm.email,
        phone: playerForm.phone,
        position: playerForm.position,
        category: playerForm.category,
        jersey_number: playerForm.jersey_number ? parseInt(playerForm.jersey_number) : undefined,
        date_of_birth: playerForm.date_of_birth || undefined,
        height_cm: playerForm.height_cm ? parseInt(playerForm.height_cm) : undefined,
        weight_kg: playerForm.weight_kg ? parseFloat(playerForm.weight_kg) : undefined,
        status: playerForm.status,
      })

      const supabase = createClient()
      const { data: playersData } = await supabase.from('user_profiles').select('*').eq('role', 'player')
      if (playersData) setPlayers(playersData as Player[])
      setShowEditModal(false)
      alert('Player updated successfully!')
    } catch (error: any) {
      console.error('Error updating player:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Layout pageTitle="Players">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!user) return null

  const activePlayers = players.filter((p) => p.status === 'active').length
  const injuredPlayers = players.filter((p) => p.status === 'injured').length
  const totalPlayers = players.length

  const filteredPlayers = players.filter((player) => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) || player.position.toLowerCase().includes(searchTerm.toLowerCase()) || player.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'all' || player.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const positions = [
    { value: 'prop', label: 'Prop', category: 'forwards' },
    { value: 'hooker', label: 'Hooker', category: 'forwards' },
    { value: 'lock', label: 'Lock', category: 'forwards' },
    { value: 'flanker', label: 'Flanker', category: 'forwards' },
    { value: '8th_man', label: '8th Man', category: 'forwards' },
    { value: 'scrum_half', label: 'Scrum Half', category: 'backs' },
    { value: 'fly_half', label: 'Fly Half', category: 'backs' },
    { value: 'inside_center', label: 'Inside Center', category: 'backs' },
    { value: 'outside_center', label: 'Outside Center', category: 'backs' },
    { value: 'winger', label: 'Winger', category: 'backs' },
  ]

  return (
    <Layout pageTitle="Players">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-extrabold text-club-gradient mb-2">Player Management</h1>
            <p className="text-lg text-neutral-medium font-medium">Manage and view all players</p>
          </div>
          {(user?.role === 'coach' || user?.role === 'admin' || user?.role === 'data_admin') && (
            <button
              onClick={() => {
                setPlayerForm({ name: '', email: '', phone: '', position: '', category: 'forwards', jersey_number: '', date_of_birth: '', height_cm: '', weight_kg: '', status: 'active', benchPressPB: '', squatPB: '', deadliftPB: '', pullUpPB: '' })
                setShowAddModal(true)
              }}
              className="bg-club-gradient text-white px-6 py-3 rounded-button font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Add Player
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Total Players" value={totalPlayers} icon={Users} iconColor="bg-primary" />
          <StatCard title="Active Players" value={`${activePlayers} (${Math.round((activePlayers / totalPlayers) * 100) || 0}%)`} icon={CheckCircle} iconColor="bg-success" />
          <StatCard title="Injured Players" value={injuredPlayers} icon={AlertCircle} iconColor="bg-secondary" />
        </div>

        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-medium w-5 h-5" />
              <input type="text" placeholder="Search by name, position, or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all" />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-medium w-5 h-5" />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="pl-10 pr-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none bg-white">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="injured">Injured</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-card border border-neutral-light shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-light">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-text uppercase">Player</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-text uppercase">Position</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-text uppercase">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-text uppercase">Games</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-text uppercase">Tries</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-text uppercase">Tackles</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-text uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-light">
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-neutral-medium">No players found</td>
                  </tr>
                ) : (
                  filteredPlayers.map((player) => (
                    <tr key={player.id} className="hover:bg-neutral-light transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-club-gradient flex items-center justify-center text-white font-bold">
                            {player.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-neutral-text">{player.name}</p>
                            <p className="text-sm text-neutral-medium">{player.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-medium capitalize">{player.position?.replace(/_/g, ' ') || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${player.status === 'active' ? 'bg-success/10 text-success' : player.status === 'injured' ? 'bg-secondary/10 text-secondary' : 'bg-warning/10 text-warning'}`}>
                          {player.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-medium">{player.games_played || 0}</td>
                      <td className="px-6 py-4 text-sm text-neutral-medium">{player.tries || 0}</td>
                      <td className="px-6 py-4 text-sm text-neutral-medium">{player.tackles || 0}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button onClick={() => { setSelectedPlayer(player); setShowViewModal(true) }} className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="View Details">
                            <Eye className="w-4 h-4" />
                          </button>
                          {(user?.role === 'coach' || user?.role === 'admin' || user?.role === 'data_admin') && (
                            <>
                              <button onClick={() => { setSelectedPlayer(player); const pos = positions.find(p => p.value === player.position); setPlayerForm({ name: player.name, email: player.email, phone: player.phone || '', position: player.position, category: (pos?.category === 'forwards' || pos?.category === 'backs') ? pos.category : ('forwards' as 'forwards' | 'backs'), jersey_number: '', date_of_birth: '', height_cm: '', weight_kg: '', status: player.status, benchPressPB: '', squatPB: '', deadliftPB: '', pullUpPB: '' }); setShowEditModal(true) }} className="p-2 text-info hover:bg-info/10 rounded-lg transition-colors" title="Edit Player">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={async () => {
                                setSelectedPlayerForGym(player)
                                const playerId = player.user_id || player.id
                                try {
                                  const { db } = await import('@/lib/db-helpers')
                                  const gymStats = await db.getPlayerGymStats(playerId)
                                  setGymMetricsForm({
                                    benchPressPB: gymStats.benchPressPB?.toString() || '',
                                    squatPB: gymStats.squatPB?.toString() || '',
                                    deadliftPB: gymStats.deadliftPB?.toString() || '',
                                    pullUpPB: gymStats.pullUpPB?.toString() || '',
                                  })
                                } catch (error) {
                                  setGymMetricsForm({ benchPressPB: '', squatPB: '', deadliftPB: '', pullUpPB: '' })
                                }
                                setShowGymMetricsModal(true)
                              }} className="p-2 text-warning hover:bg-warning/10 rounded-lg transition-colors" title="Update Gym Metrics">
                                <Dumbbell className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card shadow-soft max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-light">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-neutral-text">Add New Player</h3>
                <button onClick={() => setShowAddModal(false)} className="text-neutral-medium hover:text-neutral-text transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-text mb-2">Name *</label>
                  <input type="text" value={playerForm.name} onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-text mb-2">Email *</label>
                  <input type="email" value={playerForm.email} onChange={(e) => setPlayerForm({ ...playerForm, email: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-text mb-2">Phone</label>
                  <input type="tel" value={playerForm.phone} onChange={(e) => setPlayerForm({ ...playerForm, phone: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-text mb-2">Category *</label>
                  <select value={playerForm.category} onChange={(e) => { setPlayerForm({ ...playerForm, category: e.target.value as 'forwards' | 'backs', position: '' }) }} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="forwards">Forwards</option>
                    <option value="backs">Backs</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-text mb-2">Position *</label>
                  <select value={playerForm.position} onChange={(e) => setPlayerForm({ ...playerForm, position: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" required>
                    <option value="">Select Position</option>
                    {positions.filter(p => p.category === playerForm.category).map(pos => (
                      <option key={pos.value} value={pos.value}>{pos.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-text mb-2">Status</label>
                  <select value={playerForm.status} onChange={(e) => setPlayerForm({ ...playerForm, status: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="active">Active</option>
                    <option value="injured">Injured</option>
                    <option value="suspended">Suspended</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-light flex justify-end space-x-3">
              <button onClick={() => setShowAddModal(false)} className="px-6 py-2 border border-neutral-light rounded-button font-semibold text-neutral-text hover:bg-neutral-light transition-colors" disabled={saving}>
                Cancel
              </button>
              <button onClick={handleAddPlayer} className="px-6 py-2 bg-primary text-white rounded-button font-semibold hover:bg-primary-dark transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed" disabled={saving || !playerForm.name || !playerForm.email || !playerForm.position}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Adding...' : 'Add Player'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedPlayer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card shadow-soft max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-light">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-neutral-text">Edit Player</h3>
                <button onClick={() => setShowEditModal(false)} className="text-neutral-medium hover:text-neutral-text transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-text mb-2">Name *</label>
                  <input type="text" value={playerForm.name} onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-text mb-2">Email *</label>
                  <input type="email" value={playerForm.email} onChange={(e) => setPlayerForm({ ...playerForm, email: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-text mb-2">Phone</label>
                  <input type="tel" value={playerForm.phone} onChange={(e) => setPlayerForm({ ...playerForm, phone: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-text mb-2">Status</label>
                  <select value={playerForm.status} onChange={(e) => setPlayerForm({ ...playerForm, status: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="active">Active</option>
                    <option value="injured">Injured</option>
                    <option value="suspended">Suspended</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-light flex justify-end space-x-3">
              <button onClick={() => setShowEditModal(false)} className="px-6 py-2 border border-neutral-light rounded-button font-semibold text-neutral-text hover:bg-neutral-light transition-colors" disabled={saving}>
                Cancel
              </button>
              <button onClick={handleUpdatePlayer} className="px-6 py-2 bg-primary text-white rounded-button font-semibold hover:bg-primary-dark transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed" disabled={saving || !playerForm.name || !playerForm.email}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && selectedPlayer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card shadow-soft max-w-2xl w-full">
            <div className="p-6 border-b border-neutral-light">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-neutral-text">Player Details</h3>
                <button onClick={() => setShowViewModal(false)} className="text-neutral-medium hover:text-neutral-text transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 rounded-full bg-club-gradient flex items-center justify-center text-white font-bold text-2xl">
                  {selectedPlayer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-neutral-text">{selectedPlayer.name}</h4>
                  <p className="text-neutral-medium">{selectedPlayer.email}</p>
                  <p className="text-neutral-medium">{selectedPlayer.phone}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-light">
                <div>
                  <p className="text-sm text-neutral-medium">Position</p>
                  <p className="font-semibold text-neutral-text capitalize">{selectedPlayer.position?.replace(/_/g, ' ') || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-medium">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${selectedPlayer.status === 'active' ? 'bg-success/10 text-success' : selectedPlayer.status === 'injured' ? 'bg-secondary/10 text-secondary' : 'bg-warning/10 text-warning'}`}>
                    {selectedPlayer.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-neutral-medium">Games Played</p>
                  <p className="font-semibold text-neutral-text">{selectedPlayer.games_played || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-medium">Tries</p>
                  <p className="font-semibold text-neutral-text">{selectedPlayer.tries || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-medium">Tackles</p>
                  <p className="font-semibold text-neutral-text">{selectedPlayer.tackles || 0}</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-light flex justify-end">
              <button onClick={() => setShowViewModal(false)} className="px-6 py-2 bg-primary text-white rounded-button font-semibold hover:bg-primary-dark transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showGymMetricsModal && selectedPlayerForGym && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card shadow-soft max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-light">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Dumbbell className="w-6 h-6 text-primary mr-2" />
                  <h3 className="text-2xl font-bold text-neutral-text">Update Gym Metrics - {selectedPlayerForGym.name}</h3>
                </div>
                <button onClick={() => { setShowGymMetricsModal(false); setSelectedPlayerForGym(null) }} className="text-neutral-medium hover:text-neutral-text transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-neutral-text mb-2">
                  Bench Press Personal Best (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={gymMetricsForm.benchPressPB}
                  onChange={(e) => setGymMetricsForm({ ...gymMetricsForm, benchPressPB: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter weight in kg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-text mb-2">
                  Squat Personal Best (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={gymMetricsForm.squatPB}
                  onChange={(e) => setGymMetricsForm({ ...gymMetricsForm, squatPB: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter weight in kg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-text mb-2">
                  Deadlift Personal Best (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={gymMetricsForm.deadliftPB}
                  onChange={(e) => setGymMetricsForm({ ...gymMetricsForm, deadliftPB: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter weight in kg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-text mb-2">
                  Pull-ups Personal Best (reps)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={gymMetricsForm.pullUpPB}
                  onChange={(e) => setGymMetricsForm({ ...gymMetricsForm, pullUpPB: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter number of reps"
                />
              </div>
            </div>
            <div className="p-6 border-t border-neutral-light flex justify-end space-x-3">
              <button
                onClick={() => { setShowGymMetricsModal(false); setSelectedPlayerForGym(null) }}
                className="px-6 py-2 border border-neutral-light rounded-button font-semibold text-neutral-text hover:bg-neutral-light transition-colors"
                disabled={savingGymMetrics}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setSavingGymMetrics(true)
                  try {
                    const playerId = selectedPlayerForGym.user_id || selectedPlayerForGym.id
                    
                    if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
                      alert('Gym metrics updated! (Dev Mode)')
                      setShowGymMetricsModal(false)
                      setSelectedPlayerForGym(null)
                      setSavingGymMetrics(false)
                      return
                    }

                    const { db } = await import('@/lib/db-helpers')
                    await db.updatePlayerGymStats(playerId, {
                      benchPressPB: gymMetricsForm.benchPressPB && gymMetricsForm.benchPressPB.trim() !== '' ? parseFloat(gymMetricsForm.benchPressPB) : null,
                      squatPB: gymMetricsForm.squatPB && gymMetricsForm.squatPB.trim() !== '' ? parseFloat(gymMetricsForm.squatPB) : null,
                      deadliftPB: gymMetricsForm.deadliftPB && gymMetricsForm.deadliftPB.trim() !== '' ? parseFloat(gymMetricsForm.deadliftPB) : null,
                      pullUpPB: gymMetricsForm.pullUpPB && gymMetricsForm.pullUpPB.trim() !== '' ? parseInt(gymMetricsForm.pullUpPB) : null,
                    })

                    alert('Gym metrics updated successfully!')
                    setShowGymMetricsModal(false)
                    setSelectedPlayerForGym(null)
                  } catch (error: any) {
                    console.error('Error updating gym metrics:', error)
                    alert(`Error updating gym metrics: ${error.message}`)
                  } finally {
                    setSavingGymMetrics(false)
                  }
                }}
                className="px-6 py-2 bg-primary text-white rounded-button font-semibold hover:bg-primary-dark transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={savingGymMetrics}
              >
                <Save className="w-4 h-4 mr-2" />
                {savingGymMetrics ? 'Saving...' : 'Save Metrics'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
