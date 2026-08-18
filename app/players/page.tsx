'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import ConceptStatCard from '@/components/ConceptStatCard'
import { PageHeader, Button, Card, StatGrid } from '@/components/ui'
import { Users, Search, Filter, UserPlus, Eye, Edit, AlertCircle, CheckCircle, X, Save, Dumbbell, Award, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PositionIcon from '@/components/PositionIcon'

interface Player {
  id: string
  user_id?: string
  name: string
  position: string
  status: string
  email: string
  phone?: string
  profile_picture_url?: string | null
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
  const [clubCaptainStatus, setClubCaptainStatus] = useState<Record<string, boolean>>({})
  const [togglingClubCaptain, setTogglingClubCaptain] = useState<string | null>(null)

  // Load club captain status for players
  const loadClubCaptainStatus = async (playersList: Player[]) => {
    try {
      const statusMap: Record<string, boolean> = {}
      
      // Check club captain status for each player
      await Promise.all(
        playersList.map(async (player) => {
          const playerId = player.user_id || player.id
          if (!playerId) return
          
          try {
            const response = await fetch(`/api/players/${playerId}/club-captain`)
            if (response.ok) {
              const data = await response.json()
              statusMap[playerId] = data.isClubCaptain || false
            }
          } catch (error) {
            console.error(`Error checking club captain status for ${playerId}:`, error)
          }
        })
      )
      
      setClubCaptainStatus(statusMap)
    } catch (error) {
      console.error('Error loading club captain status:', error)
    }
  }

  // Toggle club captain status
  const toggleClubCaptain = async (player: Player) => {
    const playerId = player.user_id || player.id
    if (!playerId) return
    
    setTogglingClubCaptain(playerId)
    
    try {
      const isCurrentlyClubCaptain = clubCaptainStatus[playerId] || false
      
      if (isCurrentlyClubCaptain) {
        // Remove club captain role
        const response = await fetch(`/api/players/${playerId}/club-captain`, {
          method: 'DELETE',
        })
        
        if (response.ok) {
          setClubCaptainStatus(prev => ({ ...prev, [playerId]: false }))
          alert(`${player.name} is no longer a club captain`)
        } else {
          const error = await response.json()
          alert(`Failed to remove club captain role: ${error.error || 'Unknown error'}`)
        }
      } else {
        // Promote to club captain
        const response = await fetch(`/api/players/${playerId}/club-captain`, {
          method: 'POST',
        })
        
        if (response.ok) {
          setClubCaptainStatus(prev => ({ ...prev, [playerId]: true }))
          alert(`${player.name} is now a club captain. They will see the club captain dashboard when they log in.`)
        } else {
          const error = await response.json()
          alert(`Failed to promote to club captain: ${error.error || 'Unknown error'}`)
        }
      }
    } catch (error: any) {
      console.error('Error toggling club captain:', error)
      alert(`Error: ${error.message || 'Failed to update club captain status'}`)
    } finally {
      setTogglingClubCaptain(null)
    }
  }
  
  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (!authUser) {
      setLoading(false)
      return
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', authUser.id)
      .single()
    
      if (profile) {
        setUser(profile)
        
        // Fetch players - use API route for admin to bypass RLS, otherwise direct query
        if (profile.role === 'admin' || profile.role === 'coach' || profile.role === 'data_admin') {
          try {
            console.log('Fetching players from API route for admin user...', profile.role)
            // For admin/coach, try API route first
            const response = await fetch('/api/admin/players', {
              cache: 'no-store', // Ensure fresh data
            })
            console.log('Players API response status:', response.status)
            if (response.ok) {
              const data = await response.json()
              console.log('Players fetched:', data.players?.length || 0, 'players')
              if (data.players && data.players.length > 0) {
                console.log('Sample player:', data.players[0])
              }
              setPlayers(data.players || [])
            } else {
              const errorData = await response.json()
              console.error('Error from players API:', errorData)
              // Show user-friendly error message
              if (errorData.error?.includes('SUPABASE_SERVICE_ROLE_KEY')) {
                alert('Configuration Error: The SUPABASE_SERVICE_ROLE_KEY environment variable is not set in Vercel. Please check your deployment settings.')
              } else if (errorData.error) {
                console.error('API Error Details:', errorData)
              }
              // Fallback to direct query
              const { data: playersData } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('role', 'player')
              if (playersData) {
                console.log('Using fallback query, got', playersData.length, 'players')
                const playersList = playersData as Player[]
                setPlayers(playersList)
                
                // Load club captain status for all players (admin only)
                if (profile.role === 'admin' && playersList.length > 0) {
                  await loadClubCaptainStatus(playersList)
                }
              }
            }
          } catch (error) {
            console.error('Error fetching players:', error)
            // Fallback to direct query
            const { data: playersData } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('role', 'player')
            if (playersData) {
              console.log('Using fallback query after error, got', playersData.length, 'players')
              const playersList = playersData as Player[]
              setPlayers(playersList)
              
              // Load club captain status for all players (admin only)
              if (profile.role === 'admin' && playersList.length > 0) {
                await loadClubCaptainStatus(playersList)
              }
            }
          }
        } else {
          // For other roles, use direct query (they can only see their own data)
          const { data: playersData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('role', 'player')
          if (playersData) {
            const playersList = playersData as Player[]
            setPlayers(playersList)
            
            // Load club captain status for all players (admin only)
            if (profile.role === 'admin' && playersList.length > 0) {
              await loadClubCaptainStatus(playersList)
            }
          }
        }
      }
      
      setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Load club captain status when players are loaded and user is admin
  useEffect(() => {
    if (user?.role === 'admin' && players.length > 0) {
      loadClubCaptainStatus(players)
    }
  }, [players, user?.role])

  const handleAddPlayer = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playerForm),
      })

      if (!response.ok) {
        const error = await response.json()
        // The API returns { error: "<reason>" } — surface that reason so the
        // user knows why (e.g. email already in use, role limit reached).
        throw new Error(error.error || error.message || 'Failed to add player')
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

      const playerId = selectedPlayer.user_id || selectedPlayer.id
      
      // Use API route to update player (bypasses RLS)
      const response = await fetch(`/api/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update player')
      }

      // Reload players using the same method as initial load
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (authUser) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', authUser.id)
          .single()
        
        if (profile && (profile.role === 'admin' || profile.role === 'coach' || profile.role === 'data_admin')) {
          // Use API route for admin/coach/data_admin (same as initial load)
          try {
            const response = await fetch('/api/admin/players', {
              cache: 'no-store',
            })
            if (response.ok) {
              const data = await response.json()
              setPlayers(data.players || [])
            } else {
              // Fallback to direct query
              const { data: playersData } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('role', 'player')
              if (playersData) setPlayers(playersData as Player[])
            }
          } catch (error) {
            console.error('Error reloading players:', error)
            // Fallback to direct query
            const { data: playersData } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('role', 'player')
            if (playersData) setPlayers(playersData as Player[])
          }
        } else {
          // For other roles, use direct query
          const { data: playersData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('role', 'player')
          if (playersData) setPlayers(playersData as Player[])
        }
      }
      
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tm-secondary"></div>
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
    // Forwards (the pack)
    { value: 'loosehead_prop', label: 'Loosehead Prop', category: 'forwards' },
    { value: 'hooker', label: 'Hooker', category: 'forwards' },
    { value: 'tighthead_prop', label: 'Tighthead Prop', category: 'forwards' },
    { value: 'lock', label: 'Lock', category: 'forwards' },
    { value: 'blindside_flanker', label: 'Blindside Flanker', category: 'forwards' },
    { value: 'openside_flanker', label: 'Openside Flanker', category: 'forwards' },
    { value: '8th_man', label: 'Number Eight', category: 'forwards' },
    // Backs
    { value: 'scrum_half', label: 'Scrum Half', category: 'backs' },
    { value: 'fly_half', label: 'Fly Half', category: 'backs' },
    { value: 'inside_center', label: 'Inside Center', category: 'backs' },
    { value: 'outside_center', label: 'Outside Center', category: 'backs' },
    { value: 'left_wing', label: 'Left Wing', category: 'backs' },
    { value: 'right_wing', label: 'Right Wing', category: 'backs' },
    { value: 'full_back', label: 'Full-Back', category: 'backs' },
  ]

  return (
    <Layout pageTitle="Players">
      <div className="space-y-5">
        <PageHeader
          title="Player management"
          subtitle="Manage and view all players"
          actions={
            <>
              <Button variant="secondary" icon={RefreshCw} onClick={loadData}>
                Refresh
              </Button>
              {(user?.role === 'coach' || user?.role === 'admin' || user?.role === 'data_admin') && (
                <Button
                  icon={UserPlus}
                  onClick={() => {
                    setPlayerForm({ name: '', email: '', phone: '', position: '', category: 'forwards', jersey_number: '', date_of_birth: '', height_cm: '', weight_kg: '', status: 'active', benchPressPB: '', squatPB: '', deadliftPB: '', pullUpPB: '' })
                    setShowAddModal(true)
                  }}
                >
                  Add player
                </Button>
              )}
            </>
          }
        />

        <StatGrid cols={3}>
          <ConceptStatCard
            label="Total players"
            value={totalPlayers}
            meta="All registered players"
            icon={Users}
            iconBgColor="rgba(91, 163, 217, 0.12)"
            iconTextColor="#5BA3D9"
          />
          <ConceptStatCard
            label="Active players"
            value={`${activePlayers} (${Math.round((activePlayers / totalPlayers) * 100) || 0}%)`}
            meta="Currently available"
            icon={CheckCircle}
            iconBgColor="rgba(45, 184, 138, 0.12)"
            iconTextColor="#2DB88A"
          />
          <ConceptStatCard
            label="Injured players"
            value={injuredPlayers}
            valueColor="#E05757"
            meta="Out with injury"
            icon={AlertCircle}
            iconBgColor="rgba(224, 87, 87, 0.12)"
            iconTextColor="#E05757"
          />
        </StatGrid>

        <Card>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-tm-text-3 w-[18px] h-[18px]" />
              <input type="text" placeholder="Search by name, position, or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="tm-input pl-10" />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-tm-text-3 w-[18px] h-[18px] pointer-events-none z-10" />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="tm-select pl-10 pr-8 appearance-none md:w-48">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="injured">Injured</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </Card>

        <Card padded={false}>
          <div className="md:hidden divide-y divide-tm-border">
            {filteredPlayers.length === 0 ? (
              <div className="px-4 py-8 text-center text-tm-text-3">No players found</div>
            ) : (
              filteredPlayers.map((player) => (
                <div key={player.id} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-tm-secondary flex items-center justify-center text-tm-on-secondary font-bold">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-tm-text-1">{player.name}</p>
                      <p className="text-sm text-tm-text-3">{player.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded-full bg-tm-surface-hover text-tm-text-1 capitalize">
                      {player.position.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-1 rounded-full font-medium ${
                      player.status === 'active'
                        ? 'bg-success/10 text-success'
                        : player.status === 'injured'
                        ? 'bg-[#E05757]/10 text-[#E05757]'
                        : 'bg-warning/10 text-warning'
                    }`}>
                      {player.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm text-tm-text-3">
                    <div>
                      <p className="text-xs text-tm-text-3">Games</p>
                      <p className="font-semibold text-tm-text-1">{player.games_played || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-tm-text-3">Tries</p>
                      <p className="font-semibold text-tm-text-1">{player.tries || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-tm-text-3">Tackles</p>
                      <p className="font-semibold text-tm-text-1">{player.tackles || 0}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => { setSelectedPlayer(player); setShowViewModal(true) }} className="p-2 text-tm-secondary hover:bg-tm-surface-hover rounded-lg transition-colors" title="View Details">
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
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => toggleClubCaptain(player)}
                        disabled={togglingClubCaptain === (player.user_id || player.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          clubCaptainStatus[player.user_id || player.id]
                            ? 'text-warning bg-warning/15 hover:bg-warning/25'
                            : 'text-tm-text-3 hover:bg-tm-surface-hover'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={clubCaptainStatus[player.user_id || player.id] ? 'Remove Club Captain' : 'Make Club Captain'}
                      >
                        {togglingClubCaptain === (player.user_id || player.id) ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Award className={`w-4 h-4 ${clubCaptainStatus[player.user_id || player.id] ? 'fill-current' : ''}`} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-tm-surface-hover">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-tm-text-1 uppercase">Player</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-tm-text-1 uppercase">Position</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-tm-text-1 uppercase">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-tm-text-1 uppercase">Games</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-tm-text-1 uppercase">Tries</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-tm-text-1 uppercase">Tackles</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-tm-text-1 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tm-border">
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-tm-text-3">No players found</td>
                  </tr>
                ) : (
                  filteredPlayers.map((player) => (
                    <tr key={player.id} className="hover:bg-tm-surface-hover transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-tm-secondary flex items-center justify-center text-tm-on-secondary font-bold">
                            {player.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-tm-text-1">{player.name}</p>
                            <p className="text-sm text-tm-text-3">{player.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-tm-text-3 capitalize">{player.position.replace('_', ' ')}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${player.status === 'active' ? 'bg-success/10 text-success' : player.status === 'injured' ? 'bg-[#E05757]/10 text-[#E05757]' : 'bg-warning/10 text-warning'}`}>
                          {player.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-tm-text-3">{player.games_played || 0}</td>
                      <td className="px-6 py-4 text-sm text-tm-text-3">{player.tries || 0}</td>
                      <td className="px-6 py-4 text-sm text-tm-text-3">{player.tackles || 0}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button onClick={() => { setSelectedPlayer(player); setShowViewModal(true) }} className="p-2 text-tm-secondary hover:bg-tm-surface-hover rounded-lg transition-colors" title="View Details">
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
                          {user?.role === 'admin' && (
                            <button
                              onClick={() => toggleClubCaptain(player)}
                              disabled={togglingClubCaptain === (player.user_id || player.id)}
                              className={`p-2 rounded-lg transition-colors ${
                                clubCaptainStatus[player.user_id || player.id]
                                  ? 'text-warning bg-warning/15 hover:bg-warning/25'
                                  : 'text-tm-text-3 hover:bg-tm-surface-hover'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              title={clubCaptainStatus[player.user_id || player.id] ? 'Remove Club Captain' : 'Make Club Captain'}
                            >
                              {togglingClubCaptain === (player.user_id || player.id) ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Award className={`w-4 h-4 ${clubCaptainStatus[player.user_id || player.id] ? 'fill-current' : ''}`} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="rounded-[10px] border border-tm-border bg-tm-surface shadow-xl w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-tm-border">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-tm-text-1">Add New Player</h3>
                <button onClick={() => setShowAddModal(false)} className="modal-close-btn">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">Name *</label>
                  <input type="text" value={playerForm.name} onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })} className="tm-input" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">Email *</label>
                  <input type="email" value={playerForm.email} onChange={(e) => setPlayerForm({ ...playerForm, email: e.target.value })} className="tm-input" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">Phone</label>
                  <input type="tel" value={playerForm.phone} onChange={(e) => setPlayerForm({ ...playerForm, phone: e.target.value })} className="tm-input" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">Category *</label>
                  <select value={playerForm.category} onChange={(e) => { setPlayerForm({ ...playerForm, category: e.target.value as 'forwards' | 'backs', position: '' }) }} className="tm-input">
                    <option value="forwards">Forwards</option>
                    <option value="backs">Backs</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">Position *</label>
                  <select value={playerForm.position} onChange={(e) => setPlayerForm({ ...playerForm, position: e.target.value })} className="tm-input" required>
                    <option value="">Select Position</option>
                    {positions.filter(p => p.category === playerForm.category).map(pos => (
                      <option key={pos.value} value={pos.value}>{pos.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">Status</label>
                  <select value={playerForm.status} onChange={(e) => setPlayerForm({ ...playerForm, status: e.target.value })} className="tm-input">
                    <option value="active">Active</option>
                    <option value="injured">Injured</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-tm-border flex justify-end space-x-3">
              <button onClick={() => setShowAddModal(false)} className="px-6 py-2 border border-tm-border rounded-[6px] font-semibold text-tm-text-1 hover:bg-tm-surface-hover transition-colors" disabled={saving}>
                Cancel
              </button>
              <button onClick={handleAddPlayer} className="px-6 py-2 bg-tm-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed" disabled={saving || !playerForm.name || !playerForm.email || !playerForm.position}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Adding...' : 'Add Player'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedPlayer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="rounded-[10px] border border-tm-border bg-tm-surface shadow-xl w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-tm-border">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-tm-text-1">Edit Player</h3>
                <button onClick={() => setShowEditModal(false)} className="modal-close-btn">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">Name *</label>
                  <input type="text" value={playerForm.name} onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })} className="tm-input" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">Email *</label>
                  <input type="email" value={playerForm.email} onChange={(e) => setPlayerForm({ ...playerForm, email: e.target.value })} className="tm-input" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">Phone</label>
                  <input type="tel" value={playerForm.phone} onChange={(e) => setPlayerForm({ ...playerForm, phone: e.target.value })} className="tm-input" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">Status</label>
                  <select value={playerForm.status} onChange={(e) => setPlayerForm({ ...playerForm, status: e.target.value })} className="tm-input">
                    <option value="active">Active</option>
                    <option value="injured">Injured</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-tm-border flex justify-end space-x-3">
              <button onClick={() => setShowEditModal(false)} className="px-6 py-2 border border-tm-border rounded-[6px] font-semibold text-tm-text-1 hover:bg-tm-surface-hover transition-colors" disabled={saving}>
                Cancel
              </button>
              <button onClick={handleUpdatePlayer} className="px-6 py-2 bg-tm-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed" disabled={saving || !playerForm.name || !playerForm.email}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && selectedPlayer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="rounded-[10px] border border-tm-border bg-tm-surface shadow-xl w-full max-w-[95vw] sm:max-w-2xl">
            <div className="p-4 sm:p-6 border-b border-tm-border">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-tm-text-1">Player Details</h3>
                <button onClick={() => setShowViewModal(false)} className="modal-close-btn">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-5">
              {/* Player header */}
              <div className="flex items-center gap-4">
                {selectedPlayer.profile_picture_url ? (
                  <img
                    src={selectedPlayer.profile_picture_url}
                    alt={selectedPlayer.name}
                    className="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2"
                    style={{ borderColor: 'var(--acc, #5BA3D9)' }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0"
                       style={{ background: 'var(--acc, #5BA3D9)', color: 'var(--btn-txt, #080F1C)' }}>
                    {selectedPlayer.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className="text-xl font-bold text-tm-text-1">{selectedPlayer.name}</h4>
                  <p className="text-sm text-tm-text-3">{selectedPlayer.email}</p>
                  {selectedPlayer.phone && <p className="text-sm text-tm-text-3">{selectedPlayer.phone}</p>}
                </div>
              </div>

              {/* Position feature block — leads with the player's own photo so
                  it reads as "this player, who plays X" rather than a generic
                  position illustration; falls back to the position icon only
                  when no photo has been uploaded. */}
              <div className="flex items-center gap-5 rounded-xl p-4 border"
                   style={{ background: 'var(--p7, #112035)', borderColor: 'var(--b1, rgba(255,255,255,0.07))' }}>
                {selectedPlayer.profile_picture_url ? (
                  <img
                    src={selectedPlayer.profile_picture_url}
                    alt={selectedPlayer.name}
                    className="w-[90px] h-[90px] rounded-xl object-cover flex-shrink-0 drop-shadow-lg border-2"
                    style={{ borderColor: 'var(--acc, #5BA3D9)' }}
                  />
                ) : (
                  <PositionIcon
                    position={selectedPlayer.position}
                    size={90}
                    className="flex-shrink-0 drop-shadow-lg"
                  />
                )}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-1"
                     style={{ color: 'var(--t3, #506478)' }}>Position</p>
                  <p className="text-lg font-bold capitalize mb-1"
                     style={{ color: 'var(--t1, #EDF2F8)' }}>
                    {selectedPlayer.position.replace(/_/g, ' ')}
                  </p>
                  {selectedPlayer.position === 'fly_half' && (
                    <p className="text-xs" style={{ color: 'var(--acc, #5BA3D9)' }}>
                      Playmaker · #10 · Decision-maker
                    </p>
                  )}
                  <span className={`mt-2 inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedPlayer.status === 'active'
                      ? 'bg-success/10 text-success'
                      : selectedPlayer.status === 'injured'
                      ? 'bg-[#E05757]/10 text-[#E05757]'
                      : 'bg-warning/10 text-warning'
                  }`}>
                    {selectedPlayer.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-1 border-t border-tm-border">
                <div>
                  <p className="text-sm text-tm-text-3">Games Played</p>
                  <p className="font-semibold text-tm-text-1">{selectedPlayer.games_played || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-tm-text-3">Tries</p>
                  <p className="font-semibold text-tm-text-1">{selectedPlayer.tries || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-tm-text-3">Tackles</p>
                  <p className="font-semibold text-tm-text-1">{selectedPlayer.tackles || 0}</p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-tm-border flex justify-end">
              <button onClick={() => setShowViewModal(false)} className="px-6 py-2 bg-tm-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showGymMetricsModal && selectedPlayerForGym && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="rounded-[10px] border border-tm-border bg-tm-surface shadow-xl w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-tm-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Dumbbell className="w-6 h-6 text-primary mr-2" />
                  <h3 className="text-2xl font-bold text-tm-text-1">Update Gym Metrics - {selectedPlayerForGym.name}</h3>
                </div>
                <button onClick={() => { setShowGymMetricsModal(false); setSelectedPlayerForGym(null) }} className="modal-close-btn">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                  Bench Press Personal Best (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={gymMetricsForm.benchPressPB}
                  onChange={(e) => setGymMetricsForm({ ...gymMetricsForm, benchPressPB: e.target.value })}
                  className="tm-input"
                  placeholder="Enter weight in kg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                  Squat Personal Best (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={gymMetricsForm.squatPB}
                  onChange={(e) => setGymMetricsForm({ ...gymMetricsForm, squatPB: e.target.value })}
                  className="tm-input"
                  placeholder="Enter weight in kg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                  Deadlift Personal Best (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={gymMetricsForm.deadliftPB}
                  onChange={(e) => setGymMetricsForm({ ...gymMetricsForm, deadliftPB: e.target.value })}
                  className="tm-input"
                  placeholder="Enter weight in kg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                  Pull-ups Personal Best (reps)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={gymMetricsForm.pullUpPB}
                  onChange={(e) => setGymMetricsForm({ ...gymMetricsForm, pullUpPB: e.target.value })}
                  className="tm-input"
                  placeholder="Enter number of reps"
                />
              </div>
            </div>
            <div className="p-6 border-t border-tm-border flex justify-end space-x-3">
              <button
                onClick={() => { setShowGymMetricsModal(false); setSelectedPlayerForGym(null) }}
                className="px-6 py-2 border border-tm-border rounded-[6px] font-semibold text-tm-text-1 hover:bg-tm-surface-hover transition-colors"
                disabled={savingGymMetrics}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setSavingGymMetrics(true)
                  try {
                    const playerId = selectedPlayerForGym.user_id || selectedPlayerForGym.id
                    
                    // Use API route to update gym stats (bypasses RLS)
                    const response = await fetch(`/api/players/${playerId}/gym-stats`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        benchPressPB: gymMetricsForm.benchPressPB && gymMetricsForm.benchPressPB.trim() !== '' ? parseFloat(gymMetricsForm.benchPressPB) : null,
                        squatPB: gymMetricsForm.squatPB && gymMetricsForm.squatPB.trim() !== '' ? parseFloat(gymMetricsForm.squatPB) : null,
                        deadliftPB: gymMetricsForm.deadliftPB && gymMetricsForm.deadliftPB.trim() !== '' ? parseFloat(gymMetricsForm.deadliftPB) : null,
                        pullUpPB: gymMetricsForm.pullUpPB && gymMetricsForm.pullUpPB.trim() !== '' ? parseInt(gymMetricsForm.pullUpPB) : null,
                      }),
                    })

                    if (!response.ok) {
                      const error = await response.json()
                      throw new Error(error.error || 'Failed to update gym metrics')
                    }

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
                className="px-6 py-2 bg-tm-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
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
