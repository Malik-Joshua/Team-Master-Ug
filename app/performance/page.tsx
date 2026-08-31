'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { BarChart3, TrendingUp, TrendingDown, Trophy, Target, Activity, Calendar, Users, Award, AlertCircle, DollarSign, FileText, CheckCircle, Plus, Edit, Trash2, X, Save, Utensils, Dumbbell, PlayCircle, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RefreshButton from '@/components/RefreshButton'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

export default function PerformancePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Coach-specific stats
  const [coachStats, setCoachStats] = useState({
    trainingSessionsConducted: 0,
    matchesAttended: 0,
  })
  const [teamStats, setTeamStats] = useState<any>(null)
  const [playersSummary, setPlayersSummary] = useState<any[]>([])
  const [coachMatches, setCoachMatches] = useState<any[]>([])
  
  // Team Manager-specific stats
  const [teamManagerStats, setTeamManagerStats] = useState({
    gameDays: 0,
    trainingSessionsAttended: 0,
    injuryReports: 0,
  })
  const [injuryReports, setInjuryReports] = useState<any[]>([])
  const [teamManagerMatches, setTeamManagerMatches] = useState<any[]>([])
  
  // Finance Admin - Club Performance stats
  const [clubPerformance, setClubPerformance] = useState<any>(null)
  
  // Admin - Club Performance stats
  const [adminClubPerformance, setAdminClubPerformance] = useState<any>(null)
  
  // Player-specific stats
  const [playerStats, setPlayerStats] = useState({
    totalMatches: 0,
    totalTries: 0,
    totalTackles: 0,
    avgMinutes: 0,
    winRate: 0,
  })
  const [recentMatches, setRecentMatches] = useState<Array<{
    matchId: string
    opponent: string
    tournamentType: string
    matchDate: string
    result?: string | null
    tries: number
    tackles: number
    minutes: number
  }>>([])

  // Physio-specific stats
  const [physioStats, setPhysioStats] = useState({
    trainingSessionsAttended: 0,
    gamesAttended: 0,
  })

  // Performance Resources (for players and admins/coaches)
  const [performanceResources, setPerformanceResources] = useState<any[]>([])
  const [loadingResources, setLoadingResources] = useState(false)
  const [showResourceModal, setShowResourceModal] = useState(false)
  const [editingResource, setEditingResource] = useState<any>(null)
  const [resourceForm, setResourceForm] = useState({
    title: '',
    description: '',
    resource_type: 'diet_plan',
    content: '',
    attachment_url: '', // Keep for backward compatibility
    links: [] as Array<{ url: string; label: string }>,
    is_active: true,
  })
  const [selectedResourceType, setSelectedResourceType] = useState<string>('all')

  // Debug: Log when modal state changes
  useEffect(() => {
    console.log('showResourceModal changed:', showResourceModal)
  }, [showResourceModal])

  // Load performance resources
  const loadPerformanceResources = useCallback(async (userRole: string) => {
    setLoadingResources(true)
    try {
      const url = selectedResourceType !== 'all' 
        ? `/api/performance-resources?type=${selectedResourceType}`
        : '/api/performance-resources'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setPerformanceResources(data.resources || [])
      } else {
        console.error('Failed to load performance resources')
      }
    } catch (error) {
      console.error('Error loading performance resources:', error)
    } finally {
      setLoadingResources(false)
    }
  }, [selectedResourceType])

  const loadData = useCallback(async () => {
      setLoading(true)
      
      // Clear dev mode data to avoid mock/test content
      if (typeof window !== 'undefined') {
        if (localStorage.getItem('dev_user') || localStorage.getItem('dev_role')) {
          localStorage.removeItem('dev_user')
          localStorage.removeItem('dev_role')
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

        // Load performance resources
        if (profile) {
          await loadPerformanceResources(profile.role)
          setUser(profile)

          if (profile.role === 'coach' || profile.role === 'asst_coach') {
            // Load coach-specific data
            try {
              const { db } = await import('@/lib/db-helpers')
              
              // Training sessions conducted
              const sessionsCount = await db.getCoachTrainingSessionsCount(authUser.id)
              
              // Matches attended
              const matchesCount = await db.getCoachMatchesAttended(authUser.id)
              const matches = await db.getCoachMatches(authUser.id)
              
              // Team performance stats
              const teamPerformance = await db.getTeamPerformanceStats()
              
              // Players performance summary
              const playersPerf = await db.getPlayersPerformanceSummary()
              
              setCoachStats({
                trainingSessionsConducted: sessionsCount,
                matchesAttended: matchesCount,
              })
              setTeamStats(teamPerformance)
              setPlayersSummary(playersPerf)
              setCoachMatches(matches)
            } catch (error) {
              console.error('Error loading coach performance data:', error)
              // Set default values on error
              setTeamStats({
                totalTries: 0,
                totalTackles: 0,
                totalTacklesMissed: 0,
                totalBallCarries: 0,
                totalBallHandlingErrors: 0,
                matchCount: 0,
                avgTriesPerMatch: 0,
                avgTacklesPerMatch: 0,
                tackleSuccessRate: 0,
              })
            }
          } else if (profile.role === 'data_admin') {
            // Load Team Manager-specific data
            try {
              const { db } = await import('@/lib/db-helpers')
              
              // Game days (matches created by team manager)
              const gameDays = await db.getTeamManagerGameDays(authUser.id)
              
              // Training sessions attended (where team manager recorded attendance)
              const trainingSessions = await db.getTeamManagerTrainingSessionsAttended(authUser.id)
              
              // Injury reports - use API route to bypass RLS
              let injuries: any[] = []
              try {
                const injuryResponse = await fetch('/api/admin/injury-reports', {
                  cache: 'no-store',
                  headers: {
                    'Cache-Control': 'no-cache',
                  }
                })
                if (injuryResponse.ok) {
                  const injuryData = await injuryResponse.json()
                  injuries = injuryData.injuries || []
                  console.log('Loaded injury reports from API:', injuries.length)
                } else {
                  console.error('Error fetching injury reports:', await injuryResponse.json())
                  // Fallback to db helper
                  injuries = await db.getInjuryReports()
                }
              } catch (injuryError) {
                console.error('Error loading injury reports:', injuryError)
                // Fallback to db helper
                injuries = await db.getInjuryReports()
              }
              
              // Matches created by team manager
              const matches = await db.getTeamManagerMatches(authUser.id)
              
              // Players performance summary
              const playersPerf = await db.getPlayersPerformanceSummary()
              
              setTeamManagerStats({
                gameDays,
                trainingSessionsAttended: trainingSessions,
                injuryReports: injuries.length,
              })
              setInjuryReports(injuries)
              setPlayersSummary(playersPerf)
              setTeamManagerMatches(matches)
            } catch (error) {
              console.error('Error loading team manager performance data:', error)
            }
          } else if (profile.role === 'finance_admin') {
            // Load Club Performance data for Finance Admin
            try {
              const { db } = await import('@/lib/db-helpers')
              const performance = await db.getClubFinancialPerformance()
              setClubPerformance(performance)
            } catch (error) {
              console.error('Error loading club performance data:', error)
            }
          } else if (profile.role === 'admin') {
            // Load Club Performance data for Admin using API route (bypasses RLS)
            try {
              const response = await fetch('/api/admin/performance')
              if (response.ok) {
                const performance = await response.json()
                setAdminClubPerformance(performance)
              } else {
                const error = await response.json()
                console.error('Error loading club performance data:', error)
                // Fallback to db helper if API fails
                const { db } = await import('@/lib/db-helpers')
                const performance = await db.getClubPerformance()
                setAdminClubPerformance(performance)
              }
            } catch (error) {
              console.error('Error loading club performance data:', error)
              // Fallback to db helper if API fails
              try {
                const { db } = await import('@/lib/db-helpers')
                const performance = await db.getClubPerformance()
                setAdminClubPerformance(performance)
              } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError)
              }
            }
          } else if (profile.role === 'physio') {
            // Load Physio-specific data
            try {
              const { db } = await import('@/lib/db-helpers')
              const sessionsCount = await db.getTotalTrainingSessions()
              const matchesCount = await db.getTotalMatches()
              setPhysioStats({
                trainingSessionsAttended: sessionsCount,
                gamesAttended: matchesCount,
              })
            } catch (error) {
              console.error('Error loading physio performance data:', error)
            }
          } else {
            // Load player-specific match stats - only count games where stats have been entered
            try {
              const { data: matchStats } = await supabase
                .from('match_stats')
                .select('match_id, tries_scored, tackles_made, minutes_played, matches:matches (opponent, tournament_type, match_date, result)')
                .eq('player_id', authUser.id)

              if (matchStats && matchStats.length > 0) {
                // Count unique matches (games played) - only games with stats entered count
                const uniqueMatchIds = new Set(matchStats.map(stat => stat.match_id))
                const totalMatches = uniqueMatchIds.size
                
                const totalTries = matchStats.reduce((sum, stat) => sum + (stat.tries_scored || 0), 0)
                const totalTackles = matchStats.reduce((sum, stat) => sum + (stat.tackles_made || 0), 0)
                const totalMinutes = matchStats.reduce((sum, stat) => sum + (stat.minutes_played || 0), 0)

                setPlayerStats({
                  totalMatches: totalMatches, // Count unique matches, not total stats records
                  totalTries,
                  totalTackles,
                  avgMinutes: totalMatches > 0 ? Math.round(totalMinutes / totalMatches) : 0,
                  winRate: 0,
                })

                const recent = matchStats
                  .map((stat: any) => ({
                    matchId: stat.match_id,
                    opponent: stat.matches?.opponent || 'Unknown Opponent',
                    tournamentType: stat.matches?.tournament_type || 'match',
                    matchDate: stat.matches?.match_date || '',
                    result: stat.matches?.result || null,
                    tries: stat.tries_scored || 0,
                    tackles: stat.tackles_made || 0,
                    minutes: stat.minutes_played || 0,
                  }))
                  .filter((item: any) => item.matchDate)
                  .sort((a: any, b: any) => (a.matchDate < b.matchDate ? 1 : -1))
                  .slice(0, 5)
                setRecentMatches(recent)
              } else {
                // No match stats means no games played
                setPlayerStats({
                  totalMatches: 0,
                  totalTries: 0,
                  totalTackles: 0,
                  avgMinutes: 0,
                  winRate: 0,
                })
                setRecentMatches([])
              }
            } catch (error) {
              console.error('Error loading player performance data:', error)
              setRecentMatches([])
            }
          }
        }
      }
      
      setLoading(false)
    }, [loadPerformanceResources])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Reload resources when filter changes
  useEffect(() => {
    if (user) {
      loadPerformanceResources(user.role)
    }
  }, [selectedResourceType, user, loadPerformanceResources])

  // Handle create/update resource
  const handleSaveResource = async () => {
    // Validate required fields
    if (!resourceForm.title || !resourceForm.title.trim()) {
      alert('Please enter a title for the resource')
      return
    }

    if (!resourceForm.content || !resourceForm.content.trim()) {
      alert('Please enter content for the resource')
      return
    }

    if (!resourceForm.resource_type) {
      alert('Please select a resource type')
      return
    }

    try {
      const url = editingResource 
        ? `/api/performance-resources/${editingResource.id}`
        : '/api/performance-resources'
      const method = editingResource ? 'PUT' : 'POST'

      console.log('Saving resource:', { url, method, resourceForm })

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resourceForm),
      })

      const responseData = await response.json()

      if (response.ok) {
        console.log('Resource saved successfully:', responseData)
        await loadPerformanceResources(user?.role || 'player')
        setShowResourceModal(false)
        setEditingResource(null)
        setResourceForm({
          title: '',
          description: '',
          resource_type: 'diet_plan',
          content: '',
          attachment_url: '',
          links: [],
          is_active: true,
        })
        alert(editingResource ? 'Resource updated successfully!' : 'Resource created successfully!')
      } else {
        console.error('Error saving resource:', responseData)
        const errorMessage = responseData.error || `Failed to ${editingResource ? 'update' : 'create'} resource. Status: ${response.status}`
        alert(`Error: ${errorMessage}`)
      }
    } catch (error: any) {
      console.error('Exception saving resource:', error)
      alert(`Error: ${error.message || 'Failed to save resource. Please try again.'}`)
    }
  }

  // Handle delete resource
  const handleDeleteResource = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) return

    try {
      const response = await fetch(`/api/performance-resources/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadPerformanceResources(user?.role || 'player')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  // Get resource type icon and label
  const getResourceTypeInfo = (type: string) => {
    switch (type) {
      case 'diet_plan':
        return { icon: Utensils, label: 'Diet Plan', color: 'bg-success' }
      case 'gym_programme':
        return { icon: Dumbbell, label: 'Gym Programme', color: 'bg-primary' }
      case 'play_info':
        return { icon: PlayCircle, label: 'Play Information', color: 'bg-info' }
      case 'position_info':
        return { icon: MapPin, label: 'Position Information', color: 'bg-warning' }
      default:
        return { icon: FileText, label: 'Resource', color: 'bg-neutral-medium' }
    }
  }

  // Open resource modal for editing
  const handleEditResource = (resource: any) => {
    setEditingResource(resource)
    // Load links from resource, or convert attachment_url to links format for backward compatibility
    let resourceLinks: Array<{ url: string; label: string }> = []
    if (resource.links && Array.isArray(resource.links) && resource.links.length > 0) {
      resourceLinks = resource.links
    } else if (resource.attachment_url && resource.attachment_url.trim() !== '') {
      resourceLinks = [{ url: resource.attachment_url, label: 'Attachment' }]
    }
    
    setResourceForm({
      title: resource.title,
      description: resource.description || '',
      resource_type: resource.resource_type,
      content: resource.content,
      attachment_url: resource.attachment_url || '',
      links: resourceLinks,
      is_active: resource.is_active,
    })
    setShowResourceModal(true)
  }

  // Open resource modal for creating
  const handleNewResource = () => {
    // Prevent multiple calls
    if (showResourceModal) {
      console.log('Modal already open, ignoring click')
      return
    }
    
    console.log('handleNewResource called', { user: user?.role, showResourceModal })
    setEditingResource(null)
    setResourceForm({
      title: '',
      description: '',
      resource_type: 'diet_plan',
      content: '',
      attachment_url: '',
      links: [],
      is_active: true,
    })
    setShowResourceModal(true)
    console.log('Modal state set to true')
  }

  if (loading || !user) {
    return (
      <Layout pageTitle="Performance">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  // Team Manager Performance View
  if (user.role === 'data_admin') {
    const teamManagerPerformanceCards = [
      {
        title: 'Game Days',
        value: teamManagerStats.gameDays,
        icon: Trophy,
        color: 'bg-primary',
        description: 'Matches managed as Team Manager',
      },
      {
        title: 'Training Sessions',
        value: teamManagerStats.trainingSessionsAttended,
        icon: Calendar,
        color: 'bg-success',
        description: 'Sessions attended/recorded',
      },
      {
        title: 'Injury Reports',
        value: teamManagerStats.injuryReports,
        icon: AlertCircle,
        color: 'bg-secondary',
        description: 'Players currently injured',
      },
      {
        title: 'Total Players',
        value: playersSummary.length,
        icon: Users,
        color: 'bg-info',
        description: 'Players in system',
      },
    ]

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'active':
          return 'bg-success/10 text-success'
        case 'injured':
          return 'bg-warning/10 text-warning'
        case 'inactive':
          return 'bg-neutral-medium/10 text-tm-text-3'
        default:
          return 'bg-tm-surface-hover/10 text-tm-text-3'
      }
    }

    return (
      <Layout pageTitle="Team Manager Performance">
        <div className="space-y-6">
          <div className="mb-2">
            <h1 className="text-[20px] font-medium text-tm-text-1">Team Manager Performance Dashboard</h1>
            <p className="text-[13px] text-tm-text-3">Track your management activities and team overview</p>
          </div>

          {/* Team Manager Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {teamManagerPerformanceCards.map((card) => {
              const Icon = card.icon
              return (
                <StatCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  icon={Icon}
                  iconColor={card.color}
                  description={card.description}
                />
              )
            })}
          </div>

          {/* Injury Reports Section */}
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <h2 className="text-2xl font-bold text-tm-text-1 mb-6 flex items-center">
              <AlertCircle className="w-6 h-6 mr-2 text-secondary" />
              Injury Reports
            </h2>
            {injuryReports.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-tm-text-3 mx-auto mb-4" />
                <p className="text-tm-text-3">No injury reports at this time</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-tm-border">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Player Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Position</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {injuryReports.map((player) => (
                      <tr key={player.user_id || player.id} className="border-b border-tm-border/50 hover:bg-tm-surface-hover/30 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-tm-text-1">{player.name}</p>
                        </td>
                        <td className="py-3 px-4 text-tm-text-3 capitalize">
                          {player.position?.replace('_', ' ') || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-tm-text-3">{player.email}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(player.status)}`}>
                            {player.status || 'injured'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Players Performance Summary */}
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <h2 className="text-2xl font-bold text-tm-text-1 mb-6 flex items-center">
              <Users className="w-6 h-6 mr-2 text-primary" />
              Players Performance Summary
            </h2>
            {playersSummary.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-tm-text-3 mx-auto mb-4" />
                <p className="text-tm-text-3">No player data available yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-tm-border">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Player Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Status</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-tm-text-1">Matches</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-tm-text-1">Tries</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-tm-text-1">Tackles</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-tm-text-1">Avg Minutes</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-tm-text-1">Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playersSummary.map((player) => (
                      <tr key={player.playerId || player.id} className="border-b border-tm-border/50 hover:bg-tm-surface-hover/30 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-tm-text-1">{player.name}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(player.status)}`}>
                            {player.status || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-tm-text-1">{player.totalMatches || 0}</td>
                        <td className="py-3 px-4 text-center text-tm-text-1">{player.totalTries || 0}</td>
                        <td className="py-3 px-4 text-center text-tm-text-1">{player.totalTackles || 0}</td>
                        <td className="py-3 px-4 text-center text-tm-text-1">{player.avgMinutes || 0} min</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-semibold ${player.attendanceRate >= 80 ? 'text-success' : player.attendanceRate >= 60 ? 'text-warning' : 'text-secondary'}`}>
                            {player.attendanceRate || 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Performance Resources Management */}
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-tm-text-1">Performance Resources</h2>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleNewResource()
                }}
                className="bg-primary text-tm-on-secondary px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Resource
              </button>
            </div>
            <PerformanceResourcesManagement
              resources={performanceResources}
              loading={loadingResources}
              onRefresh={() => loadPerformanceResources(user?.role || 'coach')}
              onEdit={handleEditResource}
              onDelete={handleDeleteResource}
            />
          </div>

          {/* Recent Game Days */}
          {teamManagerMatches.length > 0 && (
            <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
              <h2 className="text-2xl font-bold text-tm-text-1 mb-6 flex items-center">
                <Trophy className="w-6 h-6 mr-2 text-primary" />
                Recent Game Days
              </h2>
              <div className="space-y-3">
                {teamManagerMatches.slice(0, 5).map((match) => {
                  const matchDate = new Date(match.match_date)
                  const getResultColor = (result: string) => {
                    switch (result) {
                      case 'win':
                        return 'bg-success/10 text-success'
                      case 'loss':
                        return 'bg-[#E05757]/10 text-[#E05757]'
                      case 'draw':
                        return 'bg-warning/10 text-warning'
                      default:
                        return 'bg-tm-surface-hover/10 text-tm-text-3'
                    }
                  }
                  
                  return (
                    <div key={match.id} className="p-4 bg-tm-surface-hover/50 rounded-lg hover:bg-tm-surface-hover transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-tm-text-1">{match.opponent}</p>
                          <p className="text-sm text-tm-text-3">
                            {matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {match.tournament_type}
                            {match.score_our_team !== null && match.score_opponent !== null && (
                              <span className="ml-2">
                                {match.score_our_team} - {match.score_opponent}
                              </span>
                            )}
                          </p>
                        </div>
                        {match.result && (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getResultColor(match.result)}`}>
                            {match.result.charAt(0).toUpperCase() + match.result.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Resource Modal */}
        {showResourceModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-3 sm:p-4"
            style={{ position: 'fixed', zIndex: 9999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowResourceModal(false)
                setEditingResource(null)
              }
            }}
          >
            <div className="bg-tm-surface rounded-lg w-full max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-tm-surface border-b border-tm-border p-4 sm:p-6 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-tm-text-1">
                  {editingResource ? 'Edit Resource' : 'Create New Resource'}
                </h3>
                <button
                  onClick={() => {
                    setShowResourceModal(false)
                    setEditingResource(null)
                    setResourceForm({
                      title: '',
                      description: '',
                      resource_type: 'diet_plan',
                      content: '',
                      attachment_url: '',
                      links: [],
                      is_active: true,
                    })
                  }}
                  className="p-2 hover:bg-tm-surface-hover rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={resourceForm.title}
                    onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter resource title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Resource Type *
                  </label>
                  <select
                    value={resourceForm.resource_type}
                    onChange={(e) => setResourceForm({ ...resourceForm, resource_type: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="diet_plan">Diet Plan</option>
                    <option value="gym_programme">Gym Programme</option>
                    <option value="play_info">Play Information</option>
                    <option value="position_info">Position Information</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={resourceForm.description}
                    onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Brief description (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Content *
                  </label>
                  <textarea
                    value={resourceForm.content}
                    onChange={(e) => setResourceForm({ ...resourceForm, content: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[200px]"
                    placeholder="Enter the resource content (supports markdown)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    External Links (optional)
                  </label>
                  <div className="space-y-3">
                    {resourceForm.links.map((link, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={link.label}
                            onChange={(e) => {
                              const newLinks = [...resourceForm.links]
                              newLinks[index].label = e.target.value
                              setResourceForm({ ...resourceForm, links: newLinks })
                            }}
                            className="px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Link label (e.g., PDF, Video)"
                          />
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => {
                              const newLinks = [...resourceForm.links]
                              newLinks[index].url = e.target.value
                              setResourceForm({ ...resourceForm, links: newLinks })
                            }}
                            className="px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="https://example.com/file.pdf"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newLinks = resourceForm.links.filter((_, i) => i !== index)
                            setResourceForm({ ...resourceForm, links: newLinks })
                          }}
                          className="p-2 text-[#E05757] hover:bg-[#E05757]/10 rounded-lg transition-colors"
                          title="Remove link"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setResourceForm({
                          ...resourceForm,
                          links: [...resourceForm.links, { url: '', label: '' }]
                        })
                      }}
                      className="w-full px-4 py-2 border-2 border-dashed border-tm-border rounded-lg text-tm-text-1 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Add Link
                    </button>
                  </div>
                  <p className="text-xs text-tm-text-1 mt-2">
                    Add multiple links that players can click on. Each link needs a label and URL.
                  </p>
                </div>
                {(user?.role === 'admin' || user?.role === 'coach' || user?.role === 'asst_coach') && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active_data_admin"
                      checked={resourceForm.is_active}
                      onChange={(e) => setResourceForm({ ...resourceForm, is_active: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label htmlFor="is_active_data_admin" className="text-sm text-tm-text-1">
                      Active (visible to players)
                    </label>
                  </div>
                )}
                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowResourceModal(false)
                      setEditingResource(null)
                      setResourceForm({
                        title: '',
                        description: '',
                        resource_type: 'diet_plan',
                        content: '',
                        attachment_url: '',
                        links: [],
                        is_active: true,
                      })
                    }}
                    className="px-4 py-2 border border-tm-border rounded-lg text-tm-text-1 hover:bg-tm-surface-hover transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveResource}
                    className="px-4 py-2 bg-primary text-tm-on-secondary rounded-lg font-semibold hover:opacity-90 transition-all"
                  >
                    <Save className="w-4 h-4 inline mr-2" />
                    {editingResource ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Layout>
    )
  }

  // Coach Performance View
  if (user.role === 'coach' || user.role === 'asst_coach') {
    const coachPerformanceCards = [
      {
        title: 'Training Sessions',
        value: coachStats.trainingSessionsConducted,
        icon: Calendar,
        color: 'bg-primary',
        description: 'Total sessions conducted',
      },
      {
        title: 'Matches Attended',
        value: coachStats.matchesAttended,
        icon: Trophy,
        color: 'bg-secondary',
        description: 'Matches as coach',
      },
      {
        title: 'Team Tries',
        value: teamStats?.totalTries || 0,
        icon: Target,
        color: 'bg-success',
        description: 'Total team tries scored',
      },
      {
        title: 'Team Tackles',
        value: teamStats?.totalTackles || 0,
        icon: Activity,
        color: 'bg-info',
        description: 'Total team tackles made',
      },
      {
        title: 'Tackle Success',
        value: teamStats ? `${teamStats.tackleSuccessRate}%` : '0%',
        icon: TrendingUp,
        color: 'bg-warning',
        description: 'Team tackle success rate',
      },
    ]

    // Team performance chart data
    const teamChartData = teamStats ? {
      labels: ['Tries', 'Tackles', 'Ball Carries', 'Handling Errors'],
      datasets: [
        {
          label: 'Team Performance',
          data: [
            teamStats.totalTries,
            teamStats.totalTackles,
            teamStats.totalBallCarries,
            teamStats.totalBallHandlingErrors,
          ],
          backgroundColor: [
            'rgba(37, 99, 235, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(251, 191, 36, 0.8)',
            'rgba(239, 68, 68, 0.8)',
          ],
          borderColor: [
            'rgba(37, 99, 235, 1)',
            'rgba(34, 197, 94, 1)',
            'rgba(251, 191, 36, 1)',
            'rgba(239, 68, 68, 1)',
          ],
          borderWidth: 2,
        },
      ],
    } : null

    const teamChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    }

    // Player attendance chart
    const topPlayers = [...playersSummary]
      .sort((a, b) => b.attendanceRate - a.attendanceRate)
      .slice(0, 10)

    const attendanceChartData = topPlayers.length > 0 ? {
      labels: topPlayers.map(p => p.name),
      datasets: [
        {
          label: 'Training Attendance Rate (%)',
          data: topPlayers.map(p => p.attendanceRate),
          backgroundColor: 'rgba(37, 99, 235, 0.6)',
          borderColor: 'rgba(37, 99, 235, 1)',
          borderWidth: 2,
        },
      ],
    } : null

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'active':
          return 'bg-success/10 text-success'
        case 'injured':
          return 'bg-warning/10 text-warning'
        case 'inactive':
          return 'bg-neutral-medium/10 text-tm-text-3'
        default:
          return 'bg-tm-surface-hover/10 text-tm-text-3'
      }
    }

    return (
      <Layout pageTitle="Coach Performance">
        <div className="space-y-6">
          <div className="mb-2">
            <h1 className="text-[20px] font-medium text-tm-text-1">Coach Performance Dashboard</h1>
            <p className="text-[13px] text-tm-text-3">Track your coaching activities and team performance</p>
          </div>

          {/* Coach Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {coachPerformanceCards.map((card) => {
              const Icon = card.icon
              return (
                <StatCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  icon={Icon}
                  iconColor={card.color}
                  description={card.description}
                />
              )
            })}
          </div>

          {/* Team Performance Chart */}
          {teamChartData && (
            <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
              <h2 className="text-2xl font-bold text-tm-text-1 mb-6">Team Performance Overview</h2>
              <div className="h-64">
                <Bar data={teamChartData} options={teamChartOptions} />
              </div>
              {teamStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-tm-border">
                  <div>
                    <p className="text-sm text-tm-text-3">Avg Tries/Match</p>
                    <p className="text-2xl font-bold text-primary">{teamStats.avgTriesPerMatch}</p>
                  </div>
                  <div>
                    <p className="text-sm text-tm-text-3">Avg Tackles/Match</p>
                    <p className="text-2xl font-bold text-success">{teamStats.avgTacklesPerMatch}</p>
                  </div>
                  <div>
                    <p className="text-sm text-tm-text-3">Total Matches</p>
                    <p className="text-2xl font-bold text-info">{teamStats.matchCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-tm-text-3">Tackle Success Rate</p>
                    <p className="text-2xl font-bold text-warning">{teamStats.tackleSuccessRate}%</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Player Attendance Chart */}
          {attendanceChartData && topPlayers.length > 0 && (
            <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
              <h2 className="text-2xl font-bold text-tm-text-1 mb-6">Top Players - Training Attendance</h2>
              <div className="h-64">
                <Bar data={attendanceChartData} options={teamChartOptions} />
              </div>
            </div>
          )}

          {/* Players Performance Summary */}
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <h2 className="text-2xl font-bold text-tm-text-1 mb-6 flex items-center">
              <Users className="w-6 h-6 mr-2 text-primary" />
              Players Performance Summary
            </h2>
            {playersSummary.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-tm-text-3 mx-auto mb-4" />
                <p className="text-tm-text-3">No player data available yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-tm-border">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Player Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Status</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-tm-text-1">Matches</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-tm-text-1">Tries</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-tm-text-1">Tackles</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-tm-text-1">Avg Minutes</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-tm-text-1">Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playersSummary.map((player) => (
                      <tr key={player.playerId} className="border-b border-tm-border/50 hover:bg-tm-surface-hover/30 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-tm-text-1">{player.name}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(player.status)}`}>
                            {player.status || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-tm-text-1">{player.totalMatches}</td>
                        <td className="py-3 px-4 text-center text-tm-text-1">{player.totalTries}</td>
                        <td className="py-3 px-4 text-center text-tm-text-1">{player.totalTackles}</td>
                        <td className="py-3 px-4 text-center text-tm-text-1">{player.avgMinutes} min</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-semibold ${player.attendanceRate >= 80 ? 'text-success' : player.attendanceRate >= 60 ? 'text-warning' : 'text-secondary'}`}>
                            {player.attendanceRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Matches */}
          {coachMatches.length > 0 && (
            <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
              <h2 className="text-2xl font-bold text-tm-text-1 mb-6 flex items-center">
                <Trophy className="w-6 h-6 mr-2 text-primary" />
                Recent Matches
              </h2>
              <div className="space-y-3">
                {coachMatches.slice(0, 5).map((match) => {
                  const matchDate = new Date(match.match_date)
                  const getResultColor = (result: string) => {
                    switch (result) {
                      case 'win':
                        return 'bg-success/10 text-success'
                      case 'loss':
                        return 'bg-[#E05757]/10 text-[#E05757]'
                      case 'draw':
                        return 'bg-warning/10 text-warning'
                      default:
                        return 'bg-tm-surface-hover/10 text-tm-text-3'
                    }
                  }
                  
                  return (
                    <div key={match.id} className="p-4 bg-tm-surface-hover/50 rounded-lg hover:bg-tm-surface-hover transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-tm-text-1">{match.opponent}</p>
                          <p className="text-sm text-tm-text-3">
                            {matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {match.tournament_type}
                            {match.score_our_team !== null && match.score_opponent !== null && (
                              <span className="ml-2">
                                {match.score_our_team} - {match.score_opponent}
                              </span>
                            )}
                          </p>
                        </div>
                        {match.result && (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getResultColor(match.result)}`}>
                            {match.result.charAt(0).toUpperCase() + match.result.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Performance Resources Management */}
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-tm-text-1">Performance Resources</h2>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleNewResource()
                }}
                className="bg-primary text-tm-on-secondary px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Resource
              </button>
            </div>
            <PerformanceResourcesManagement
              resources={performanceResources}
              loading={loadingResources}
              onRefresh={() => loadPerformanceResources(user?.role || 'coach')}
              onEdit={handleEditResource}
              onDelete={handleDeleteResource}
            />
          </div>
        </div>

        {/* Resource Modal */}
        {showResourceModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-3 sm:p-4"
            style={{ position: 'fixed', zIndex: 9999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowResourceModal(false)
                setEditingResource(null)
              }
            }}
          >
            <div className="bg-tm-surface rounded-lg w-full max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-tm-surface border-b border-tm-border p-4 sm:p-6 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-tm-text-1">
                  {editingResource ? 'Edit Resource' : 'Create New Resource'}
                </h3>
                <button
                  onClick={() => {
                    setShowResourceModal(false)
                    setEditingResource(null)
                    setResourceForm({
                      title: '',
                      description: '',
                      resource_type: 'diet_plan',
                      content: '',
                      attachment_url: '',
                      links: [],
                      is_active: true,
                    })
                  }}
                  className="p-2 hover:bg-tm-surface-hover rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={resourceForm.title}
                    onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter resource title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Resource Type *
                  </label>
                  <select
                    value={resourceForm.resource_type}
                    onChange={(e) => setResourceForm({ ...resourceForm, resource_type: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="diet_plan">Diet Plan</option>
                    <option value="gym_programme">Gym Programme</option>
                    <option value="play_info">Play Information</option>
                    <option value="position_info">Position Information</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={resourceForm.description}
                    onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Brief description (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Content *
                  </label>
                  <textarea
                    value={resourceForm.content}
                    onChange={(e) => setResourceForm({ ...resourceForm, content: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[200px]"
                    placeholder="Enter the resource content (supports markdown)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    External Links (optional)
                  </label>
                  <div className="space-y-3">
                    {resourceForm.links.map((link, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={link.label}
                            onChange={(e) => {
                              const newLinks = [...resourceForm.links]
                              newLinks[index].label = e.target.value
                              setResourceForm({ ...resourceForm, links: newLinks })
                            }}
                            className="px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Link label (e.g., PDF, Video)"
                          />
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => {
                              const newLinks = [...resourceForm.links]
                              newLinks[index].url = e.target.value
                              setResourceForm({ ...resourceForm, links: newLinks })
                            }}
                            className="px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="https://example.com/file.pdf"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newLinks = resourceForm.links.filter((_, i) => i !== index)
                            setResourceForm({ ...resourceForm, links: newLinks })
                          }}
                          className="p-2 text-[#E05757] hover:bg-[#E05757]/10 rounded-lg transition-colors"
                          title="Remove link"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setResourceForm({
                          ...resourceForm,
                          links: [...resourceForm.links, { url: '', label: '' }]
                        })
                      }}
                      className="w-full px-4 py-2 border-2 border-dashed border-tm-border rounded-lg text-tm-text-1 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Add Link
                    </button>
                  </div>
                  <p className="text-xs text-tm-text-1 mt-2">
                    Add multiple links that players can click on. Each link needs a label and URL.
                  </p>
                </div>
                {(user?.role === 'admin' || user?.role === 'coach' || user?.role === 'asst_coach') && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={resourceForm.is_active}
                      onChange={(e) => setResourceForm({ ...resourceForm, is_active: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label htmlFor="is_active" className="text-sm text-tm-text-1">
                      Active (visible to players)
                    </label>
                  </div>
                )}
                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowResourceModal(false)
                      setEditingResource(null)
                      setResourceForm({
                        title: '',
                        description: '',
                        resource_type: 'diet_plan',
                        content: '',
                        attachment_url: '',
                        links: [],
                        is_active: true,
                      })
                    }}
                    className="px-4 py-2 border border-tm-border rounded-lg text-tm-text-1 hover:bg-tm-surface-hover transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveResource}
                    className="px-4 py-2 bg-primary text-tm-on-secondary rounded-lg font-semibold hover:opacity-90 transition-all"
                  >
                    <Save className="w-4 h-4 inline mr-2" />
                    {editingResource ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Layout>
    )
  }

  // Admin - Club Performance View
  if (user.role === 'admin') {
    const formatCurrency = (amount: number) => {
      if (amount >= 1000000) {
        return `UGX ${(amount / 1000000).toFixed(1)}M`
      }
      return `UGX ${amount.toLocaleString()}`
    }

    const clubPerformanceCards = adminClubPerformance ? [
      {
        title: 'Total Players',
        value: adminClubPerformance.clubStats.totalPlayers,
        icon: Users,
        color: 'bg-primary',
        description: 'All registered players',
      },
      {
        title: 'Active Players',
        value: adminClubPerformance.clubStats.activePlayers,
        icon: Activity,
        color: 'bg-success',
        description: 'Currently active players',
      },
      {
        title: 'Total Matches',
        value: adminClubPerformance.clubStats.totalMatches,
        icon: Trophy,
        color: 'bg-warning',
        description: 'Matches played',
      },
      {
        title: 'Win Rate',
        value: `${adminClubPerformance.clubStats.winRate}%`,
        icon: TrendingUp,
        color: 'bg-info',
        description: 'Match win percentage',
      },
      {
        title: 'Training Sessions',
        value: adminClubPerformance.clubStats.totalTrainingSessions,
        icon: Calendar,
        color: 'bg-primary',
        description: 'Total training sessions',
      },
      {
        title: 'Net Balance',
        value: formatCurrency(adminClubPerformance.financial.netBalance),
        icon: DollarSign,
        color: 'bg-success',
        description: 'Financial net balance',
      },
    ] : []

    return (
      <Layout pageTitle="Club Performance">
        <div className="space-y-6">
          <div className="mb-2">
            <h1 className="text-[20px] font-medium text-tm-text-1">Club Performance Dashboard</h1>
            <p className="text-[13px] text-tm-text-3">Comprehensive overview of club performance and statistics</p>
          </div>

          {adminClubPerformance && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
                {clubPerformanceCards.map((card) => {
                  const Icon = card.icon
                  return (
                    <StatCard
                      key={card.title}
                      title={card.title}
                      value={card.value}
                      icon={Icon}
                      iconColor={card.color}
                      description={card.description}
                    />
                  )
                })}
              </div>

              {/* Team Performance Section */}
              {adminClubPerformance.teamStats && (
                <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
                  <h2 className="text-2xl font-bold text-tm-text-1 mb-6 flex items-center">
                    <Trophy className="w-6 h-6 mr-2 text-primary" />
                    Team Performance
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-sm text-tm-text-3 mb-1">Total Tries</p>
                      <p className="text-3xl font-bold text-primary">{adminClubPerformance.teamStats.totalTries}</p>
                    </div>
                    <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                      <p className="text-sm text-tm-text-3 mb-1">Total Tackles</p>
                      <p className="text-3xl font-bold text-success">{adminClubPerformance.teamStats.totalTackles}</p>
                    </div>
                    <div className="p-4 bg-info/10 rounded-lg border border-info/20">
                      <p className="text-sm text-tm-text-3 mb-1">Tackle Success Rate</p>
                      <p className="text-3xl font-bold text-info">{adminClubPerformance.teamStats.tackleSuccessRate}%</p>
                    </div>
                    <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
                      <p className="text-sm text-tm-text-3 mb-1">Avg Tries/Match</p>
                      <p className="text-3xl font-bold text-warning">{adminClubPerformance.teamStats.avgTriesPerMatch}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Match Statistics */}
              {adminClubPerformance.clubStats && (
                <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
                  <h2 className="text-2xl font-bold text-tm-text-1 mb-6 flex items-center">
                    <BarChart3 className="w-6 h-6 mr-2 text-primary" />
                    Match Statistics
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                      <p className="text-sm text-tm-text-3 mb-1">Wins</p>
                      <p className="text-3xl font-bold text-success">{adminClubPerformance.clubStats.wins}</p>
                    </div>
                    <div className="p-4 bg-secondary/10 rounded-lg border border-secondary/20">
                      <p className="text-sm text-tm-text-3 mb-1">Losses</p>
                      <p className="text-3xl font-bold text-secondary">{adminClubPerformance.clubStats.losses}</p>
                    </div>
                    <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
                      <p className="text-sm text-tm-text-3 mb-1">Draws</p>
                      <p className="text-3xl font-bold text-warning">{adminClubPerformance.clubStats.draws}</p>
                    </div>
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-sm text-tm-text-3 mb-1">Win Rate</p>
                      <p className="text-3xl font-bold text-primary">{adminClubPerformance.clubStats.winRate}%</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Financial Overview */}
              {adminClubPerformance.financial && (
                <>
                  <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
                    <h2 className="text-2xl font-bold text-tm-text-1 mb-6 flex items-center">
                      <DollarSign className="w-6 h-6 mr-2 text-success" />
                      Financial Overview
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                        <p className="text-sm text-tm-text-3 mb-1">Total Revenue</p>
                        <p className="text-3xl font-bold text-success">{formatCurrency(adminClubPerformance.financial.totalRevenue)}</p>
                      </div>
                      <div className="p-4 bg-secondary/10 rounded-lg border border-secondary/20">
                        <p className="text-sm text-tm-text-3 mb-1">Total Expenses</p>
                        <p className="text-3xl font-bold text-secondary">{formatCurrency(adminClubPerformance.financial.totalExpenses)}</p>
                      </div>
                      <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                        <p className="text-sm text-tm-text-3 mb-1">Net Balance</p>
                        <p className="text-3xl font-bold text-primary">{formatCurrency(adminClubPerformance.financial.netBalance)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Recent Transactions Table for Admin */}
                  {adminClubPerformance.financial.recentTransactions && adminClubPerformance.financial.recentTransactions.length > 0 && (
                    <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
                      <h2 className="text-2xl font-bold text-tm-text-1 mb-6 flex items-center">
                        <DollarSign className="w-6 h-6 mr-2 text-primary" />
                        Recent Financial Transactions
                      </h2>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-tm-border">
                              <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Date</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Type</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Category</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Amount</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminClubPerformance.financial.recentTransactions.map((transaction: any) => (
                              <tr key={transaction.id} className="border-b border-tm-border/50 hover:bg-tm-surface-hover/30 transition-colors">
                                <td className="py-3 px-4 text-sm text-tm-text-3">
                                  {new Date(transaction.transaction_date).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${transaction.type === 'revenue' ? 'bg-success/10 text-success' : 'bg-[#E05757]/10 text-[#E05757]'}`}>
                                    {transaction.type === 'revenue' ? 'Revenue' : 'Expense'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-tm-text-1 font-medium">{transaction.category}</td>
                                <td className={`py-3 px-4 font-bold ${transaction.type === 'revenue' ? 'text-success' : 'text-secondary'}`}>
                                  {transaction.type === 'revenue' ? '+' : '-'}{formatCurrency(parseFloat(transaction.amount.toString()))}
                                </td>
                                <td className="py-3 px-4 text-sm text-tm-text-3">{transaction.description || 'No description'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(!adminClubPerformance.financial.recentTransactions || adminClubPerformance.financial.recentTransactions.length === 0) && (
                    <div className="bg-tm-surface rounded-card p-8 border border-tm-border shadow-soft text-center">
                      <DollarSign className="w-12 h-12 text-tm-text-3 mx-auto mb-4" />
                      <p className="text-tm-text-3">No recent transactions found</p>
                    </div>
                  )}
                </>
              )}

              {/* Players Performance Summary */}
              {adminClubPerformance.playersPerf && adminClubPerformance.playersPerf.length > 0 && (
                <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
                  <h2 className="text-2xl font-bold text-tm-text-1 mb-6 flex items-center">
                    <Users className="w-6 h-6 mr-2 text-primary" />
                    Players Performance Summary
                  </h2>
                  <div className="md:hidden divide-y divide-tm-border">
                    {adminClubPerformance.playersSummary.map((player: any) => {
                      const getStatusColor = (status: string) => {
                        switch (status) {
                          case 'active':
                            return 'bg-success/10 text-success'
                          case 'injured':
                            return 'bg-warning/10 text-warning'
                          case 'inactive':
                            return 'bg-neutral-medium/10 text-tm-text-3'
                          default:
                            return 'bg-tm-surface-hover/10 text-tm-text-3'
                        }
                      }
                      return (
                        <div key={player.playerId || player.id} className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-tm-text-1">{player.name}</p>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(player.status)}`}>
                              {player.status || 'N/A'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm text-tm-text-3">
                            <div>
                              <p className="text-xs text-tm-text-3">Matches</p>
                              <p className="font-semibold text-tm-text-1">{player.totalMatches || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-tm-text-3">Tries</p>
                              <p className="font-semibold text-tm-text-1">{player.totalTries || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-tm-text-3">Tackles</p>
                              <p className="font-semibold text-tm-text-1">{player.totalTackles || 0}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm text-tm-text-3">
                            <div>
                              <p className="text-xs text-tm-text-3">Avg Minutes</p>
                              <p className="font-semibold text-tm-text-1">{player.avgMinutes || 0} min</p>
                            </div>
                            <div>
                              <p className="text-xs text-tm-text-3">Attendance</p>
                              <p className={`font-semibold ${player.attendanceRate >= 80 ? 'text-success' : player.attendanceRate >= 60 ? 'text-warning' : 'text-secondary'}`}>
                                {player.attendanceRate || 0}%
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-tm-border">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Player Name</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Status</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-tm-text-1">Matches</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-tm-text-1">Tries</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-tm-text-1">Tackles</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-tm-text-1">Avg Minutes</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-tm-text-1">Attendance Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminClubPerformance.playersSummary.map((player: any) => {
                          const getStatusColor = (status: string) => {
                            switch (status) {
                              case 'active':
                                return 'bg-success/10 text-success'
                              case 'injured':
                                return 'bg-warning/10 text-warning'
                              case 'inactive':
                                return 'bg-neutral-medium/10 text-tm-text-3'
                              default:
                                return 'bg-tm-surface-hover/10 text-tm-text-3'
                            }
                          }
                          return (
                            <tr key={player.playerId || player.id} className="border-b border-tm-border/50 hover:bg-tm-surface-hover/30 transition-colors">
                              <td className="py-3 px-4">
                                <p className="font-medium text-tm-text-1">{player.name}</p>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(player.status)}`}>
                                  {player.status || 'N/A'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center text-tm-text-1">{player.totalMatches || 0}</td>
                              <td className="py-3 px-4 text-center text-tm-text-1">{player.totalTries || 0}</td>
                              <td className="py-3 px-4 text-center text-tm-text-1">{player.totalTackles || 0}</td>
                              <td className="py-3 px-4 text-center text-tm-text-1">{player.avgMinutes || 0} min</td>
                              <td className="py-3 px-4 text-center">
                                <span className={`font-semibold ${player.attendanceRate >= 80 ? 'text-success' : player.attendanceRate >= 60 ? 'text-warning' : 'text-secondary'}`}>
                                  {player.attendanceRate || 0}%
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Performance Resources Management */}
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-tm-text-1">Performance Resources</h2>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleNewResource()
                }}
                className="bg-primary text-tm-on-secondary px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Resource
              </button>
            </div>
            <PerformanceResourcesManagement
              resources={performanceResources}
              loading={loadingResources}
              onRefresh={() => loadPerformanceResources(user?.role || 'admin')}
              onEdit={handleEditResource}
              onDelete={handleDeleteResource}
            />
          </div>
        </div>

        {/* Resource Modal */}
        {showResourceModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
            style={{ position: 'fixed', zIndex: 9999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowResourceModal(false)
                setEditingResource(null)
              }
            }}
          >
            <div className="bg-tm-surface rounded-lg w-full max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-tm-surface border-b border-tm-border p-4 sm:p-6 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-tm-text-1">
                  {editingResource ? 'Edit Resource' : 'Create New Resource'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowResourceModal(false)
                    setEditingResource(null)
                    setResourceForm({
                      title: '',
                      description: '',
                      resource_type: 'diet_plan',
                      content: '',
                      attachment_url: '',
                      links: [],
                      is_active: true,
                    })
                  }}
                  className="p-2 hover:bg-tm-surface-hover rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={resourceForm.title}
                    onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter resource title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Resource Type *
                  </label>
                  <select
                    value={resourceForm.resource_type}
                    onChange={(e) => setResourceForm({ ...resourceForm, resource_type: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="diet_plan">Diet Plan</option>
                    <option value="gym_programme">Gym Programme</option>
                    <option value="play_info">Play Information</option>
                    <option value="position_info">Position Information</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={resourceForm.description}
                    onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Brief description (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Content *
                  </label>
                  <textarea
                    value={resourceForm.content}
                    onChange={(e) => setResourceForm({ ...resourceForm, content: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[200px]"
                    placeholder="Enter the resource content (supports markdown)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    External Links (optional)
                  </label>
                  <div className="space-y-3">
                    {resourceForm.links.map((link, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={link.label}
                            onChange={(e) => {
                              const newLinks = [...resourceForm.links]
                              newLinks[index].label = e.target.value
                              setResourceForm({ ...resourceForm, links: newLinks })
                            }}
                            className="px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Link label (e.g., PDF, Video)"
                          />
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => {
                              const newLinks = [...resourceForm.links]
                              newLinks[index].url = e.target.value
                              setResourceForm({ ...resourceForm, links: newLinks })
                            }}
                            className="px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="https://example.com/file.pdf"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newLinks = resourceForm.links.filter((_, i) => i !== index)
                            setResourceForm({ ...resourceForm, links: newLinks })
                          }}
                          className="p-2 text-[#E05757] hover:bg-[#E05757]/10 rounded-lg transition-colors"
                          title="Remove link"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setResourceForm({
                          ...resourceForm,
                          links: [...resourceForm.links, { url: '', label: '' }]
                        })
                      }}
                      className="w-full px-4 py-2 border-2 border-dashed border-tm-border rounded-lg text-tm-text-1 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Add Link
                    </button>
                  </div>
                  <p className="text-xs text-tm-text-1 mt-2">
                    Add multiple links that players can click on. Each link needs a label and URL.
                  </p>
                </div>
                {(user?.role === 'admin' || user?.role === 'coach' || user?.role === 'asst_coach') && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active_admin_modal"
                      checked={resourceForm.is_active}
                      onChange={(e) => setResourceForm({ ...resourceForm, is_active: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label htmlFor="is_active_admin_modal" className="text-sm text-tm-text-1">
                      Active (visible to players)
                    </label>
                  </div>
                )}
                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResourceModal(false)
                      setEditingResource(null)
                      setResourceForm({
                        title: '',
                        description: '',
                        resource_type: 'diet_plan',
                        content: '',
                        attachment_url: '',
                        links: [],
                        is_active: true,
                      })
                    }}
                    className="px-4 py-2 border border-tm-border rounded-lg text-tm-text-1 hover:bg-tm-surface-hover transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveResource}
                    className="px-4 py-2 bg-primary text-tm-on-secondary rounded-lg font-semibold hover:opacity-90 transition-all"
                  >
                    <Save className="w-4 h-4 inline mr-2" />
                    {editingResource ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Layout>
    )
  }

  // Finance Admin - Club Performance View
  if (user.role === 'finance_admin') {
    const formatCurrency = (amount: number) => {
      if (amount >= 1000000) {
        return `UGX ${(amount / 1000000).toFixed(1)}M`
      }
      return `UGX ${amount.toLocaleString()}`
    }

    const financialCards = clubPerformance ? [
      {
        title: 'Total Revenue',
        value: formatCurrency(clubPerformance.totalRevenue),
        icon: TrendingUp,
        color: 'bg-success',
        description: 'All club revenue',
      },
      {
        title: 'Total Expenses',
        value: formatCurrency(clubPerformance.totalExpenses),
        icon: TrendingDown,
        color: 'bg-secondary',
        description: 'All club expenses',
      },
      {
        title: 'Net Balance',
        value: formatCurrency(clubPerformance.netBalance),
        icon: DollarSign,
        color: 'bg-primary',
        description: 'Revenue minus expenses',
      },
    ] : []

    const budgetCards = clubPerformance ? [
      {
        title: 'Pending Budgets',
        value: clubPerformance.budgetStats?.pending || 0,
        icon: FileText,
        color: 'bg-warning',
        description: 'Budgets awaiting approval',
      },
      {
        title: 'Approved Budgets',
        value: clubPerformance.budgetStats?.approved || 0,
        icon: CheckCircle,
        color: 'bg-info',
        description: 'Approved budget requests',
      },
      {
        title: 'Total Budgets',
        value: clubPerformance.budgetStats?.total || 0,
        icon: FileText,
        color: 'bg-tm-surface-hover',
        description: 'All budget requests',
      },
    ] : []

    return (
      <Layout pageTitle="Club Performance">
        <div className="space-y-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-[20px] font-medium text-tm-text-1">Financial Performance Dashboard</h1>
            <p className="text-[13px] text-tm-text-3">Comprehensive financial overview and budget management</p>
          </div>

          {clubPerformance ? (
            <>
              {/* Financial Metrics Section */}
              <div>
                <h2 className="text-2xl font-bold text-tm-text-1 mb-4 flex items-center">
                  <DollarSign className="w-6 h-6 mr-2 text-success" />
                  Financial Metrics
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  {financialCards.map((card) => {
                  const Icon = card.icon
                  return (
                    <StatCard
                      key={card.title}
                      title={card.title}
                      value={card.value}
                      icon={Icon}
                      iconColor={card.color}
                      description={card.description}
                    />
                  )
                })}
              </div>

                {/* Financial Summary Cards */}
              <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-gradient-to-br from-success/10 to-success/5 rounded-lg border border-success/20">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-tm-text-3">Total Revenue</p>
                        <TrendingUp className="w-5 h-5 text-success" />
                  </div>
                      <p className="text-3xl font-bold text-success mb-1">{formatCurrency(clubPerformance.totalRevenue)}</p>
                      <p className="text-xs text-tm-text-3">All income sources</p>
                  </div>
                    <div className="p-6 bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-lg border border-secondary/20">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-tm-text-3">Total Expenses</p>
                        <TrendingDown className="w-5 h-5 text-secondary" />
                  </div>
                      <p className="text-3xl font-bold text-secondary mb-1">{formatCurrency(clubPerformance.totalExpenses)}</p>
                      <p className="text-xs text-tm-text-3">All club expenditures</p>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-tm-text-3">Net Balance</p>
                        <DollarSign className="w-5 h-5 text-primary" />
                      </div>
                      <p className="text-3xl font-bold text-primary mb-1">{formatCurrency(clubPerformance.netBalance)}</p>
                      <p className="text-xs text-tm-text-3">Current financial position</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Budget Management Section */}
              {clubPerformance.budgetStats && (
                <div>
                  <h2 className="text-2xl font-bold text-tm-text-1 mb-4 flex items-center">
                    <FileText className="w-6 h-6 mr-2 text-warning" />
                    Budget Management
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {budgetCards.map((card) => {
                      const Icon = card.icon
                      return (
                        <StatCard
                          key={card.title}
                          title={card.title}
                          value={card.value}
                          icon={Icon}
                          iconColor={card.color}
                          description={card.description}
                        />
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Recent Transactions Section */}
              {clubPerformance.recentTransactions && clubPerformance.recentTransactions.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-tm-text-1 mb-4 flex items-center">
                    <DollarSign className="w-6 h-6 mr-2 text-primary" />
                    Recent Financial Transactions
                  </h2>
                <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-tm-border">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Date</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Type</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Category</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Amount</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-tm-text-1">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clubPerformance.recentTransactions.map((transaction: any) => (
                          <tr key={transaction.id} className="border-b border-tm-border/50 hover:bg-tm-surface-hover/30 transition-colors">
                            <td className="py-3 px-4 text-sm text-tm-text-3">
                              {new Date(transaction.transaction_date).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${transaction.type === 'revenue' ? 'bg-success/10 text-success' : 'bg-[#E05757]/10 text-[#E05757]'}`}>
                                {transaction.type === 'revenue' ? 'Revenue' : 'Expense'}
                              </span>
                            </td>
                              <td className="py-3 px-4 text-tm-text-1 font-medium">{transaction.category}</td>
                            <td className={`py-3 px-4 font-bold ${transaction.type === 'revenue' ? 'text-success' : 'text-secondary'}`}>
                              {transaction.type === 'revenue' ? '+' : '-'}{formatCurrency(parseFloat(transaction.amount.toString()))}
                            </td>
                            <td className="py-3 px-4 text-sm text-tm-text-3">{transaction.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}

              {(!clubPerformance.recentTransactions || clubPerformance.recentTransactions.length === 0) && (
                <div className="bg-tm-surface rounded-card p-8 border border-tm-border shadow-soft text-center">
                  <DollarSign className="w-12 h-12 text-tm-text-3 mx-auto mb-4" />
                  <p className="text-tm-text-3">No recent transactions found</p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-tm-surface rounded-card p-8 border border-tm-border shadow-soft text-center">
              <DollarSign className="w-12 h-12 text-tm-text-3 mx-auto mb-4" />
              <p className="text-tm-text-3">Loading financial data...</p>
            </div>
          )}

        </div>
      </Layout>
    )
  }

  // Physio Performance View
  if (user.role === 'physio') {
    const physioPerformanceCards = [
      {
        title: 'Training Sessions Attended',
        value: physioStats.trainingSessionsAttended,
        icon: Calendar,
        color: 'bg-primary',
        description: 'Total training sessions attended',
      },
      {
        title: 'Games Attended',
        value: physioStats.gamesAttended,
        icon: Trophy,
        color: 'bg-secondary',
        description: 'Total matches attended',
      },
    ]

    return (
      <Layout pageTitle="Physio Performance">
        <div className="space-y-6">
          <div className="mb-2">
            <h1 className="text-[20px] font-medium text-tm-text-1">Physiotherapist Activity Dashboard</h1>
            <p className="text-[13px] text-tm-text-3">Track your training sessions and games attended</p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {physioPerformanceCards.map((card) => {
              const Icon = card.icon
              return (
                <StatCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  icon={Icon}
                  iconColor={card.color}
                  description={card.description}
                />
              )
            })}
          </div>

          {/* Activity Summary */}
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <h2 className="text-2xl font-bold text-tm-text-1 mb-6">Activity Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-tm-text-1">Training Sessions</h3>
                  <Calendar className="w-8 h-8 text-primary" />
                </div>
                <p className="text-4xl font-bold text-tm-text-1 mb-2">{physioStats.trainingSessionsAttended}</p>
                <p className="text-sm text-tm-text-3">Total sessions attended to provide medical support</p>
              </div>
              <div className="p-6 bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-lg border border-secondary/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-tm-text-1">Games Attended</h3>
                  <Trophy className="w-8 h-8 text-secondary" />
                </div>
                <p className="text-4xl font-bold text-tm-text-1 mb-2">{physioStats.gamesAttended}</p>
                <p className="text-sm text-tm-text-3">Total matches attended for medical coverage</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  // Player Performance View (existing)
  const last10Games = ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5', 'Game 6', 'Game 7', 'Game 8', 'Game 9', 'Game 10']
  const tacklesData = [5, 4, 6, 3, 5, 4, 5, 6, 4, 5]
  const triesData = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1]

  const chartData = {
    labels: last10Games,
    datasets: [
      {
        label: 'Tackles',
        data: tacklesData,
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Tries',
        data: triesData,
        borderColor: '#DC2626',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  }

  const performanceCards = [
    {
      title: 'Matches Played',
      value: playerStats.totalMatches,
      icon: Calendar,
      color: 'bg-primary',
      description: 'Total games participated',
    },
    {
      title: 'Tries Scored',
      value: playerStats.totalTries,
      icon: Trophy,
      color: 'bg-secondary',
      description: 'Total tries across all matches',
    },
    {
      title: 'Tackles Made',
      value: playerStats.totalTackles,
      icon: Target,
      color: 'bg-success',
      description: 'Successful defensive tackles',
    },
    {
      title: 'Avg Minutes',
      value: `${playerStats.avgMinutes} min`,
      icon: Activity,
      color: 'bg-info',
      description: 'Average playing time per match',
    },
    {
      title: 'Win Rate',
      value: `${playerStats.winRate}%`,
      icon: TrendingUp,
      color: 'bg-warning',
      description: 'Team win rate in your matches',
    },
  ]

  return (
    <Layout pageTitle="Performance">
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-[20px] font-medium text-tm-text-1">My Performance</h1>
            <p className="text-[13px] text-tm-text-3">Track your individual statistics and progress</p>
          </div>
          <RefreshButton onRefresh={loadData} />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {performanceCards.map((card) => {
            const Icon = card.icon
            return (
              <StatCard
                key={card.title}
                title={card.title}
                value={card.value}
                icon={Icon}
                iconColor={card.color}
                description={card.description}
              />
            )
          })}
        </div>

        {/* Performance Chart */}
        <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
          <h2 className="text-2xl font-bold text-tm-text-1 mb-6">Performance Over Time</h2>
          <div className="h-64">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Match History */}
        <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
          <h2 className="text-2xl font-bold text-tm-text-1 mb-6">Recent Matches</h2>
          {recentMatches.length === 0 ? (
            <div className="p-6 text-center text-tm-text-3">
              No recent matches yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentMatches.map((match) => (
                <div key={match.matchId} className="p-4 bg-tm-surface-hover/50 rounded-lg hover:bg-tm-surface-hover transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-tm-text-1">
                        {match.tournamentType.replace('_', ' ')} vs {match.opponent}
                      </p>
                      <p className="text-sm text-tm-text-3">
                        {match.tries} tries, {match.tackles} tackles, {match.minutes} minutes
                      </p>
                    </div>
                    {match.result && (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        match.result === 'win'
                          ? 'bg-success/10 text-success'
                          : match.result === 'loss'
                          ? 'bg-[#E05757]/10 text-[#E05757]'
                          : 'bg-tm-surface-hover text-tm-text-1'
                      }`}>
                        {match.result.charAt(0).toUpperCase() + match.result.slice(1)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Performance Resources Section for Players */}
        <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-tm-text-1">Performance Resources</h2>
            <div className="flex items-center gap-3">
              <select
                value={selectedResourceType}
                onChange={(e) => setSelectedResourceType(e.target.value)}
                className="px-4 py-2 border border-tm-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Resources</option>
                <option value="diet_plan">Diet Plans</option>
                <option value="gym_programme">Gym Programmes</option>
                <option value="play_info">Play Information</option>
                <option value="position_info">Position Information</option>
              </select>
            </div>
          </div>

          {loadingResources ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : performanceResources.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-tm-text-3 mx-auto mb-4" />
              <p className="text-tm-text-3">No performance resources available yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {performanceResources.map((resource) => {
                const typeInfo = getResourceTypeInfo(resource.resource_type)
                const Icon = typeInfo.icon
                return (
                  <div
                    key={resource.id}
                    className="border border-tm-border rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`${typeInfo.color} p-3 rounded-lg`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-tm-text-1">{resource.title}</h3>
                          <span className="text-xs text-tm-text-3">{typeInfo.label}</span>
                        </div>
                      </div>
                    </div>
                    {resource.description && (
                      <p className="text-sm text-tm-text-3 mb-4">{resource.description}</p>
                    )}
                    <div className="prose prose-sm max-w-none mb-4">
                      <div className="text-sm text-tm-text-1 whitespace-pre-wrap">{resource.content}</div>
                    </div>
                    {/* Display all links */}
                    {((resource.links && Array.isArray(resource.links) && resource.links.length > 0) || resource.attachment_url) && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-tm-text-1">Links:</p>
                        <div className="flex flex-wrap gap-2">
                          {resource.links && Array.isArray(resource.links) && resource.links.length > 0 ? (
                            resource.links.map((link: any, index: number) => (
                              <a
                                key={index}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline text-sm inline-flex items-center gap-1 px-3 py-1 bg-primary/10 rounded-lg"
                              >
                                <FileText className="w-4 h-4" />
                                {link.label || 'Link'}
                              </a>
                            ))
                          ) : resource.attachment_url ? (
                            <a
                              href={resource.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm inline-flex items-center gap-1 px-3 py-1 bg-primary/10 rounded-lg"
                            >
                              <FileText className="w-4 h-4" />
                              View Attachment
                            </a>
                          ) : null}
                        </div>
                      </div>
                    )}
                    <div className="mt-4 pt-4 border-t border-tm-border text-xs text-tm-text-3">
                      Created {new Date(resource.created_at).toLocaleDateString()}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Resource Modal */}
        {showResourceModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
            style={{ position: 'fixed', zIndex: 9999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowResourceModal(false)
                setEditingResource(null)
              }
            }}
          >
            <div className="bg-tm-surface rounded-lg w-full max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-tm-surface border-b border-tm-border p-4 sm:p-6 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-tm-text-1">
                  {editingResource ? 'Edit Resource' : 'Create New Resource'}
                </h3>
                <button
                  onClick={() => {
                    setShowResourceModal(false)
                    setEditingResource(null)
                    setResourceForm({
                      title: '',
                      description: '',
                      resource_type: 'diet_plan',
                      content: '',
                      attachment_url: '',
                      links: [],
                      is_active: true,
                    })
                  }}
                  className="p-2 hover:bg-tm-surface-hover rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={resourceForm.title}
                    onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter resource title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Resource Type *
                  </label>
                  <select
                    value={resourceForm.resource_type}
                    onChange={(e) => setResourceForm({ ...resourceForm, resource_type: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="diet_plan">Diet Plan</option>
                    <option value="gym_programme">Gym Programme</option>
                    <option value="play_info">Play Information</option>
                    <option value="position_info">Position Information</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={resourceForm.description}
                    onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Brief description (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    Content *
                  </label>
                  <textarea
                    value={resourceForm.content}
                    onChange={(e) => setResourceForm({ ...resourceForm, content: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[200px]"
                    placeholder="Enter the resource content (supports markdown)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                    External Links (optional)
                  </label>
                  <div className="space-y-3">
                    {resourceForm.links.map((link, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={link.label}
                            onChange={(e) => {
                              const newLinks = [...resourceForm.links]
                              newLinks[index].label = e.target.value
                              setResourceForm({ ...resourceForm, links: newLinks })
                            }}
                            className="px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Link label (e.g., PDF, Video)"
                          />
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => {
                              const newLinks = [...resourceForm.links]
                              newLinks[index].url = e.target.value
                              setResourceForm({ ...resourceForm, links: newLinks })
                            }}
                            className="px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="https://example.com/file.pdf"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newLinks = resourceForm.links.filter((_, i) => i !== index)
                            setResourceForm({ ...resourceForm, links: newLinks })
                          }}
                          className="p-2 text-[#E05757] hover:bg-[#E05757]/10 rounded-lg transition-colors"
                          title="Remove link"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setResourceForm({
                          ...resourceForm,
                          links: [...resourceForm.links, { url: '', label: '' }]
                        })
                      }}
                      className="w-full px-4 py-2 border-2 border-dashed border-tm-border rounded-lg text-tm-text-1 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Add Link
                    </button>
                  </div>
                  <p className="text-xs text-tm-text-1 mt-2">
                    Add multiple links that players can click on. Each link needs a label and URL.
                  </p>
                </div>
                {(user?.role === 'admin' || user?.role === 'coach' || user?.role === 'asst_coach') && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={resourceForm.is_active}
                      onChange={(e) => setResourceForm({ ...resourceForm, is_active: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label htmlFor="is_active" className="text-sm text-tm-text-1">
                      Active (visible to players)
                    </label>
                  </div>
                )}
                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowResourceModal(false)
                      setEditingResource(null)
                      setResourceForm({
                        title: '',
                        description: '',
                        resource_type: 'diet_plan',
                        content: '',
                        attachment_url: '',
                        links: [],
                        is_active: true,
                      })
                    }}
                    className="px-4 py-2 border border-tm-border rounded-lg text-tm-text-1 hover:bg-tm-surface-hover transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveResource}
                    className="px-4 py-2 bg-primary text-tm-on-secondary rounded-lg font-semibold hover:opacity-90 transition-all"
                  >
                    <Save className="w-4 h-4 inline mr-2" />
                    {editingResource ? 'Update' : 'Create'}
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

// Admin/Coach Performance Resources Management Component
function PerformanceResourcesManagement({ 
  resources, 
  loading, 
  onRefresh,
  onEdit,
  onDelete 
}: {
  resources: any[]
  loading: boolean
  onRefresh: () => void
  onEdit: (resource: any) => void
  onDelete: (id: string) => void
}) {
  const [selectedType, setSelectedType] = useState<string>('all')

  const filteredResources = selectedType === 'all' 
    ? resources 
    : resources.filter(r => r.resource_type === selectedType)

  const getResourceTypeInfo = (type: string) => {
    switch (type) {
      case 'diet_plan':
        return { icon: Utensils, label: 'Diet Plan', color: 'bg-success' }
      case 'gym_programme':
        return { icon: Dumbbell, label: 'Gym Programme', color: 'bg-primary' }
      case 'play_info':
        return { icon: PlayCircle, label: 'Play Information', color: 'bg-info' }
      case 'position_info':
        return { icon: MapPin, label: 'Position Information', color: 'bg-warning' }
      default:
        return { icon: FileText, label: 'Resource', color: 'bg-neutral-medium' }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-4 py-2 border border-tm-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Resources</option>
          <option value="diet_plan">Diet Plans</option>
          <option value="gym_programme">Gym Programmes</option>
          <option value="play_info">Play Information</option>
          <option value="position_info">Position Information</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-tm-text-3 mx-auto mb-4" />
          <p className="text-tm-text-3">No resources found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResources.map((resource) => {
            const typeInfo = getResourceTypeInfo(resource.resource_type)
            const Icon = typeInfo.icon
            return (
              <div
                key={resource.id}
                className="border border-tm-border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`${typeInfo.color} p-2 rounded-lg`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-tm-text-1">{resource.title}</h3>
                        <span className="text-xs text-tm-text-3">{typeInfo.label}</span>
                      </div>
                      {!resource.is_active && (
                        <span className="px-2 py-1 bg-neutral-medium/10 text-tm-text-3 rounded-full text-xs">
                          Inactive
                        </span>
                      )}
                    </div>
                    {resource.description && (
                      <p className="text-sm text-tm-text-3 mb-2">{resource.description}</p>
                    )}
                    <div className="text-xs text-tm-text-3">
                      Created {new Date(resource.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(resource)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(resource.id)}
                      className="p-2 text-secondary hover:bg-secondary/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
