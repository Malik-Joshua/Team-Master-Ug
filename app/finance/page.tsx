'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { DollarSign, TrendingUp, TrendingDown, Plus, Filter, Calendar, Download } from 'lucide-react'
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

export default function FinancePage() {
  const [user, setUser] = useState<any>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showRevenueModal, setShowRevenueModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
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

  useEffect(() => {
    const loadData = async () => {
      // Check for dev mode
      if (typeof window !== 'undefined') {
        const devUser = localStorage.getItem('dev_user')
        if (devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            // Mock transactions for dev mode
            const mockTransactions: Transaction[] = [
              {
                id: '1',
                type: 'revenue',
                category: 'Sponsorship',
                amount: 5000000,
                date: new Date().toISOString(),
                notes: 'Annual sponsorship from ABC Corp',
                createdBy: 'Admin',
              },
              {
                id: '2',
                type: 'expense',
                category: 'Equipment',
                amount: 1500000,
                date: new Date(Date.now() - 86400000).toISOString(),
                notes: 'Purchase of new rugby balls',
                createdBy: 'Admin',
              },
              {
                id: '3',
                type: 'revenue',
                category: 'Membership Fees',
                amount: 2500000,
                date: new Date(Date.now() - 172800000).toISOString(),
                notes: 'Monthly membership collection',
                createdBy: 'Admin',
              },
              {
                id: '4',
                type: 'expense',
                category: 'Travel',
                amount: 3000000,
                date: new Date(Date.now() - 259200000).toISOString(),
                notes: 'Team travel to away match',
                createdBy: 'Admin',
              },
              {
                id: '5',
                type: 'revenue',
                category: 'Merchandise',
                amount: 800000,
                date: new Date(Date.now() - 345600000).toISOString(),
                notes: 'Jersey sales',
                createdBy: 'Admin',
              },
            ]
            setTransactions(mockTransactions)
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
          // Fetch real transactions
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

  const totalRevenue = transactions
    .filter(t => t.type === 'revenue')
    .reduce((sum, t) => sum + t.amount, 0)
  
  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
  
  const netBalance = totalRevenue - totalExpenses

  // Calculate monthly financial data from transactions
  const getMonthlyData = () => {
    const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']
    const monthlyRevenue: number[] = []
    const monthlyExpenses: number[] = []

    // Initialize with mock data (in production, calculate from transactions)
    months.forEach((_, index) => {
      // Calculate revenue and expenses for each month from transactions
      const monthIndex = new Date().getMonth() - (5 - index)
      const year = new Date().getFullYear()
      
      const monthRevenue = transactions
        .filter(t => {
          const tDate = new Date(t.date)
          return t.type === 'revenue' && 
                 tDate.getMonth() === monthIndex && 
                 tDate.getFullYear() === year
        })
        .reduce((sum, t) => sum + t.amount, 0)
      
      const monthExpense = transactions
        .filter(t => {
          const tDate = new Date(t.date)
          return t.type === 'expense' && 
                 tDate.getMonth() === monthIndex && 
                 tDate.getFullYear() === year
        })
        .reduce((sum, t) => sum + t.amount, 0)

      // Use mock data if no transactions for this month
      monthlyRevenue.push(monthRevenue || [6500000, 7200000, 6800000, 7500000, 8200000, 7800000][index])
      monthlyExpenses.push(monthExpense || [4800000, 5200000, 5100000, 5500000, 5800000, 5600000][index])
    })

    return { labels: months, revenue: monthlyRevenue, expenses: monthlyExpenses }
  }

  const monthlyData = getMonthlyData()

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

  const handleAddRevenue = async () => {
    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        alert('Please log in to add revenue')
        return
      }

      if (!revenueForm.type || !revenueForm.amount) {
        alert('Please fill in required fields')
        return
      }

      const { data: newTransaction, error } = await supabase
        .from('financial_transactions')
        .insert({
          transaction_date: revenueForm.date || new Date().toISOString().split('T')[0],
          type: 'revenue',
          category: revenueForm.type,
          description: revenueForm.notes || revenueForm.type,
          amount: parseFloat(revenueForm.amount),
          created_by: authUser.id,
        })
        .select(`
          *,
          created_by_user:user_profiles!financial_transactions_created_by_fkey(name)
        `)
        .single()

      if (error) throw error

      // Add to local state
      const formattedTransaction: Transaction = {
        id: newTransaction.id,
        type: 'revenue',
        category: newTransaction.category,
        amount: parseFloat(newTransaction.amount.toString()),
        date: newTransaction.transaction_date,
        notes: newTransaction.description,
        createdBy: newTransaction.created_by_user?.name || user.name,
      }

      setTransactions([formattedTransaction, ...transactions])
      setRevenueForm({ type: '', amount: '', date: '', notes: '' })
      setShowRevenueModal(false)
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
        alert('Please log in to add expenses')
        return
      }

      if (!expenseForm.type || !expenseForm.amount) {
        alert('Please fill in required fields')
        return
      }

      const { data: newTransaction, error } = await supabase
        .from('financial_transactions')
        .insert({
          transaction_date: expenseForm.date || new Date().toISOString().split('T')[0],
          type: 'expense',
          category: expenseForm.type,
          description: expenseForm.notes || expenseForm.type,
          amount: parseFloat(expenseForm.amount),
          created_by: authUser.id,
        })
        .select(`
          *,
          created_by_user:user_profiles!financial_transactions_created_by_fkey(name)
        `)
        .single()

      if (error) throw error

      // Add to local state
      const formattedTransaction: Transaction = {
        id: newTransaction.id,
        type: 'expense',
        category: newTransaction.category,
        amount: parseFloat(newTransaction.amount.toString()),
        date: newTransaction.transaction_date,
        notes: newTransaction.description,
        createdBy: newTransaction.created_by_user?.name || user.name,
      }

      setTransactions([formattedTransaction, ...transactions])
      setExpenseForm({ type: '', amount: '', date: '', notes: '' })
      setShowExpenseModal(false)
      alert('Expense added successfully!')
    } catch (error: any) {
      console.error('Error adding expense:', error)
      alert(`Error adding expense: ${error.message}`)
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

  return (
    <Layout pageTitle="Financial Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-extrabold text-club-gradient mb-2">Financial Management</h1>
            <p className="text-lg text-neutral-medium font-medium">Track revenue, expenses, and financial records</p>
          </div>
          <div className="flex items-center space-x-3">
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

        {/* Financial Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(totalRevenue)}
            icon={TrendingUp}
            iconColor="bg-success"
            description="All revenue transactions"
          />
          <StatCard
            title="Total Expenses"
            value={formatCurrency(totalExpenses)}
            icon={TrendingDown}
            iconColor="bg-secondary"
            description="All expense transactions"
          />
          <StatCard
            title="Net Balance"
            value={formatCurrency(netBalance)}
            icon={DollarSign}
            iconColor="bg-primary"
            description="Revenue minus expenses"
          />
        </div>

        {/* Monthly Financial Trend Chart */}
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <h3 className="text-xl font-bold text-neutral-text mb-4">Monthly Financial Trend</h3>
          <div className="h-64">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <h3 className="text-lg font-bold text-neutral-text mb-4">Filter Transactions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-medium mb-2">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'revenue' | 'expense')}
                className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              >
                <option value="all">All Types</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-medium mb-2">Date From</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-medium mb-2">Date To</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-white rounded-card shadow-soft border border-neutral-light overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-light bg-neutral-light">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-neutral-text">
                Transactions ({filteredTransactions.length})
              </h2>
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
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Created By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-light">
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-neutral-light transition-colors">
                      <td className="px-6 py-4 text-sm text-neutral-medium">
                        {new Date(transaction.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          transaction.type === 'revenue' 
                            ? 'bg-success/10 text-success' 
                            : 'bg-secondary/10 text-secondary'
                        }`}>
                          {transaction.type === 'revenue' ? 'Revenue' : 'Expense'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-neutral-text font-medium">{transaction.category}</td>
                      <td className={`px-6 py-4 font-bold ${
                        transaction.type === 'revenue' ? 'text-success' : 'text-secondary'
                      }`}>
                        {transaction.type === 'revenue' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-medium">{transaction.notes}</td>
                      <td className="px-6 py-4 text-sm text-neutral-medium">{transaction.createdBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Revenue Modal */}
        {showRevenueModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-card shadow-large max-w-2xl w-full border border-neutral-light">
              <div className="p-6 border-b border-neutral-light">
                <h2 className="text-2xl font-bold text-neutral-text">Add Revenue</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Type</label>
                  <select
                    value={revenueForm.type}
                    onChange={(e) => setRevenueForm({ ...revenueForm, type: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-success focus:border-success transition-all"
                  >
                    <option value="">Select type...</option>
                    <option value="Sponsorship">Sponsorship</option>
                    <option value="Membership Fees">Membership Fees</option>
                    <option value="Merchandise">Merchandise</option>
                    <option value="Match Fees">Match Fees</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Amount (UGX)</label>
                  <input
                    type="number"
                    value={revenueForm.amount}
                    onChange={(e) => setRevenueForm({ ...revenueForm, amount: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-success focus:border-success transition-all"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Date</label>
                  <input
                    type="date"
                    value={revenueForm.date}
                    onChange={(e) => setRevenueForm({ ...revenueForm, date: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-success focus:border-success transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Notes</label>
                  <textarea
                    value={revenueForm.notes}
                    onChange={(e) => setRevenueForm({ ...revenueForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-success focus:border-success transition-all"
                    placeholder="Optional notes..."
                  />
                </div>
              </div>
              <div className="p-6 border-t border-neutral-light flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowRevenueModal(false)
                    setRevenueForm({ type: '', amount: '', date: '', notes: '' })
                  }}
                  className="px-6 py-3 bg-neutral-light text-neutral-text rounded-button font-semibold hover:bg-neutral-medium transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddRevenue}
                  className="px-6 py-3 bg-success text-white rounded-button font-semibold hover:bg-success-dark transition-all duration-300 shadow-soft hover:shadow-medium"
                >
                  Add Revenue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Expense Modal */}
        {showExpenseModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-card shadow-large max-w-2xl w-full border border-neutral-light">
              <div className="p-6 border-b border-neutral-light">
                <h2 className="text-2xl font-bold text-neutral-text">Add Expense</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Type</label>
                  <select
                    value={expenseForm.type}
                    onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                  >
                    <option value="">Select type...</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Travel">Travel</option>
                    <option value="Facilities">Facilities</option>
                    <option value="Salaries">Salaries</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Amount (UGX)</label>
                  <input
                    type="number"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Date</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Notes</label>
                  <textarea
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                    placeholder="Optional notes..."
                  />
                </div>
              </div>
              <div className="p-6 border-t border-neutral-light flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowExpenseModal(false)
                    setExpenseForm({ type: '', amount: '', date: '', notes: '' })
                  }}
                  className="px-6 py-3 bg-neutral-light text-neutral-text rounded-button font-semibold hover:bg-neutral-medium transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddExpense}
                  className="px-6 py-3 bg-secondary text-white rounded-button font-semibold hover:bg-secondary-dark transition-all duration-300 shadow-soft hover:shadow-medium"
                >
                  Add Expense
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

