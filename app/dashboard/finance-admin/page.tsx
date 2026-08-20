'use client'

import Layout from '@/components/Layout'
import BirthdayAlert from '@/components/BirthdayAlert'
import { DollarSign, TrendingUp, TrendingDown, Calendar, X, AlertCircle, Wallet } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import RefreshButton from '@/components/RefreshButton'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function FinanceAdminDashboard() {
  const [trainingSessions, setTrainingSessions] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [selectedMatchId, setSelectedMatchId] = useState<string>('')
  const [sessionAttendance, setSessionAttendance] = useState<any>(null)
  const [matchAttendance, setMatchAttendance] = useState<any>(null)
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])
  const [budgets, setBudgets] = useState<any[]>([])

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

    // Transactions — try to include budget_id (migration 044). If that column
    // hasn't been applied yet, fall back to selecting without it so the page
    // still works (the per-project burndown just shows 0 until it's applied).
    const primaryTx = await supabase
      .from('financial_transactions')
      .select('id, transaction_date, type, amount, category, description, budget_id')
      .order('transaction_date', { ascending: false })
    let transactionsData: any[] | null = primaryTx.data
    if (primaryTx.error?.message?.includes('budget_id')) {
      const retry = await supabase
        .from('financial_transactions')
        .select('id, transaction_date, type, amount, category, description')
        .order('transaction_date', { ascending: false })
      transactionsData = retry.data
    }
    if (transactionsData) {
      setTransactions(transactionsData)
    }

    // Budgets (with their line items) power the KPI cards and burndown.
    try {
      const { db } = await import('@/lib/db-helpers')
      const budgetsData = await db.getBudgets(authUser.id, 'finance_admin')
      setBudgets(budgetsData || [])
    } catch (e) {
      console.error('Error loading budgets:', e)
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

  // ── KPI figures ────────────────────────────────────────────────────────
  // Active budgets (still live) power the burndown below.
  const activeBudgets = budgets.filter(
    (b: any) => b.status === 'approved' || b.status === 'pending'
  )
  // Amount Spent = all expenses, with a freshness stamp from the most recent one.
  const amountSpent = totalExpenses
  const lastExpenseDate = transactions
    .filter((t: any) => t.type === 'expense' && t.transaction_date)
    .map((t: any) => t.transaction_date)
    .sort()
    .pop()
  const spentUpdatedLabel = lastExpenseDate
    ? `Updated ${formatDistanceToNow(new Date(lastExpenseDate), { addSuffix: true })}`
    : 'No expenses logged yet'
  const pendingReview = budgets.filter((b: any) => b.status === 'pending').length

  // ── Critical Project Burndown ──────────────────────────────────────────
  // Actual spend per project = sum of expense transactions tagged with that
  // budget_id (migration 044). Show the projects closest to / over budget
  // first, since those need attention.
  const projectBurndown = activeBudgets
    .map((b: any) => {
      const budget = Number(b.total_amount) || 0
      const spent = transactions
        .filter((t: any) => t.type === 'expense' && t.budget_id === b.id)
        .reduce((s: number, t: any) => s + (t.amount || 0), 0)
      const pct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0
      return { id: b.id, name: b.event_name || 'Untitled project', spent, budget, pct, over: spent > budget }
    })
    .sort((a, b) => b.pct - a.pct)

  // Recent transactions for the live roster (both revenue & expense).
  const recentTransactions = transactions.slice(0, 6)

  // Expenses grouped by category (for the doughnut breakdown). Sorted
  // largest-first so the biggest cost centres lead the legend.
  const expenseCategories = (() => {
    const totals = new Map<string, number>()
    transactions
      .filter((t: any) => t.type === 'expense')
      .forEach((t: any) => {
        const label = (t.category || 'Other').toString()
        // Normalise to Title Case so "equipment"/"Equipment" merge into one slice.
        const key = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()
        totals.set(key, (totals.get(key) || 0) + (t.amount || 0))
      })
    return Array.from(totals.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  })()

  // A calm, distinct palette for the category slices.
  const CATEGORY_COLORS = ['#E15A8C', '#4CAF87', '#6C6CE0', '#3B9AE8', '#E0A93B', '#9B6CE0', '#E07A5A', '#5AB6C9']

  const doughnutData = {
    labels: expenseCategories.map((c) => c.category),
    datasets: [
      {
        data: expenseCategories.map((c) => c.amount),
        backgroundColor: expenseCategories.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]),
        borderColor: 'var(--tm-surface)',
        borderWidth: 3,
        hoverOffset: 6,
      },
    ],
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const value = context.parsed || 0
            const pct = totalExpenses > 0 ? Math.round((value / totalExpenses) * 100) : 0
            return `${context.label}: ${formatCurrency(value)} (${pct}%)`
          },
        },
      },
    },
  }

  return (
    <Layout pageTitle="Financial Overview">
      <div className="space-y-6">
        <BirthdayAlert />
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[20px] font-medium text-tm-text-1">Finance Admin Dashboard</h1>
            <p className="mt-[2px] text-[13px] text-tm-text-3">Manage finances and attendance</p>
          </div>
          <RefreshButton onRefresh={loadData} />
        </div>
        {/* Finance KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Amount Spent + last-updated stamp */}
          <div className="bg-tm-surface rounded-card p-5 border border-tm-border shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-tm-text-3">Amount Spent</p>
            <p className="text-[26px] leading-tight font-bold text-tm-text-1 mt-2">{formatCurrency(amountSpent)}</p>
            <p className="text-[12px] text-tm-text-3 mt-3 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
              {spentUpdatedLabel}
            </p>
          </div>

          {/* Total Revenue */}
          <div className="bg-tm-surface rounded-card p-5 border border-tm-border shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-tm-text-3">Total Revenue</p>
            <p className="text-[26px] leading-tight font-bold text-tm-text-1 mt-2">{formatCurrency(totalRevenue)}</p>
            <p className="text-[12px] text-tm-text-3 mt-3 inline-flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-success" />
              All income received
            </p>
          </div>

          {/* Net Balance (revenue − expenses) + solvency badge */}
          <div className="bg-tm-surface rounded-card p-5 border border-tm-border shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-tm-text-3">Net Balance</p>
            <p className={`text-[26px] leading-tight font-bold mt-2 ${netBalance >= 0 ? 'text-success' : 'text-secondary'}`}>{formatCurrency(netBalance)}</p>
            <span className={`inline-block mt-3 text-[11px] font-semibold px-2.5 py-1 rounded-full ${netBalance >= 0 ? 'bg-success/15 text-success' : 'bg-secondary/15 text-secondary'}`}>
              {netBalance >= 0 ? 'Solvent Balance' : 'In Deficit'}
            </span>
          </div>

          {/* Pending / Review */}
          <div className="bg-tm-surface rounded-card p-5 border border-tm-border shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-tm-text-3">Pending / Review</p>
            <p className="text-[26px] leading-tight font-bold text-warning mt-2">{pendingReview}</p>
            <p className="text-[12px] mt-3 inline-flex items-center gap-1.5 text-warning">
              <AlertCircle className="w-3.5 h-3.5" />
              Requires sign-off or audit
            </p>
          </div>
        </div>

        {/* Analytics grid — left column: category donut + burndown; right: roster */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1 space-y-6">

        {/* Expenses by Category — doughnut breakdown */}
        <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
          <h3 className="text-xl font-bold text-tm-text-1 mb-4">Expenses by Category</h3>
          {expenseCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingDown className="w-12 h-12 text-tm-text-3 opacity-40 mb-3" />
              <p className="text-sm font-medium text-tm-text-1">No expenses logged yet</p>
              <p className="text-xs text-tm-text-3 mt-1">Add expenses on the Finance page to see the breakdown here.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              {/* Doughnut with total in the centre */}
              <div className="relative w-[170px] h-[170px] flex-shrink-0">
                <Doughnut data={doughnutData} options={doughnutOptions} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
                  <span className="text-[9px] font-semibold tracking-wider uppercase text-tm-text-3">Total Spent</span>
                  <span className="text-base font-bold text-tm-text-1 leading-tight">{formatCurrency(totalExpenses)}</span>
                  <span className="text-[11px] font-semibold text-primary mt-0.5">100%</span>
                </div>
              </div>

              {/* Category legend — full card width so labels/amounts never truncate or overflow */}
              <div className="w-full space-y-3">
                {expenseCategories.map((c, i) => {
                  const pct = totalExpenses > 0 ? Math.round((c.amount / totalExpenses) * 100) : 0
                  return (
                    <div key={c.category} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                        <span className="text-sm font-medium text-tm-text-1 truncate">{c.category}</span>
                        <span className="text-[11px] text-tm-text-3 flex-shrink-0">{pct}%</span>
                      </div>
                      <span className="text-sm font-semibold text-tm-text-1 flex-shrink-0 whitespace-nowrap">{formatCurrency(c.amount)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Critical Project Burndown */}
        <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-bold text-tm-text-1">Critical Project Burndown</h3>
            <Link href="/finance" className="text-[13px] font-semibold text-primary hover:opacity-80 transition-opacity">View All</Link>
          </div>
          {projectBurndown.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="w-11 h-11 mx-auto text-tm-text-3 opacity-40 mb-3" />
              <p className="text-sm font-medium text-tm-text-1">No active budgets yet</p>
              <p className="text-xs text-tm-text-3 mt-1">Create a budget on the Finance page, then tag expenses to it to track spend here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {projectBurndown.slice(0, 5).map((p) => (
                <div key={p.id}>
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className="text-sm font-semibold text-tm-text-1 truncate">{p.name}</span>
                    <span className="text-[13px] text-tm-text-3 flex-shrink-0">
                      <span className={p.over ? 'text-secondary font-semibold' : 'text-tm-text-2 font-semibold'}>{formatCurrency(p.spent)}</span>
                      {' / '}{formatCurrency(p.budget)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--tm-surface-hover)' }}>
                    <div
                      className={`h-full rounded-full transition-all ${p.over ? 'bg-secondary' : 'bg-success'}`}
                      style={{ width: `${Math.max(p.pct, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        </div>{/* end left column */}

        {/* Right column: live transactions roster */}
        <div className="lg:col-span-2">
        {/* Recent Transactions roster */}
        <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-tm-border">
            <h3 className="text-xl font-bold text-tm-text-1">Recent Transactions</h3>
            <Link href="/finance" className="text-[13px] font-semibold text-primary hover:opacity-80 transition-opacity">Full Ledger</Link>
          </div>
          {recentTransactions.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 mx-auto text-tm-text-3 opacity-40 mb-3" />
              <p className="text-sm font-medium text-tm-text-1">No transactions yet</p>
              <p className="text-xs text-tm-text-3 mt-1">Log revenue or expenses on the Finance page to see them here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-tm-text-3">
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3 hidden sm:table-cell">Category</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3 hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tm-border">
                  {recentTransactions.map((t: any, i: number) => {
                    const isRevenue = t.type === 'revenue'
                    return (
                      <tr key={t.id || i} className="hover:bg-tm-surface-hover transition-colors">
                        <td className="px-6 py-3.5">
                          <p className="text-sm font-medium text-tm-text-1 truncate max-w-[220px]">{t.description || t.category || '—'}</p>
                        </td>
                        <td className="px-6 py-3.5 hidden sm:table-cell">
                          <span className="text-sm text-tm-text-3 capitalize">{t.category || '—'}</span>
                        </td>
                        <td className={`px-6 py-3.5 text-sm font-semibold ${isRevenue ? 'text-success' : 'text-secondary'}`}>
                          {isRevenue ? '+' : '−'}{formatCurrency(t.amount || 0)}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize ${isRevenue ? 'bg-success/15 text-success' : 'bg-secondary/15 text-secondary'}`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 hidden md:table-cell">
                          <span className="text-sm text-tm-text-3">{t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-GB') : '—'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </div>{/* end right column */}
        </div>{/* end analytics grid */}

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
      </div>
    </Layout>
  )
}

