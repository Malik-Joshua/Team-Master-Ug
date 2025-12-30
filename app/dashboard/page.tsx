'use client'

// Version: 2c7ddaf - TypeScript fix for fixture team selection state variables
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { Calendar, Activity, Trophy, Target, AlertCircle, Dumbbell, Edit, X, Save, HeartPulse, Pill, FileText, Clock, CheckCircle, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
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
import { Line } from 'react-chartjs-2'

// Register Chart.js components only on client side
if (typeof window !== 'undefined') {
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
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({
    totalPlayers: 0,
    activePlayers: 0,
    totalMatches: 0,
    totalTries: 0,
    totalTackles: 0,
    avgMinutes: 0,
    winRate: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    trainingSessionsAttended: 0,
  })
  const [trainingSessionsData, setTrainingSessionsData] = useState<any[]>([])
  const [gymStats, setGymStats] = useState({
    benchPressPB: null as number | null,
    squatPB: null as number | null,
    deadliftPB: null as number | null,
    pullUpPB: null as number | null,
  })
  const [injuries, setInjuries] = useState<any[]>([])
  const [loadingInjuries, setLoadingInjuries] = useState(false)
  const [bestGymMetrics, setBestGymMetrics] = useState<any>(null)
  const [loadingBestMetrics, setLoadingBestMetrics] = useState(false)
  const [playerFixtureSelection, setPlayerFixtureSelection] = useState<any>(null)
  const [loadingPlayerFixture, setLoadingPlayerFixture] = useState(false)
  const [activeInjuriesView, setActiveInjuriesView] = useState<any[]>([])
  const [loadingActiveInjuries, setLoadingActiveInjuries] = useState(false)
  const [recentTeamSelections, setRecentTeamSelections] = useState<any[]>([])
  const [recentTrainingSchedules, setRecentTrainingSchedules] = useState<any[]>([])
  const [recentGymSchedules, setRecentGymSchedules] = useState<any[]>([])
  const [topPerformers, setTopPerformers] = useState<any[]>([])

  useEffect(() => {
    const loadDashboard = async () => {

      // Real authentication
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          router.push('/dev-login')
          return
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
            
            // Load general statistics for all roles
            // For admin and coach, use API route to bypass RLS; for others, use direct queries
            try {
              if (profile.role === 'admin' || profile.role === 'coach') {
                // Use API route for admin/coach (bypasses RLS)
                const response = await fetch('/api/admin/statistics')
                if (response.ok) {
                  const data = await response.json()
                  setStats(prev => ({
                    ...prev,
                    totalPlayers: data.totalPlayers || 0,
                    activePlayers: data.activePlayers || 0,
                    totalMatches: data.totalMatches || 0,
                    totalTries: data.totalTries || 0,
                    totalTackles: data.totalTackles || 0,
                    avgMinutes: data.avgMinutes || 0,
                    winRate: data.winRate || 0,
                    totalRevenue: data.totalRevenue || 0,
                    totalExpenses: data.totalExpenses || 0,
                  }))
                } else {
                  console.error('Failed to fetch statistics from API')
                }
              } else {
                // For non-admin roles, use direct queries (they can only see their own data)
                // Get total players count
                const { count: totalPlayersCount } = await supabase
                  .from('user_profiles')
                  .select('*', { count: 'exact', head: true })
                  .eq('role', 'player')
                
                // Get active players count
                const { count: activePlayersCount } = await supabase
                  .from('user_profiles')
                  .select('*', { count: 'exact', head: true })
                  .eq('role', 'player')
                  .eq('status', 'active')
                
                // Get total matches count
                const { count: totalMatchesCount } = await supabase
                  .from('matches')
                  .select('*', { count: 'exact', head: true })
                
                // Get match stats for tries and tackles
                const { data: matchStats } = await supabase
                  .from('match_stats')
                  .select('tries_scored, tackles_made, minutes_played')
                
                const totalTries = matchStats?.reduce((sum, stat) => sum + (stat.tries_scored || 0), 0) || 0
                const totalTackles = matchStats?.reduce((sum, stat) => sum + (stat.tackles_made || 0), 0) || 0
                const totalMinutes = matchStats?.reduce((sum, stat) => sum + (stat.minutes_played || 0), 0) || 0
                const avgMinutes = totalMatchesCount && totalMatchesCount > 0 ? Math.round(totalMinutes / totalMatchesCount) : 0
                
                // Get match results for win rate
                const { data: matches } = await supabase
                  .from('matches')
                  .select('result')
                
                const wins = matches?.filter(m => m.result === 'win').length || 0
                const totalPlayed = matches?.filter(m => m.result).length || 0
                const winRate = totalPlayed > 0 ? Math.round((wins / totalPlayed) * 100) : 0
                
                // Get financial data
                const { data: revenueTransactions } = await supabase
                  .from('financial_transactions')
                  .select('amount')
                  .eq('type', 'revenue')
                
                const { data: expenseTransactions } = await supabase
                  .from('financial_transactions')
                  .select('amount')
                  .eq('type', 'expense')
                
                const totalRevenue = revenueTransactions?.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) || 0
                const totalExpenses = expenseTransactions?.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) || 0
                
                setStats(prev => ({
                  ...prev,
                  totalPlayers: totalPlayersCount || 0,
                  activePlayers: activePlayersCount || 0,
                  totalMatches: totalMatchesCount || 0,
                  totalTries,
                  totalTackles,
                  avgMinutes,
                  winRate,
                  totalRevenue: Math.round(totalRevenue),
                  totalExpenses: Math.round(totalExpenses),
                }))
              }
            } catch (error) {
              console.error('Error loading general statistics:', error)
            }
            
            // Load real stats based on role
            if (profile.role === 'coach') {
              try {
                const { db } = await import('@/lib/db-helpers')
                const sessionCount = await db.getCoachTrainingSessionsCount(authUser.id)
                const sessions = await db.getCoachTrainingSessions(authUser.id)
                setStats(prev => ({
                  ...prev,
                  trainingSessionsAttended: sessionCount,
                }))
                setTrainingSessionsData(sessions)
                
                // Load top performers for coach dashboard
                const performers = await db.getPlayersPerformanceSummary()
                if (performers) {
                  // Get player positions
                  const playerIds = performers.map((p: any) => p.playerId)
                  if (playerIds.length > 0) {
                    const { data: playerDetails } = await supabase
                      .from('players')
                      .select('user_id, position')
                      .in('user_id', playerIds)
                    
                    const positionMap: Record<string, string> = {}
                    if (playerDetails) {
                      playerDetails.forEach((p: any) => {
                        positionMap[p.user_id] = p.position
                      })
                    }
                    
                    // Add positions to performers and sort
                    const performersWithPositions = performers.map((p: any) => ({
                      ...p,
                      position: positionMap[p.playerId] || null,
                    }))
                    
                    // Sort by total tries, then tackles, and take top 5
                    const sorted = performersWithPositions
                      .sort((a: any, b: any) => {
                        if (b.totalTries !== a.totalTries) return b.totalTries - a.totalTries
                        return b.totalTackles - a.totalTackles
                      })
                      .slice(0, 5)
                    setTopPerformers(sorted)
                  } else {
                    setTopPerformers([])
                  }
                }
                
                // Get recent training schedules (last 5, ordered by date desc)
                const recentSessions = sessions
                  .sort((a: any, b: any) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
                  .slice(0, 5)
                setRecentTrainingSchedules(recentSessions)

                // Get recent gym schedules (for players, data_admin, admin)
                if (profile.role === 'player' || profile.role === 'data_admin' || profile.role === 'admin') {
                  const { data: gymSchedules } = await supabase
                    .from('gym_schedules')
                    .select(`
                      *,
                      coach:user_profiles!gym_schedules_created_by_fkey(name)
                    `)
                    .order('schedule_date', { ascending: false })
                    .limit(5)

                  if (gymSchedules) {
                    setRecentGymSchedules(gymSchedules)
                  }
                }
                
                // Get recent team selections created by this coach
                const { data: teamSelections } = await supabase
                  .from('fixture_team_selections')
                  .select(`
                    *,
                    match:matches(id, match_date, opponent, venue, tournament_type)
                  `)
                  .eq('selected_by', authUser.id)
                  .order('created_at', { ascending: false })
                  .limit(10)
                
                if (teamSelections) {
                  // Group by match_id to get unique matches
                  const matchGroups = new Map()
                  teamSelections.forEach((selection: any) => {
                    if (selection.match) {
                      const matchId = selection.match.id
                      if (!matchGroups.has(matchId)) {
                        matchGroups.set(matchId, {
                          match: selection.match,
                          selections: [],
                          created_at: selection.created_at,
                        })
                      }
                      matchGroups.get(matchId).selections.push(selection)
                    }
                  })
                  
                  // Convert to array and sort by created_at
                  const recentSelections = Array.from(matchGroups.values())
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .slice(0, 5)
                  
                  setRecentTeamSelections(recentSelections)
                }
              } catch (error) {
                console.error('Error loading coach training sessions:', error)
              }
            } else if (profile.role === 'player') {
              try {
                const { db } = await import('@/lib/db-helpers')
                const sessionsAttended = await db.getPlayerTrainingSessionsAttended(authUser.id)
                const gymMetrics = await db.getPlayerGymStats(authUser.id)
                
                // Load player match stats - only count games where stats have been entered
                const { data: playerMatchStats } = await supabase
                  .from('match_stats')
                  .select('match_id, tries_scored, tackles_made, minutes_played')
                  .eq('player_id', authUser.id)
                
                // Calculate games played based on unique match_ids (only games with stats entered)
                const uniqueMatchIds = new Set(playerMatchStats?.map(stat => stat.match_id) || [])
                const totalMatches = uniqueMatchIds.size
                const totalTries = playerMatchStats?.reduce((sum, stat) => sum + (stat.tries_scored || 0), 0) || 0
                const totalTackles = playerMatchStats?.reduce((sum, stat) => sum + (stat.tackles_made || 0), 0) || 0
                const totalMinutes = playerMatchStats?.reduce((sum, stat) => sum + (stat.minutes_played || 0), 0) || 0
                const avgMinutes = totalMatches > 0 ? Math.round(totalMinutes / totalMatches) : 0
                
                setStats(prev => ({
                  ...prev,
                  trainingSessionsAttended: sessionsAttended,
                  totalMatches: totalMatches,
                  totalTries: totalTries,
                  totalTackles: totalTackles,
                  avgMinutes: avgMinutes,
                }))
                setGymStats(gymMetrics)
                
                // Load player injuries
                setLoadingInjuries(true)
                const playerInjuries = await db.getInjuries(authUser.id)
                setInjuries(playerInjuries || [])
                setLoadingInjuries(false)

                // Load player fixture selection via API (includes teammates)
                setLoadingPlayerFixture(true)
                try {
                  const response = await fetch(`/api/fixtures/team-selection?playerId=${authUser.id}`)
                  if (response.ok) {
                    const data = await response.json()
                    if (data.isSelected) {
                      setPlayerFixtureSelection({
                        isSelected: true,
                        selection: data.selection,
                        match: data.match,
                        teammates: data.teammates || [], // Include teammates
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
              } catch (error) {
                console.error('Error loading player stats:', error)
                setLoadingInjuries(false)
                setLoadingPlayerFixture(false)
              }
            }
            
            // Load best gym metrics for all roles except finance_admin and physio
            if (profile.role !== 'finance_admin' && profile.role !== 'physio') {
              try {
                setLoadingBestMetrics(true)
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

            // Load active injuries for coaches, admins, and team managers (read-only view)
            if (profile.role === 'coach' || profile.role === 'admin' || profile.role === 'data_admin') {
              try {
                setLoadingActiveInjuries(true)
                const { db } = await import('@/lib/db-helpers')
                const injuries = await db.getActiveInjuries()
                setActiveInjuriesView(injuries || [])
              } catch (error) {
                console.error('Error loading active injuries:', error)
                setActiveInjuriesView([])
              } finally {
                setLoadingActiveInjuries(false)
              }
            }

            // Load fixture team selection for coaches, admins, team managers, and physio
            if (profile.role !== 'finance_admin' && profile.role !== 'player') {
              try {
                setLoadingPlayerFixture(true)
                // Get the latest upcoming match
                const matchesResponse = await fetch('/api/fixtures')
                if (matchesResponse.ok) {
                  const matchesData = await matchesResponse.json()
                  if (matchesData.fixtures && matchesData.fixtures.length > 0) {
                    const latestMatch = matchesData.fixtures[0]
                    // Get team selection for this match
                    const selectionResponse = await fetch(`/api/fixtures/team-selection?matchId=${latestMatch.id}`)
                    if (selectionResponse.ok) {
                      const selectionData = await selectionResponse.json()
                      setPlayerFixtureSelection(selectionData)
                    }
                  }
                }
              } catch (error) {
                console.error('Error loading fixture team selection:', error)
                setPlayerFixtureSelection(null)
              } finally {
                setLoadingPlayerFixture(false)
              }
            }
          } else {
            router.push('/dev-login')
          }
        } else {
          router.push('/dev-login')
        }
      } catch (error) {
        console.error('Error loading dashboard:', error)
        router.push('/dev-login')
      }
    }

    loadDashboard()
  }, [router])

  // Route to role-specific dashboards
  useEffect(() => {
    if (user && user.role) {
      if (user.role === 'data_admin') {
        router.push('/dashboard/data-admin')
        return
      } else if (user.role === 'finance_admin') {
        router.push('/dashboard/finance-admin')
        return
      } else if (user.role === 'admin') {
        router.push('/dashboard/admin')
        return
      } else if (user.role === 'physio') {
        router.push('/dashboard/physio')
        return
      }
    }
  }, [user, router])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-neutral-medium">Loading...</p>
        </div>
      </div>
    )
  }

  // Role-based dashboard content
  if (user.role === 'player') {
    return (
      <Layout pageTitle="Player Dashboard">
        <div className="space-y-6">
          {/* Fixture Selection Notification for Player */}
          {loadingPlayerFixture ? (
            <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </div>
          ) : playerFixtureSelection && playerFixtureSelection.isSelected ? (
            <div className="bg-white rounded-card p-6 border-2 border-primary shadow-soft">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-club-gradient flex items-center justify-center">
                    <Trophy className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-xl font-bold text-neutral-text">You&apos;re Selected for the Next Fixture!</h3>
                    {playerFixtureSelection.selection.is_starting && !playerFixtureSelection.selection.is_substitute ? (
                      <span className="px-3 py-1 bg-success/10 text-success rounded-full text-sm font-medium">
                        Starting Lineup
                      </span>
                    ) : playerFixtureSelection.selection.is_substitute ? (
                      <span className="px-3 py-1 bg-warning/10 text-warning rounded-full text-sm font-medium">
                        Substitute
                      </span>
                    ) : null}
                  </div>
                  <div className="bg-neutral-light rounded-lg p-4 mb-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-neutral-medium uppercase mb-1">Match Date</p>
                        <p className="text-sm font-semibold text-neutral-text">
                          {new Date(playerFixtureSelection.match.match_date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-neutral-medium uppercase mb-1">Opponent</p>
                        <p className="text-sm font-semibold text-neutral-text">{playerFixtureSelection.match.opponent}</p>
                      </div>
                      {playerFixtureSelection.match.venue && (
                        <div>
                          <p className="text-xs font-semibold text-neutral-medium uppercase mb-1">Venue</p>
                          <p className="text-sm font-semibold text-neutral-text">{playerFixtureSelection.match.venue}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    {playerFixtureSelection.selection.jersey_number && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-medium">Jersey #</span>
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-bold">{playerFixtureSelection.selection.jersey_number}</span>
                      </div>
                    )}
                    {playerFixtureSelection.selection.position && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-medium">Position:</span>
                        <span className="px-3 py-1 bg-info/10 text-info rounded-full text-sm font-medium capitalize">{playerFixtureSelection.selection.position.replace('_', ' ')}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Show Teammates */}
                  {playerFixtureSelection.teammates && playerFixtureSelection.teammates.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-neutral-light">
                      <h4 className="text-sm font-semibold text-neutral-text mb-3">Your Teammates ({playerFixtureSelection.teammates.length})</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {playerFixtureSelection.teammates.map((teammate: any) => (
                          <div key={teammate.player_id} className="bg-neutral-light rounded-lg p-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-neutral-text text-xs">{teammate.name}</span>
                              {teammate.jersey_number && (
                                <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-xs font-bold">#{teammate.jersey_number}</span>
                              )}
                            </div>
                            {teammate.position && (
                              <p className="text-xs text-neutral-medium mt-1 capitalize">{teammate.position.replace(/_/g, ' ')}</p>
                            )}
                            <div className="flex gap-1 mt-1">
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
          ) : (
            <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-neutral-light flex items-center justify-center">
                    <Trophy className="w-8 h-8 text-neutral-medium" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-neutral-text mb-1">No Selection Yet</h3>
                  <p className="text-sm text-neutral-medium">You haven&apos;t been selected for the upcoming fixture. Check back later for updates.</p>
                </div>
              </div>
            </div>
          )}

          {/* Hero Section */}
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-neutral-text mb-2">
                  Welcome back, {user.name}!
                </h2>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 bg-success/10 text-success rounded-full text-sm font-medium">
                    {user.status || 'Active'}
                  </span>
                  {user.position && (
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium capitalize">
                      {user.position.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-20 h-20 rounded-full bg-club-gradient flex items-center justify-center text-white text-2xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Training Sessions Attended"
              value={stats.trainingSessionsAttended}
              icon={Calendar}
              iconColor="bg-primary"
            />
            <StatCard
              title="Games Played"
              value={stats.totalMatches}
              icon={Trophy}
              iconColor="bg-secondary"
            />
            <StatCard
              title="Tries Scored"
              value={stats.totalTries}
              icon={Target}
              iconColor="bg-success"
            />
            <StatCard
              title="Tackles Made"
              value={stats.totalTackles}
              icon={Activity}
              iconColor="bg-info"
            />
          </div>

          {/* Gym Metrics Section */}
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <div className="flex items-center mb-6">
              <Dumbbell className="w-6 h-6 text-primary mr-2" />
              <h3 className="text-xl font-bold text-neutral-text">Gym Metrics - Personal Bests</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 border border-primary/20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Bench Press</h4>
                  <Dumbbell className="w-5 h-5 text-primary" />
                </div>
                <p className="text-3xl font-bold text-neutral-text">
                  {gymStats.benchPressPB !== null ? `${gymStats.benchPressPB} kg` : 'N/A'}
                </p>
                <p className="text-xs text-neutral-medium mt-1">Personal Best</p>
              </div>
              <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-lg p-6 border border-secondary/20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Squat</h4>
                  <Dumbbell className="w-5 h-5 text-secondary" />
                </div>
                <p className="text-3xl font-bold text-neutral-text">
                  {gymStats.squatPB !== null ? `${gymStats.squatPB} kg` : 'N/A'}
                </p>
                <p className="text-xs text-neutral-medium mt-1">Personal Best</p>
              </div>
              <div className="bg-gradient-to-br from-success/10 to-success/5 rounded-lg p-6 border border-success/20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Deadlift</h4>
                  <Dumbbell className="w-5 h-5 text-success" />
                </div>
                <p className="text-3xl font-bold text-neutral-text">
                  {gymStats.deadliftPB !== null ? `${gymStats.deadliftPB} kg` : 'N/A'}
                </p>
                <p className="text-xs text-neutral-medium mt-1">Personal Best</p>
              </div>
              <div className="bg-gradient-to-br from-info/10 to-info/5 rounded-lg p-6 border border-info/20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Pull-ups</h4>
                  <Dumbbell className="w-5 h-5 text-info" />
                </div>
                <p className="text-3xl font-bold text-neutral-text">
                  {gymStats.pullUpPB !== null ? `${gymStats.pullUpPB} reps` : 'N/A'}
                </p>
                <p className="text-xs text-neutral-medium mt-1">Personal Best</p>
              </div>
            </div>
            {gymStats.benchPressPB === null && gymStats.squatPB === null && gymStats.deadliftPB === null && gymStats.pullUpPB === null && (
              <div className="mt-4 text-center text-neutral-medium text-sm">
                No gym metrics recorded yet. Contact your coach or team manager to update your metrics.
              </div>
            )}
          </div>

          {/* Injury Information Section */}
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <div className="flex items-center mb-6">
              <HeartPulse className="w-6 h-6 text-secondary mr-2" />
              <h3 className="text-xl font-bold text-neutral-text">My Injury Information</h3>
            </div>
            
            {loadingInjuries ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : injuries.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success" />
                <p className="text-neutral-medium">No active injuries recorded. You&apos;re good to go!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {injuries.map((injury) => (
                  <div
                    key={injury.id}
                    className={`p-6 rounded-lg border-2 transition-all ${
                      injury.status === 'active'
                        ? 'border-secondary bg-red-50'
                        : injury.status === 'cleared' || injury.status === 'healed'
                        ? 'border-success bg-green-50'
                        : 'border-neutral-light bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <AlertCircle className={`w-6 h-6 ${
                          injury.status === 'active' ? 'text-secondary' : 'text-success'
                        }`} />
                        <div>
                          <h4 className="text-lg font-bold text-neutral-text">Injury Information</h4>
                          <p className="text-sm text-neutral-medium">
                            Injured on {new Date(injury.injury_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        injury.status === 'active'
                          ? 'bg-secondary text-white'
                          : injury.status === 'cleared' || injury.status === 'healed'
                          ? 'bg-success text-white'
                          : 'bg-neutral-light text-neutral-medium'
                      }`}>
                        {injury.status === 'active' ? 'ACTIVE' : injury.status === 'cleared' ? 'CLEARED' : 'HEALED'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-neutral-medium uppercase">Cause</label>
                        <p className="text-neutral-text mt-1">{injury.cause}</p>
                      </div>
                      {injury.return_to_training_date && (
                        <div>
                          <label className="text-xs font-semibold text-neutral-medium uppercase flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            Return to Training
                          </label>
                          <p className="text-neutral-text mt-1">
                            {new Date(injury.return_to_training_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      )}
                      {injury.return_to_play_date && (
                        <div>
                          <label className="text-xs font-semibold text-neutral-medium uppercase flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            Return to Game
                          </label>
                          <p className="text-neutral-text mt-1">
                            {new Date(injury.return_to_play_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      )}
                    </div>

                    {injury.status === 'active' && injury.return_to_play_date && (
                      <div className="mt-4 flex items-center space-x-2 text-sm">
                        <Clock className="w-4 h-4 text-neutral-medium" />
                        <span className="text-neutral-medium">
                          Estimated return to play: {new Date(injury.return_to_play_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Best Gym Metrics of the Week */}
          {user.role !== 'finance_admin' && user.role !== 'physio' && (
            <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
              <div className="flex items-center mb-6">
                <Trophy className="w-6 h-6 text-warning mr-2" />
                <h3 className="text-xl font-bold text-neutral-text">Best Gym Metrics of the Week</h3>
              </div>
              
              {loadingBestMetrics ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !bestGymMetrics ? (
                <div className="text-center py-8">
                  <Dumbbell className="w-12 h-12 mx-auto mb-4 text-neutral-light" />
                  <p className="text-neutral-medium">No gym metrics recorded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 border border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Bench Press</h4>
                      <Dumbbell className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-3xl font-bold text-neutral-text">
                      {bestGymMetrics.bestBenchPress?.value || 0} kg
                    </p>
                    <p className="text-sm text-primary font-medium mt-1">{bestGymMetrics.bestBenchPress?.playerName || 'N/A'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-lg p-6 border border-secondary/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Squat</h4>
                      <Dumbbell className="w-5 h-5 text-secondary" />
                    </div>
                    <p className="text-3xl font-bold text-neutral-text">
                      {bestGymMetrics.bestSquat?.value || 0} kg
                    </p>
                    <p className="text-sm text-secondary font-medium mt-1">{bestGymMetrics.bestSquat?.playerName || 'N/A'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-success/10 to-success/5 rounded-lg p-6 border border-success/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Deadlift</h4>
                      <Dumbbell className="w-5 h-5 text-success" />
                    </div>
                    <p className="text-3xl font-bold text-neutral-text">
                      {bestGymMetrics.bestDeadlift?.value || 0} kg
                    </p>
                    <p className="text-sm text-success font-medium mt-1">{bestGymMetrics.bestDeadlift?.playerName || 'N/A'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-info/10 to-info/5 rounded-lg p-6 border border-info/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Pull-ups</h4>
                      <Dumbbell className="w-5 h-5 text-info" />
                    </div>
                    <p className="text-3xl font-bold text-neutral-text">
                      {bestGymMetrics.bestPullUps?.value || 0} reps
                    </p>
                    <p className="text-sm text-info font-medium mt-1">{bestGymMetrics.bestPullUps?.playerName || 'N/A'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Performance Chart */}
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <h3 className="text-xl font-bold text-neutral-text mb-4">Performance Over Time</h3>
            <div className="h-64">
              <Line
                data={{
                  labels: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5', 'Game 6', 'Game 7', 'Game 8', 'Game 9', 'Game 10'],
                  datasets: [
                    {
                      label: 'Tackles',
                      data: [5, 4, 6, 3, 5, 4, 5, 6, 4, 5],
                      borderColor: '#2563EB',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      fill: true,
                      tension: 0.4,
                    },
                    {
                      label: 'Tries',
                      data: [1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
                      borderColor: '#DC2626',
                      backgroundColor: 'rgba(220, 38, 38, 0.1)',
                      fill: true,
                      tension: 0.4,
                    },
                  ],
                }}
                options={{
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
                }}
              />
            </div>
          </div>

          {/* Recent Notifications */}
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <h3 className="text-xl font-bold text-neutral-text mb-4">Recent Notifications</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 hover:bg-neutral-light rounded-lg transition-colors">
                <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-neutral-text">New training session scheduled</p>
                  <p className="text-xs text-neutral-medium mt-1">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 hover:bg-neutral-light rounded-lg transition-colors">
                <AlertCircle className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <p className="text-sm text-neutral-text">Match stats updated</p>
                  <p className="text-xs text-neutral-medium mt-1">5 hours ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  // Coach Dashboard
  if (user.role === 'coach') {
    return (
      <Layout pageTitle="Coach Control Center">
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Players"
              value={stats.totalPlayers}
              icon={Activity}
              iconColor="bg-primary"
            />
            <StatCard
              title="Active Players"
              value={`${stats.activePlayers} (${Math.round((stats.activePlayers / stats.totalPlayers) * 100)}%)`}
              icon={Activity}
              iconColor="bg-success"
            />
            <StatCard
              title="Injured Players"
              value={stats.totalPlayers - stats.activePlayers}
              icon={AlertCircle}
              iconColor="bg-secondary"
            />
            <StatCard
              title="Training Sessions"
              value={stats.trainingSessionsAttended}
              icon={Calendar}
              iconColor="bg-info"
            />
          </div>

          {/* Training Sessions Track */}
          <div className="bg-white rounded-card border border-neutral-light shadow-soft p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-neutral-text">Training Sessions Track</h3>
              <span className="text-sm text-neutral-medium">Total: {stats.trainingSessionsAttended} sessions</span>
            </div>
            <div className="h-64">
              <Line
                data={{
                  labels: trainingSessionsData.length > 0
                    ? trainingSessionsData.map((session, index) => {
                        const date = new Date(session.session_date)
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      })
                    : Array.from({ length: 12 }, (_, i) => {
                        const date = new Date()
                        date.setDate(date.getDate() - (12 - i) * 7)
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      }),
                  datasets: [
                    {
                      label: 'Training Sessions Conducted',
                      data: trainingSessionsData.length > 0
                        ? trainingSessionsData.map((_, index) => index + 1)
                        : Array.from({ length: 12 }, (_, i) => i + 1),
                      borderColor: '#2563EB',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      fill: true,
                      tension: 0.4,
                      pointRadius: 5,
                      pointHoverRadius: 7,
                      pointBackgroundColor: '#2563EB',
                      pointBorderColor: '#ffffff',
                      pointBorderWidth: 2,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: true,
                      position: 'top' as const,
                    },
                    tooltip: {
                      mode: 'index' as const,
                      intersect: false,
                      callbacks: {
                        label: function(context) {
                          return `Session ${context.parsed.y}`
                        }
                      }
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        stepSize: 1,
                        precision: 0,
                      },
                      grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                      },
                      title: {
                        display: true,
                        text: 'Number of Sessions',
                      },
                    },
                    x: {
                      grid: {
                        display: false,
                      },
                      title: {
                        display: true,
                        text: 'Date',
                      },
                    },
                  },
                }}
              />
            </div>
            {trainingSessionsData.length === 0 && (
              <div className="mt-4 text-center text-neutral-medium text-sm">
                No training sessions recorded yet. Start by creating a training session!
              </div>
            )}
          </div>

          {/* Recent Training Schedules */}
          {recentTrainingSchedules.length > 0 && (
            <div className="bg-white rounded-card border border-neutral-light shadow-soft">
              <div className="p-6 border-b border-neutral-light">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-neutral-text flex items-center gap-2">
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
                    <div key={session.id} className="border border-neutral-light rounded-lg p-4 hover:bg-neutral-light/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-neutral-text">
                              {session.description || `Training Session ${session.session_number}`}
                            </h4>
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                              Session #{session.session_number}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-neutral-medium">
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

          {/* Recent Team Selections */}
          {recentTeamSelections.length > 0 && (
            <div className="bg-white rounded-card border border-neutral-light shadow-soft">
              <div className="p-6 border-b border-neutral-light">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-neutral-text flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    Recent Team Selections
                  </h3>
                  <Link
                    href="/fixtures"
                    className="text-primary hover:underline text-sm font-medium"
                  >
                    Manage Selections →
                  </Link>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {recentTeamSelections.map((selectionGroup: any, index: number) => {
                    const match = selectionGroup.match
                    const startingCount = selectionGroup.selections.filter((s: any) => s.is_starting && !s.is_substitute).length
                    const substituteCount = selectionGroup.selections.filter((s: any) => s.is_substitute).length
                    const totalSelected = selectionGroup.selections.length
                    
                    return (
                      <div key={match?.id || index} className="border border-neutral-light rounded-lg p-4 hover:bg-neutral-light/50 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-neutral-text">
                                {match?.opponent ? `vs ${match.opponent}` : 'Match Team Selection'}
                              </h4>
                              {match?.tournament_type && (
                                <span className="px-2 py-1 bg-secondary/10 text-secondary rounded text-xs font-medium capitalize">
                                  {match.tournament_type.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-neutral-medium">
                              {match?.match_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {new Date(match.match_date).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </div>
                              )}
                              {match?.venue && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  {match.venue}
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {new Date(selectionGroup.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })} at {new Date(selectionGroup.created_at).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-neutral-light">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-success">{startingCount}</p>
                            <p className="text-xs text-neutral-medium">Starting</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-warning">{substituteCount}</p>
                            <p className="text-xs text-neutral-medium">Substitutes</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-primary">{totalSelected}</p>
                            <p className="text-xs text-neutral-medium">Total Selected</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Fixture Team Selection */}
          {playerFixtureSelection && playerFixtureSelection.match && (
            <div className="bg-white rounded-card border border-neutral-light shadow-soft">
              <div className="p-6 border-b border-neutral-light">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-neutral-text flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    Upcoming Fixture Team Selection
                  </h3>
                  <Link
                    href="/fixtures"
                    className="text-primary hover:underline text-sm font-medium"
                  >
                    Manage Team Selection →
                  </Link>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <h4 className="font-semibold text-neutral-text mb-2">
                    {new Date(playerFixtureSelection.match.match_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })} vs {playerFixtureSelection.match.opponent}
                  </h4>
                  {playerFixtureSelection.match.venue && (
                    <p className="text-sm text-neutral-medium">Venue: {playerFixtureSelection.match.venue}</p>
                  )}
                </div>
                
                {playerFixtureSelection.starting && playerFixtureSelection.starting.length > 0 && (
                  <div className="mb-4">
                    <h5 className="font-semibold text-neutral-text mb-2">Starting Lineup ({playerFixtureSelection.starting.length})</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {playerFixtureSelection.starting.map((selection: any) => (
                        <div key={selection.id} className="bg-success/5 border border-success/20 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-neutral-text">{selection.player?.name || 'Unknown'}</span>
                            {selection.jersey_number && (
                              <span className="bg-success/20 text-success px-2 py-1 rounded text-xs font-bold">#{selection.jersey_number}</span>
                            )}
                          </div>
                          {selection.position && (
                            <p className="text-xs text-neutral-medium mt-1 capitalize">{selection.position.replace(/_/g, ' ')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {playerFixtureSelection.substitutes && playerFixtureSelection.substitutes.length > 0 && (
                  <div>
                    <h5 className="font-semibold text-neutral-text mb-2">Substitutes ({playerFixtureSelection.substitutes.length})</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {playerFixtureSelection.substitutes.map((selection: any) => (
                        <div key={selection.id} className="bg-warning/5 border border-warning/20 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-neutral-text">{selection.player?.name || 'Unknown'}</span>
                            {selection.jersey_number && (
                              <span className="bg-warning/20 text-warning px-2 py-1 rounded text-xs font-bold">#{selection.jersey_number}</span>
                            )}
                          </div>
                          {selection.position && (
                            <p className="text-xs text-neutral-medium mt-1 capitalize">{selection.position.replace(/_/g, ' ')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!playerFixtureSelection.starting || playerFixtureSelection.starting.length === 0) && 
                 (!playerFixtureSelection.substitutes || playerFixtureSelection.substitutes.length === 0) && (
                  <p className="text-neutral-medium text-center py-4">No team selection made yet for this fixture.</p>
                )}
              </div>
            </div>
          )}

          {/* Active Injuries View (Read-Only) */}
          {activeInjuriesView.length > 0 && (
            <div className="bg-white rounded-card border border-neutral-light shadow-soft">
              <div className="p-6 border-b border-neutral-light">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-neutral-text flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-secondary" />
                    Active Player Injuries
                  </h3>
                  <span className="text-sm text-neutral-medium">{activeInjuriesView.length} active injury{activeInjuriesView.length !== 1 ? 'ies' : ''}</span>
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
                            <h4 className="font-semibold text-neutral-text text-lg mb-1">{playerName}</h4>
                            <p className="text-sm text-neutral-medium">Injured on {new Date(injury.injury_date).toLocaleDateString()}</p>
                          </div>
                          <span className="px-3 py-1 bg-secondary text-white rounded-full text-xs font-medium">
                            ACTIVE
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs font-semibold text-neutral-medium uppercase mb-1">Cause</p>
                            <p className="text-sm text-neutral-text">{injury.cause}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-neutral-medium uppercase mb-1">Diagnosis</p>
                            <p className="text-sm text-neutral-text font-medium">{injury.diagnosis}</p>
                          </div>
                          {returnDate && (
                            <div>
                              <p className="text-xs font-semibold text-neutral-medium uppercase mb-1">Expected Return</p>
                              <p className="text-sm text-neutral-text font-medium">
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

          {/* Top Performers Table */}
          <div className="bg-white rounded-card border border-neutral-light shadow-soft overflow-hidden">
            <div className="p-6 border-b border-neutral-light">
              <h3 className="text-xl font-bold text-neutral-text">Top Performers</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-light">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Player</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Position</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Games</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Tries</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Tackles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-light">
                  {topPerformers.length > 0 ? (
                    topPerformers.map((player: any) => (
                      <tr key={player.playerId || player.user_id || player.id} className="hover:bg-neutral-light transition-colors cursor-pointer">
                        <td className="px-6 py-4 text-sm font-medium text-neutral-text">{player.name || 'Unknown'}</td>
                        <td className="px-6 py-4 text-sm text-neutral-medium capitalize">
                          {player.position?.replace(/_/g, ' ') || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-medium">{player.totalMatches || 0}</td>
                        <td className="px-6 py-4 text-sm text-neutral-medium">{player.totalTries || 0}</td>
                        <td className="px-6 py-4 text-sm text-neutral-medium">{player.totalTackles || 0}</td>
                  </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-neutral-medium">
                        No performance data available yet
                      </td>
                  </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-neutral-light">
              <button
                onClick={() => router.push('/players')}
                className="px-6 py-2 bg-club-gradient text-white rounded-button font-semibold hover:opacity-90 transition-opacity"
              >
                View All Players
              </button>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  // Default dashboard for other roles
  return (
    <Layout pageTitle="Dashboard">
      <div className="space-y-6">
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <h2 className="text-2xl font-bold text-neutral-text mb-2">
            Welcome, {user.name}!
          </h2>
          <p className="text-neutral-medium">
            Your {user.role.replace('_', ' ')} dashboard
          </p>
        </div>
      </div>
    </Layout>
  )
}
