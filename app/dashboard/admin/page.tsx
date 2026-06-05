'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import ConceptStatCard from '@/components/ConceptStatCard'
import QuickActions from '@/components/QuickActions'
import AttendanceSummary from '@/components/AttendanceSummary'
import FixtureCard from '@/components/FixtureCard'
import InjuryList from '@/components/InjuryList'
import BirthdayAlert from '@/components/BirthdayAlert'
import { Users, Activity, DollarSign, Package, Calendar, CheckCircle, XCircle, AlertCircle, FileText, X, Trophy, BarChart3, ClipboardCheck, CalendarPlus, HeartPulse, UserPlus, RefreshCw, ArrowRight, Clock, MapPin } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import RefreshButton from '@/components/RefreshButton'
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

const formatDateSafe = (dateString: string | null | undefined, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!dateString) return 'TBD'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'TBD'
  return date.toLocaleDateString('en-US', options)
}

const formatTimeSafe = (dateString: string | null | undefined) => {
  if (!dateString) return 'TBD'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'TBD'
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

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
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null)
  const [pendingBudgets, setPendingBudgets] = useState<any[]>([])
  const [selectedBudget, setSelectedBudget] = useState<any>(null)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [showSquadModal, setShowSquadModal] = useState(false)
  const [showMatchDayModal, setShowMatchDayModal] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
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
    totalStaff: 0,
    totalRevenue: 0,
    inventoryItems: 0,
  })
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([])
  const [recentApprovals, setRecentApprovals] = useState<any[]>([])

  const loadData = useCallback(async () => {
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
                totalStaff: data.totalStaff || 0,
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

          // Load active injuries using API route (bypasses RLS)
          try {
            setLoadingInjuries(true)
            const response = await fetch('/api/admin/injuries', {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache',
              }
            })
            if (response.ok) {
              const data = await response.json()
              setActiveInjuries(data.injuries || [])
              console.log('Loaded active injuries from API:', data.injuries)
            } else {
              const error = await response.json()
              console.error('Error fetching active injuries:', error)
              setActiveInjuries([])
            }
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
                approved_by_profile:user_profiles!budgets_approved_by_fkey(name),
                budget_items (*)
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
  }, [])

  useEffect(() => {
    setIsMounted(true)
    loadData()
  }, [loadData])

  const handleApproveBudget = async (budgetId: string) => {
    try {
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

  const activities: Array<{ message: string; time: string; color: string }> = []

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
    <Layout pageTitle="Admin Dashboard">
      <div className="space-y-5">
        <BirthdayAlert />
        
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[20px] font-medium mb-[2px]" style={{ color: 'var(--tm-text-1)' }}>Admin dashboard</h2>
            <p className="text-[13px]" style={{ color: 'var(--tm-text-3)' }}>Overview of club operations and statistics</p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] text-[13px] font-medium transition-all duration-200 hover:border-[var(--tm-primary)] hover:text-[var(--tm-primary)] hover:scale-[1.03] hover:shadow-md cursor-pointer group"
              style={{ border: '1px solid var(--tm-border)', color: 'var(--tm-text-2)', background: 'var(--tm-surface)' }}
            >
              <RefreshCw className="w-[15px] h-[15px] transition-transform duration-500 group-hover:rotate-180" /> Refresh
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <QuickActions
          actions={[
            {
              icon: ClipboardCheck,
              label: 'Mark attendance',
              iconBgColor: 'rgba(91, 163, 217, 0.12)',
              iconTextColor: '#5BA3D9',
              onClick: () => router.push('/training'),
            },
            {
              icon: CalendarPlus,
              label: 'Create session',
              iconBgColor: 'rgba(45, 184, 138, 0.12)',
              iconTextColor: '#2DB88A',
              onClick: () => router.push('/training'),
            },
            {
              icon: HeartPulse,
              label: 'Log injury',
              iconBgColor: 'rgba(224, 87, 87, 0.12)',
              iconTextColor: '#E05757',
              onClick: () => router.push('/dashboard/physio'),
            },
            {
              icon: UserPlus,
              label: 'Add player',
              iconBgColor: 'rgba(224, 159, 66, 0.12)',
              iconTextColor: '#E09F42',
              onClick: () => router.push('/players'),
            },
          ]}
        />

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-3">
          <ConceptStatCard
            label="Total players"
            value={stats.totalPlayers}
            change={'+3 this month'}
            changeType="positive"
            meta="17 registered · 7 staff"
            icon={Users}
            iconBgColor="rgba(91, 163, 217, 0.12)"
            iconTextColor="#5BA3D9"
          />
          <ConceptStatCard
            label="Attendance rate"
            value={attendanceSummary ? `${Math.round(attendanceSummary.attendanceRate)}%` : '0%'}
            change={'+5% vs last month'}
            changeType="positive"
            meta="Based on last 5 sessions"
            icon={Activity}
            iconBgColor="rgba(45, 184, 138, 0.12)"
            iconTextColor="#2DB88A"
          />
          <ConceptStatCard
            label="Active injuries"
            value={activeInjuries.length}
            change={activeInjuries.length > 0 ? activeInjuries.slice(0, 2).map((i: any) => i.player?.name || 'Unknown').join(' · ') : 'None'}
            changeType={activeInjuries.length > 0 ? 'negative' : 'neutral'}
            meta={`${activeInjuries.filter((i: any) => i.status === 'active').length} active · ${activeInjuries.filter((i: any) => i.status === 'recovery').length} recovery`}
            icon={HeartPulse}
            iconBgColor="rgba(224, 87, 87, 0.12)"
            iconTextColor="#E05757"
          />
          <ConceptStatCard
            label="Next fixture"
            value={upcomingMatches.length > 0 ? `vs ${upcomingMatches[0].opponent}` : 'No upcoming'}
            change={upcomingMatches.length > 0 ? `${new Date(upcomingMatches[0].match_date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })} · ${new Date(upcomingMatches[0].match_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : ''}
            changeType="neutral"
            meta={upcomingMatches.length > 0 ? upcomingMatches[0].venue || 'TBD' : ''}
            icon={Trophy}
            iconBgColor="rgba(224, 159, 66, 0.12)"
            iconTextColor="#E09F42"
          />
        </div>

        {/* Middle row - attendance + fixture + injuries */}
        <div className="grid grid-cols-[1.4fr_1fr] gap-4">
          {/* Attendance summary */}
          {attendanceSummary && (
            <AttendanceSummary
              chips={[
                { label: 'Present', value: attendanceSummary.presentCount, bgColor: 'rgba(45, 184, 138, 0.12)', textColor: '#2DB88A' },
                { label: 'Absent', value: attendanceSummary.absentCount, bgColor: 'rgba(224, 87, 87, 0.12)', textColor: '#E05757' },
                { label: 'Justified', value: attendanceSummary.justifiedAbsenceCount, bgColor: 'rgba(255, 255, 255, 0.04)', textColor: 'var(--tm-text-2)' },
                { label: 'Injured', value: attendanceSummary.injuredCount, bgColor: 'rgba(224, 159, 66, 0.12)', textColor: '#E09F42' },
              ]}
              presentData={attendanceSummary.recentSessions.map(s => s.present)}
              absentData={attendanceSummary.recentSessions.map(s => s.absent)}
              labels={attendanceSummary.recentSessions.map(s => new Date(s.sessionDate).toLocaleDateString('en-US', { weekday: 'short' }))}
            />
          )}

          {/* Right column - fixture + injuries */}
          <div className="flex flex-col gap-3.5">
            {/* Next fixture card */}
            {upcomingMatches.length > 0 && (
              <FixtureCard
                label={`Next fixture · ${upcomingMatches[0].tournament_type?.replace('_', ' ') || 'Match'}`}
                homeTeam="Team Master"
                awayTeam={upcomingMatches[0].opponent}
                date={formatDateSafe(upcomingMatches[0].match_date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                time={formatTimeSafe(upcomingMatches[0].match_date)}
                venue={upcomingMatches[0].venue || 'TBD'}
                onViewSquad={() => {
                  console.log("View squad clicked in FixtureCard parent!");
                  setShowSquadModal(true);
                }}
                onMatchDay={() => {
                  console.log("Match day clicked in FixtureCard parent!");
                  setShowMatchDayModal(true);
                }}
              />
            )}

            {/* Active injuries */}
            {activeInjuries.length > 0 && (
              <div className="rounded-[10px] overflow-hidden flex-1" style={{ background: 'var(--tm-surface)', border: '1px solid var(--tm-border)' }}>
                <div className="flex items-center justify-between p-3.5 px-4.5 border-b" style={{ borderColor: 'var(--tm-border)' }}>
                  <div className="flex items-center gap-1.5">
                    <HeartPulse className="w-[17px] h-[17px]" style={{ color: 'var(--tm-secondary)' }} />
                    <span className="text-[14px] font-medium" style={{ color: 'var(--tm-text-1)' }}>Active injuries</span>
                  </div>
                  <Link href="/dashboard/physio" className="text-[12px] font-medium flex items-center gap-1 cursor-pointer" style={{ color: 'var(--tm-secondary)' }}>
                    All <ArrowRight className="w-[13px] h-[13px]" />
                  </Link>
                </div>
                <div className="p-3 px-4.5">
                  <InjuryList
                    injuries={activeInjuries.map((injury: any) => ({
                      name: injury.player?.name || 'Unknown',
                      injury: injury.diagnosis || injury.cause || 'Unknown injury',
                      date: new Date(injury.injury_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                      status: injury.status === 'active' ? 'active' : 'recovery',
                      returnDate: injury.return_to_play_date ? new Date(injury.return_to_play_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD',
                    }))}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Budget Approvals */}
        {recentApprovals.length > 0 && (
          <div className="rounded-[10px] overflow-hidden" style={{ background: 'var(--tm-surface)', border: '1px solid var(--tm-border)' }}>
            <div className="p-4.5 border-b" style={{ borderColor: 'var(--tm-border)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-medium flex items-center gap-1.5" style={{ color: 'var(--tm-text-1)' }}>
                  <CheckCircle className="w-[17px] h-[17px] text-[#2DB88A]" />
                  Recent Budget Approvals
                </h3>
                <Link
                  href="/finance"
                  className="text-[12px] font-medium flex items-center gap-1 hover:opacity-80"
                  style={{ color: 'var(--tm-secondary)' }}
                >
                  View All →
                </Link>
              </div>
            </div>
            <div className="p-4.5">
              <div className="space-y-3.5">
                {recentApprovals.map((budget) => (
                  <div key={budget.id} className="p-3.5 bg-success/5 rounded-[8px] border border-success/20">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h4 className="text-[13px] font-semibold" style={{ color: 'var(--tm-text-1)' }}>{budget.event_name}</h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success border border-success/20">
                            Approved
                          </span>
                        </div>
                        <p className="text-[11px] mb-1" style={{ color: 'var(--tm-text-3)' }}>
                          {budget.event_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} • {new Date(budget.event_date).toLocaleDateString()}
                        </p>
                        {budget.budget_items && budget.budget_items.length > 0 && (
                          <div className="mb-2">
                            <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--tm-text-muted)' }}>Items</p>
                            <div className="space-y-1">
                              {budget.budget_items.slice(0, 3).map((item: any, index: number) => (
                                <div key={index} className="flex items-center justify-between text-[11px]" style={{ color: 'var(--tm-text-2)' }}>
                                  <span className="truncate">{item.item_name}</span>
                                  <span className="text-[11px]" style={{ color: 'var(--tm-text-3)' }}>
                                    {formatCurrency(parseFloat(item.total_amount.toString()))}
                                  </span>
                                </div>
                              ))}
                              {budget.budget_items.length > 3 && (
                                <p className="text-[10px]" style={{ color: 'var(--tm-text-muted)' }}>
                                  +{budget.budget_items.length - 3} more items
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        <p className="text-[14px] font-bold text-success mt-1.5">
                          {formatCurrency(parseFloat(budget.total_amount.toString()))}
                        </p>
                        {budget.approved_at && (
                          <p className="text-[10px] mt-1" style={{ color: 'var(--tm-text-muted)' }}>
                            Approved on {new Date(budget.approved_at).toLocaleDateString()} by {budget.approved_by_profile?.name || 'Admin'}
                          </p>
                        )}
                      </div>
                      <CheckCircle className="w-[15px] h-[15px] text-success" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}


        {pendingBudgets.length > 0 && (
          <div className="rounded-[10px] overflow-hidden p-4.5" style={{ background: 'var(--tm-surface)', border: '1px solid var(--tm-border)' }}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: 'var(--tm-border)' }}>
              <h2 className="text-[14px] font-medium flex items-center" style={{ color: 'var(--tm-text-1)' }}>
                <FileText className="w-[17px] h-[17px] mr-1.5" style={{ color: 'var(--tm-secondary)' }} />
                Pending Budget Approvals ({pendingBudgets.length})
              </h2>
              <Link
                href="/finance"
                className="text-[12px] font-medium hover:opacity-80"
                style={{ color: 'var(--tm-secondary)' }}
              >
                View All Budgets →
              </Link>
            </div>
            <div className="space-y-3.5">
              {pendingBudgets.slice(0, 3).map((budget) => (
                <div key={budget.id} className="p-3.5 bg-warning/10 rounded-[8px] border border-warning/20 hover:bg-warning/20 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2.5 mb-1.5">
                        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--tm-text-1)' }}>{budget.event_name}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/10 text-warning border border-warning/20">
                          Pending
                        </span>
                      </div>
                      <p className="text-[11px] mb-1" style={{ color: 'var(--tm-text-3)' }}>
                        {budget.event_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} • {new Date(budget.event_date).toLocaleDateString()}
                      </p>
                      <p className="text-[11px] mb-2" style={{ color: 'var(--tm-text-2)' }}>{budget.description}</p>
                      {budget.budget_items && budget.budget_items.length > 0 && (
                        <div className="mb-2">
                          <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--tm-text-muted)' }}>Items</p>
                          <div className="space-y-1">
                            {budget.budget_items.slice(0, 3).map((item: any, index: number) => (
                              <div key={index} className="flex items-center justify-between text-[11px]" style={{ color: 'var(--tm-text-2)' }}>
                                <span className="truncate">{item.item_name}</span>
                                <span className="text-[11px]" style={{ color: 'var(--tm-text-3)' }}>
                                  {formatCurrency(parseFloat(item.total_amount.toString()))}
                                </span>
                              </div>
                            ))}
                            {budget.budget_items.length > 3 && (
                              <p className="text-[10px]" style={{ color: 'var(--tm-text-muted)' }}>
                                +{budget.budget_items.length - 3} more items
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      <p className="text-[14px] font-bold" style={{ color: 'var(--tm-secondary)' }}>{formatCurrency(parseFloat(budget.total_amount.toString()))}</p>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--tm-text-muted)' }}>
                        Created by: {budget.created_by_profile?.name || 'Finance Admin'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => {
                          setSelectedBudget(budget)
                          setShowBudgetModal(true)
                        }}
                        className="px-3 py-1.5 bg-[var(--tm-secondary)] text-[var(--tm-text-on-secondary)] rounded-[6px] font-semibold hover:opacity-90 transition-opacity text-[11px] cursor-pointer border-none"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {pendingBudgets.length > 3 && (
              <div className="mt-3.5 text-center">
                <Link
                  href="/finance"
                  className="text-[11px] font-medium hover:opacity-80"
                  style={{ color: 'var(--tm-secondary)' }}
                >
                  View {pendingBudgets.length - 3} more pending budgets →
                </Link>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {managementCards.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.name}
                href={card.href}
                className="rounded-[10px] p-4 flex flex-col gap-3 cursor-pointer transition-all duration-300 hover-lift hover:border-[var(--tm-primary)] hover:bg-[var(--tm-primary-subtle)]"
                style={{ background: 'var(--tm-surface)', border: '1px solid var(--tm-border)' }}
              >
                <div className={`${card.color} w-9 h-9 rounded-[8px] flex items-center justify-center`}>
                  <Icon className="w-[18px] h-[18px] text-white" />
                </div>
                <h3 className="text-[13px] font-medium" style={{ color: 'var(--tm-text-1)' }}>{card.name}</h3>
              </Link>
            )
          })}
        </div>

        <div className="rounded-[10px] p-4.5" style={{ background: 'var(--tm-surface)', border: '1px solid var(--tm-border)' }}>
          <h3 className="text-[14px] font-medium mb-4" style={{ color: 'var(--tm-text-1)' }}>Recent Activity Feed</h3>
          {activities.length === 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--tm-text-3)' }}>No recent activity yet.</p>
          ) : (
            <div className="space-y-3.5">
              {activities.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3 p-2.5 hover:bg-[var(--tm-surface-hover)] rounded-[6px] transition-colors">
                  <div className={`w-2 h-2 rounded-full ${activity.color} mt-2 flex-shrink-0`} />
                  <div className="flex-1">
                    <p className="text-[13px]" style={{ color: 'var(--tm-text-1)' }}>{activity.message}</p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--tm-text-3)' }}>{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showBudgetModal && selectedBudget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="rounded-[10px] shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--tm-surface)', border: '1px solid var(--tm-border)' }}>
            <div className="p-4.5 border-b" style={{ borderColor: 'var(--tm-border)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold" style={{ color: 'var(--tm-text-1)' }}>Review Budget Request</h3>
                <button onClick={() => { setShowBudgetModal(false); setSelectedBudget(null); setRejectionReason('') }} className="cursor-pointer border-none bg-none hover:opacity-80 transition-opacity" style={{ color: 'var(--tm-text-3)' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4.5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase mb-1" style={{ color: 'var(--tm-text-muted)' }}>Event Name</label>
                  <p className="font-medium text-[13px]" style={{ color: 'var(--tm-text-1)' }}>{selectedBudget.event_name}</p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase mb-1" style={{ color: 'var(--tm-text-muted)' }}>Event Type</label>
                  <p className="text-[13px]" style={{ color: 'var(--tm-text-1)' }}>{selectedBudget.event_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase mb-1" style={{ color: 'var(--tm-text-muted)' }}>Event Date</label>
                  <p className="text-[13px]" style={{ color: 'var(--tm-text-1)' }}>{new Date(selectedBudget.event_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase mb-1" style={{ color: 'var(--tm-text-muted)' }}>Total Amount</label>
                  <p className="text-[15px] font-bold" style={{ color: 'var(--tm-secondary)' }}>{formatCurrency(parseFloat(selectedBudget.total_amount.toString()))}</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold uppercase mb-1" style={{ color: 'var(--tm-text-muted)' }}>Description</label>
                  <p className="text-[13px]" style={{ color: 'var(--tm-text-2)' }}>{selectedBudget.description || 'No description provided'}</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold uppercase mb-1" style={{ color: 'var(--tm-text-muted)' }}>Created By</label>
                  <p className="text-[13px]" style={{ color: 'var(--tm-text-2)' }}>{selectedBudget.created_by_profile?.name || 'Finance Admin'} ({selectedBudget.created_by_profile?.email || 'N/A'})</p>
                </div>
              </div>

              {selectedBudget.budget_items && selectedBudget.budget_items.length > 0 && (
                <div className="border-t pt-3.5" style={{ borderColor: 'var(--tm-border)' }}>
                  <h4 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--tm-text-1)' }}>Budget Items</h4>
                  <div className="space-y-2">
                    {selectedBudget.budget_items.map((item: any, index: number) => (
                      <div key={index} className="p-3 rounded-[6px]" style={{ background: 'var(--tm-surface-hover)', border: '1px solid var(--tm-border)' }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-[12px]" style={{ color: 'var(--tm-text-1)' }}>{item.item_name}</p>
                            {item.category && <p className="text-[11px]" style={{ color: 'var(--tm-text-3)' }}>{item.category}</p>}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-[12px]" style={{ color: 'var(--tm-text-1)' }}>{formatCurrency(parseFloat(item.total_amount.toString()))}</p>
                            <p className="text-[10px]" style={{ color: 'var(--tm-text-3)' }}>{item.quantity} × {formatCurrency(parseFloat(item.unit_price.toString()))}</p>
                          </div>
                        </div>
                        {item.notes && <p className="text-[10px] mt-1" style={{ color: 'var(--tm-text-3)' }}>{item.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-3.5" style={{ borderColor: 'var(--tm-border)' }}>
                <label className="block text-[11px] font-semibold uppercase mb-1.5" style={{ color: 'var(--tm-text-muted)' }}>Rejection Reason (if rejecting)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[var(--tm-secondary)] text-[12px]"
                  style={{ background: 'var(--tm-surface-hover)', borderColor: 'var(--tm-border)', color: 'var(--tm-text-1)' }}
                  placeholder="Provide a reason for rejection (optional)"
                />
              </div>
            </div>
            <div className="p-4.5 border-t flex justify-end space-x-2.5" style={{ borderColor: 'var(--tm-border)' }}>
              <button
                onClick={() => { setShowBudgetModal(false); setSelectedBudget(null); setRejectionReason('') }}
                className="px-4 py-1.5 border rounded-[6px] text-[12px] font-medium cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: 'none', borderColor: 'var(--tm-border)', color: 'var(--tm-text-2)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRejectBudget(selectedBudget.id)}
                className="px-4 py-1.5 rounded-[6px] text-[12px] font-medium text-white bg-[#E05757] hover:opacity-90 transition-opacity border-none cursor-pointer"
              >
                Reject
              </button>
              <button
                onClick={() => handleApproveBudget(selectedBudget.id)}
                className="px-4 py-1.5 rounded-[6px] text-[12px] font-medium text-white bg-[#2DB88A] hover:opacity-90 transition-opacity border-none cursor-pointer"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Squad Lineup Popup Modal */}
      {showSquadModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="rounded-[10px] shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto flex flex-col" style={{ background: 'var(--tm-surface)', border: '1px solid var(--tm-border)' }}>
            {/* Header */}
            <div className="p-4.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--tm-border)' }}>
              <div className="flex items-center gap-2">
                <Trophy className="w-[17px] h-[17px]" style={{ color: 'var(--tm-secondary)' }} />
                <h3 className="text-[14px] font-semibold" style={{ color: 'var(--tm-text-1)' }}>Upcoming Squad Selection</h3>
              </div>
              <button onClick={() => setShowSquadModal(false)} className="cursor-pointer border-none bg-none hover:opacity-80 transition-opacity" style={{ color: 'var(--tm-text-3)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4.5 space-y-4 overflow-y-auto">
              {teamSelection && teamSelection.match ? (
                <>
                  <div className="mb-2">
                    <h4 className="text-[13px] font-semibold mb-1" style={{ color: 'var(--tm-text-1)' }}>
                      {formatDateSafe(teamSelection.match.match_date, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })} vs {teamSelection.match.opponent}
                    </h4>
                    {teamSelection.match.venue && (
                      <p className="text-[11px]" style={{ color: 'var(--tm-text-3)' }}>Venue: {teamSelection.match.venue}</p>
                    )}
                  </div>

                  {/* Starting Lineup */}
                  {teamSelection.starting && teamSelection.starting.length > 0 ? (
                    <div>
                      <h5 className="text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--tm-text-muted)' }}>Starting Lineup ({teamSelection.starting.length})</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {teamSelection.starting.map((selection: any) => (
                          <div key={selection.id} className="bg-success/5 border border-success/15 rounded-[8px] p-2.5 flex items-center justify-between">
                            <div>
                              <span className="text-[12px] font-medium block" style={{ color: 'var(--tm-text-1)' }}>{selection.player?.name || 'Unknown'}</span>
                              {selection.position && (
                                <p className="text-[10px] capitalize mt-0.5" style={{ color: 'var(--tm-text-3)' }}>{selection.position.replace(/_/g, ' ')}</p>
                              )}
                            </div>
                            {selection.jersey_number && (
                              <span className="bg-success/15 text-success px-2 py-0.5 rounded text-[10px] font-bold">#{selection.jersey_number}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] py-2 text-center" style={{ color: 'var(--tm-text-3)' }}>No starting lineup chosen yet.</p>
                  )}

                  {/* Substitutes */}
                  {teamSelection.substitutes && teamSelection.substitutes.length > 0 && (
                    <div className="border-t pt-4" style={{ borderColor: 'var(--tm-border)' }}>
                      <h5 className="text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--tm-text-muted)' }}>Substitutes ({teamSelection.substitutes.length})</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {teamSelection.substitutes.map((selection: any) => (
                          <div key={selection.id} className="bg-warning/5 border border-warning/15 rounded-[8px] p-2.5 flex items-center justify-between">
                            <div>
                              <span className="text-[12px] font-medium block" style={{ color: 'var(--tm-text-1)' }}>{selection.player?.name || 'Unknown'}</span>
                              {selection.position && (
                                <p className="text-[10px] capitalize mt-0.5" style={{ color: 'var(--tm-text-3)' }}>{selection.position.replace(/_/g, ' ')}</p>
                              )}
                            </div>
                            {selection.jersey_number && (
                              <span className="bg-warning/15 text-warning px-2 py-0.5 rounded text-[10px] font-bold">#{selection.jersey_number}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 mx-auto opacity-20 mb-3" style={{ color: 'var(--tm-text-muted)' }} />
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--tm-text-1)' }}>No lineup submitted yet</p>
                  <p className="text-[11px] max-w-sm mx-auto mt-1" style={{ color: 'var(--tm-text-3)' }}>
                    Coaches have not yet saved a squad lineup selection for this match in the database.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t flex justify-between items-center" style={{ borderColor: 'var(--tm-border)' }}>
              <Link
                href="/fixtures"
                className="text-[11px] font-semibold hover:opacity-80 transition-opacity"
                style={{ color: 'var(--tm-secondary)' }}
              >
                Manage Team Selection →
              </Link>
              <button
                onClick={() => setShowSquadModal(false)}
                className="px-4 py-1.5 rounded-[6px] text-[12px] font-medium text-white bg-[var(--tm-secondary)] hover:opacity-90 transition-opacity border-none cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Day Info Popup Modal */}
      {showMatchDayModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="rounded-[10px] shadow-xl max-w-md w-full" style={{ background: 'var(--tm-surface)', border: '1px solid var(--tm-border)' }}>
            {/* Header */}
            <div className="p-4.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--tm-border)' }}>
              <div className="flex items-center gap-2">
                <Trophy className="w-[17px] h-[17px]" style={{ color: 'var(--tm-secondary)' }} />
                <h3 className="text-[14px] font-semibold" style={{ color: 'var(--tm-text-1)' }}>Match Day Details</h3>
              </div>
              <button onClick={() => setShowMatchDayModal(false)} className="cursor-pointer border-none bg-none hover:opacity-80 transition-opacity" style={{ color: 'var(--tm-text-3)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {upcomingMatches.length > 0 ? (
                <>
                  <div className="text-center pb-2 border-b" style={{ borderColor: 'var(--tm-border)' }}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--tm-primary-subtle)]" style={{ color: 'var(--tm-secondary)' }}>
                      {upcomingMatches[0].tournament_type?.replace('_', ' ') || 'Match'}
                    </span>
                    <h4 className="text-[16px] font-bold mt-2.5" style={{ color: 'var(--tm-text-1)' }}>
                      Team Master <span className="text-[11px] font-semibold px-2 py-0.5 mx-1 rounded-full bg-[var(--tm-border)]" style={{ color: 'var(--tm-text-3)' }}>vs</span> {upcomingMatches[0].opponent}
                    </h4>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--tm-secondary)' }} />
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-gray-500">Date</p>
                        <p className="text-[13px] font-medium" style={{ color: 'var(--tm-text-1)' }}>
                          {formatDateSafe(upcomingMatches[0].match_date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--tm-secondary)' }} />
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-gray-500">Kickoff Time</p>
                        <p className="text-[13px] font-medium" style={{ color: 'var(--tm-text-1)' }}>
                          {formatTimeSafe(upcomingMatches[0].match_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--tm-secondary)' }} />
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-gray-500">Venue</p>
                        <p className="text-[13px] font-medium" style={{ color: 'var(--tm-text-1)' }}>
                          {upcomingMatches[0].venue || 'TBD'}
                        </p>
                      </div>
                    </div>

                    {upcomingMatches[0].notes && (
                      <div className="pt-3 border-t" style={{ borderColor: 'var(--tm-border)' }}>
                        <p className="text-[11px] font-semibold uppercase text-gray-500 mb-1">Match Day Notes</p>
                        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--tm-text-2)' }}>
                          {upcomingMatches[0].notes}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto opacity-20 mb-3" style={{ color: 'var(--tm-text-muted)' }} />
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--tm-text-1)' }}>No upcoming fixtures scheduled</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4.5 border-t flex justify-end space-x-2.5" style={{ borderColor: 'var(--tm-border)' }}>
              <button
                onClick={() => setShowMatchDayModal(false)}
                className="px-4 py-1.5 border rounded-[6px] text-[12px] font-medium cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: 'none', borderColor: 'var(--tm-border)', color: 'var(--tm-text-2)' }}
              >
                Cancel
              </button>
              <Link
                href="/fixtures"
                className="px-4 py-1.5 rounded-[6px] text-[12px] font-medium text-white text-center hover:opacity-90 transition-opacity border-none cursor-pointer bg-[var(--tm-secondary)]"
              >
                Manage Fixtures
              </Link>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
