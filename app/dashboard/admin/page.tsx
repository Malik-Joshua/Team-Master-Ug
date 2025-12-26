'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { Users, Activity, DollarSign, Package, Calendar, CheckCircle, XCircle, AlertCircle, FileText, X, Trophy, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface AttendanceSummary {
  totalSessions: number
  totalPlayers: number
  activePlayers?: number
  presentCount: number
  absentCount: number
  justifiedAbsenceCount: number
  injuredCount: number
  attendanceRate: number
  recentSessions: Array<{
    sessionDate: string
    sessionTitle: string
    present: number
    absent: number
    total: number
  }>
}

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null)
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null)
  const [pendingBudgets, setPendingBudgets] = useState<any[]>([])
  const [selectedBudget, setSelectedBudget] = useState<any>(null)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeInjuries, setActiveInjuries] = useState<any[]>([])
  const [loadingInjuries, setLoadingInjuries] = useState(false)
  const [teamSelection, setTeamSelection] = useState<any>(null)
  const [loadingTeamSelection, setLoadingTeamSelection] = useState(false)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPlayers: 0,
    activePlayers: 0,
    totalRevenue: 0,
    inventoryItems: 0,
  })
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([])
  const [recentApprovals, setRecentApprovals] = useState<any[]>([])

  useEffect(() => {
    const loadData = async () => {
      if (typeof window !== 'undefined') {
        const devUser = localStorage.getItem('dev_user')
        if (devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            setAttendanceSummary({
              totalSessions: 24,
              totalPlayers: 30,
              presentCount: 520,
              absentCount: 120,
              justifiedAbsenceCount: 45,
              injuredCount: 15,
              attendanceRate: 74.3,
              recentSessions: [
                { sessionDate: '2024-12-15', sessionTitle: 'Training Session 24', present: 22, absent: 8, total: 30 },
                { sessionDate: '2024-12-10', sessionTitle: 'Training Session 23', present: 25, absent: 5, total: 30 },
                { sessionDate: '2024-12-05', sessionTitle: 'Training Session 22', present: 20, absent: 10, total: 30 },
                { sessionDate: '2024-12-01', sessionTitle: 'Training Session 21', present: 23, absent: 7, total: 30 },
                { sessionDate: '2024-11-26', sessionTitle: 'Training Session 20', present: 24, absent: 6, total: 30 },
              ],
            })
            setPendingBudgets([
              {
                id: '1',
                event_name: 'Uganda Cup Final',
                event_type: 'game_day',
                event_date: '2024-12-20',
                description: 'Match day expenses',
                total_amount: 5000000,
                created_by_profile: { name: 'Finance Admin', email: 'finance@example.com' },
                budget_items: [
                  { item_name: 'Transport', category: 'Travel', quantity: 1, unit_price: 2000000, total_amount: 2000000 },
                  { item_name: 'Food & Beverages', category: 'Catering', quantity: 1, unit_price: 3000000, total_amount: 3000000 },
                ],
              },
            ])
            // Mock active injuries for dev mode
            setActiveInjuries([
              {
                id: '1',
                player_id: 'player1',
                player: { name: 'John Doe' },
                injury_date: '2024-12-01',
                cause: 'Training collision',
                diagnosis: 'Sprained ankle',
                return_to_play_date: '2024-12-20',
                return_to_training_date: '2024-12-15',
                status: 'active',
              },
              {
                id: '2',
                player_id: 'player2',
                player: { name: 'Mike Johnson' },
                injury_date: '2024-12-05',
                cause: 'Match injury',
                diagnosis: 'Shoulder strain',
                return_to_play_date: '2024-12-25',
                return_to_training_date: '2024-12-18',
                status: 'active',
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

          // Load statistics using API route (bypasses RLS)
          try {
            const response = await fetch('/api/admin/statistics')
            if (response.ok) {
              const data = await response.json()
              setStats({
                totalUsers: data.totalUsers || 0,
                totalPlayers: data.totalPlayers || 0,
                activePlayers: data.activePlayers || 0,
                totalRevenue: data.totalRevenue || 0,
                inventoryItems: data.inventoryItems || 0,
              })
              console.log('Loaded stats from API:', data)
            } else {
              const error = await response.json()
              console.error('Error fetching statistics:', error)
            }
          } catch (error) {
            console.error('Error loading statistics:', error)
          }

          // Load active injuries
          try {
            setLoadingInjuries(true)
            const { db } = await import('@/lib/db-helpers')
            const injuries = await db.getActiveInjuries()
            setActiveInjuries(injuries || [])
          } catch (error) {
            console.error('Error loading active injuries:', error)
            setActiveInjuries([])
          } finally {
            setLoadingInjuries(false)
          }

          // Load upcoming matches
          try {
            const { db } = await import('@/lib/db-helpers')
            const matches = await db.getUpcomingMatches()
            setUpcomingMatches(matches.slice(0, 3)) // Show next 3 upcoming matches
          } catch (error) {
            console.error('Error loading upcoming matches:', error)
            setUpcomingMatches([])
          }

          // Load recent budget approvals
          try {
            const { data: approvedBudgets } = await supabase
              .from('budgets')
              .select(`
                *,
                created_by_profile:user_profiles!budgets_created_by_fkey(name),
                approved_by_profile:user_profiles!budgets_approved_by_fkey(name)
              `)
              .eq('status', 'approved')
              .order('approved_at', { ascending: false })
              .limit(5)
            
            setRecentApprovals(approvedBudgets || [])
          } catch (error) {
            console.error('Error loading recent approvals:', error)
            setRecentApprovals([])
          }

          const { data: sessions } = await supabase
            .from('training_sessions')
            .select('id, session_date, description, session_number')
            .order('session_date', { ascending: false })
            .limit(10)

          const { data: attendance } = await supabase
            .from('training_attendance')
            .select('*')

          const { data: players } = await supabase
            .from('user_profiles')
            .select('user_id, status')
            .eq('role', 'player')

          if (sessions && attendance && players) {
            const totalSessions = sessions.length
            const totalPlayers = players.length
            const activePlayers = players.filter((p: any) => p.status === 'active').length
            let presentCount = 0
            let absentCount = 0
            let justifiedAbsenceCount = 0
            let injuredCount = 0

            attendance.forEach((record: any) => {
              if (record.attendance_status === 'P') presentCount++
              else if (record.attendance_status === 'X') absentCount++
              else if (record.attendance_status === 'A') justifiedAbsenceCount++
              else if (record.attendance_status === 'I') injuredCount++
            })

            const totalRecords = attendance.length
            const attendanceRate = totalRecords > 0 
              ? (presentCount / totalRecords) * 100 
              : 0

            const recentSessions = await Promise.all(
              sessions.slice(0, 5).map(async (session: any) => {
                const { data: sessionAttendance } = await supabase
                  .from('training_attendance')
                  .select('attendance_status')
                  .eq('session_id', session.id)

                const present = sessionAttendance?.filter((a: any) => a.attendance_status === 'P').length || 0
                const absent = sessionAttendance?.filter((a: any) => a.attendance_status === 'X').length || 0
                const total = sessionAttendance?.length || 0

                return {
                  sessionDate: session.session_date,
                  sessionTitle: session.description || `Training Session ${session.session_number}`,
                  present,
                  absent,
                  total,
                }
              })
            )

            setAttendanceSummary({
              totalSessions,
              totalPlayers,
              activePlayers: activePlayers || totalPlayers,
              presentCount,
              absentCount,
              justifiedAbsenceCount,
              injuredCount,
              attendanceRate: Math.round(attendanceRate * 10) / 10,
              recentSessions,
            })

            try {
              const { db } = await import('@/lib/db-helpers')
              const budgets = await db.getPendingBudgets()
              setPendingBudgets(budgets)
            } catch (error) {
              console.error('Error loading pending budgets:', error)
            }

            // Load team selection for upcoming fixture
            try {
              setLoadingTeamSelection(true)
              const matchesResponse = await fetch('/api/fixtures')
              if (matchesResponse.ok) {
                const matchesData = await matchesResponse.json()
                if (matchesData.fixtures && matchesData.fixtures.length > 0) {
                  const latestMatch = matchesData.fixtures[0]
                  const selectionResponse = await fetch(`/api/fixtures/team-selection?matchId=${latestMatch.id}`)
                  if (selectionResponse.ok) {
                    const selectionData = await selectionResponse.json()
                    setTeamSelection(selectionData)
                  }
                }
              }
            } catch (error) {
              console.error('Error loading team selection:', error)
            } finally {
              setLoadingTeamSelection(false)
            }
          }
        }
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const handleApproveBudget = async (budgetId: string) => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
        setPendingBudgets(pendingBudgets.filter(b => b.id !== budgetId))
        alert('Budget approved! (Dev Mode)')
        return
      }

      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert('Please log in to approve budgets')
        return
      }

      const { db } = await import('@/lib/db-helpers')
      await db.approveBudget(budgetId, authUser.id)
      
      const budgets = await db.getPendingBudgets()
      setPendingBudgets(budgets)
      setShowBudgetModal(false)
      setSelectedBudget(null)
      alert('Budget approved successfully!')
    } catch (error: any) {
      console.error('Error approving budget:', error)
      alert(`Error approving budget: ${error.message}`)
    }
  }

  const handleRejectBudget = async (budgetId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection')
      return
    }

    try {
      if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
        setPendingBudgets(pendingBudgets.filter(b => b.id !== budgetId))
        setRejectionReason('')
        setShowBudgetModal(false)
        setSelectedBudget(null)
        alert('Budget rejected! (Dev Mode)')
        return
      }

      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert('Please log in to reject budgets')
        return
      }

      const { db } = await import('@/lib/db-helpers')
      await db.rejectBudget(budgetId, authUser.id, rejectionReason)
      
      const budgets = await db.getPendingBudgets()
      setPendingBudgets(budgets)
      setRejectionReason('')
      setShowBudgetModal(false)
      setSelectedBudget(null)
      alert('Budget rejected successfully!')
    } catch (error: any) {
      console.error('Error rejecting budget:', error)
      alert(`Error rejecting budget: ${error.message}`)
    }
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `UGX ${(amount / 1000000).toFixed(1)}M`
    }
    return `UGX ${amount.toLocaleString()}`
  }

  const managementCards = [
    { name: 'Player Data', icon: Activity, href: '/players', color: 'bg-primary' },
    { name: 'Performance', icon: BarChart3, href: '/performance', color: 'bg-warning' },
    { name: 'Financial Records', icon: DollarSign, href: '/finance', color: 'bg-success' },
    { name: 'Inventory', icon: Package, href: '/inventory', color: 'bg-info' },
  ]

  const activities = [
    { type: 'player', message: 'New player registered: James Anderson', time: '10 minutes ago', color: 'bg-primary' },
    { type: 'match', message: 'Match stats logged: Uganda Cup Final', time: '2 hours ago', color: 'bg-info' },
    { type: 'finance', message: 'Revenue added: UGX 5,000,000 sponsorship', time: '5 hours ago', color: 'bg-success' },
  ]

  const attendanceChartData = attendanceSummary ? {
    labels: attendanceSummary.recentSessions.map(s => 
      new Date(s.sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    ),
    datasets: [
      {
        label: 'Present',
        data: attendanceSummary.recentSessions.map(s => s.present),
        backgroundColor: 'rgba(5, 150, 105, 0.8)',
        borderColor: '#059669',
        borderWidth: 2,
      },
      {
        label: 'Absent',
        data: attendanceSummary.recentSessions.map(s => s.absent),
        backgroundColor: 'rgba(220, 38, 38, 0.8)',
        borderColor: '#DC2626',
        borderWidth: 2,
      },
    ],
  } : null

  if (loading) {
    return (
      <Layout pageTitle="Admin Control Panel">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout pageTitle="Admin Control Panel">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <StatCard title="Total Users" value={stats.totalUsers} icon={Users} iconColor="bg-primary" />
          <StatCard title="Total Players" value={stats.totalPlayers} icon={Users} iconColor="bg-primary" />
          <StatCard title="Active Players" value={stats.activePlayers} icon={Activity} iconColor="bg-success" />
          <StatCard title="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} iconColor="bg-success" />
          <StatCard title="Inventory Items" value={stats.inventoryItems} icon={Package} iconColor="bg-info" />
        </div>

        {/* Upcoming Fixtures */}
        {upcomingMatches.length > 0 && (
          <div className="bg-white rounded-card border border-neutral-light shadow-soft">
            <div className="p-6 border-b border-neutral-light">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-text flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Upcoming Fixtures
                </h3>
                <Link
                  href="/fixtures"
                  className="text-primary hover:underline text-sm font-medium"
                >
                  View All →
                </Link>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {upcomingMatches.map((match) => (
                  <div key={match.id} className="p-4 bg-primary/5 rounded-lg border border-primary/20 hover:bg-primary/10 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-neutral-text text-lg mb-1">
                          vs {match.opponent}
                        </h4>
                        <p className="text-sm text-neutral-medium mb-2">
                          {new Date(match.match_date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                        {match.venue && (
                          <p className="text-sm text-neutral-medium">📍 {match.venue}</p>
                        )}
                        <p className="text-xs text-neutral-medium mt-2">
                          {match.tournament_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </p>
                      </div>
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent Budget Approvals */}
        {recentApprovals.length > 0 && (
          <div className="bg-white rounded-card border border-neutral-light shadow-soft">
            <div className="p-6 border-b border-neutral-light">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-text flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  Recent Budget Approvals
                </h3>
                <Link
                  href="/finance"
                  className="text-primary hover:underline text-sm font-medium"
                >
                  View All →
                </Link>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {recentApprovals.map((budget) => (
                  <div key={budget.id} className="p-4 bg-success/5 rounded-lg border border-success/20">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-bold text-neutral-text">{budget.event_name}</h4>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-success/20 text-success">
                            Approved
                          </span>
                        </div>
                        <p className="text-sm text-neutral-medium mb-1">
                          {budget.event_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} • {new Date(budget.event_date).toLocaleDateString()}
                        </p>
                        <p className="text-lg font-bold text-success mt-2">
                          {formatCurrency(parseFloat(budget.total_amount.toString()))}
                        </p>
                        {budget.approved_at && (
                          <p className="text-xs text-neutral-medium mt-1">
                            Approved on {new Date(budget.approved_at).toLocaleDateString()} by {budget.approved_by_profile?.name || 'Admin'}
                          </p>
                        )}
                      </div>
                      <CheckCircle className="w-5 h-5 text-success" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active Injuries View (Read-Only) */}
        {activeInjuries.length > 0 && (
          <div className="bg-white rounded-card border border-neutral-light shadow-soft">
            <div className="p-6 border-b border-neutral-light">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-text flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-secondary" />
                  Active Player Injuries
                </h3>
                <span className="text-sm text-neutral-medium">{activeInjuries.length} active injury{activeInjuries.length !== 1 ? 'ies' : ''}</span>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {activeInjuries.map((injury: any) => {
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

        {pendingBudgets.length > 0 && (
          <div className="bg-white rounded-card border border-neutral-light shadow-soft p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-neutral-text flex items-center">
                <FileText className="w-6 h-6 mr-2 text-warning" />
                Pending Budget Approvals ({pendingBudgets.length})
              </h2>
              <Link
                href="/finance"
                className="text-primary hover:text-primary-dark font-semibold text-sm"
              >
                View All Budgets →
              </Link>
            </div>
            <div className="space-y-4">
              {pendingBudgets.slice(0, 3).map((budget) => (
                <div key={budget.id} className="p-4 bg-warning/10 rounded-lg border border-warning/20 hover:bg-warning/20 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-bold text-neutral-text">{budget.event_name}</h3>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-warning/20 text-warning">
                          Pending
                        </span>
                      </div>
                      <p className="text-sm text-neutral-medium mb-1">
                        {budget.event_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} • {new Date(budget.event_date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-neutral-medium mb-2">{budget.description}</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(parseFloat(budget.total_amount.toString()))}</p>
                      <p className="text-xs text-neutral-medium mt-1">
                        Created by: {budget.created_by_profile?.name || 'Finance Admin'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => {
                          setSelectedBudget(budget)
                          setShowBudgetModal(true)
                        }}
                        className="px-4 py-2 bg-primary text-white rounded-button font-semibold hover:bg-primary-dark transition-colors text-sm"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {pendingBudgets.length > 3 && (
              <div className="mt-4 text-center">
                <Link
                  href="/finance"
                  className="text-primary hover:text-primary-dark font-semibold text-sm"
                >
                  View {pendingBudgets.length - 3} more pending budgets →
                </Link>
              </div>
            )}
          </div>
        )}

        {attendanceSummary && (
          <div className="bg-white rounded-card border border-neutral-light shadow-soft p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-neutral-text flex items-center">
                <Calendar className="w-6 h-6 mr-2 text-primary" />
                Training Attendance Summary
              </h2>
              <Link
                href="/training"
                className="text-primary hover:text-primary-dark font-semibold text-sm"
              >
                View Details →
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span className="text-2xl font-bold text-success">{attendanceSummary.presentCount}</span>
                </div>
                <p className="text-sm text-neutral-medium">Present</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <XCircle className="w-5 h-5 text-secondary" />
                  <span className="text-2xl font-bold text-secondary">{attendanceSummary.absentCount}</span>
                </div>
                <p className="text-sm text-neutral-medium">Absent</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <AlertCircle className="w-5 h-5 text-info" />
                  <span className="text-2xl font-bold text-info">{attendanceSummary.justifiedAbsenceCount}</span>
                </div>
                <p className="text-sm text-neutral-medium">Justified</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <div className="flex items-center justify-between mb-2">
                  <AlertCircle className="w-5 h-5 text-warning" />
                  <span className="text-2xl font-bold text-warning">{attendanceSummary.injuredCount}</span>
                </div>
                <p className="text-sm text-neutral-medium">Injured</p>
              </div>
              <div className="bg-club-gradient rounded-lg p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Activity className="w-5 h-5" />
                  <span className="text-2xl font-bold">{attendanceSummary.attendanceRate}%</span>
                </div>
                <p className="text-sm text-white/90">Rate</p>
              </div>
            </div>

            {attendanceChartData && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-neutral-text mb-4">Recent Sessions Attendance</h3>
                <div className="h-64">
                  <Bar
                    data={attendanceChartData}
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
                          ticks: {
                            stepSize: 1,
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-neutral-light">
              <div>
                <p className="text-sm text-neutral-medium">Total Sessions</p>
                <p className="text-xl font-bold text-neutral-text">{attendanceSummary.totalSessions}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-medium">Total Players</p>
                <p className="text-xl font-bold text-neutral-text">{attendanceSummary.totalPlayers}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-medium">Overall Attendance Rate</p>
                <p className="text-xl font-bold text-primary">{attendanceSummary.attendanceRate}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Fixture Team Selection */}
        {teamSelection && teamSelection.match && (
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
                  View All Fixtures →
                </Link>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <h4 className="font-semibold text-neutral-text mb-2">
                  {new Date(teamSelection.match.match_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })} vs {teamSelection.match.opponent}
                </h4>
                {teamSelection.match.venue && (
                  <p className="text-sm text-neutral-medium">Venue: {teamSelection.match.venue}</p>
                )}
              </div>
              
              {teamSelection.starting && teamSelection.starting.length > 0 && (
                <div className="mb-4">
                  <h5 className="font-semibold text-neutral-text mb-2">Starting Lineup ({teamSelection.starting.length})</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {teamSelection.starting.map((selection: any) => (
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

              {teamSelection.substitutes && teamSelection.substitutes.length > 0 && (
                <div>
                  <h5 className="font-semibold text-neutral-text mb-2">Substitutes ({teamSelection.substitutes.length})</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {teamSelection.substitutes.map((selection: any) => (
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

              {(!teamSelection.starting || teamSelection.starting.length === 0) && 
               (!teamSelection.substitutes || teamSelection.substitutes.length === 0) && (
                <p className="text-neutral-medium text-center py-4">No team selection made yet for this fixture.</p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {managementCards.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.name}
                href={card.href}
                className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift card-hover"
              >
                <div className={`${card.color} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-neutral-text">{card.name}</h3>
              </Link>
            )
          })}
        </div>

        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <h3 className="text-xl font-bold text-neutral-text mb-6">Recent Activity Feed</h3>
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 hover:bg-neutral-light rounded-lg transition-colors">
                <div className={`w-2 h-2 rounded-full ${activity.color} mt-2 flex-shrink-0`} />
                <div className="flex-1">
                  <p className="text-sm text-neutral-text">{activity.message}</p>
                  <p className="text-xs text-neutral-medium mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showBudgetModal && selectedBudget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card shadow-soft max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-light">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-neutral-text">Review Budget Request</h3>
                <button onClick={() => { setShowBudgetModal(false); setSelectedBudget(null); setRejectionReason('') }} className="text-neutral-medium hover:text-neutral-text transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-medium mb-1">Event Name</label>
                  <p className="text-neutral-text font-medium">{selectedBudget.event_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-medium mb-1">Event Type</label>
                  <p className="text-neutral-text">{selectedBudget.event_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-medium mb-1">Event Date</label>
                  <p className="text-neutral-text">{new Date(selectedBudget.event_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-medium mb-1">Total Amount</label>
                  <p className="text-lg font-bold text-primary">{formatCurrency(parseFloat(selectedBudget.total_amount.toString()))}</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-neutral-medium mb-1">Description</label>
                  <p className="text-neutral-text">{selectedBudget.description || 'No description provided'}</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-neutral-medium mb-1">Created By</label>
                  <p className="text-neutral-text">{selectedBudget.created_by_profile?.name || 'Finance Admin'} ({selectedBudget.created_by_profile?.email || 'N/A'})</p>
                </div>
              </div>

              {selectedBudget.budget_items && selectedBudget.budget_items.length > 0 && (
                <div className="border-t border-neutral-light pt-4">
                  <h4 className="text-lg font-bold text-neutral-text mb-4">Budget Items</h4>
                  <div className="space-y-2">
                    {selectedBudget.budget_items.map((item: any, index: number) => (
                      <div key={index} className="p-3 bg-neutral-light/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-neutral-text">{item.item_name}</p>
                            {item.category && <p className="text-sm text-neutral-medium">{item.category}</p>}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-neutral-text">{formatCurrency(parseFloat(item.total_amount.toString()))}</p>
                            <p className="text-xs text-neutral-medium">{item.quantity} × {formatCurrency(parseFloat(item.unit_price.toString()))}</p>
                          </div>
                        </div>
                        {item.notes && <p className="text-xs text-neutral-medium mt-1">{item.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-neutral-light pt-4">
                <label className="block text-sm font-semibold text-neutral-medium mb-2">Rejection Reason (if rejecting)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
                  placeholder="Provide a reason for rejection (optional)"
                />
              </div>
            </div>
            <div className="p-6 border-t border-neutral-light flex justify-end space-x-3">
              <button
                onClick={() => { setShowBudgetModal(false); setSelectedBudget(null); setRejectionReason('') }}
                className="px-6 py-2 border border-neutral-light rounded-button font-semibold text-neutral-text hover:bg-neutral-light transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRejectBudget(selectedBudget.id)}
                className="px-6 py-2 bg-secondary text-white rounded-button font-semibold hover:bg-secondary-dark transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => handleApproveBudget(selectedBudget.id)}
                className="px-6 py-2 bg-success text-white rounded-button font-semibold hover:bg-success-dark transition-colors"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
