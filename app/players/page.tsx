'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { Users, Search, Filter, UserPlus, Eye, Edit, AlertCircle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Player {
  id: string
  name: string
  position: string
  status: string
  email: string
  phone?: string
  games_played: number
  tries: number
  tackles: number
}

export default function PlayersPage() {
  const [user, setUser] = useState<any>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    const loadData = async () => {
      // Check for dev mode
      if (typeof window !== 'undefined') {
        const devUser = localStorage.getItem('dev_user')
        if (devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            // Mock players data for dev mode
            setPlayers([
              {
                id: '1',
                name: 'John Doe',
                position: 'Fly Half',
                status: 'active',
                email: 'john@example.com',
                phone: '+256 700 000 000',
                games_played: 15,
                tries: 8,
                tackles: 45,
              },
              {
                id: '2',
                name: 'Jane Smith',
                position: 'Prop',
                status: 'active',
                email: 'jane@example.com',
                phone: '+256 700 000 001',
                games_played: 12,
                tries: 2,
                tackles: 38,
              },
              {
                id: '3',
                name: 'Mike Johnson',
                position: 'Wing',
                status: 'injured',
                email: 'mike@example.com',
                phone: '+256 700 000 002',
                games_played: 10,
                tries: 5,
                tackles: 20,
              },
              {
                id: '4',
                name: 'Sarah Williams',
                position: 'Scrum Half',
                status: 'active',
                email: 'sarah@example.com',
                phone: '+256 700 000 003',
                games_played: 18,
                tries: 3,
                tackles: 52,
              },
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
            .select('*')
            .eq('role', 'player')

          if (playersData) {
            setPlayers(playersData as Player[])
          }
        }
      }
      setLoading(false)
    }

    loadData()
  }, [])

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
    const matchesSearch =
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'all' || player.status === filterStatus
    return matchesSearch && matchesFilter
  })

  return (
    <Layout pageTitle="Players">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-extrabold text-club-gradient mb-2">Player Management</h1>
            <p className="text-lg text-neutral-medium font-medium">Manage and view all players</p>
          </div>
          <button className="bg-club-gradient text-white px-6 py-3 rounded-button font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center">
            <UserPlus className="w-5 h-5 mr-2" />
            Add Player
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Total Players"
            value={totalPlayers}
            icon={Users}
            iconColor="bg-primary"
          />
          <StatCard
            title="Active Players"
            value={`${activePlayers} (${Math.round((activePlayers / totalPlayers) * 100)}%)`}
            icon={CheckCircle}
            iconColor="bg-success"
          />
          <StatCard
            title="Injured Players"
            value={injuredPlayers}
            icon={AlertCircle}
            iconColor="bg-secondary"
          />
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-medium w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, position, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-medium w-5 h-5" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="pl-10 pr-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="injured">Injured</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        {/* Players Table */}
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
                    <td colSpan={7} className="px-6 py-12 text-center text-neutral-medium">
                      No players found
                    </td>
                  </tr>
                ) : (
                  filteredPlayers.map((player) => (
                    <tr
                      key={player.id}
                      className="hover:bg-neutral-light transition-colors cursor-pointer"
                    >
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
                      <td className="px-6 py-4 text-sm text-neutral-medium capitalize">
                        {player.position.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            player.status === 'active'
                              ? 'bg-success/10 text-success'
                              : player.status === 'injured'
                              ? 'bg-secondary/10 text-secondary'
                              : 'bg-warning/10 text-warning'
                          }`}
                        >
                          {player.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-medium">{player.games_played}</td>
                      <td className="px-6 py-4 text-sm text-neutral-medium">{player.tries}</td>
                      <td className="px-6 py-4 text-sm text-neutral-medium">{player.tackles}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-info hover:bg-info/10 rounded-lg transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
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
    </Layout>
  )
}


