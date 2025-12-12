'use client'

import { useEffect, useState } from 'react'
// Fixed TypeScript errors for fixture team selection state variables
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { Calendar, Activity, Trophy, Target, AlertCircle, Dumbbell, Edit, X, Save, HeartPulse, Pill, FileText, Clock, CheckCircle } from 'lucide-react'
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
  const [injuries, setInjuries] = useState<any[]>([])
  const [loadingInjuries, setLoadingInjuries] = useState(false)
  const [bestGymMetrics, setBestGymMetrics] = useState<any>(null)
  const [loadingBestMetrics, setLoadingBestMetrics] = useState(false)
  const [playerFixtureSelection, setPlayerFixtureSelection] = useState<any>(null)
  const [loadingPlayerFixture, setLoadingPlayerFixture] = useState(false)
  const [activeInjuriesView, setActiveInjuriesView] = useState<any[]>([])
  const [loadingActiveInjuries, setLoadingActiveInjuries] = useState(false)

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
            
            // Mock active injuries for coaches, admins, and team managers in dev mode
            if (userData.role === 'coach' || userData.role === 'admin' || userData.role === 'data_admin') {
              setActiveInjuriesView([
                {
                  id: '1',
                  player_id: 'player1',
                  player: { name: 'John Doe' },
                  injury_date: '2024-12-01',
                  cause: 'Training collision',
                  diagnosis: 'Sprained ankle',
                  return_to_play_date: '2024-12-20',
                  return_to_training_date: '2024-12-15',
                  status: 'active',
                },
                {
                  id: '2',
                  player_id: 'player2',
                  player: { name: 'Mike Johnson' },
                  injury_date: '2024-12-05',
                  cause: 'Match injury',
                  diagnosis: 'Shoulder strain',
                  return_to_play_date: '2024-12-25',
                  return_to_training_date: '2024-12-18',
                  status: 'active',
                },
              ])
            }
            
            // Mock gym stats for players in dev mode
            if (userData.role === 'player') {
              setGymStats({
                benchPressPB: 100,
                squatPB: 150,
                deadliftPB: 180,
                pullUpPB: 20,
              })
              // Mock fixture selection for dev mode
              setPlayerFixtureSelection({
                match: {
                  id: '1',
                  match_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  opponent: 'Kampala RFC',
                  venue: 'Home Ground',
                  tournament_type: 'league',
                },
                isSelected: true,
                selection: {
                  is_starting: true,
                  is_substitute: false,
                  jersey_number: 10,
                  position: 'fly_half',
                },
              })
              // Mock injury data for dev mode
              setInjuries([
                {
                  id: '1',
                  injury_date: '2024-12-01',
                  cause: 'Training collision',
                  diagnosis: 'Sprained ankle',
                  action_taken: 'RICE treatment, compression bandage applied',
                  further_treatment: 'Physiotherapy sessions 3x/week for 2 weeks',
                  medication: 'Ibuprofen 400mg twice daily for 5 days',
                  return_to_training_date: '2024-12-15',
                  return_to_play_date: '2024-12-22',
                  status: 'active',
                  notes: 'Player responding well to treatment. Continue with physio sessions and monitor progress.',
                  created_at: '2024-12-01T10:00:00Z',
                },
              ])
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
                
                // Load player injuries
                setLoadingInjuries(true)
                const playerInjuries = await db.getInjuries(authUser.id)
                setInjuries(playerInjuries || [])
                setLoadingInjuries(false)

                // Load player fixture selection
                setLoadingPlayerFixture(true)
                try {
                  const fixtureSelection = await db.getPlayerFixtureSelection(authUser.id)
                  setPlayerFixtureSelection(fixtureSelection)
                } catch (error) {
                  console.error('Error loading player fixture selection:', error)
                  setPlayerFixtureSelection(null)
                } finally {
                  setLoadingPlayerFixture(false)
                }
              } catch (error) {
                console.error('Error loading player stats:', error)
                setLoadingInjuries(false)
                setLoadingPlayerFixture(false)
              }
            }
            
            // Load best gym metrics for all roles except finance_admin and physio
            if (profile.role !== 'finance_admin' && profile.role !== 'physio') {
              try {
                setLoadingBestMetrics(true)
                const { db } = await import('@/lib/db-helpers')
                const bestMetrics = await db.getBestGymMetricsOfWeek()
                setBestGymMetrics(bestMetrics)
              } catch (error) {
                console.error('Error loading best gym metrics:', error)
                setBestGymMetrics(null)
              } finally {
                setLoadingBestMetrics(false)
              }
            }

            // Load active injuries for coaches, admins, and team managers (read-only view)
            if (profile.role === 'coach' || profile.role === 'admin' || profile.role === 'data_admin') {
              try {
                setLoadingActiveInjuries(true)
                const { db } = await import('@/lib/db-helpers')
                const injuries = await db.getActiveInjuries()
                setActiveInjuriesView(injuries || [])
              } catch (error) {
                console.error('Error loading active injuries:', error)
                setActiveInjuriesView([])
              } finally {
                setLoadingActiveInjuries(false)
              }
            }

            // Load fixture team selection for all roles except finance_admin
            if (profile.role !== 'finance_admin') {
              try {
                setLoadingPlayerFixture(true)
                const { db } = await import('@/lib/db-helpers')
                const teamSelection = await db.getLatestFixtureTeamSelection()
                setPlayerFixtureSelection(teamSelection)
              } catch (error) {
                console.error('Error loading fixture team selection:', error)
                setPlayerFixtureSelection(null)
              } finally {
                setLoadingPlayerFixture(false)
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
      } else if (user.role === 'physio') {
        router.push('/dashboard/physio')
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
          {/* Fixture Selection Notification for Player */}
          {playerFixtureSelection && playerFixtureSelection.isSelected && (
            <div className="bg-white rounded-card p-6 border-2 border-primary shadow-soft">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-club-gradient flex items-center justify-center">
                    <Trophy className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-xl font-bold text-neutral-text">You&apos;re Selected for the Next Fixture!</h3>
                    {playerFixtureSelection.selection.is_starting && !playerFixtureSelection.selection.is_substitute ? (
                      <span className="px-3 py-1 bg-success/10 text-success rounded-full text-sm font-medium">
                        Starting Lineup
                      </span>
                    ) : playerFixtureSelection.selection.is_substitute ? (
                      <span className="px-3 py-1 bg-warning/10 text-warning rounded-full text-sm font-medium">
                        Substitute
                      </span>
                    ) : null}
                  </div>
                  <div className="bg-neutral-light rounded-lg p-4 mb-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-neutral-medium uppercase mb-1">Match Date</p>
                        <p className="text-sm font-semibold text-neutral-text">
                          {new Date(playerFixtureSelection.match.match_date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-neutral-medium uppercase mb-1">Opponent</p>
                        <p className="text-sm font-semibold text-neutral-text">{playerFixtureSelection.match.opponent}</p>
                      </div>
                      {playerFixtureSelection.match.venue && (
                        <div>
                          <p className="text-xs font-semibold text-neutral-medium uppercase mb-1">Venue</p>
                          <p className="text-sm font-semibold text-neutral-text">{playerFixtureSelection.match.venue}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    {playerFixtureSelection.selection.jersey_number && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-medium">Jersey #</span>
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-bold">{playerFixtureSelection.selection.jersey_number}</span>
                      </div>
                    )}
                    {playerFixtureSelection.selection.position && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-medium">Position:</span>
                        <span className="px-3 py-1 bg-info/10 text-info rounded-full text-sm font-medium capitalize">{playerFixtureSelection.selection.position.replace('_', ' ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

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
            <div className="flex items-center mb-6">
              <Dumbbell className="w-6 h-6 text-primary mr-2" />
              <h3 className="text-xl font-bold text-neutral-text">Gym Metrics - Personal Bests</h3>
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
                No gym metrics recorded yet. Contact your coach or team manager to update your metrics.
              </div>
            )}
          </div>

          {/* Injury Information Section */}
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <div className="flex items-center mb-6">
              <HeartPulse className="w-6 h-6 text-secondary mr-2" />
              <h3 className="text-xl font-bold text-neutral-text">My Injury Information</h3>
            </div>
            
            {loadingInjuries ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : injuries.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success" />
                <p className="text-neutral-medium">No active injuries recorded. You&apos;re good to go!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {injuries.map((injury) => (
                  <div
                    key={injury.id}
                    className={`p-6 rounded-lg border-2 transition-all ${
                      injury.status === 'active'
                        ? 'border-secondary bg-red-50'
                        : injury.status === 'cleared' || injury.status === 'healed'
                        ? 'border-success bg-green-50'
                        : 'border-neutral-light bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <AlertCircle className={`w-6 h-6 ${
                          injury.status === 'active' ? 'text-secondary' : 'text-success'
                        }`} />
                        <div>
                          <h4 className="text-lg font-bold text-neutral-text">{injury.diagnosis}</h4>
                          <p className="text-sm text-neutral-medium">
                            Injured on {new Date(injury.injury_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        injury.status === 'active'
                          ? 'bg-secondary text-white'
                          : injury.status === 'cleared' || injury.status === 'healed'
                          ? 'bg-success text-white'
                          : 'bg-neutral-light text-neutral-medium'
                      }`}>
                        {injury.status === 'active' ? 'ACTIVE' : injury.status === 'cleared' ? 'CLEARED' : 'HEALED'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-xs font-semibold text-neutral-medium uppercase">Cause</label>
                        <p className="text-neutral-text mt-1">{injury.cause}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-neutral-medium uppercase">Diagnosis</label>
                        <p className="text-neutral-text mt-1 font-medium">{injury.diagnosis}</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-neutral-medium uppercase">Action Taken</label>
                        <p className="text-neutral-text mt-1">{injury.action_taken}</p>
                      </div>
                      {injury.further_treatment && (
                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-neutral-medium uppercase">Treatment Plan</label>
                          <p className="text-neutral-text mt-1">{injury.further_treatment}</p>
                        </div>
                      )}
                      {injury.medication && (
                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-neutral-medium uppercase flex items-center">
                            <Pill className="w-4 h-4 mr-1" />
                            Medication Plan
                          </label>
                          <p className="text-neutral-text mt-1 font-medium text-primary">{injury.medication}</p>
                        </div>
                      )}
                      {injury.return_to_training_date && (
                        <div>
                          <label className="text-xs font-semibold text-neutral-medium uppercase flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            Return to Training
                          </label>
                          <p className="text-neutral-text mt-1">
                            {new Date(injury.return_to_training_date).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      {injury.return_to_play_date && (
                        <div>
                          <label className="text-xs font-semibold text-neutral-medium uppercase flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            Return to Play
                          </label>
                          <p className="text-neutral-text mt-1">
                            {new Date(injury.return_to_play_date).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {injury.notes && (
                      <div className="mt-4 p-4 bg-white/80 rounded-lg border border-neutral-light">
                        <label className="text-xs font-semibold text-neutral-medium uppercase flex items-center mb-2">
                          <FileText className="w-4 h-4 mr-1" />
                          Physiotherapist Notes
                        </label>
                        <p className="text-neutral-text italic">{injury.notes}</p>
                      </div>
                    )}

                    {injury.status === 'active' && injury.return_to_play_date && (
                      <div className="mt-4 flex items-center space-x-2 text-sm">
                        <Clock className="w-4 h-4 text-neutral-medium" />
                        <span className="text-neutral-medium">
                          Estimated return to play: {new Date(injury.return_to_play_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Best Gym Metrics of the Week */}
          {user.role !== 'finance_admin' && user.role !== 'physio' && (
            <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
              <div className="flex items-center mb-6">
                <Trophy className="w-6 h-6 text-warning mr-2" />
                <h3 className="text-xl font-bold text-neutral-text">Best Gym Metrics of the Week</h3>
              </div>
              
              {loadingBestMetrics ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !bestGymMetrics ? (
                <div className="text-center py-8">
                  <Dumbbell className="w-12 h-12 mx-auto mb-4 text-neutral-light" />
                  <p className="text-neutral-medium">No gym metrics recorded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 border border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Bench Press</h4>
                      <Dumbbell className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-3xl font-bold text-neutral-text">
                      {bestGymMetrics.bestBenchPress?.value || 0} kg
                    </p>
                    <p className="text-sm text-primary font-medium mt-1">{bestGymMetrics.bestBenchPress?.playerName || 'N/A'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-lg p-6 border border-secondary/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Squat</h4>
                      <Dumbbell className="w-5 h-5 text-secondary" />
                    </div>
                    <p className="text-3xl font-bold text-neutral-text">
                      {bestGymMetrics.bestSquat?.value || 0} kg
                    </p>
                    <p className="text-sm text-secondary font-medium mt-1">{bestGymMetrics.bestSquat?.playerName || 'N/A'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-success/10 to-success/5 rounded-lg p-6 border border-success/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Deadlift</h4>
                      <Dumbbell className="w-5 h-5 text-success" />
                    </div>
                    <p className="text-3xl font-bold text-neutral-text">
                      {bestGymMetrics.bestDeadlift?.value || 0} kg
                    </p>
                    <p className="text-sm text-success font-medium mt-1">{bestGymMetrics.bestDeadlift?.playerName || 'N/A'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-info/10 to-info/5 rounded-lg p-6 border border-info/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-neutral-medium uppercase tracking-wide">Pull-ups</h4>
                      <Dumbbell className="w-5 h-5 text-info" />
                    </div>
                    <p className="text-3xl font-bold text-neutral-text">
                      {bestGymMetrics.bestPullUps?.value || 0} reps
                    </p>
                    <p className="text-sm text-info font-medium mt-1">{bestGymMetrics.bestPullUps?.playerName || 'N/A'}</p>
                  </div>
                </div>
              )}
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

          {/* Active Injuries View (Read-Only) */}
          {activeInjuriesView.length > 0 && (
            <div className="bg-white rounded-card border border-neutral-light shadow-soft">
              <div className="p-6 border-b border-neutral-light">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-neutral-text flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-secondary" />
                    Active Player Injuries
                  </h3>
                  <span className="text-sm text-neutral-medium">{activeInjuriesView.length} active injury{activeInjuriesView.length !== 1 ? 'ies' : ''}</span>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {activeInjuriesView.map((injury: any) => {
                    const playerName = injury.player?.name || 'Unknown Player'
                    const returnDate = injury.return_to_play_date || injury.return_to_training_date
                    return (
                      <div key={injury.id} className="border border-secondary/20 bg-secondary/5 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-neutral-text text-lg mb-1">{playerName}</h4>
                            <p className="text-sm text-neutral-medium">Injured on {new Date(injury.injury_date).toLocaleDateString()}</p>
                          </div>
                          <span className="px-3 py-1 bg-secondary text-white rounded-full text-xs font-medium">
                            ACTIVE
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs font-semibold text-neutral-medium uppercase mb-1">Cause</p>
                            <p className="text-sm text-neutral-text">{injury.cause}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-neutral-medium uppercase mb-1">Diagnosis</p>
                            <p className="text-sm text-neutral-text font-medium">{injury.diagnosis}</p>
                          </div>
                          {returnDate && (
                            <div>
                              <p className="text-xs font-semibold text-neutral-medium uppercase mb-1">Expected Return</p>
                              <p className="text-sm text-neutral-text font-medium">
                                {new Date(returnDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

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
