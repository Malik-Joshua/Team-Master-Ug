'use client'

import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import { useState } from 'react'
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

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `UGX ${(amount / 1000000).toFixed(1)}M`
    }
    return `UGX ${amount.toLocaleString()}`
  }

  const totalRevenue = 45000000
  const totalExpenses = 32000000
  const netBalance = totalRevenue - totalExpenses

  // Monthly financial data for the last 6 months
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
        {/* Financial Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(totalRevenue)}
            icon={TrendingUp}
            iconColor="bg-success"
          />
          <StatCard
            title="Total Expense"
            value={formatCurrency(totalExpenses)}
            icon={TrendingDown}
            iconColor="bg-secondary"
          />
          <StatCard
            title="Net Balance"
            value={formatCurrency(netBalance)}
            icon={DollarSign}
            iconColor="bg-primary"
          />
        </div>

        {/* Monthly Financial Trend Chart */}
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <h3 className="text-xl font-bold text-neutral-text mb-4">Monthly Financial Trend</h3>
          <div className="h-64">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Dual Entry Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Log Revenue Form */}
          <div className="bg-white rounded-card p-6 border-2 border-success/20 shadow-soft">
            <h3 className="text-xl font-bold text-neutral-text mb-6">Log Revenue</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">Type</label>
                <select
                  value={revenueForm.type}
                  onChange={(e) => setRevenueForm({ ...revenueForm, type: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-success focus:border-success transition-all"
                >
                  <option value="">Select type...</option>
                  <option value="sponsorship">Sponsorship</option>
                  <option value="membership">Membership Fees</option>
                  <option value="merchandise">Merchandise</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">Amount (UGX)</label>
                <input
                  type="number"
                  value={revenueForm.amount}
                  onChange={(e) => setRevenueForm({ ...revenueForm, amount: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-success focus:border-success transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">Date</label>
                <input
                  type="date"
                  value={revenueForm.date}
                  onChange={(e) => setRevenueForm({ ...revenueForm, date: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-success focus:border-success transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">Notes</label>
                <textarea
                  value={revenueForm.notes}
                  onChange={(e) => setRevenueForm({ ...revenueForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-success focus:border-success transition-all"
                />
              </div>
              <button className="w-full px-6 py-3 bg-success text-white rounded-button font-semibold hover:bg-success-dark transition-colors">
                Add Revenue
              </button>
            </div>
          </div>

          {/* Log Expense Form */}
          <div className="bg-white rounded-card p-6 border-2 border-secondary/20 shadow-soft">
            <h3 className="text-xl font-bold text-neutral-text mb-6">Log Expense</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">Type</label>
                <select
                  value={expenseForm.type}
                  onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                >
                  <option value="">Select type...</option>
                  <option value="equipment">Equipment</option>
                  <option value="travel">Travel</option>
                  <option value="facilities">Facilities</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">Amount (UGX)</label>
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">Date</label>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">Notes</label>
                <textarea
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                />
              </div>
              <button className="w-full px-6 py-3 bg-secondary text-white rounded-button font-semibold hover:bg-secondary-dark transition-colors">
                Add Expense
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

