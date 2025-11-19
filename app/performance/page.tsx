'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { BarChart3, TrendingUp, Trophy, Target, Activity, Calendar, Users, Award, AlertCircle } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  
  // Coach-specific stats
  const [coachStats, setCoachStats] = useState({
    trainingSessionsConducted: 0,
    matchesAttended: 0,
  })
  const [teamStats, setTeamStats] = useState<any>(null)
  const [playersSummary, setPlayersSummary] = useState<any[]>([])
  const [coachMatches, setCoachMatches] = useState<any[]>([])
  
  // Player-specific stats
  const [playerStats, setPlayerStats] = useState({
    totalMatches: 0,
    totalTries: 0,
    totalTackles: 0,
    avgMinutes: 0,
    winRate: 0,
  })

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      
      // Check for dev mode
      if (typeof window !== 'undefined') {
        const devUser = localStorage.getItem('dev_user')
        if (devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            
            // Mock data based on role
            if (userData.role === 'coach') {
              setCoachStats({
                trainingSessionsConducted: 24,
                matchesAttended: 12,
              })
              setTeamStats({
                totalTries: 45,
                totalTackles: 320,
                totalTacklesMissed: 45,
                totalBallCarries: 180,
                totalBallHandlingErrors: 25,
                matchCount: 12,
                avgTriesPerMatch: 3.8,
                avgTacklesPerMatch: 26.7,
                tackleSuccessRate: 87.7,
              })
              setPlayersSummary([
                { name: 'John Doe', status: 'active', totalMatches: 10, totalTries: 5, totalTackles: 35, attendanceRate: 85.5 },
                { name: 'Jane Smith', status: 'active', totalMatches: 8, totalTries: 3, totalTackles: 28, attendanceRate: 92.0 },
              ])
            } else {
              setPlayerStats({
                totalMatches: 15,
                totalTries: 8,
                totalTackles: 45,
                avgMinutes: 72,
                winRate: 65,
              })
            }
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

          if (profile.role === 'coach') {
            // Load coach-specific data
            try {
              const { db } = await import('@/lib/db-helpers')
              
              // Training sessions conducted
              const sessionsCount = await db.getCoachTrainingSessionsCount(authUser.id)
              
              // Matches attended
              const matchesCount = await db.getCoachMatchesAttended(authUser.id)
              const matches = await db.getCoachMatches(authUser.id)
              
              // Team performance stats
              const teamPerformance = await db.getTeamPerformanceStats()
              
              // Players performance summary
              const playersPerf = await db.getPlayersPerformanceSummary()
              
              setCoachStats({
                trainingSessionsConducted: sessionsCount,
                matchesAttended: matchesCount,
              })
              setTeamStats(teamPerformance)
              setPlayersSummary(playersPerf)
              setCoachMatches(matches)
            } catch (error) {
              console.error('Error loading coach performance data:', error)
              // Set default values on error
              setTeamStats({
                totalTries: 0,
                totalTackles: 0,
                totalTacklesMissed: 0,
                totalBallCarries: 0,
                totalBallHandlingErrors: 0,
                matchCount: 0,
                avgTriesPerMatch: 0,
                avgTacklesPerMatch: 0,
                tackleSuccessRate: 0,
              })
            }
          } else {
            // Load player-specific match stats
            try {
              const { data: matchStats } = await supabase
                .from('match_stats')
                .select('*')
                .eq('player_id', authUser.id)

              if (matchStats && matchStats.length > 0) {
                const totalTries = matchStats.reduce((sum, stat) => sum + (stat.tries_scored || 0), 0)
                const totalTackles = matchStats.reduce((sum, stat) => sum + (stat.tackles_made || 0), 0)
                const totalMinutes = matchStats.reduce((sum, stat) => sum + (stat.minutes_played || 0), 0)

                setPlayerStats({
                  totalMatches: matchStats.length,
                  totalTries,
                  totalTackles,
                  avgMinutes: Math.round(totalMinutes / matchStats.length),
                  winRate: 0,
                })
              }
            } catch (error) {
              console.error('Error loading player performance data:', error)
            }
          }
        }
      }
      
      setLoading(false)
    }

    loadData()
  }, [])

  if (loading || !user) {
    return (
      <Layout pageTitle="Performance">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  // Coach Performance View
  if (user.role === 'coach') {
    const coachPerformanceCards = [
      {
        title: 'Training Sessions',
        value: coachStats.trainingSessionsConducted,
        icon: Calendar,
        color: 'bg-primary',
        description: 'Total sessions conducted',
      },
      {
        title: 'Matches Attended',
        value: coachStats.matchesAttended,
        icon: Trophy,
        color: 'bg-secondary',
        description: 'Matches as coach',
      },
      {
        title: 'Team Tries',
        value: teamStats?.totalTries || 0,
        icon: Target,
        color: 'bg-success',
        description: 'Total team tries scored',
      },
      {
        title: 'Team Tackles',
        value: teamStats?.totalTackles || 0,
        icon: Activity,
        color: 'bg-info',
        description: 'Total team tackles made',
      },
      {
        title: 'Tackle Success',
        value: teamStats ? `${teamStats.tackleSuccessRate}%` : '0%',
        icon: TrendingUp,
        color: 'bg-warning',
        description: 'Team tackle success rate',
      },
    ]

    // Team performance chart data
    const teamChartData = teamStats ? {
      labels: ['Tries', 'Tackles', 'Ball Carries', 'Handling Errors'],
      datasets: [
        {
          label: 'Team Performance',
          data: [
            teamStats.totalTries,
            teamStats.totalTackles,
            teamStats.totalBallCarries,
            teamStats.totalBallHandlingErrors,
          ],
          backgroundColor: [
            'rgba(37, 99, 235, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(251, 191, 36, 0.8)',
            'rgba(239, 68, 68, 0.8)',
          ],
          borderColor: [
            'rgba(37, 99, 235, 1)',
            'rgba(34, 197, 94, 1)',
            'rgba(251, 191, 36, 1)',
            'rgba(239, 68, 68, 1)',
          ],
          borderWidth: 2,
        },
      ],
    } : null

    const teamChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
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

    // Player attendance chart
    const topPlayers = [...playersSummary]
      .sort((a, b) => b.attendanceRate - a.attendanceRate)
      .slice(0, 10)

    const attendanceChartData = topPlayers.length > 0 ? {
      labels: topPlayers.map(p => p.name),
      datasets: [
        {
          label: 'Training Attendance Rate (%)',
          data: topPlayers.map(p => p.attendanceRate),
          backgroundColor: 'rgba(37, 99, 235, 0.6)',
          borderColor: 'rgba(37, 99, 235, 1)',
          borderWidth: 2,
        },
      ],
    } : null

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'active':
          return 'bg-success/10 text-success'
        case 'injured':
          return 'bg-warning/10 text-warning'
        case 'inactive':
          return 'bg-neutral-medium/10 text-neutral-medium'
        default:
          return 'bg-neutral-light/10 text-neutral-medium'
      }
    }

    return (
      <Layout pageTitle="Coach Performance">
        <div className="space-y-6">
          <div className="mb-2">
            <h1 className="text-4xl font-extrabold text-club-gradient mb-2">Coach Performance Dashboard</h1>
            <p className="text-lg text-neutral-medium font-medium">Track your coaching activities and team performance</p>
          </div>

          {/* Coach Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {coachPerformanceCards.map((card) => {
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

          {/* Team Performance Chart */}
          {teamChartData && (
            <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
              <h2 className="text-2xl font-bold text-neutral-text mb-6">Team Performance Overview</h2>
              <div className="h-64">
                <Bar data={teamChartData} options={teamChartOptions} />
              </div>
              {teamStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-neutral-light">
                  <div>
                    <p className="text-sm text-neutral-medium">Avg Tries/Match</p>
                    <p className="text-2xl font-bold text-primary">{teamStats.avgTriesPerMatch}</p>
                  </div>
                  <div>
                    <p className="text-sm text-neutral-medium">Avg Tackles/Match</p>
                    <p className="text-2xl font-bold text-success">{teamStats.avgTacklesPerMatch}</p>
                  </div>
                  <div>
                    <p className="text-sm text-neutral-medium">Total Matches</p>
                    <p className="text-2xl font-bold text-info">{teamStats.matchCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-neutral-medium">Tackle Success Rate</p>
                    <p className="text-2xl font-bold text-warning">{teamStats.tackleSuccessRate}%</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Player Attendance Chart */}
          {attendanceChartData && topPlayers.length > 0 && (
            <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
              <h2 className="text-2xl font-bold text-neutral-text mb-6">Top Players - Training Attendance</h2>
              <div className="h-64">
                <Bar data={attendanceChartData} options={teamChartOptions} />
              </div>
            </div>
          )}

          {/* Players Performance Summary */}
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <h2 className="text-2xl font-bold text-neutral-text mb-6 flex items-center">
              <Users className="w-6 h-6 mr-2 text-primary" />
              Players Performance Summary
            </h2>
            {playersSummary.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-neutral-medium mx-auto mb-4" />
                <p className="text-neutral-medium">No player data available yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-light">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-text">Player Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-text">Status</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-text">Matches</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-text">Tries</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-text">Tackles</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-text">Avg Minutes</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-text">Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playersSummary.map((player) => (
                      <tr key={player.playerId} className="border-b border-neutral-light/50 hover:bg-neutral-light/30 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-neutral-text">{player.name}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(player.status)}`}>
                            {player.status || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-neutral-text">{player.totalMatches}</td>
                        <td className="py-3 px-4 text-center text-neutral-text">{player.totalTries}</td>
                        <td className="py-3 px-4 text-center text-neutral-text">{player.totalTackles}</td>
                        <td className="py-3 px-4 text-center text-neutral-text">{player.avgMinutes} min</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-semibold ${player.attendanceRate >= 80 ? 'text-success' : player.attendanceRate >= 60 ? 'text-warning' : 'text-secondary'}`}>
                            {player.attendanceRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Matches */}
          {coachMatches.length > 0 && (
            <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
              <h2 className="text-2xl font-bold text-neutral-text mb-6 flex items-center">
                <Trophy className="w-6 h-6 mr-2 text-primary" />
                Recent Matches
              </h2>
              <div className="space-y-3">
                {coachMatches.slice(0, 5).map((match) => {
                  const matchDate = new Date(match.match_date)
                  const getResultColor = (result: string) => {
                    switch (result) {
                      case 'win':
                        return 'bg-success/10 text-success'
                      case 'loss':
                        return 'bg-secondary/10 text-secondary'
                      case 'draw':
                        return 'bg-warning/10 text-warning'
                      default:
                        return 'bg-neutral-light/10 text-neutral-medium'
                    }
                  }
                  
                  return (
                    <div key={match.id} className="p-4 bg-neutral-light/50 rounded-lg hover:bg-neutral-light transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-neutral-text">{match.opponent}</p>
                          <p className="text-sm text-neutral-medium">
                            {matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {match.tournament_type}
                            {match.score_our_team !== null && match.score_opponent !== null && (
                              <span className="ml-2">
                                {match.score_our_team} - {match.score_opponent}
                              </span>
                            )}
                          </p>
                        </div>
                        {match.result && (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getResultColor(match.result)}`}>
                            {match.result.charAt(0).toUpperCase() + match.result.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </Layout>
    )
  }

  // Player Performance View (existing)
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
      value: playerStats.totalMatches,
      icon: Calendar,
      color: 'bg-primary',
      description: 'Total games participated',
    },
    {
      title: 'Tries Scored',
      value: playerStats.totalTries,
      icon: Trophy,
      color: 'bg-secondary',
      description: 'Total tries across all matches',
    },
    {
      title: 'Tackles Made',
      value: playerStats.totalTackles,
      icon: Target,
      color: 'bg-success',
      description: 'Successful defensive tackles',
    },
    {
      title: 'Avg Minutes',
      value: `${playerStats.avgMinutes} min`,
      icon: Activity,
      color: 'bg-info',
      description: 'Average playing time per match',
    },
    {
      title: 'Win Rate',
      value: `${playerStats.winRate}%`,
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
