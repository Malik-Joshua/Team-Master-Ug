'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { BarChart3, TrendingUp, Trophy, Target, Activity, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
import { Line, Bar } from 'react-chartjs-2'

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

export default function PerformancePage() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({
    totalMatches: 0,
    totalTries: 0,
    totalTackles: 0,
    avgMinutes: 0,
    winRate: 0,
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
            // Mock stats for dev mode
            setStats({
              totalMatches: 15,
              totalTries: 8,
              totalTackles: 45,
              avgMinutes: 72,
              winRate: 65,
            })
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

          // Fetch player-specific match stats
          const { data: matchStats } = await supabase
            .from('match_stats')
            .select('*')
            .eq('player_id', authUser.id)

          if (matchStats && matchStats.length > 0) {
            const totalTries = matchStats.reduce((sum, stat) => sum + (stat.tries_scored || 0), 0)
            const totalTackles = matchStats.reduce((sum, stat) => sum + (stat.tackles_made || 0), 0)
            const totalMinutes = matchStats.reduce((sum, stat) => sum + (stat.minutes_played || 0), 0)

            setStats({
              totalMatches: matchStats.length,
              totalTries,
              totalTackles,
              avgMinutes: Math.round(totalMinutes / matchStats.length),
              winRate: 0,
            })
          }
        }
      }
    }

    loadData()
  }, [])

  if (!user) {
    return (
      <Layout pageTitle="Performance">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  // Mock data for performance chart
  const last10Games = ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5', 'Game 6', 'Game 7', 'Game 8', 'Game 9', 'Game 10']
  const tacklesData = [5, 4, 6, 3, 5, 4, 5, 6, 4, 5]
  const triesData = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1]

  const chartData = {
    labels: last10Games,
    datasets: [
      {
        label: 'Tackles',
        data: tacklesData,
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Tries',
        data: triesData,
        borderColor: '#DC2626',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        fill: true,
        tension: 0.4,
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

  const performanceCards = [
    {
      title: 'Matches Played',
      value: stats.totalMatches,
      icon: Calendar,
      color: 'bg-primary',
      description: 'Total games participated',
    },
    {
      title: 'Tries Scored',
      value: stats.totalTries,
      icon: Trophy,
      color: 'bg-secondary',
      description: 'Total tries across all matches',
    },
    {
      title: 'Tackles Made',
      value: stats.totalTackles,
      icon: Target,
      color: 'bg-success',
      description: 'Successful defensive tackles',
    },
    {
      title: 'Avg Minutes',
      value: `${stats.avgMinutes} min`,
      icon: Activity,
      color: 'bg-info',
      description: 'Average playing time per match',
    },
    {
      title: 'Win Rate',
      value: `${stats.winRate}%`,
      icon: TrendingUp,
      color: 'bg-warning',
      description: 'Team win rate in your matches',
    },
  ]

  return (
    <Layout pageTitle="Performance">
      <div className="space-y-6">
        <div className="mb-2">
          <h1 className="text-4xl font-extrabold text-club-gradient mb-2">My Performance</h1>
          <p className="text-lg text-neutral-medium font-medium">Track your individual statistics and progress</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {performanceCards.map((card) => {
            const Icon = card.icon
            return (
              <StatCard
                key={card.title}
                title={card.title}
                value={card.value}
                icon={Icon}
                iconColor={card.color}
                description={card.description}
              />
            )
          })}
        </div>

        {/* Performance Chart */}
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <h2 className="text-2xl font-bold text-neutral-text mb-6">Performance Over Time</h2>
          <div className="h-64">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Match History */}
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <h2 className="text-2xl font-bold text-neutral-text mb-6">Recent Matches</h2>
          <div className="space-y-3">
            <div className="p-4 bg-neutral-light/50 rounded-lg hover:bg-neutral-light transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-text">Uganda Cup Final</p>
                  <p className="text-sm text-neutral-medium">2 tries, 5 tackles, 80 minutes</p>
                </div>
                <span className="px-3 py-1 bg-success/10 text-success rounded-full text-sm font-medium">
                  Win
                </span>
              </div>
            </div>
            <div className="p-4 bg-neutral-light/50 rounded-lg hover:bg-neutral-light transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-text">League Match vs Lions</p>
                  <p className="text-sm text-neutral-medium">1 try, 4 tackles, 75 minutes</p>
                </div>
                <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-sm font-medium">
                  Loss
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

