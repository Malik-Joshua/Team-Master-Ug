'use client'

// Version: 2c7ddaf - TypeScript fix for fixture team selection state variables
import { useEffect, useState, useCallback } from 'react'
import RefreshButton from '@/components/RefreshButton'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import BirthdayAlert from '@/components/BirthdayAlert'
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
    matchesAttended: 0,
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

  const loadDashboard = useCallback(async () => {
      // Real authentication
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          router.push('/login')
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
            // Check if player has a linked club_captain account BEFORE setting user
            let effectiveProfile = profile
            if (profile.role === 'player') {
              const { data: clubCaptainProfile, error: linkError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('role', 'club_captain')
                .eq('linked_player_id', authUser.id)
                .maybeSingle()
              
              if (linkError) {
                console.error('Error checking for linked club captain account:', linkError)
              }
              
              if (clubCaptainProfile) {
                // Player has a linked club captain account - redirect to club captain dashboard
                console.log('✅ Player has linked club captain account, redirecting to club captain dashboard', {
                  playerId: authUser.id,
                  clubCaptainId: clubCaptainProfile.user_id,
                  linkedPlayerId: clubCaptainProfile.linked_player_id
                })
                // Redirect immediately to club captain dashboard
                router.push('/dashboard/club-captain')
                return
              } else {
                console.log('ℹ️ No linked club captain account found for player', authUser.id)
              }
            }
            
            setUser(effectiveProfile)
            
            // Load general statistics for all roles
            // For admin and coach, use API route to bypass RLS; for others, use direct queries
            try {
              if (effectiveProfile.role === 'admin' || effectiveProfile.role === 'coach') {
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
            if (effectiveProfile.role === 'coach') {
              try {
                const { db } = await import('@/lib/db-helpers')
                const sessionCount = await db.getCoachTrainingSessionsCount(authUser.id)
                const sessions = await db.getCoachTrainingSessions(authUser.id)
                const { count: matchAttendanceCount } = await supabase
                  .from('match_staff_attendance')
                  .select('match_id, matches!inner(status)', { count: 'exact', head: true })
                  .eq('staff_id', authUser.id)
                  .eq('attendance_status', 'P')
                  .eq('matches.status', 'played')
                setStats(prev => ({
                  ...prev,
                  trainingSessionsAttended: sessionCount,
                  matchesAttended: matchAttendanceCount || 0,
                }))
                setTrainingSessionsData(sessions)
                
                // Load top performers using API (accurate, ranked best to least)
                try {
                  const statsResponse = await fetch('/api/admin/statistics', { cache: 'no-store' })
                  if (statsResponse.ok) {
                    const statsData = await statsResponse.json()
                    setTopPerformers((statsData.topPerformers || []).slice(0, 5))
                  } else {
                    setTopPerformers([])
                  }
                } catch (performerError) {
                  console.error('Error loading top performers:', performerError)
                  setTopPerformers([])
                }
                
                // Get recent training schedules (last 5, ordered by date desc)
                const recentSessions = sessions
                  .sort((a: any, b: any) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
                  .slice(0, 5)
                setRecentTrainingSchedules(recentSessions)

                // Get recent gym schedules (for players, data_admin, admin)
                if (effectiveProfile.role === 'player' || effectiveProfile.role === 'data_admin' || effectiveProfile.role === 'admin') {
                  try {
                    // Use API route to bypass RLS and get accurate data
                    const gymSchedulesResponse = await fetch('/api/gym-schedules', {
                      cache: 'no-store',
                    })
                    
                    if (gymSchedulesResponse.ok) {
                      const gymSchedulesData = await gymSchedulesResponse.json()
                      console.log('Gym schedules API response:', gymSchedulesData)
                      
                      if (gymSchedulesData.schedules && gymSchedulesData.schedules.length > 0) {
                        // Get the 5 most recent schedules
                        const recentSchedules = gymSchedulesData.schedules
                          .sort((a: any, b: any) => 
                            new Date(b.schedule_date).getTime() - new Date(a.schedule_date).getTime()
                          )
                          .slice(0, 5)
                        setRecentGymSchedules(recentSchedules)
                        console.log(`✅ Loaded ${recentSchedules.length} gym schedule(s) for ${profile.role}`, recentSchedules)
                      } else {
                        setRecentGymSchedules([])
                        console.log('⚠️ No gym schedules found in API response')
                      }
                    } else {
                      const errorData = await gymSchedulesResponse.json().catch(() => ({ error: 'Unknown error' }))
                      console.error('❌ Error fetching gym schedules via API:', gymSchedulesResponse.status, errorData)
                      setRecentGymSchedules([])
                    }
                  } catch (gymError) {
                    console.error('❌ Error fetching gym schedules:', gymError)
                    setRecentGymSchedules([])
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
            } else if (effectiveProfile.role === 'player') {
              try {
                const { db } = await import('@/lib/db-helpers')
                const sessionsAttended = await db.getPlayerTrainingSessionsAttended(authUser.id)
                
                // Load gym metrics using API route (bypasses RLS and ensures fresh data)
                try {
                  const gymStatsResponse = await fetch(`/api/players/${authUser.id}/gym-stats`, {
                    cache: 'no-store',
                    headers: {
                      'Cache-Control': 'no-cache',
                    }
                  })
                  
                  if (gymStatsResponse.ok) {
                    const gymMetrics = await gymStatsResponse.json()
                    setGymStats(gymMetrics)
                  } else {
                    console.error('Failed to load gym stats:', gymStatsResponse.status)
                    // Fallback to empty stats
                    setGymStats({
                      benchPressPB: null,
                      squatPB: null,
                      deadliftPB: null,
                      pullUpPB: null,
                    })
                  }
                } catch (gymError) {
                  console.error('Error loading gym metrics:', gymError)
                  // Fallback to empty stats
                  setGymStats({
                    benchPressPB: null,
                    squatPB: null,
                    deadliftPB: null,
                    pullUpPB: null,
                  })
                }
                
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
                      // Player not selected, but show match info
                      setPlayerFixtureSelection({
                        isSelected: false,
                        match: data.match,
                      })
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
            if (effectiveProfile.role !== 'finance_admin' && effectiveProfile.role !== 'physio') {
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
            if (effectiveProfile.role === 'coach' || effectiveProfile.role === 'admin' || effectiveProfile.role === 'data_admin') {
              try {
                setLoadingActiveInjuries(true)
                const response = await fetch('/api/admin/injuries', {
                  cache: 'no-store',
                  headers: {
                    'Cache-Control': 'no-cache',
                  }
                })
                if (response.ok) {
                  const data = await response.json()
                  setActiveInjuriesView(data.injuries || [])
                  console.log('Loaded active injuries from API:', data.injuries)
                } else {
                  const error = await response.json()
                  console.error('Error fetching active injuries:', error)
                  setActiveInjuriesView([])
                }
              } catch (error) {
                console.error('Error loading active injuries:', error)
                setActiveInjuriesView([])
              } finally {
                setLoadingActiveInjuries(false)
              }
            }

            // Load fixture team selection for coaches, admins, team managers, and physio
            if (effectiveProfile.role !== 'finance_admin' && effectiveProfile.role !== 'player') {
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
            console.warn('[DashboardPage] Authenticated, but no user profile found in user_profiles.');
            router.push('/login')
          }
        } else {
          console.warn('[DashboardPage] No authenticated authUser found.');
          router.push('/login')
        }
      } catch (error) {
        console.error('[DashboardPage] Error loading dashboard:', error)
        router.push('/login')
      }
  }, [router])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // Refresh gym stats for players periodically (every 30 seconds) and on page visibility change
  useEffect(() => {
    if (user?.role === 'player') {
      const supabase = createClient()
      
      const refreshGymStats = async () => {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser()
          if (authUser) {
            // Use API route to get fresh gym stats (bypasses RLS and caching)
            const response = await fetch(`/api/players/${authUser.id}/gym-stats`, {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache',
              }
            })
            
            if (response.ok) {
              const gymMetrics = await response.json()
              setGymStats(gymMetrics)
            } else {
              console.error('Failed to refresh gym stats:', response.status)
            }
          }
        } catch (error) {
          console.error('Error refreshing gym metrics:', error)
        }
      }

      // Refresh on page visibility change (when user switches back to tab)
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          refreshGymStats()
        }
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)

      // Refresh every 30 seconds
      const interval = setInterval(refreshGymStats, 30000)

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        clearInterval(interval)
      }
    }
  }, [user])

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
      } else if (user.role === 'club_captain') {
        router.push('/dashboard/club-captain')
        return
      }
    }
  }, [user, router])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-tm-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-tm-text-3">Loading...</p>
        </div>
      </div>
    )
  }

  // Role-based dashboard content
  if (user.role === 'player') {
    return (
      <Layout pageTitle="Player Dashboard">
        <div className="space-y-6">
          <BirthdayAlert />
          {/* Fixture Selection Notification for Player */}
          {loadingPlayerFixture ? (
            <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </div>
          ) : playerFixtureSelection && playerFixtureSelection.match ? (
            playerFixtureSelection.isSelected ? (
            <div className="bg-tm-surface rounded-card p-6 border-2 border-primary shadow-soft">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-tm-secondary flex items-center justify-center">
                    <Trophy className="w-8 h-8 text-tm-on-secondary" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <h3 className="text-xl font-bold text-tm-text-1">You&apos;re Selected for the Next Fixture!</h3>
                    {playerFixtureSelection.selection.is_starting && !playerFixtureSelection.selection.is_substitute ? (
                      <span className="px-3 py-1 bg-success/10 text-success rounded-full text-sm font-medium">
                        Starting Lineup
                      </span>
                    ) : playerFixtureSelection.selection.is_substitute ? (
                      <span className="px-3 py-1 bg-warning/10 text-warning rounded-full text-sm font-medium">
                        Substitute
                      </span>
                    ) : null}
                    {playerFixtureSelection.selection.is_captain && (
                      <span className="px-3 py-1 bg-warning/100 text-white rounded-full text-sm font-bold flex items-center gap-1">
                        <Trophy className="w-4 h-4" />
                        Captain
                      </span>
                    )}
                    {playerFixtureSelection.selection.is_assistant_captain && (
                      <span className="px-3 py-1 bg-tm-surface-hover0 text-white rounded-full text-sm font-bold flex items-center gap-1">
                        <Trophy className="w-4 h-4" />
                        Assistant Captain
                      </span>
                    )}
                  </div>
                  <div className="bg-tm-surface-hover rounded-lg p-4 mb-3">
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
                  <div className="flex items-center gap-4 flex-wrap">
                    {playerFixtureSelection.selection.jersey_number && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-tm-text-3">Jersey #</span>
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-bold">{playerFixtureSelection.selection.jersey_number}</span>
                      </div>
                    )}
                    {playerFixtureSelection.selection.position && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-tm-text-3">Position:</span>
                        <span className="px-3 py-1 bg-info/10 text-info rounded-full text-sm font-medium capitalize">{playerFixtureSelection.selection.position.replace('_', ' ')}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Show Captain and Assistant Captain */}
                  {(playerFixtureSelection.captain || playerFixtureSelection.assistantCaptain) && (
                    <div className="mt-4 pt-4 border-t border-tm-border">
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
            ) : (
              <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-full bg-tm-surface-hover flex items-center justify-center">
                      <Trophy className="w-8 h-8 text-tm-text-3" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-tm-text-1 mb-3">Upcoming Fixture</h3>
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
                    
                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <Trophy className="w-5 h-5 text-warning" />
                        <div>
                          <h4 className="text-sm font-semibold text-tm-text-1 mb-1">You have not been selected</h4>
                          <p className="text-xs text-tm-text-3">Check back later for updates on team selection.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-tm-surface-hover flex items-center justify-center">
                    <Trophy className="w-8 h-8 text-tm-text-3" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-tm-text-1 mb-1">No Upcoming Fixtures</h3>
                  <p className="text-sm text-tm-text-3">There are no upcoming fixtures scheduled at this time.</p>
                </div>
              </div>
            </div>
          )}

          {/* Hero Section */}
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[20px] font-medium text-tm-text-1 mb-2">Welcome back, {user.name}!</h2>
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
              <div className="w-20 h-20 rounded-full bg-tm-secondary flex items-center justify-center text-tm-on-secondary text-2xl font-bold">
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
              iconTextColor="text-tm-on-secondary"
            />
            <StatCard
              title="Games Played"
              value={stats.totalMatches}
              icon={Trophy}
              iconColor="bg-secondary"
              iconTextColor="text-tm-on-secondary"
            />
            <StatCard
              title="Tries Scored"
              value={stats.totalTries}
              icon={Target}
              iconColor="bg-success"
              iconTextColor="text-white"
            />
            <StatCard
              title="Tackles Made"
              value={stats.totalTackles}
              icon={Activity}
              iconColor="bg-info"
              iconTextColor="text-white"
            />
          </div>

          {/* Gym Metrics Section */}
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <div className="flex items-center mb-6">
              <Dumbbell className="w-6 h-6 text-primary mr-2" />
              <h3 className="text-xl font-bold text-tm-text-1">Gym Metrics - Personal Bests</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 border border-primary/20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-tm-text-3 uppercase tracking-wide">Bench Press</h4>
                  <Dumbbell className="w-5 h-5 text-primary" />
                </div>
                <p className="text-3xl font-bold text-tm-text-1">
                  {gymStats.benchPressPB !== null ? `${gymStats.benchPressPB} kg` : 'N/A'}
                </p>
                <p className="text-xs text-tm-text-3 mt-1">Personal Best</p>
              </div>
              <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-lg p-6 border border-secondary/20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-tm-text-3 uppercase tracking-wide">Squat</h4>
                  <Dumbbell className="w-5 h-5 text-secondary" />
                </div>
                <p className="text-3xl font-bold text-tm-text-1">
                  {gymStats.squatPB !== null ? `${gymStats.squatPB} kg` : 'N/A'}
                </p>
                <p className="text-xs text-tm-text-3 mt-1">Personal Best</p>
              </div>
              <div className="bg-gradient-to-br from-success/10 to-success/5 rounded-lg p-6 border border-success/20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-tm-text-3 uppercase tracking-wide">Deadlift</h4>
                  <Dumbbell className="w-5 h-5 text-success" />
                </div>
                <p className="text-3xl font-bold text-tm-text-1">
                  {gymStats.deadliftPB !== null ? `${gymStats.deadliftPB} kg` : 'N/A'}
                </p>
                <p className="text-xs text-tm-text-3 mt-1">Personal Best</p>
              </div>
              <div className="bg-gradient-to-br from-info/10 to-info/5 rounded-lg p-6 border border-info/20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-tm-text-3 uppercase tracking-wide">Pull-ups</h4>
                  <Dumbbell className="w-5 h-5 text-info" />
                </div>
                <p className="text-3xl font-bold text-tm-text-1">
                  {gymStats.pullUpPB !== null ? `${gymStats.pullUpPB} reps` : 'N/A'}
                </p>
                <p className="text-xs text-tm-text-3 mt-1">Personal Best</p>
              </div>
            </div>
            {gymStats.benchPressPB === null && gymStats.squatPB === null && gymStats.deadliftPB === null && gymStats.pullUpPB === null && (
              <div className="mt-4 text-center text-tm-text-3 text-sm">
                No gym metrics recorded yet. Contact your coach or team manager to update your metrics.
              </div>
            )}
          </div>

          {/* Injury Information Section */}
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <div className="flex items-center mb-6">
              <HeartPulse className="w-6 h-6 text-secondary mr-2" />
              <h3 className="text-xl font-bold text-tm-text-1">My Injury Information</h3>
            </div>
            
            {loadingInjuries ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : injuries.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success" />
                <p className="text-tm-text-3">No active injuries recorded. You&apos;re good to go!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {injuries.map((injury) => (
                  <div
                    key={injury.id}
                    className={`p-6 rounded-lg border-2 transition-all ${
                      injury.status === 'active'
                        ? 'border-secondary bg-[#E05757]/10'
                        : injury.status === 'cleared' || injury.status === 'healed'
                        ? 'border-success bg-success/10'
                        : 'border-tm-border bg-tm-surface'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <AlertCircle className={`w-6 h-6 ${
                          injury.status === 'active' ? 'text-secondary' : 'text-success'
                        }`} />
                        <div>
                          <h4 className="text-lg font-bold text-tm-text-1">Injury Information</h4>
                          <p className="text-sm text-tm-text-3">
                            Injured on {new Date(injury.injury_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        injury.status === 'active'
                          ? 'bg-secondary text-tm-on-secondary'
                          : injury.status === 'cleared' || injury.status === 'healed'
                          ? 'bg-success text-white'
                          : 'bg-tm-surface-hover text-tm-text-3'
                      }`}>
                        {injury.status === 'active' ? 'ACTIVE' : injury.status === 'cleared' ? 'CLEARED' : 'HEALED'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-tm-text-3 uppercase">Cause</label>
                        <p className="text-tm-text-1 mt-1">{injury.cause}</p>
                      </div>
                      {injury.return_to_training_date && (
                        <div>
                          <label className="text-xs font-semibold text-tm-text-3 uppercase flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            Return to Training
                          </label>
                          <p className="text-tm-text-1 mt-1">
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
                          <label className="text-xs font-semibold text-tm-text-3 uppercase flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            Return to Game
                          </label>
                          <p className="text-tm-text-1 mt-1">
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
                        <Clock className="w-4 h-4 text-tm-text-3" />
                        <span className="text-tm-text-3">
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
            <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Trophy className="w-6 h-6 text-warning mr-2" />
                  <h3 className="text-xl font-bold text-tm-text-1">Best Gym Metrics of the Week</h3>
                </div>
                {bestGymMetrics && bestGymMetrics.weekStart && bestGymMetrics.weekEnd && (
                  <div className="text-sm text-tm-text-3">
                    {new Date(bestGymMetrics.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(bestGymMetrics.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </div>
              
              {loadingBestMetrics ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !bestGymMetrics || (!bestGymMetrics.benchPress && !bestGymMetrics.squat && !bestGymMetrics.deadlift && !bestGymMetrics.pullUp) ? (
                <div className="text-center py-8">
                  <Dumbbell className="w-12 h-12 mx-auto mb-4 text-tm-text-3" />
                  <p className="text-tm-text-3">No gym metrics recorded for this week yet.</p>
                  {bestGymMetrics && bestGymMetrics.weekStart && bestGymMetrics.weekEnd && (
                    <p className="text-xs text-tm-text-3 mt-2">
                      Week: {new Date(bestGymMetrics.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(bestGymMetrics.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 border border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-tm-text-3 uppercase tracking-wide">Bench Press</h4>
                      <Dumbbell className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-3xl font-bold text-tm-text-1">
                      {bestGymMetrics.benchPress?.value || 0} kg
                    </p>
                    <p className="text-sm text-primary font-medium mt-1">{bestGymMetrics.benchPress?.playerName || 'N/A'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-lg p-6 border border-secondary/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-tm-text-3 uppercase tracking-wide">Squat</h4>
                      <Dumbbell className="w-5 h-5 text-secondary" />
                    </div>
                    <p className="text-3xl font-bold text-tm-text-1">
                      {bestGymMetrics.squat?.value || 0} kg
                    </p>
                    <p className="text-sm text-secondary font-medium mt-1">{bestGymMetrics.squat?.playerName || 'N/A'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-success/10 to-success/5 rounded-lg p-6 border border-success/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-tm-text-3 uppercase tracking-wide">Deadlift</h4>
                      <Dumbbell className="w-5 h-5 text-success" />
                    </div>
                    <p className="text-3xl font-bold text-tm-text-1">
                      {bestGymMetrics.deadlift?.value || 0} kg
                    </p>
                    <p className="text-sm text-success font-medium mt-1">{bestGymMetrics.deadlift?.playerName || 'N/A'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-info/10 to-info/5 rounded-lg p-6 border border-info/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-tm-text-3 uppercase tracking-wide">Pull-ups</h4>
                      <Dumbbell className="w-5 h-5 text-info" />
                    </div>
                    <p className="text-3xl font-bold text-tm-text-1">
                      {bestGymMetrics.pullUp?.value || 0} reps
                    </p>
                    <p className="text-sm text-info font-medium mt-1">{bestGymMetrics.pullUp?.playerName || 'N/A'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Performance Chart */}
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <h3 className="text-xl font-bold text-tm-text-1 mb-4">Performance Over Time</h3>
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

          {/* Recent Gym Schedules */}
          {recentGymSchedules.length > 0 && (
            <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft">
              <div className="p-6 border-b border-tm-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-tm-text-1 flex items-center gap-2">
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

          {/* Recent Notifications */}
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <h3 className="text-xl font-bold text-tm-text-1 mb-4">Recent Notifications</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 hover:bg-tm-surface-hover rounded-lg transition-colors">
                <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-tm-text-1">New training session scheduled</p>
                  <p className="text-xs text-tm-text-3 mt-1">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 hover:bg-tm-surface-hover rounded-lg transition-colors">
                <AlertCircle className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <p className="text-sm text-tm-text-1">Match stats updated</p>
                  <p className="text-xs text-tm-text-3 mt-1">5 hours ago</p>
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
        <div className="space-y-4 sm:space-y-6">
          <BirthdayAlert />
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              title="Total Players"
              value={stats.totalPlayers}
              icon={Activity}
              iconColor="bg-primary"
              iconTextColor="text-tm-on-secondary"
            />
            <StatCard
              title="Active Players"
              value={`${stats.activePlayers} (${stats.totalPlayers > 0 ? Math.round((stats.activePlayers / stats.totalPlayers) * 100) : 0}%)`}
              icon={Activity}
              iconColor="bg-success"
              iconTextColor="text-white"
            />
            <StatCard
              title="Injured Players"
              value={stats.totalPlayers - stats.activePlayers}
              icon={AlertCircle}
              iconColor="bg-[#E05757]"
              iconTextColor="text-white"
              valueColor="#E05757"
            />
            <StatCard
              title="Training Sessions"
              value={stats.trainingSessionsAttended}
              icon={Calendar}
              iconColor="bg-info"
              iconTextColor="text-white"
            />
            <StatCard
              title="Matches Attended"
              value={stats.matchesAttended}
              icon={Trophy}
              iconColor="bg-warning"
              iconTextColor="text-white"
            />
          </div>

          {/* Training Sessions Track */}
          <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft p-4 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-tm-text-1">Training Sessions Track</h3>
              <span className="text-sm text-tm-text-3">Total: {stats.trainingSessionsAttended} sessions</span>
            </div>
            <div className="h-48 sm:h-64 min-w-0">
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
              <div className="mt-4 text-center text-tm-text-3 text-sm">
                No training sessions recorded yet. Start by creating a training session!
              </div>
            )}
          </div>

          {/* Recent Training Schedules */}
          {recentTrainingSchedules.length > 0 && (
            <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft">
              <div className="p-4 sm:p-6 border-b border-tm-border">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg sm:text-xl font-bold text-tm-text-1 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
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
              <div className="p-4 sm:p-6">
                <div className="space-y-3">
                  {recentTrainingSchedules.map((session: any) => (
                    <div key={session.id} className="border border-tm-border rounded-lg p-3 sm:p-4 hover:bg-tm-surface-hover/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                            <h4 className="font-semibold text-tm-text-1 text-sm sm:text-base truncate">
                              {session.description || `Training Session ${session.session_number}`}
                            </h4>
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium flex-shrink-0">
                              Session #{session.session_number}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-tm-text-3">
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
            <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft">
              <div className="p-4 sm:p-6 border-b border-tm-border">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg sm:text-xl font-bold text-tm-text-1 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary flex-shrink-0" />
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
              <div className="p-4 sm:p-6">
                <div className="space-y-4">
                  {recentTeamSelections.map((selectionGroup: any, index: number) => {
                    const match = selectionGroup.match
                    const startingCount = selectionGroup.selections.filter((s: any) => s.is_starting && !s.is_substitute).length
                    const substituteCount = selectionGroup.selections.filter((s: any) => s.is_substitute).length
                    const totalSelected = selectionGroup.selections.length
                    
                    return (
                      <div key={match?.id || index} className="border border-tm-border rounded-lg p-3 sm:p-4 hover:bg-tm-surface-hover/50 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h4 className="font-semibold text-tm-text-1 text-sm sm:text-base truncate">
                                {match?.opponent ? `vs ${match.opponent}` : 'Match Team Selection'}
                              </h4>
                              {match?.tournament_type && (
                                <span className="px-2 py-1 bg-[#E05757]/10 text-[#E05757] rounded text-xs font-medium capitalize flex-shrink-0">
                                  {match.tournament_type.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-tm-text-3">
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
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3 pt-3 border-t border-tm-border">
                          <div className="text-center">
                            <p className="text-xl sm:text-2xl font-bold text-success">{startingCount}</p>
                            <p className="text-xs text-tm-text-3">Starting</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xl sm:text-2xl font-bold text-warning">{substituteCount}</p>
                            <p className="text-xs text-tm-text-3">Substitutes</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xl sm:text-2xl font-bold text-primary">{totalSelected}</p>
                            <p className="text-xs text-tm-text-3">Total Selected</p>
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
            <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft">
              <div className="p-4 sm:p-6 border-b border-tm-border">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg sm:text-xl font-bold text-tm-text-1 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary flex-shrink-0" />
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
              <div className="p-4 sm:p-6">
                <div className="mb-4">
                  <h4 className="font-semibold text-tm-text-1 mb-2">
                    {new Date(playerFixtureSelection.match.match_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })} vs {playerFixtureSelection.match.opponent}
                  </h4>
                  {playerFixtureSelection.match.venue && (
                    <p className="text-sm text-tm-text-3">Venue: {playerFixtureSelection.match.venue}</p>
                  )}
                </div>
                
                {playerFixtureSelection.starting && playerFixtureSelection.starting.length > 0 && (
                  <div className="mb-4">
                    <h5 className="font-semibold text-tm-text-1 mb-2 text-sm sm:text-base">Starting Lineup ({playerFixtureSelection.starting.length})</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                      {playerFixtureSelection.starting.map((selection: any) => (
                        <div key={selection.id} className="bg-success/5 border border-success/20 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-tm-text-1">{selection.player?.name || 'Unknown'}</span>
                            {selection.jersey_number && (
                              <span className="bg-success/20 text-success px-2 py-1 rounded text-xs font-bold">#{selection.jersey_number}</span>
                            )}
                          </div>
                          {selection.position && (
                            <p className="text-xs text-tm-text-3 mt-1 capitalize">{selection.position.replace(/_/g, ' ')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {playerFixtureSelection.substitutes && playerFixtureSelection.substitutes.length > 0 && (
                  <div>
                    <h5 className="font-semibold text-tm-text-1 mb-2 text-sm sm:text-base">Substitutes ({playerFixtureSelection.substitutes.length})</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                      {playerFixtureSelection.substitutes.map((selection: any) => (
                        <div key={selection.id} className="bg-warning/5 border border-warning/20 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-tm-text-1">{selection.player?.name || 'Unknown'}</span>
                            {selection.jersey_number && (
                              <span className="bg-warning/20 text-warning px-2 py-1 rounded text-xs font-bold">#{selection.jersey_number}</span>
                            )}
                          </div>
                          {selection.position && (
                            <p className="text-xs text-tm-text-3 mt-1 capitalize">{selection.position.replace(/_/g, ' ')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!playerFixtureSelection.starting || playerFixtureSelection.starting.length === 0) && 
                 (!playerFixtureSelection.substitutes || playerFixtureSelection.substitutes.length === 0) && (
                  <p className="text-tm-text-3 text-center py-4">No team selection made yet for this fixture.</p>
                )}
              </div>
            </div>
          )}

          {/* Active Injuries View (Read-Only) */}
          {activeInjuriesView.length > 0 && (
            <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft">
              <div className="p-4 sm:p-6 border-b border-tm-border">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg sm:text-xl font-bold text-tm-text-1 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-secondary flex-shrink-0" />
                    Active Player Injuries
                  </h3>
                  <span className="text-sm text-tm-text-3">{activeInjuriesView.length} active injury{activeInjuriesView.length !== 1 ? 'ies' : ''}</span>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                <div className="space-y-4">
                  {activeInjuriesView.map((injury: any) => {
                    const playerName = injury.player?.name || 'Unknown Player'
                    const returnDate = injury.return_to_play_date || injury.return_to_training_date
                    return (
                      <div key={injury.id} className="border border-secondary/20 bg-secondary/5 rounded-lg p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-tm-text-1 text-base sm:text-lg mb-1 truncate">{playerName}</h4>
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

          {/* Top Performers */}
          <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-tm-border">
              <h3 className="text-lg sm:text-xl font-bold text-tm-text-1">Top Performers</h3>
            </div>
            {/* Mobile card layout */}
            <div className="md:hidden p-4 space-y-3">
              {topPerformers.length > 0 ? (
                topPerformers.map((player: any) => (
                  <div
                    key={player.playerId || player.user_id || player.id}
                    className="border border-tm-border rounded-lg p-4 hover:bg-tm-surface-hover/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-tm-text-1">{player.name || 'Unknown'}</span>
                      <span className="text-xs text-tm-text-3 capitalize px-2 py-1 bg-tm-surface-hover rounded">
                        {player.position?.replace(/_/g, ' ') || 'N/A'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm text-tm-text-3">
                      <div>
                        <p className="text-xs text-tm-text-3">Games</p>
                        <p className="font-medium text-tm-text-1">{player.totalMatches || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-tm-text-3">Tries</p>
                        <p className="font-medium text-tm-text-1">{player.totalTries || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-tm-text-3">Tackles</p>
                        <p className="font-medium text-tm-text-1">{player.totalTackles || 0}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-tm-text-3 text-sm">No performance data available yet</p>
              )}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
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
                  {topPerformers.length > 0 ? (
                    topPerformers.map((player: any) => (
                      <tr key={player.playerId || player.user_id || player.id} className="hover:bg-tm-surface-hover transition-colors cursor-pointer">
                        <td className="px-6 py-4 text-sm font-medium text-tm-text-1">{player.name || 'Unknown'}</td>
                        <td className="px-6 py-4 text-sm text-tm-text-3 capitalize">
                          {player.position?.replace(/_/g, ' ') || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-tm-text-3">{player.totalMatches || 0}</td>
                        <td className="px-6 py-4 text-sm text-tm-text-3">{player.totalTries || 0}</td>
                        <td className="px-6 py-4 text-sm text-tm-text-3">{player.totalTackles || 0}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-tm-text-3">
                        No performance data available yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 sm:p-6 border-t border-tm-border">
              <button
                onClick={() => router.push('/players')}
                className="w-full sm:w-auto px-6 py-2 bg-tm-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-opacity"
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
        <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
          <h2 className="text-2xl font-bold text-tm-text-1 mb-2">
            Welcome, {user.name}!
          </h2>
          <p className="text-tm-text-3">
            Your {user.role.replace('_', ' ')} dashboard
          </p>
        </div>
      </div>
    </Layout>
  )
}
