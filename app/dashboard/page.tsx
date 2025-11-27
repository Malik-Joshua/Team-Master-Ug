'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { Calendar, Activity, Trophy, Target, AlertCircle, Dumbbell, Edit, X, Save } from 'lucide-react'
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
import { Line } from 'react-chartjs-2'

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

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({
    totalPlayers: 0,
    activePlayers: 0,
    totalMatches: 0,
    totalTries: 0,
    totalTackles: 0,
    avgMinutes: 0,
    winRate: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    trainingSessionsAttended: 0,
  })
  const [trainingSessionsData, setTrainingSessionsData] = useState<any[]>([])
  const [gymStats, setGymStats] = useState({
    benchPressPB: null as number | null,
    squatPB: null as number | null,
    deadliftPB: null as number | null,
    pullUpPB: null as number | null,
  })
  const [showGymForm, setShowGymForm] = useState(false)
  const [gymFormData, setGymFormData] = useState({
    benchPressPB: '',
    squatPB: '',
    deadliftPB: '',
    pullUpPB: '',
  })
  const [savingGymStats, setSavingGymStats] = useState(false)

  useEffect(() => {
    const loadDashboard = async () => {
      // Check for dev mode first
      if (typeof window !== 'undefined') {
        const devRole = localStorage.getItem('dev_role')
        const devUser = localStorage.getItem('dev_user')

        if (devRole && devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            // Set mock stats based on role
            const mockStats = {
              totalPlayers: 25,
              activePlayers: 20,
              totalMatches: 12,
              totalTries: 8,
              totalTackles: 45,
              avgMinutes: 72,
              winRate: 65,
              totalRevenue: 50000000,
              totalExpenses: 32000000,
              trainingSessionsAttended: userData.role === 'coach' ? 18 : (userData.role === 'player' ? 15 : 0),
            }
            setStats(mockStats)
            // Mock gym stats for players in dev mode
            if (userData.role === 'player') {
              setGymStats({
                benchPressPB: 100,
                squatPB: 150,
                deadliftPB: 180,
                pullUpPB: 20,
              })
            }
            // Mock training sessions data for coach
            if (userData.role === 'coach') {
              const mockSessions = Array.from({ length: 18 }, (_, i) => ({
                id: `session-${i + 1}`,
                session_date: new Date(2024, 0, 1 + i * 7).toISOString().split('T')[0],
                session_number: i + 1,
                location: 'Training Ground',
                description: `Training Session ${i + 1}`,
              }))
              setTrainingSessionsData(mockSessions)
            }
            return
          } catch (e) {
            console.error('Error parsing dev user data:', e)
            localStorage.removeItem('dev_role')
            localStorage.removeItem('dev_user')
          }
        }
      }

      // Real authentication
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          router.push('/dev-login')
          return
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
            // Load real stats based on role
            if (profile.role === 'coach') {
              try {
                const { db } = await import('@/lib/db-helpers')
                const sessionCount = await db.getCoachTrainingSessionsCount(authUser.id)
                const sessions = await db.getCoachTrainingSessions(authUser.id)
                setStats(prev => ({
                  ...prev,
                  trainingSessionsAttended: sessionCount,
                }))
                setTrainingSessionsData(sessions)
              } catch (error) {
                console.error('Error loading coach training sessions:', error)
              }
            } else if (profile.role === 'player') {
              try {
                const { db } = await import('@/lib/db-helpers')
                const sessionsAttended = await db.getPlayerTrainingSessionsAttended(authUser.id)
                const gymMetrics = await db.getPlayerGymStats(authUser.id)
                setStats(prev => ({
                  ...prev,
                  trainingSessionsAttended: sessionsAttended,
                }))
                setGymStats(gymMetrics)
              } catch (error) {
                console.error('Error loading player stats:', error)
              }
            }
          } else {
            router.push('/dev-login')
          }
        } else {
          router.push('/dev-login')
        }
      } catch (error) {
        console.error('Error loading dashboard:', error)
        router.push('/dev-login')
      }
    }

    loadDashboard()
  }, [router])

  // Route to role-specific dashboards
  useEffect(() => {
    if (user && user.role) {
      if (user.role === 'data_admin') {
        router.push('/dashboard/data-admin')
        return
      } else if (user.role === 'finance_admin') {
        router.push('/dashboard/finance-admin')
        return
      } else if (user.role === 'admin') {
        router.push('/dashboard/admin')
        return
      }
    }
  }, [user, router])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-neutral-medium">Loading...</p>
        </div>
      </div>
    )
  }

  // Role-based dashboard content
  if (user.role === 'player') {
    return (
      <Layout pageTitle="Player Dashboard">
        <div className="space-y-6">
          {/* Hero Section */}
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-neutral-text mb-2">
                  Welcome back, {user.name}!
                </h2>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 bg-success/10 text-success rounded-full text-sm font-medium">
                    {user.status || 'Active'}
                  </span>
                  {user.position && (
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium capitalize">
                      {user.position.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-20 h-20 rounded-full bg-club-gradient flex items-center justify-center text-white text-2xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Training Sessions Attended"
              value={stats.trainingSessionsAttended}
              icon={Calendar}
              iconColor="bg-primary"
            />
            <StatCard
              title="Games Played"
              value={stats.totalMatches}
              icon={Trophy}
              iconColor="bg-secondary"
            />
            <StatCard
              title="Tries Scored"
              value={stats.totalTries}
              icon={Target}
              iconColor="bg-success"
            />
            <StatCard
              title="Tackles Made"
              value={stats.totalTackles}
              icon={Activity}
              iconColor="bg-info"
            />
          </div>

          {/* Gym Metrics Section */}
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Dumbbell className="w-6 h-6 text-primary mr-2" />
                <h3 className="text-xl font-bold text-neutral-text">Gym Metrics - Personal Bests</h3>
              </div>
              <button
                onClick={() => {
                  setGymFormData({
                    benchPressPB: gymStats.benchPressPB?.toString() || '',
                    squatPB: gymStats.squatPB?.toString() || '',
                    deadliftPB: gymStats.deadliftPB?.toString() || '',
                    pullUpPB: gymStats.pullUpPB?.toString() || '',
                  })
                  setShowGymForm(true)
                }}
                className="flex items-center px-4 py-2 bg-primary text-white rounded-button font-semibold hover:bg-primary-dark transition-colors"
              >
                <Edit className="w-4 h-4 mr-2" />
                Update Metrics
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 border border-primary/20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Bench Press</h4>
                  <Dumbbell className="w-5 h-5 text-primary" />
                </div>
                <p className="text-3xl font-bold text-neutral-text">
                  {gymStats.benchPressPB !== null ? `${gymStats.benchPressPB} kg` : 'N/A'}
                </p>
                <p className="text-xs text-neutral-medium mt-1">Personal Best</p>
              </div>
              <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-lg p-6 border border-secondary/20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Squat</h4>
                  <Dumbbell className="w-5 h-5 text-secondary" />
                </div>
                <p className="text-3xl font-bold text-neutral-text">
                  {gymStats.squatPB !== null ? `${gymStats.squatPB} kg` : 'N/A'}
                </p>
                <p className="text-xs text-neutral-medium mt-1">Personal Best</p>
              </div>
              <div className="bg-gradient-to-br from-success/10 to-success/5 rounded-lg p-6 border border-success/20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Deadlift</h4>
                  <Dumbbell className="w-5 h-5 text-success" />
                </div>
                <p className="text-3xl font-bold text-neutral-text">
                  {gymStats.deadliftPB !== null ? `${gymStats.deadliftPB} kg` : 'N/A'}
                </p>
                <p className="text-xs text-neutral-medium mt-1">Personal Best</p>
              </div>
              <div className="bg-gradient-to-br from-info/10 to-info/5 rounded-lg p-6 border border-info/20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Pull-ups</h4>
                  <Dumbbell className="w-5 h-5 text-info" />
                </div>
                <p className="text-3xl font-bold text-neutral-text">
                  {gymStats.pullUpPB !== null ? `${gymStats.pullUpPB} reps` : 'N/A'}
                </p>
                <p className="text-xs text-neutral-medium mt-1">Personal Best</p>
              </div>
            </div>
            {gymStats.benchPressPB === null && gymStats.squatPB === null && gymStats.deadliftPB === null && gymStats.pullUpPB === null && (
              <div className="mt-4 text-center text-neutral-medium text-sm">
                No gym metrics recorded yet. Click &quot;Update Metrics&quot; above to add your personal bests.
              </div>
            )}
          </div>

          {/* Gym Metrics Edit Modal */}
          {showGymForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-card shadow-soft max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-neutral-light">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Dumbbell className="w-6 h-6 text-primary mr-2" />
                      <h3 className="text-2xl font-bold text-neutral-text">Update Gym Metrics</h3>
                    </div>
                    <button
                      onClick={() => setShowGymForm(false)}
                      className="text-neutral-medium hover:text-neutral-text transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-text mb-2">
                      Bench Press Personal Best (kg)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={gymFormData.benchPressPB}
                      onChange={(e) => setGymFormData({ ...gymFormData, benchPressPB: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Enter weight in kg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-text mb-2">
                      Squat Personal Best (kg)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={gymFormData.squatPB}
                      onChange={(e) => setGymFormData({ ...gymFormData, squatPB: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Enter weight in kg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-text mb-2">
                      Deadlift Personal Best (kg)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={gymFormData.deadliftPB}
                      onChange={(e) => setGymFormData({ ...gymFormData, deadliftPB: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Enter weight in kg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-neutral-text mb-2">
                      Pull-ups Personal Best (reps)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={gymFormData.pullUpPB}
                      onChange={(e) => setGymFormData({ ...gymFormData, pullUpPB: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Enter number of reps"
                    />
                  </div>
                </div>
                <div className="p-6 border-t border-neutral-light flex justify-end space-x-3">
                  <button
                    onClick={() => setShowGymForm(false)}
                    className="px-6 py-2 border border-neutral-light rounded-button font-semibold text-neutral-text hover:bg-neutral-light transition-colors"
                    disabled={savingGymStats}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setSavingGymStats(true)
                      try {
                        // Check for dev mode
                        if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
                          const devUser = JSON.parse(localStorage.getItem('dev_user') || '{}')
                          const updatedGymStats = {
                            benchPressPB: gymFormData.benchPressPB ? parseFloat(gymFormData.benchPressPB) : null,
                            squatPB: gymFormData.squatPB ? parseFloat(gymFormData.squatPB) : null,
                            deadliftPB: gymFormData.deadliftPB ? parseFloat(gymFormData.deadliftPB) : null,
                            pullUpPB: gymFormData.pullUpPB && gymFormData.pullUpPB.trim() !== '' ? parseInt(gymFormData.pullUpPB) : null,
                          }
                          setGymStats(updatedGymStats)
                          setShowGymForm(false)
                          alert('Gym metrics updated! (Dev Mode)')
                          setSavingGymStats(false)
                          return
                        }

                        const supabase = createClient()
                        const { data: { user: authUser } } = await supabase.auth.getUser()

                        if (!authUser) {
                          alert('Please log in to update gym metrics')
                          setSavingGymStats(false)
                          return
                        }

                        const { db } = await import('@/lib/db-helpers')
                        await db.updatePlayerGymStats(authUser.id, {
                          benchPressPB: gymFormData.benchPressPB && gymFormData.benchPressPB.trim() !== '' ? parseFloat(gymFormData.benchPressPB) : null,
                          squatPB: gymFormData.squatPB && gymFormData.squatPB.trim() !== '' ? parseFloat(gymFormData.squatPB) : null,
                          deadliftPB: gymFormData.deadliftPB && gymFormData.deadliftPB.trim() !== '' ? parseFloat(gymFormData.deadliftPB) : null,
                          pullUpPB: gymFormData.pullUpPB && gymFormData.pullUpPB.trim() !== '' ? parseInt(gymFormData.pullUpPB) : null,
                        })

                        // Reload gym stats
                        const updatedStats = await db.getPlayerGymStats(authUser.id)
                        setGymStats(updatedStats)
                        setShowGymForm(false)
                        alert('Gym metrics updated successfully!')
                      } catch (error: any) {
                        console.error('Error updating gym metrics:', error)
                        alert(`Error updating gym metrics: ${error.message}`)
                      } finally {
                        setSavingGymStats(false)
                      }
                    }}
                    className="px-6 py-2 bg-primary text-white rounded-button font-semibold hover:bg-primary-dark transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={savingGymStats}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {savingGymStats ? 'Saving...' : 'Save Metrics'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Performance Chart */}
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <h3 className="text-xl font-bold text-neutral-text mb-4">Performance Over Time</h3>
            <div className="h-64">
              <Line
                data={{
                  labels: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5', 'Game 6', 'Game 7', 'Game 8', 'Game 9', 'Game 10'],
                  datasets: [
                    {
                      label: 'Tackles',
                      data: [5, 4, 6, 3, 5, 4, 5, 6, 4, 5],
                      borderColor: '#2563EB',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      fill: true,
                      tension: 0.4,
                    },
                    {
                      label: 'Tries',
                      data: [1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
                      borderColor: '#DC2626',
                      backgroundColor: 'rgba(220, 38, 38, 0.1)',
                      fill: true,
                      tension: 0.4,
                    },
                  ],
                }}
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
                }}
              />
            </div>
          </div>

          {/* Recent Notifications */}
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <h3 className="text-xl font-bold text-neutral-text mb-4">Recent Notifications</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 hover:bg-neutral-light rounded-lg transition-colors">
                <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-neutral-text">New training session scheduled</p>
                  <p className="text-xs text-neutral-medium mt-1">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 hover:bg-neutral-light rounded-lg transition-colors">
                <AlertCircle className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <p className="text-sm text-neutral-text">Match stats updated</p>
                  <p className="text-xs text-neutral-medium mt-1">5 hours ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  // Coach Dashboard
  if (user.role === 'coach') {
    return (
      <Layout pageTitle="Coach Control Center">
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Players"
              value={stats.totalPlayers}
              icon={Activity}
              iconColor="bg-primary"
            />
            <StatCard
              title="Active Players"
              value={`${stats.activePlayers} (${Math.round((stats.activePlayers / stats.totalPlayers) * 100)}%)`}
              icon={Activity}
              iconColor="bg-success"
            />
            <StatCard
              title="Injured Players"
              value={stats.totalPlayers - stats.activePlayers}
              icon={AlertCircle}
              iconColor="bg-secondary"
            />
            <StatCard
              title="Training Sessions"
              value={stats.trainingSessionsAttended}
              icon={Calendar}
              iconColor="bg-info"
            />
          </div>

          {/* Training Sessions Track */}
          <div className="bg-white rounded-card border border-neutral-light shadow-soft p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-neutral-text">Training Sessions Track</h3>
              <span className="text-sm text-neutral-medium">Total: {stats.trainingSessionsAttended} sessions</span>
            </div>
            <div className="h-64">
              <Line
                data={{
                  labels: trainingSessionsData.length > 0
                    ? trainingSessionsData.map((session, index) => {
                        const date = new Date(session.session_date)
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      })
                    : Array.from({ length: 12 }, (_, i) => {
                        const date = new Date()
                        date.setDate(date.getDate() - (12 - i) * 7)
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      }),
                  datasets: [
                    {
                      label: 'Training Sessions Conducted',
                      data: trainingSessionsData.length > 0
                        ? trainingSessionsData.map((_, index) => index + 1)
                        : Array.from({ length: 12 }, (_, i) => i + 1),
                      borderColor: '#2563EB',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      fill: true,
                      tension: 0.4,
                      pointRadius: 5,
                      pointHoverRadius: 7,
                      pointBackgroundColor: '#2563EB',
                      pointBorderColor: '#ffffff',
                      pointBorderWidth: 2,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: true,
                      position: 'top' as const,
                    },
                    tooltip: {
                      mode: 'index' as const,
                      intersect: false,
                      callbacks: {
                        label: function(context) {
                          return `Session ${context.parsed.y}`
                        }
                      }
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        stepSize: 1,
                        precision: 0,
                      },
                      grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                      },
                      title: {
                        display: true,
                        text: 'Number of Sessions',
                      },
                    },
                    x: {
                      grid: {
                        display: false,
                      },
                      title: {
                        display: true,
                        text: 'Date',
                      },
                    },
                  },
                }}
              />
            </div>
            {trainingSessionsData.length === 0 && (
              <div className="mt-4 text-center text-neutral-medium text-sm">
                No training sessions recorded yet. Start by creating a training session!
              </div>
            )}
          </div>

          {/* Top Performers Table */}
          <div className="bg-white rounded-card border border-neutral-light shadow-soft overflow-hidden">
            <div className="p-6 border-b border-neutral-light">
              <h3 className="text-xl font-bold text-neutral-text">Top Performers</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-light">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Player</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Position</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Games</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Tries</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Tackles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-light">
                  <tr className="hover:bg-neutral-light transition-colors cursor-pointer">
                    <td className="px-6 py-4 text-sm font-medium text-neutral-text">John Doe</td>
                    <td className="px-6 py-4 text-sm text-neutral-medium">Fly Half</td>
                    <td className="px-6 py-4 text-sm text-neutral-medium">15</td>
                    <td className="px-6 py-4 text-sm text-neutral-medium">8</td>
                    <td className="px-6 py-4 text-sm text-neutral-medium">45</td>
                  </tr>
                  <tr className="hover:bg-neutral-light transition-colors cursor-pointer">
                    <td className="px-6 py-4 text-sm font-medium text-neutral-text">Jane Smith</td>
                    <td className="px-6 py-4 text-sm text-neutral-medium">Prop</td>
                    <td className="px-6 py-4 text-sm text-neutral-medium">12</td>
                    <td className="px-6 py-4 text-sm text-neutral-medium">2</td>
                    <td className="px-6 py-4 text-sm text-neutral-medium">38</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-neutral-light">
              <button
                onClick={() => router.push('/players')}
                className="px-6 py-2 bg-club-gradient text-white rounded-button font-semibold hover:opacity-90 transition-opacity"
              >
                View All Players
              </button>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  // Default dashboard for other roles
  return (
    <Layout pageTitle="Dashboard">
      <div className="space-y-6">
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <h2 className="text-2xl font-bold text-neutral-text mb-2">
            Welcome, {user.name}!
          </h2>
          <p className="text-neutral-medium">
            Your {user.role.replace('_', ' ')} dashboard
          </p>
        </div>
      </div>
    </Layout>
  )
}
