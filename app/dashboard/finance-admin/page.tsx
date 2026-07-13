'use client'

import Layout from '@/components/Layout'
import { useRouter } from 'next/navigation'
import StatCard from '@/components/StatCard'
import BirthdayAlert from '@/components/BirthdayAlert'
import { DollarSign, TrendingUp, TrendingDown, Calendar, X } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
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

export default function FinanceAdminDashboard() {
  const router = useRouter()
  const [revenueForm, setRevenueForm] = useState({
    type: '',
    amount: '',
    date: '',
    notes: '',
  })
  const [expenseForm, setExpenseForm] = useState({
    type: '',
    amount: '',
    date: '',
    notes: '',
  })
  const [trainingSessions, setTrainingSessions] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [selectedMatchId, setSelectedMatchId] = useState<string>('')
  const [sessionAttendance, setSessionAttendance] = useState<any>(null)
  const [matchAttendance, setMatchAttendance] = useState<any>(null)
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (!authUser) return

    // Load training sessions
    const { data: sessionsData } = await supabase
      .from('training_sessions')
      .select('id, session_date, session_time, description, location')
      .order('session_date', { ascending: false })
      .limit(50)
    
    if (sessionsData) {
      setTrainingSessions(sessionsData)
    }
    
    // Load matches
    const { data: matchesData } = await supabase
      .from('matches')
      .select('id, match_date, opponent, venue, tournament_type')
      .order('match_date', { ascending: false })
      .limit(50)
    
    if (matchesData) {
      setMatches(matchesData)
    }

    const { data: transactionsData } = await supabase
      .from('financial_transactions')
      .select('transaction_date, type, amount')
      .order('transaction_date', { ascending: false })

    if (transactionsData) {
      setTransactions(transactionsData)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const loadSessionAttendance = async (sessionId: string) => {
    if (!sessionId) return
    
    setLoadingAttendance(true)
    try {
      // Use API route to bypass RLS and get accurate attendance data
      const response = await fetch(`/api/attendance/session/${sessionId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      })
      
      if (response.ok) {
        const attendanceData = await response.json()
        setSessionAttendance(attendanceData)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Error loading session attendance:', response.status, errorData)
        setSessionAttendance(null)
      }
    } catch (error) {
      console.error('Error loading session attendance:', error)
      setSessionAttendance(null)
    } finally {
      setLoadingAttendance(false)
    }
  }

  const loadMatchAttendance = async (matchId: string) => {
    if (!matchId) return
    
    setLoadingAttendance(true)
    try {
      const supabase = createClient()
      const { data: selectionsData } = await supabase
        .from('fixture_team_selections')
        .select('is_starting, is_substitute, player_id, players!inner(user_id, user_profiles!inner(name))')
        .eq('match_id', matchId)
      
      if (selectionsData) {
        const starting = selectionsData.filter((s: any) => s.is_starting).length
        const substitutes = selectionsData.filter((s: any) => s.is_substitute).length
        const total = selectionsData.length
        
        setMatchAttendance({
          starting,
          substitutes,
          total,
          details: selectionsData,
        })
      }
    } catch (error) {
      console.error('Error loading match attendance:', error)
    } finally {
      setLoadingAttendance(false)
    }
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `UGX ${(amount / 1000000).toFixed(1)}M`
    }
    return `UGX ${amount.toLocaleString()}`
  }

  const totalRevenue = transactions
    .filter((t: any) => t.type === 'revenue')
    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
  const totalExpenses = transactions
    .filter((t: any) => t.type === 'expense')
    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
  const netBalance = totalRevenue - totalExpenses

  const buildMonthlyData = (items: any[]) => {
    const now = new Date()
    const months: Array<{ key: string; label: string }> = []
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`
      const label = date.toLocaleDateString('en-US', { month: 'short' })
      months.push({ key, label })
    }

    const revenue = months.map((month) => {
      return items
        .filter((t: any) => t.type === 'revenue' && t.transaction_date)
        .filter((t: any) => {
          const d = new Date(t.transaction_date)
          const key = `${d.getFullYear()}-${d.getMonth() + 1}`
          return key === month.key
        })
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
    })

    const expenses = months.map((month) => {
      return items
        .filter((t: any) => t.type === 'expense' && t.transaction_date)
        .filter((t: any) => {
          const d = new Date(t.transaction_date)
          const key = `${d.getFullYear()}-${d.getMonth() + 1}`
          return key === month.key
        })
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
    })

    return {
      labels: months.map((m) => m.label),
      revenue,
      expenses,
    }
  }

  // Monthly financial data for the last 6 months
  const monthlyData = buildMonthlyData(transactions)

  const chartData = {
    labels: monthlyData.labels,
    datasets: [
      {
        label: 'Revenue',
        data: monthlyData.revenue,
        backgroundColor: 'rgba(5, 150, 105, 0.8)', // Success green
        borderColor: '#059669',
        borderWidth: 2,
      },
      {
        label: 'Expenses',
        data: monthlyData.expenses,
        backgroundColor: 'rgba(220, 38, 38, 0.8)', // Secondary red
        borderColor: '#DC2626',
        borderWidth: 2,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
            weight: 500,
          },
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y
            if (value >= 1000000) {
              return `${context.dataset.label}: UGX ${(value / 1000000).toFixed(1)}M`
            }
            return `${context.dataset.label}: UGX ${value.toLocaleString()}`
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          callback: function(value: any) {
            if (value >= 1000000) {
              return `UGX ${(value / 1000000).toFixed(1)}M`
            }
            return `UGX ${value.toLocaleString()}`
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  }

  return (
    <Layout pageTitle="Financial Overview">
      <div className="space-y-6">
        <BirthdayAlert />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[20px] font-medium text-tm-text-1">Finance Admin Dashboard</h1>
            <p className="mt-[2px] text-[13px] text-tm-text-3">Manage finances and attendance</p>
          </div>
          <RefreshButton onRefresh={loadData} />
        </div>
        {/* Financial Stats */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(totalRevenue)}
            icon={TrendingUp}
            iconColor="bg-success"
            iconTextColor="text-white"
            href="/finance"
          />
          <StatCard
            title="Total Expense"
            value={formatCurrency(totalExpenses)}
            icon={TrendingDown}
            iconColor="bg-secondary"
            iconTextColor="text-tm-on-secondary"
            href="/finance"
          />
          <StatCard
            title="Net Balance"
            value={formatCurrency(netBalance)}
            icon={DollarSign}
            iconColor="bg-primary"
            iconTextColor="text-tm-on-secondary"
            href="/finance"
          />
        </div>

        {/* Monthly Financial Trend Chart */}
        <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
          <h3 className="text-xl font-bold text-tm-text-1 mb-4">Monthly Financial Trend</h3>
          <div className="h-64">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Attendance Summary Section */}
        <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-tm-text-1 flex items-center">
              <Calendar className="w-6 h-6 mr-2 text-primary" />
              Attendance Summary
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Training Session Attendance */}
            <div>
              <h3 className="text-lg font-semibold text-tm-text-1 mb-4">Training Session Attendance</h3>
              <select
                value={selectedSessionId}
                onChange={(e) => {
                  setSelectedSessionId(e.target.value)
                  setMatchAttendance(null)
                  setSelectedMatchId('')
                  if (e.target.value) {
                    loadSessionAttendance(e.target.value)
                  } else {
                    setSessionAttendance(null)
                  }
                }}
                className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all mb-4"
              >
                <option value="">Select a training session...</option>
                {trainingSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {new Date(session.session_date).toLocaleDateString()} - {session.description || `Session ${session.id.slice(0, 8)}`}
                  </option>
                ))}
              </select>

              {loadingAttendance && selectedSessionId && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              )}

              {sessionAttendance && !loadingAttendance && (
                <div className="bg-tm-surface-hover/50 rounded-lg p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-tm-text-3">Present</p>
                      <p className="text-2xl font-bold text-success">{sessionAttendance.present}</p>
                    </div>
                    <div>
                      <p className="text-sm text-tm-text-3">Absent</p>
                      <p className="text-2xl font-bold text-secondary">{sessionAttendance.absent}</p>
                    </div>
                    <div>
                      <p className="text-sm text-tm-text-3">Justified Absence</p>
                      <p className="text-2xl font-bold text-warning">{sessionAttendance.justified}</p>
                    </div>
                    <div>
                      <p className="text-sm text-tm-text-3">Injured</p>
                      <p className="text-2xl font-bold text-info">{sessionAttendance.injured}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-tm-border">
                    <p className="text-sm text-tm-text-3">Total Players</p>
                    <p className="text-xl font-bold text-tm-text-1">{sessionAttendance.total}</p>
                    <p className="text-sm text-tm-text-3 mt-1">Attendance Rate: {sessionAttendance.attendanceRate}%</p>
                  </div>
                </div>
              )}
            </div>

            {/* Game Day/Match Attendance */}
            <div>
              <h3 className="text-lg font-semibold text-tm-text-1 mb-4">Game Day Attendance</h3>
              <select
                value={selectedMatchId}
                onChange={(e) => {
                  setSelectedMatchId(e.target.value)
                  setSessionAttendance(null)
                  setSelectedSessionId('')
                  if (e.target.value) {
                    loadMatchAttendance(e.target.value)
                  } else {
                    setMatchAttendance(null)
                  }
                }}
                className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all mb-4"
              >
                <option value="">Select a match...</option>
                {matches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {new Date(match.match_date).toLocaleDateString()} - vs {match.opponent} ({match.tournament_type})
                  </option>
                ))}
              </select>

              {loadingAttendance && selectedMatchId && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              )}

              {matchAttendance && !loadingAttendance && (
                <div className="bg-tm-surface-hover/50 rounded-lg p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-tm-text-3">Starting Lineup</p>
                      <p className="text-2xl font-bold text-success">{matchAttendance.starting}</p>
                    </div>
                    <div>
                      <p className="text-sm text-tm-text-3">Substitutes</p>
                      <p className="text-2xl font-bold text-primary">{matchAttendance.substitutes}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-tm-border">
                    <p className="text-sm text-tm-text-3">Total Selected</p>
                    <p className="text-xl font-bold text-tm-text-1">{matchAttendance.total}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dual Entry Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Log Revenue Form */}
          <div className="bg-tm-surface rounded-card p-6 border-2 border-success/20 shadow-soft">
            <h3 className="text-xl font-bold text-tm-text-1 mb-6">Log Revenue</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-tm-text-1 mb-2">Type</label>
                <select
                  value={revenueForm.type}
                  onChange={(e) => setRevenueForm({ ...revenueForm, type: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-success focus:border-success transition-all"
                >
                  <option value="">Select type...</option>
                  <option value="sponsorship">Sponsorship</option>
                  <option value="membership">Membership Fees</option>
                  <option value="merchandise">Merchandise</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-tm-text-1 mb-2">Amount (UGX)</label>
                <input
                  type="number"
                  value={revenueForm.amount}
                  onChange={(e) => setRevenueForm({ ...revenueForm, amount: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-success focus:border-success transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-tm-text-1 mb-2">Date</label>
                <input
                  type="date"
                  value={revenueForm.date}
                  onChange={(e) => setRevenueForm({ ...revenueForm, date: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-success focus:border-success transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-tm-text-1 mb-2">Notes</label>
                <textarea
                  value={revenueForm.notes}
                  onChange={(e) => setRevenueForm({ ...revenueForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-success focus:border-success transition-all"
                />
              </div>
              <button
                onClick={() => router.push('/finance')}
                className="w-full px-6 py-3 bg-success text-white rounded-[6px] font-semibold hover:opacity-90 transition-colors"
              >
                Add Revenue
              </button>
            </div>
          </div>

          {/* Log Expense Form */}
          <div className="bg-tm-surface rounded-card p-6 border-2 border-secondary/20 shadow-soft">
            <h3 className="text-xl font-bold text-tm-text-1 mb-6">Log Expense</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-tm-text-1 mb-2">Type</label>
                <select
                  value={expenseForm.type}
                  onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                >
                  <option value="">Select type...</option>
                  <option value="equipment">Equipment</option>
                  <option value="travel">Travel</option>
                  <option value="facilities">Facilities</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-tm-text-1 mb-2">Amount (UGX)</label>
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-tm-text-1 mb-2">Date</label>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-tm-text-1 mb-2">Notes</label>
                <textarea
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                />
              </div>
              <button
                onClick={() => router.push('/finance')}
                className="w-full px-6 py-3 bg-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-colors"
              >
                Add Expense
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

