'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { DollarSign, TrendingUp, TrendingDown, Plus, Filter, Calendar, Download, FileText, Send, X, CheckCircle, XCircle, Trash2 } from 'lucide-react'
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

interface Transaction {
  id: string
  type: 'revenue' | 'expense'
  category: string
  amount: number
  date: string
  notes: string
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
    items: [{ item_name: '', category: '', quantity: '1', unit_price: '', total_amount: '', notes: '' }],
  })
  const [savingBudget, setSavingBudget] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      if (typeof window !== 'undefined') {
        const devUser = localStorage.getItem('dev_user')
        if (devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            const mockTransactions: Transaction[] = [
              { id: '1', type: 'revenue', category: 'Sponsorship', amount: 5000000, date: new Date().toISOString(), notes: 'Annual sponsorship', createdBy: 'Admin' },
              { id: '2', type: 'expense', category: 'Equipment', amount: 1500000, date: new Date(Date.now() - 86400000).toISOString(), notes: 'Rugby balls', createdBy: 'Admin' },
            ]
            setTransactions(mockTransactions)
            if (userData.role === 'finance_admin' || userData.role === 'admin') {
              setBudgets([
                { id: '1', event_name: 'Uganda Cup Final', event_type: 'game_day', event_date: '2024-12-15', description: 'Match day expenses', total_amount: 5000000, status: 'pending', created_by: userData.id },
                { id: '2', event_name: 'Monthly Training', event_type: 'training_session', event_date: '2024-12-10', description: 'Training session budget', total_amount: 2000000, status: 'approved', created_by: userData.id },
              ])
            }
            setLoading(false)
            return
          } catch (e) {}
        }
      }

      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (authUser) {
        const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', authUser.id).single()
        if (profile) {
          setUser(profile)
          const { data: transactionsData } = await supabase.from('financial_transactions').select('*').order('transaction_date', { ascending: false })
          if (transactionsData) setTransactions(transactionsData as Transaction[])
          
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
    }
    loadData()
  }, [])

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `UGX ${(amount / 1000000).toFixed(1)}M`
    }
    return `UGX ${amount.toLocaleString()}`
  }

  const handleAddRevenue = async () => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
        const newTransaction: Transaction = {
          id: Date.now().toString(),
          type: 'revenue',
          category: revenueForm.type,
          amount: parseFloat(revenueForm.amount),
          date: revenueForm.date || new Date().toISOString(),
          notes: revenueForm.notes,
          createdBy: 'Finance Admin',
        }
        setTransactions([newTransaction, ...transactions])
        setShowRevenueModal(false)
        setRevenueForm({ type: '', amount: '', date: '', notes: '' })
        alert('Revenue added! (Dev Mode)')
        return
      }

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
      if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
        const newTransaction: Transaction = {
          id: Date.now().toString(),
          type: 'expense',
          category: expenseForm.type,
          amount: parseFloat(expenseForm.amount),
          date: expenseForm.date || new Date().toISOString(),
          notes: expenseForm.notes,
          createdBy: 'Finance Admin',
        }
        setTransactions([newTransaction, ...transactions])
        setShowExpenseModal(false)
        setExpenseForm({ type: '', amount: '', date: '', notes: '' })
        alert('Expense added! (Dev Mode)')
        return
      }

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

    const totalAmount = budgetForm.items.reduce((sum, item) => {
      return sum + (parseFloat(item.total_amount) || 0)
    }, 0)

    if (totalAmount === 0) {
      alert('Please add at least one budget item with a valid amount')
      return
    }

    setSavingBudget(true)
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
        const newBudget: Budget = {
          id: Date.now().toString(),
          event_name: budgetForm.event_name,
          event_type: budgetForm.event_type,
          event_date: budgetForm.event_date,
          description: budgetForm.description,
          total_amount: totalAmount,
          status: 'pending',
          created_by: user?.id || '1',
          items: budgetForm.items,
        }
        setBudgets([newBudget, ...budgets])
        setShowBudgetModal(false)
        setBudgetForm({
          event_name: '',
          event_type: 'game_day',
          event_date: '',
          description: '',
          items: [{ item_name: '', category: '', quantity: '1', unit_price: '', total_amount: '', notes: '' }],
        })
        alert('Budget submitted for approval! (Dev Mode)')
        setSavingBudget(false)
        return
      }

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
          total_amount: totalAmount,
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

      setShowBudgetModal(false)
      setBudgetForm({
        event_name: '',
        event_type: 'game_day',
        event_date: '',
        description: '',
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
      if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
        setBudgets(budgets.map(b => b.id === budgetId ? { ...b, status: 'approved' } : b))
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
      if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
        setBudgets(budgets.map(b => b.id === budgetId ? { ...b, status: 'rejected', rejection_reason: reason } : b))
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
      await db.rejectBudget(budgetId, authUser.id, reason)
      
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

  const monthlyData = {
    labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
    revenue: [6500000, 7200000, 6800000, 7500000, 8200000, 7800000],
    expenses: [4800000, 5200000, 5100000, 5500000, 5800000, 5600000],
  }

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
              <button
                onClick={() => setShowBudgetModal(true)}
                className="bg-info text-white px-6 py-3 rounded-button font-semibold hover:bg-info-dark transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
              >
                <FileText className="w-5 h-5 mr-2" />
                Create Budget
              </button>
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
            <div className="overflow-x-auto">
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
                      <td className="px-6 py-4 text-sm text-neutral-medium">{transaction.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showBudgetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card shadow-soft max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-light">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-neutral-text">Create Budget Request</h3>
                <button onClick={() => setShowBudgetModal(false)} className="text-neutral-medium hover:text-neutral-text transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
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
                  <label className="block text-sm font-semibold text-neutral-text mb-2">Total Budget</label>
                  <input type="text" value={formatCurrency(budgetForm.items.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0))} disabled className="w-full px-4 py-2 border border-neutral-light rounded-lg bg-neutral-light" />
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card shadow-soft max-w-2xl w-full">
            <div className="p-6 border-b border-neutral-light">
              <h3 className="text-2xl font-bold text-neutral-text">Add Revenue</h3>
            </div>
            <div className="p-6 space-y-4">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card shadow-soft max-w-2xl w-full">
            <div className="p-6 border-b border-neutral-light">
              <h3 className="text-2xl font-bold text-neutral-text">Add Expense</h3>
            </div>
            <div className="p-6 space-y-4">
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
