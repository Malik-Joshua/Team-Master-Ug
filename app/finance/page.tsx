'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { DollarSign, TrendingUp, TrendingDown, Plus, Filter, Calendar, Download, FileText, Send, X, CheckCircle, XCircle, Trash2 } from 'lucide-react'
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

interface Transaction {
  id: string
  type: 'revenue' | 'expense'
  category: string
  amount: number
  date: string
  description: string  // Changed from notes to description to match database
  createdBy: string
}

interface Budget {
  id: string
  event_name: string
  event_type: string
  event_date: string
  description: string
  total_amount: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  created_by: string
  approved_by?: string
  rejection_reason?: string
  items?: any[]
}

export default function FinancePage() {
  const [user, setUser] = useState<any>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [showRevenueModal, setShowRevenueModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'revenue' | 'expense'>('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
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
  const [budgetForm, setBudgetForm] = useState({
    event_name: '',
    event_type: 'game_day',
    event_date: '',
    description: '',
    total_amount: '',
    items: [{ item_name: '', category: '', quantity: '1', unit_price: '', total_amount: '', notes: '' }],
  })
  const [savingBudget, setSavingBudget] = useState(false)
  const [showAttendanceView, setShowAttendanceView] = useState(false)
  const [trainingSessions, setTrainingSessions] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [selectedMatchId, setSelectedMatchId] = useState<string>('')
  const [sessionAttendance, setSessionAttendance] = useState<any>(null)
  const [matchAttendance, setMatchAttendance] = useState<any>(null)
  const [loadingAttendance, setLoadingAttendance] = useState(false)

  const loadData = useCallback(async () => {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
            setLoading(false)
            return
      }

      if (authUser) {
        const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', authUser.id).single()
        if (profile) {
          setUser(profile)
          const { data: transactionsData } = await supabase
            .from('financial_transactions')
            .select('id, type, category, amount, transaction_date, description, created_by')
            .order('transaction_date', { ascending: false })
          if (transactionsData) {
            // Map database fields to Transaction interface
            const mappedTransactions = transactionsData.map((t: any) => ({
              id: t.id,
              type: t.type,
              category: t.category,
              amount: parseFloat(t.amount),
              date: t.transaction_date,
              description: t.description || '', // Use description field from database
              createdBy: t.created_by || '',
            }))
            setTransactions(mappedTransactions as Transaction[])
          }
          
          // If finance_admin, load training sessions and matches for attendance viewing
          if (profile.role === 'finance_admin') {
            const { data: sessionsData } = await supabase
              .from('training_sessions')
              .select('id, session_date, session_time, description, location')
              .order('session_date', { ascending: false })
              .limit(50)
            
            if (sessionsData) {
              setTrainingSessions(sessionsData)
            }
            
            const { data: matchesData } = await supabase
              .from('matches')
              .select('id, match_date, opponent, venue, tournament_type')
              .order('match_date', { ascending: false })
              .limit(50)
            
            if (matchesData) {
              setMatches(matchesData)
            }
          }
          
          if (profile.role === 'finance_admin' || profile.role === 'admin') {
            try {
              const { db } = await import('@/lib/db-helpers')
              const budgetsData = await db.getBudgets(authUser.id, profile.role)
              setBudgets(budgetsData as Budget[])
            } catch (error) {
              console.error('Error loading budgets:', error)
            }
          }
        }
      }
      setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `UGX ${(amount / 1000000).toFixed(1)}M`
    }
    return `UGX ${amount.toLocaleString()}`
  }

  const handleAddRevenue = async () => {
    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert('Please log in to add revenue')
        return
      }

      const { error } = await supabase.from('financial_transactions').insert({
        transaction_date: revenueForm.date || new Date().toISOString().split('T')[0],
        type: 'revenue',
        category: revenueForm.type,
        description: revenueForm.notes || revenueForm.type,
        amount: parseFloat(revenueForm.amount),
        created_by: authUser.id,
      })

      if (error) throw error

      const { data: transactionsData } = await supabase.from('financial_transactions').select('*').order('transaction_date', { ascending: false })
      if (transactionsData) setTransactions(transactionsData as Transaction[])
      
      setShowRevenueModal(false)
      setRevenueForm({ type: '', amount: '', date: '', notes: '' })
      alert('Revenue added successfully!')
    } catch (error: any) {
      console.error('Error adding revenue:', error)
      alert(`Error adding revenue: ${error.message}`)
    }
  }

  const handleAddExpense = async () => {
    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert('Please log in to add expense')
        return
      }

      const { error } = await supabase.from('financial_transactions').insert({
        transaction_date: expenseForm.date || new Date().toISOString().split('T')[0],
        type: 'expense',
        category: expenseForm.type,
        description: expenseForm.notes || expenseForm.type,
        amount: parseFloat(expenseForm.amount),
        created_by: authUser.id,
      })

      if (error) throw error

      const { data: transactionsData } = await supabase.from('financial_transactions').select('*').order('transaction_date', { ascending: false })
      if (transactionsData) setTransactions(transactionsData as Transaction[])
      
      setShowExpenseModal(false)
      setExpenseForm({ type: '', amount: '', date: '', notes: '' })
      alert('Expense added successfully!')
    } catch (error: any) {
      console.error('Error adding expense:', error)
      alert(`Error adding expense: ${error.message}`)
    }
  }

  const handleAddBudgetItem = () => {
    setBudgetForm({
      ...budgetForm,
      items: [...budgetForm.items, { item_name: '', category: '', quantity: '1', unit_price: '', total_amount: '', notes: '' }],
    })
  }

  const handleRemoveBudgetItem = (index: number) => {
    setBudgetForm({
      ...budgetForm,
      items: budgetForm.items.filter((_, i) => i !== index),
    })
  }

  const handleBudgetItemChange = (index: number, field: string, value: string) => {
    const newItems = [...budgetForm.items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    if (field === 'quantity' || field === 'unit_price') {
      const qty = parseFloat(newItems[index].quantity) || 0
      const price = parseFloat(newItems[index].unit_price) || 0
      newItems[index].total_amount = (qty * price).toFixed(2)
    }
    
    setBudgetForm({ ...budgetForm, items: newItems })
  }

  const handleSubmitBudget = async () => {
    if (!budgetForm.event_name || !budgetForm.event_date) {
      alert('Please fill in event name and date')
      return
    }

    // Use manually entered total_amount if provided, otherwise calculate from items
    let totalAmount = parseFloat(budgetForm.total_amount) || 0
    
    if (totalAmount === 0) {
      // Fallback to calculating from items if total_amount is not provided
      totalAmount = budgetForm.items.reduce((sum, item) => {
      return sum + (parseFloat(item.total_amount) || 0)
    }, 0)
    }

    if (totalAmount === 0) {
      alert('Please enter a total budget amount or add budget items with valid amounts')
      return
    }

    setSavingBudget(true)
    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert('Please log in to create budget')
        setSavingBudget(false)
        return
      }

      const { data: budget, error: budgetError } = await supabase
        .from('budgets')
        .insert({
          event_name: budgetForm.event_name,
          event_type: budgetForm.event_type,
          event_date: budgetForm.event_date,
          description: budgetForm.description,
          total_amount: totalAmount, // Use calculated or manually entered total
          status: 'pending',
          created_by: authUser.id,
        })
        .select('id')
        .single()

      if (budgetError) throw budgetError

      const itemsToInsert = budgetForm.items
        .filter(item => item.item_name && parseFloat(item.total_amount) > 0)
        .map(item => ({
          budget_id: budget.id,
          item_name: item.item_name,
          category: item.category || null,
          quantity: parseInt(item.quantity) || 1,
          unit_price: parseFloat(item.unit_price) || 0,
          total_amount: parseFloat(item.total_amount) || 0,
          notes: item.notes || null,
        }))

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from('budget_items').insert(itemsToInsert)
        if (itemsError) throw itemsError
      }

      const { db } = await import('@/lib/db-helpers')
      const budgetsData = await db.getBudgets(authUser.id, user?.role || '')
      setBudgets(budgetsData as Budget[])

      // Notify admins about new budget submission
      await db.createNotificationForRole('admin', {
        title: 'New Budget Pending Approval',
        message: `A new budget "${budgetForm.event_name}" (${budgetForm.event_type}) has been submitted for approval.`,
        type: 'info',
        action_url: `/finance?budget=${budget.id}`,
      })

      setShowBudgetModal(false)
      setBudgetForm({
        event_name: '',
        event_type: 'game_day',
        event_date: '',
        description: '',
        total_amount: '',
        items: [{ item_name: '', category: '', quantity: '1', unit_price: '', total_amount: '', notes: '' }],
      })
      alert('Budget submitted for approval!')
    } catch (error: any) {
      console.error('Error creating budget:', error)
      alert(`Error creating budget: ${error.message}`)
    } finally {
      setSavingBudget(false)
    }
  }

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
      
      // Notification is created in approveBudget function
      
      const budgetsData = await db.getBudgets(authUser.id, user?.role || '')
      setBudgets(budgetsData)
      alert('Budget approved successfully!')
    } catch (error: any) {
      console.error('Error approving budget:', error)
      alert(`Error approving budget: ${error.message}`)
    }
  }

  const handleRejectBudget = async (budgetId: string, reason: string) => {
    if (!reason.trim()) {
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
      await db.rejectBudget(budgetId, authUser.id, reason)
      
      // Notification is created in rejectBudget function
      
      const budgetsData = await db.getBudgets(authUser.id, user?.role || '')
      setBudgets(budgetsData)
      alert('Budget rejected successfully!')
    } catch (error: any) {
      console.error('Error rejecting budget:', error)
      alert(`Error rejecting budget: ${error.message}`)
    }
  }

  const filteredTransactions = transactions.filter(transaction => {
    if (filterType !== 'all' && transaction.type !== filterType) return false
    if (filterDateFrom && new Date(transaction.date) < new Date(filterDateFrom)) return false
    if (filterDateTo && new Date(transaction.date) > new Date(filterDateTo)) return false
    return true
  })

  const loadSessionAttendance = async (sessionId: string) => {
    if (!sessionId) return
    
    setLoadingAttendance(true)
    try {
      const supabase = createClient()
      const { data: attendanceData } = await supabase
        .from('training_attendance')
        .select('attendance_status, player_id, players!inner(user_id, user_profiles!inner(name))')
        .eq('session_id', sessionId)
      
      if (attendanceData) {
        const present = attendanceData.filter((a: any) => a.attendance_status === 'P').length
        const absent = attendanceData.filter((a: any) => a.attendance_status === 'X').length
        const justified = attendanceData.filter((a: any) => a.attendance_status === 'A').length
        const injured = attendanceData.filter((a: any) => a.attendance_status === 'I').length
        const total = attendanceData.length
        const attendanceRate = total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0
        
        setSessionAttendance({
          present,
          absent,
          justified,
          injured,
          total,
          attendanceRate,
          details: attendanceData,
        })
      }
    } catch (error) {
      console.error('Error loading session attendance:', error)
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

  if (loading) {
    return (
      <Layout pageTitle="Finance">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!user) return null

  const totalRevenue = transactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const netBalance = totalRevenue - totalExpenses
  const buildMonthlyData = (items: Transaction[]) => {
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
        .filter((t) => t.type === 'revenue' && t.date)
        .filter((t) => {
          const d = new Date(t.date)
          const key = `${d.getFullYear()}-${d.getMonth() + 1}`
          return key === month.key
        })
        .reduce((sum, t) => sum + t.amount, 0)
    })

    const expenses = months.map((month) => {
      return items
        .filter((t) => t.type === 'expense' && t.date)
        .filter((t) => {
          const d = new Date(t.date)
          const key = `${d.getFullYear()}-${d.getMonth() + 1}`
          return key === month.key
        })
        .reduce((sum, t) => sum + t.amount, 0)
    })

    return {
      labels: months.map((m) => m.label),
      revenue,
      expenses,
    }
  }

  const monthlyData = buildMonthlyData(transactions)

  const chartData = {
    labels: monthlyData.labels,
    datasets: [
      {
        label: 'Revenue',
        data: monthlyData.revenue,
        backgroundColor: 'rgba(5, 150, 105, 0.8)',
        borderColor: '#059669',
        borderWidth: 2,
      },
      {
        label: 'Expenses',
        data: monthlyData.expenses,
        backgroundColor: 'rgba(220, 38, 38, 0.8)',
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-success/10 text-success'
      case 'rejected':
        return 'bg-secondary/10 text-secondary'
      case 'pending':
        return 'bg-warning/10 text-warning'
      default:
        return 'bg-neutral-light/10 text-neutral-medium'
    }
  }

  return (
    <Layout pageTitle="Financial Management">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-extrabold text-club-gradient mb-2">Financial Management</h1>
            <p className="text-lg text-neutral-medium font-medium">Track revenue, expenses, and budgets</p>
          </div>
          <div className="flex items-center space-x-3">
            {user?.role === 'finance_admin' && (
              <>
                <button
                  onClick={() => setShowAttendanceView(!showAttendanceView)}
                  className="bg-primary text-white px-6 py-3 rounded-button font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
                >
                  <Calendar className="w-5 h-5 mr-2" />
                  View Attendance
                </button>
                <button
                  onClick={() => setShowBudgetModal(true)}
                  className="bg-info text-white px-6 py-3 rounded-button font-semibold hover:bg-info-dark transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Create Budget
                </button>
              </>
            )}
            <button
              onClick={() => setShowRevenueModal(true)}
              className="bg-success text-white px-6 py-3 rounded-button font-semibold hover:bg-success-dark transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Revenue
            </button>
            <button
              onClick={() => setShowExpenseModal(true)}
              className="bg-secondary text-white px-6 py-3 rounded-button font-semibold hover:bg-secondary-dark transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Expense
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={TrendingUp} iconColor="bg-success" description="All revenue transactions" />
          <StatCard title="Total Expenses" value={formatCurrency(totalExpenses)} icon={TrendingDown} iconColor="bg-secondary" description="All expense transactions" />
          <StatCard title="Net Balance" value={formatCurrency(netBalance)} icon={DollarSign} iconColor="bg-primary" description="Revenue minus expenses" />
        </div>

        {/* Attendance View Section for Finance Admin */}
        {user?.role === 'finance_admin' && showAttendanceView && (
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-neutral-text flex items-center">
                <Calendar className="w-6 h-6 mr-2 text-primary" />
                Attendance Summary
              </h2>
              <button
                onClick={() => {
                  setShowAttendanceView(false)
                  setSelectedSessionId('')
                  setSelectedMatchId('')
                  setSessionAttendance(null)
                  setMatchAttendance(null)
                }}
                className="text-neutral-medium hover:text-neutral-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Training Session Attendance */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-text mb-4">Training Session Attendance</h3>
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
                  className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all mb-4"
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
                  <div className="bg-neutral-light/50 rounded-lg p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-neutral-medium">Present</p>
                        <p className="text-2xl font-bold text-success">{sessionAttendance.present}</p>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-medium">Absent</p>
                        <p className="text-2xl font-bold text-secondary">{sessionAttendance.absent}</p>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-medium">Justified Absence</p>
                        <p className="text-2xl font-bold text-warning">{sessionAttendance.justified}</p>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-medium">Injured</p>
                        <p className="text-2xl font-bold text-info">{sessionAttendance.injured}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-neutral-light">
                      <p className="text-sm text-neutral-medium">Total Players</p>
                      <p className="text-xl font-bold text-neutral-text">{sessionAttendance.total}</p>
                      <p className="text-sm text-neutral-medium mt-1">Attendance Rate: {sessionAttendance.attendanceRate}%</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Game Day/Match Attendance */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-text mb-4">Game Day Attendance</h3>
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
                  className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all mb-4"
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
                  <div className="bg-neutral-light/50 rounded-lg p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-neutral-medium">Starting Lineup</p>
                        <p className="text-2xl font-bold text-success">{matchAttendance.starting}</p>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-medium">Substitutes</p>
                        <p className="text-2xl font-bold text-primary">{matchAttendance.substitutes}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-neutral-light">
                      <p className="text-sm text-neutral-medium">Total Selected</p>
                      <p className="text-xl font-bold text-neutral-text">{matchAttendance.total}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {(user?.role === 'finance_admin' || user?.role === 'admin') && budgets.length > 0 && (
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <h2 className="text-2xl font-bold text-neutral-text mb-6 flex items-center">
              <FileText className="w-6 h-6 mr-2 text-info" />
              Budget Requests
            </h2>
            <div className="space-y-4">
              {budgets.map((budget) => (
                <div key={budget.id} className="p-4 bg-neutral-light/50 rounded-lg border border-neutral-light hover:bg-neutral-light transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-bold text-neutral-text">{budget.event_name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(budget.status)}`}>
                          {budget.status.charAt(0).toUpperCase() + budget.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-medium mb-1">
                        {budget.event_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} • {new Date(budget.event_date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-neutral-medium">{budget.description}</p>
                      <p className="text-lg font-bold text-primary mt-2">{formatCurrency(budget.total_amount)}</p>
                    </div>
                    {user?.role === 'admin' && budget.status === 'pending' && (
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleApproveBudget(budget.id)}
                          className="px-4 py-2 bg-success text-white rounded-button font-semibold hover:bg-success-dark transition-colors text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Enter rejection reason:')
                            if (reason) handleRejectBudget(budget.id, reason)
                          }}
                          className="px-4 py-2 bg-secondary text-white rounded-button font-semibold hover:bg-secondary-dark transition-colors text-sm"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <h3 className="text-xl font-bold text-neutral-text mb-4">Monthly Financial Trend</h3>
          <div className="h-64">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <h3 className="text-lg font-bold text-neutral-text mb-4">Filter Transactions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-medium mb-2">Type</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as 'all' | 'revenue' | 'expense')} className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all">
                <option value="all">All Types</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-medium mb-2">Date From</label>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-medium mb-2">Date To</label>
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-card shadow-soft border border-neutral-light overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-light bg-neutral-light">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-neutral-text">Transactions ({filteredTransactions.length})</h2>
              <button className="px-4 py-2 bg-primary text-white rounded-button font-medium hover:bg-primary-dark transition-colors inline-flex items-center text-sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-neutral-light rounded-full mb-4">
                <DollarSign className="w-10 h-10 text-neutral-medium" />
              </div>
              <p className="text-xl font-bold text-neutral-text mb-2">No transactions found</p>
              <p className="text-neutral-medium">Add your first revenue or expense transaction</p>
            </div>
          ) : (
            <>
              <div className="md:hidden divide-y divide-neutral-light">
                {filteredTransactions.map((transaction) => (
                  <div key={transaction.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-neutral-medium">{new Date(transaction.date).toLocaleDateString()}</p>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${transaction.type === 'revenue' ? 'bg-success/10 text-success' : 'bg-secondary/10 text-secondary'}`}>
                        {transaction.type === 'revenue' ? 'Revenue' : 'Expense'}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-neutral-text">{transaction.category}</p>
                      <p className="text-sm text-neutral-medium">{transaction.description || 'No description'}</p>
                    </div>
                    <div className={`text-lg font-bold ${transaction.type === 'revenue' ? 'text-success' : 'text-secondary'}`}>
                      {transaction.type === 'revenue' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                <thead className="bg-neutral-light">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-light">
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-neutral-light transition-colors">
                      <td className="px-6 py-4 text-sm text-neutral-medium">{new Date(transaction.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${transaction.type === 'revenue' ? 'bg-success/10 text-success' : 'bg-secondary/10 text-secondary'}`}>
                          {transaction.type === 'revenue' ? 'Revenue' : 'Expense'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-neutral-text font-medium">{transaction.category}</td>
                      <td className={`px-6 py-4 font-bold ${transaction.type === 'revenue' ? 'text-success' : 'text-secondary'}`}>
                        {transaction.type === 'revenue' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-medium">{transaction.description || 'No description'}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {showBudgetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-card shadow-soft w-full max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-neutral-light">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-neutral-text">Create Budget Request</h3>
                <button onClick={() => setShowBudgetModal(false)} className="text-neutral-medium hover:text-neutral-text transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-text mb-2">Event Name *</label>
                  <input type="text" value={budgetForm.event_name} onChange={(e) => setBudgetForm({ ...budgetForm, event_name: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-text mb-2">Event Type *</label>
                  <select value={budgetForm.event_type} onChange={(e) => setBudgetForm({ ...budgetForm, event_type: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="game_day">Game Day</option>
                    <option value="training_session">Training Session</option>
                    <option value="gathering">Gathering</option>
                    <option value="event">Event</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-text mb-2">Event Date *</label>
                  <input type="date" value={budgetForm.event_date} onChange={(e) => setBudgetForm({ ...budgetForm, event_date: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-text mb-2">Total Budget (UGX) *</label>
                  <input 
                    type="number" 
                    min="0" 
                    step="0.01"
                    value={budgetForm.total_amount} 
                    onChange={(e) => setBudgetForm({ ...budgetForm, total_amount: e.target.value })} 
                    className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" 
                    placeholder="Enter total budget amount"
                    required
                  />
                  <p className="text-xs text-neutral-medium mt-1">
                    Calculated from items: {formatCurrency(budgetForm.items.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0))}
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-text mb-2">Description</label>
                <textarea value={budgetForm.description} onChange={(e) => setBudgetForm({ ...budgetForm, description: e.target.value })} rows={3} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Describe the event and budget purpose..." />
              </div>
              
              <div className="border-t border-neutral-light pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-neutral-text">Budget Items</h4>
                  <button onClick={handleAddBudgetItem} className="px-4 py-2 bg-primary text-white rounded-button font-semibold hover:bg-primary-dark transition-colors flex items-center text-sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </button>
                </div>
                <div className="space-y-4">
                  {budgetForm.items.map((item, index) => (
                    <div key={index} className="p-4 bg-neutral-light/50 rounded-lg border border-neutral-light">
                      <div className="flex items-start justify-between mb-3">
                        <h5 className="font-semibold text-neutral-text">Item {index + 1}</h5>
                        {budgetForm.items.length > 1 && (
                          <button onClick={() => handleRemoveBudgetItem(index)} className="p-1 text-secondary hover:bg-secondary/10 rounded transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-neutral-medium mb-1">Item Name *</label>
                          <input type="text" value={item.item_name} onChange={(e) => handleBudgetItemChange(index, 'item_name', e.target.value)} className="w-full px-3 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-medium mb-1">Category</label>
                          <input type="text" value={item.category} onChange={(e) => handleBudgetItemChange(index, 'category', e.target.value)} className="w-full px-3 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" placeholder="e.g., Equipment, Food, Transport" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-medium mb-1">Quantity</label>
                          <input type="number" min="1" value={item.quantity} onChange={(e) => handleBudgetItemChange(index, 'quantity', e.target.value)} className="w-full px-3 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-medium mb-1">Unit Price (UGX)</label>
                          <input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => handleBudgetItemChange(index, 'unit_price', e.target.value)} className="w-full px-3 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-medium mb-1">Total Amount</label>
                          <input type="text" value={formatCurrency(parseFloat(item.total_amount) || 0)} disabled className="w-full px-3 py-2 border border-neutral-light rounded-lg bg-neutral-light text-sm font-semibold" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-medium mb-1">Notes</label>
                          <input type="text" value={item.notes} onChange={(e) => handleBudgetItemChange(index, 'notes', e.target.value)} className="w-full px-3 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-light flex justify-end space-x-3">
              <button onClick={() => setShowBudgetModal(false)} className="px-6 py-2 border border-neutral-light rounded-button font-semibold text-neutral-text hover:bg-neutral-light transition-colors" disabled={savingBudget}>
                Cancel
              </button>
              <button onClick={handleSubmitBudget} className="px-6 py-2 bg-info text-white rounded-button font-semibold hover:bg-info-dark transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed" disabled={savingBudget || !budgetForm.event_name || !budgetForm.event_date}>
                <Send className="w-4 h-4 mr-2" />
                {savingBudget ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevenueModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-card shadow-soft w-full max-w-[95vw] sm:max-w-2xl">
            <div className="p-4 sm:p-6 border-b border-neutral-light">
              <h3 className="text-2xl font-bold text-neutral-text">Add Revenue</h3>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-text mb-2">Type</label>
                <select value={revenueForm.type} onChange={(e) => setRevenueForm({ ...revenueForm, type: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-success">
                  <option value="">Select type...</option>
                  <option value="Sponsorship">Sponsorship</option>
                  <option value="Membership Fees">Membership Fees</option>
                  <option value="Merchandise">Merchandise</option>
                  <option value="Match Fees">Match Fees</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-text mb-2">Amount (UGX)</label>
                <input type="number" value={revenueForm.amount} onChange={(e) => setRevenueForm({ ...revenueForm, amount: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-success" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-text mb-2">Date</label>
                <input type="date" value={revenueForm.date} onChange={(e) => setRevenueForm({ ...revenueForm, date: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-success" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-text mb-2">Notes</label>
                <textarea value={revenueForm.notes} onChange={(e) => setRevenueForm({ ...revenueForm, notes: e.target.value })} rows={3} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-success" placeholder="Optional notes..." />
              </div>
            </div>
            <div className="p-6 border-t border-neutral-light flex justify-end space-x-3">
              <button onClick={() => { setShowRevenueModal(false); setRevenueForm({ type: '', amount: '', date: '', notes: '' }) }} className="px-6 py-2 border border-neutral-light rounded-button font-semibold text-neutral-text hover:bg-neutral-light transition-colors">
                Cancel
              </button>
              <button onClick={handleAddRevenue} className="px-6 py-2 bg-success text-white rounded-button font-semibold hover:bg-success-dark transition-colors">
                Add Revenue
              </button>
            </div>
          </div>
        </div>
      )}

      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-card shadow-soft w-full max-w-[95vw] sm:max-w-2xl">
            <div className="p-4 sm:p-6 border-b border-neutral-light">
              <h3 className="text-2xl font-bold text-neutral-text">Add Expense</h3>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-text mb-2">Type</label>
                <select value={expenseForm.type} onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary">
                  <option value="">Select type...</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Travel">Travel</option>
                  <option value="Facilities">Facilities</option>
                  <option value="Salaries">Salaries</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-text mb-2">Amount (UGX)</label>
                <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-text mb-2">Date</label>
                <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-text mb-2">Notes</label>
                <textarea value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} rows={3} className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Optional notes..." />
              </div>
            </div>
            <div className="p-6 border-t border-neutral-light flex justify-end space-x-3">
              <button onClick={() => { setShowExpenseModal(false); setExpenseForm({ type: '', amount: '', date: '', notes: '' }) }} className="px-6 py-2 border border-neutral-light rounded-button font-semibold text-neutral-text hover:bg-neutral-light transition-colors">
                Cancel
              </button>
              <button onClick={handleAddExpense} className="px-6 py-2 bg-secondary text-white rounded-button font-semibold hover:bg-secondary-dark transition-colors">
                Add Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
