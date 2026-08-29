'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import BirthdayAlert from '@/components/BirthdayAlert'
import DisciplineAlerts from '@/components/DisciplineAlerts'
import { Activity, AlertCircle, CheckCircle, Clock, Plus, X, Save, Edit, Calendar, Pill, FileText, User, CalendarDays, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import RefreshButton from '@/components/RefreshButton'

interface Player {
  user_id: string
  name: string
  position?: string
  jersey_number?: number
}

interface Injury {
  id: string
  player_id: string
  player_name?: string
  injury_date: string
  cause: string
  diagnosis: string
  action_taken: string
  further_treatment?: string
  medication?: string
  return_to_training_date?: string
  return_to_play_date?: string
  status: 'active' | 'cleared' | 'healed'
  cleared_at?: string
  cleared_by?: string
  notes?: string
  created_at: string
  healing_duration?: number
}

interface InjuryForm {
  player_id: string
  injury_date: string
  cause: string
  diagnosis: string
  action_taken: string
  further_treatment: string
  medication: string
  return_to_training_date: string
  return_to_play_date: string
  notes: string
}

export default function PhysioDashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<Player[]>([])
  const [injuries, setInjuries] = useState<Injury[]>([])
  const [trainingSessionsAttended, setTrainingSessionsAttended] = useState(0)
  const [gamesAttended, setGamesAttended] = useState(0)
  const [showInjuryForm, setShowInjuryForm] = useState(false)
  const [editingInjury, setEditingInjury] = useState<Injury | null>(null)
  const [injuryForm, setInjuryForm] = useState<InjuryForm>({
    player_id: '',
    injury_date: new Date().toISOString().split('T')[0],
    cause: '',
    diagnosis: '',
    action_taken: '',
    further_treatment: '',
    medication: '',
    return_to_training_date: '',
    return_to_play_date: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'cleared' | 'healed'>('all')
  const [teamSelection, setTeamSelection] = useState<any>(null)
  const [loadingTeamSelection, setLoadingTeamSelection] = useState(false)
  const [sendInjuryMessage, setSendInjuryMessage] = useState(false)

  const loadInjuries = async () => {
    const supabase = createClient()
    
    // First, get all injuries
    const { data: injuriesData, error } = await supabase
      .from('injuries')
      .select('*')
      .order('injury_date', { ascending: false })

    if (error) {
      console.error('Error loading injuries:', error)
      return
    }

    if (injuriesData && injuriesData.length > 0) {
      // Get all unique player IDs
      const playerIds = [...new Set(injuriesData.map((injury: any) => injury.player_id).filter(Boolean))]
      
      // Fetch player names using service role to bypass RLS
      let playerNamesMap: Record<string, string> = {}
      
      if (playerIds.length > 0) {
        try {
          // Use API route to fetch players (bypasses RLS)
          const playersResponse = await fetch('/api/admin/players', { cache: 'no-store' })
          if (playersResponse.ok) {
            const playersData = await playersResponse.json()
            if (playersData.players && playersData.players.length > 0) {
              playersData.players.forEach((player: any) => {
                playerNamesMap[player.user_id] = player.name
              })
            }
          }
        } catch (apiError) {
          console.error('Error fetching players from API:', apiError)
          // Fallback: try direct query with service role
          try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
            
            if (supabaseUrl && supabaseServiceKey) {
              const { createClient: createServiceClient } = await import('@supabase/supabase-js')
              const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
                auth: {
                  autoRefreshToken: false,
                  persistSession: false
                }
              })
              
              const { data: playerProfiles } = await supabaseAdmin
                .from('user_profiles')
                .select('user_id, name')
                .in('user_id', playerIds)
              
              if (playerProfiles) {
                playerProfiles.forEach((profile: any) => {
                  playerNamesMap[profile.user_id] = profile.name
                })
              }
            }
          } catch (fallbackError) {
            console.error('Error in fallback player name fetch:', fallbackError)
          }
        }
      }

      // Map injuries with player names
      const injuriesWithDetails = injuriesData.map((injury: any) => {
        const healingDuration = injury.return_to_play_date && injury.injury_date
          ? Math.ceil((new Date(injury.return_to_play_date).getTime() - new Date(injury.injury_date).getTime()) / (1000 * 60 * 60 * 24))
          : null

        return {
          ...injury,
          player_name: playerNamesMap[injury.player_id] || 'Unknown Player',
          healing_duration: healingDuration,
        } as Injury
      })
      setInjuries(injuriesWithDetails)
    } else {
      setInjuries([])
    }
  }

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', authUser.id)
      .single()

    if (profile) {
      setUser(profile)

          // Fetch players using API route to get all registered players
          try {
            const playersResponse = await fetch('/api/admin/players', { cache: 'no-store' })
            if (playersResponse.ok) {
              const playersData = await playersResponse.json()
              if (playersData.players && playersData.players.length > 0) {
                const formattedPlayers = playersData.players.map((p: any) => ({
                  user_id: p.user_id,
                  name: p.name,
                  position: p.players?.position || p.position,
                  jersey_number: p.players?.jersey_number || p.jersey_number,
                } as Player))
                setPlayers(formattedPlayers)
                console.log(`Loaded ${formattedPlayers.length} players for physio`)
              } else {
                setPlayers([])
              }
            } else {
              console.error('Error fetching players from API, trying direct query')
              // Fallback to direct query
              const { data: playersData } = await supabase
                .from('user_profiles')
                .select('user_id, name')
                .eq('role', 'player')
                .order('name', { ascending: true })

              if (playersData) {
                const playersWithDetails = await Promise.all(
                  playersData.map(async (p) => {
                    const { data: playerData } = await supabase
                      .from('players')
                      .select('position, jersey_number')
                      .eq('user_id', p.user_id)
                      .single()
                    
                    return {
                      user_id: p.user_id,
                      name: p.name,
                      position: playerData?.position,
                      jersey_number: playerData?.jersey_number,
                    } as Player
                  })
                )
                setPlayers(playersWithDetails)
              }
            }
          } catch (error) {
            console.error('Error loading players:', error)
            // Fallback to direct query
            try {
              const { data: playersData } = await supabase
                .from('user_profiles')
                .select('user_id, name')
                .eq('role', 'player')
                .order('name', { ascending: true })

              if (playersData) {
                const playersWithDetails = await Promise.all(
                  playersData.map(async (p) => {
                    const { data: playerData } = await supabase
                      .from('players')
                      .select('position, jersey_number')
                      .eq('user_id', p.user_id)
                      .single()
                    
                    return {
                      user_id: p.user_id,
                      name: p.name,
                      position: playerData?.position,
                      jersey_number: playerData?.jersey_number,
                    } as Player
                  })
                )
                setPlayers(playersWithDetails)
              }
            } catch (fallbackError) {
              console.error('Fallback query also failed:', fallbackError)
              setPlayers([])
            }
          }

      // Fetch injuries
      await loadInjuries()

      // Load training sessions and games attended
      try {
        const { db } = await import('@/lib/db-helpers')
        const sessionsCount = await db.getTotalTrainingSessions()
        setTrainingSessionsAttended(sessionsCount)
        const { count: attendedMatches } = await supabase
          .from('match_staff_attendance')
          .select('match_id, matches!inner(status)', { count: 'exact', head: true })
          .eq('staff_id', authUser.id)
          .eq('attendance_status', 'P')
          .eq('matches.status', 'played')
        setGamesAttended(attendedMatches || 0)
      } catch (error) {
        console.error('Error loading physio stats:', error)
      }

      // Load team selection for upcoming fixture
      try {
        setLoadingTeamSelection(true)
        const matchesResponse = await fetch('/api/fixtures', { cache: 'no-store' })
        if (matchesResponse.ok) {
          const matchesData = await matchesResponse.json()
          console.log('Physio dashboard - Matches data:', matchesData)
          if (matchesData.fixtures && matchesData.fixtures.length > 0) {
            const latestMatch = matchesData.fixtures[0]
            console.log('Physio dashboard - Latest match:', latestMatch)
            const selectionResponse = await fetch(`/api/fixtures/team-selection?matchId=${latestMatch.id}`, { cache: 'no-store' })
            if (selectionResponse.ok) {
              const selectionData = await selectionResponse.json()
              console.log('Physio dashboard - Team selection data:', selectionData)
              // Ensure the data structure matches what the UI expects
              if (selectionData.match && (selectionData.starting || selectionData.substitutes)) {
                setTeamSelection(selectionData)
              } else if (selectionData.selections && selectionData.selections.length > 0) {
                // Fallback: if API returns old format, format it
                setTeamSelection({
                  match: latestMatch,
                  starting: selectionData.selections.filter((s: any) => s.is_starting && !s.is_substitute),
                  substitutes: selectionData.selections.filter((s: any) => s.is_substitute),
                })
              } else {
                console.log('Physio dashboard - No team selection found for match')
                setTeamSelection(null)
              }
            } else {
              const errorData = await selectionResponse.json().catch(() => ({ error: 'Unknown error' }))
              console.error('Physio dashboard - Team selection API error:', selectionResponse.status, errorData)
              setTeamSelection(null)
            }
          } else {
            console.log('Physio dashboard - No upcoming fixtures found')
            setTeamSelection(null)
          }
        } else {
          const errorData = await matchesResponse.json().catch(() => ({ error: 'Unknown error' }))
          console.error('Physio dashboard - Fixtures API error:', matchesResponse.status, errorData)
          setTeamSelection(null)
        }
      } catch (error) {
        console.error('Physio dashboard - Error loading team selection:', error)
        setTeamSelection(null)
      } finally {
        setLoadingTeamSelection(false)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSaveInjury = async () => {
    if (!injuryForm.player_id || !injuryForm.injury_date || !injuryForm.cause || !injuryForm.diagnosis || !injuryForm.action_taken) {
      alert('Please fill in all required fields (Player, Date, Cause, Diagnosis, Action Taken)')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert('Please log in to save injuries')
        return
      }

      const injuryData = {
        player_id: injuryForm.player_id,
        injury_date: injuryForm.injury_date,
        cause: injuryForm.cause,
        diagnosis: injuryForm.diagnosis,
        action_taken: injuryForm.action_taken,
        further_treatment: injuryForm.further_treatment || null,
        medication: injuryForm.medication || null,
        return_to_training_date: injuryForm.return_to_training_date || null,
        return_to_play_date: injuryForm.return_to_play_date || null,
        notes: injuryForm.notes || null,
        created_by: authUser.id,
      }

      if (editingInjury) {
        const { error } = await supabase
          .from('injuries')
          .update(injuryData)
          .eq('id', editingInjury.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('injuries')
          .insert(injuryData)

        if (error) throw error
      }

      await loadInjuries()
      
      // Send message to player if checkbox is checked
      if (sendInjuryMessage && injuryForm.player_id) {
        try {
          const playerName = players.find(p => p.user_id === injuryForm.player_id)?.name || 'Player'
          const injuryDate = new Date(injuryForm.injury_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
          
          const messageSubject = `Injury Recorded - ${injuryDate}`
          let messageBody = `Dear ${playerName},\n\nAn injury has been recorded for you with the following details:\n\n`
          messageBody += `Injury Date: ${injuryDate}\n`
          messageBody += `Cause: ${injuryForm.cause}\n`
          messageBody += `Diagnosis: ${injuryForm.diagnosis}\n`
          messageBody += `Action Taken: ${injuryForm.action_taken}\n`
          
          if (injuryForm.further_treatment) {
            messageBody += `Further Treatment: ${injuryForm.further_treatment}\n`
          }
          
          if (injuryForm.medication) {
            messageBody += `Medication: ${injuryForm.medication}\n`
          }
          
          if (injuryForm.return_to_training_date) {
            messageBody += `Return to Training: ${new Date(injuryForm.return_to_training_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}\n`
          }
          
          if (injuryForm.return_to_play_date) {
            messageBody += `Return to Play: ${new Date(injuryForm.return_to_play_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}\n`
          }
          
          if (injuryForm.notes) {
            messageBody += `\nAdditional Notes: ${injuryForm.notes}\n`
          }
          
          messageBody += `\nPlease follow the treatment plan and recovery guidelines provided. If you have any questions or concerns, please contact the physiotherapy team.`

          const { data: newMessage, error: messageError } = await supabase
            .from('messages')
            .insert({
              sender_id: authUser.id,
              recipient_id: injuryForm.player_id,
              recipient_role: 'player',
              subject: messageSubject,
              message: messageBody,
            })
            .select()
            .single()

          if (messageError) {
            console.error('Error sending injury message:', messageError)
          } else {
            // Create notification for player
            try {
              const { db } = await import('@/lib/db-helpers')
              await db.createNotification({
                user_id: injuryForm.player_id,
                title: 'Injury Recorded',
                message: `An injury has been recorded for you. Check your messages for details.`,
                type: 'info',
                action_url: '/messages',
                reference_id: newMessage.id,
                reference_type: 'message',
              })
            } catch (notifError) {
              console.error('Error creating notification:', notifError)
            }
          }
        } catch (messageError) {
          console.error('Error sending injury message to player:', messageError)
          // Don't fail the injury save if message fails
        }
      }
      
      alert('Injury saved successfully!')

      // Reset form
      setInjuryForm({
        player_id: '',
        injury_date: new Date().toISOString().split('T')[0],
        cause: '',
        diagnosis: '',
        action_taken: '',
        further_treatment: '',
        medication: '',
        return_to_training_date: '',
        return_to_play_date: '',
        notes: '',
      })
      setSendInjuryMessage(false)
      setShowInjuryForm(false)
      setEditingInjury(null)
    } catch (error: any) {
      console.error('Error saving injury:', error)
      alert(`Error saving injury: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleClearInjury = async (injuryId: string) => {
    if (!confirm('Are you sure you want to clear this injury?')) return

    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert('Please log in to clear injuries')
        return
      }

      const { error } = await supabase
        .from('injuries')
        .update({
          status: 'cleared',
          cleared_at: new Date().toISOString(),
          cleared_by: authUser.id,
        })
        .eq('id', injuryId)

      if (error) throw error

      await loadInjuries()
      alert('Injury cleared successfully!')
    } catch (error: any) {
      console.error('Error clearing injury:', error)
      alert(`Error clearing injury: ${error.message}`)
    }
  }

  const handleEditInjury = (injury: Injury) => {
    setEditingInjury(injury)
    setInjuryForm({
      player_id: injury.player_id,
      injury_date: injury.injury_date,
      cause: injury.cause,
      diagnosis: injury.diagnosis,
      action_taken: injury.action_taken,
      further_treatment: injury.further_treatment || '',
      medication: injury.medication || '',
      return_to_training_date: injury.return_to_training_date || '',
      return_to_play_date: injury.return_to_play_date || '',
      notes: injury.notes || '',
    })
    setShowInjuryForm(true)
  }

  const activeInjuries = injuries.filter(i => i.status === 'active')
  const clearedInjuries = injuries.filter(i => i.status === 'cleared' || i.status === 'healed')
  const filteredInjuries = filterStatus === 'all' 
    ? injuries 
    : injuries.filter(i => i.status === filterStatus)

  const averageHealingTime = clearedInjuries.length > 0
    ? Math.round(clearedInjuries.reduce((sum, i) => sum + (i.healing_duration || 0), 0) / clearedInjuries.length)
    : 0

  if (loading) {
    return (
      <Layout pageTitle="Physio Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout pageTitle="Physio Dashboard">
      <div className="space-y-6">
        <BirthdayAlert />
        {/* If the physio was marked absent on a match day, the alert
            shows up here too — first-person copy from notify-staff-absence. */}
        <DisciplineAlerts />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[20px] font-medium text-tm-text-1">Injury management</h1>
            <p className="mt-[2px] text-[13px] text-tm-text-3">Manage injuries and player health</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <RefreshButton onRefresh={loadData} />
            <button
              onClick={() => {
                setEditingInjury(null)
                setInjuryForm({
                  player_id: '',
                  injury_date: new Date().toISOString().split('T')[0],
                  cause: '',
                  diagnosis: '',
                  action_taken: '',
                  further_treatment: '',
                  medication: '',
                  return_to_training_date: '',
                  return_to_play_date: '',
                  notes: '',
                })
                setShowInjuryForm(true)
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-primary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Record New Injury</span>
            </button>
          </div>
        </div>

        {/* Upcoming Fixture Team Selection */}
        {teamSelection && teamSelection.match && (
          <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft">
            <div className="p-6 border-b border-tm-border">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-tm-text-1 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Upcoming Fixture Team Selection
                </h3>
                <Link
                  href="/fixtures"
                  className="text-primary hover:underline text-sm font-medium"
                >
                  View All Fixtures →
                </Link>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <h4 className="font-semibold text-tm-text-1 mb-2">
                  {new Date(teamSelection.match.match_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })} vs {teamSelection.match.opponent}
                </h4>
                {teamSelection.match.venue && (
                  <p className="text-sm text-tm-text-3">Venue: {teamSelection.match.venue}</p>
                )}
              </div>
              
              {teamSelection.starting && teamSelection.starting.length > 0 && (
                <div className="mb-4">
                  <h5 className="font-semibold text-tm-text-1 mb-2">Starting Lineup ({teamSelection.starting.length})</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {teamSelection.starting.map((selection: any) => (
                      <div key={selection.id} className="bg-success/5 border border-success/20 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-tm-text-1">{selection.player?.name || 'Unknown'}</span>
                          {selection.jersey_number && (
                            <span className="bg-success/20 text-success px-2 py-1 rounded text-xs font-bold">#{selection.jersey_number}</span>
                          )}
                        </div>
                        {selection.position && (
                          <p className="text-xs text-tm-text-3 mt-1 capitalize">{selection.position.replace(/_/g, ' ')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {teamSelection.substitutes && teamSelection.substitutes.length > 0 && (
                <div>
                  <h5 className="font-semibold text-tm-text-1 mb-2">Substitutes ({teamSelection.substitutes.length})</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {teamSelection.substitutes.map((selection: any) => (
                      <div key={selection.id} className="bg-warning/5 border border-warning/20 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-tm-text-1">{selection.player?.name || 'Unknown'}</span>
                          {selection.jersey_number && (
                            <span className="bg-warning/20 text-warning px-2 py-1 rounded text-xs font-bold">#{selection.jersey_number}</span>
                          )}
                        </div>
                        {selection.position && (
                          <p className="text-xs text-tm-text-3 mt-1 capitalize">{selection.position.replace(/_/g, ' ')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!teamSelection.starting || teamSelection.starting.length === 0) && 
               (!teamSelection.substitutes || teamSelection.substitutes.length === 0) && (
                <p className="text-tm-text-3 text-center py-4">No team selection made yet for this fixture.</p>
              )}
            </div>
          </div>
        )}

        {/* Show loading state */}
        {loadingTeamSelection && (
          <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft p-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </div>
        )}

        {/* Show message when no team selection exists */}
        {!loadingTeamSelection && !teamSelection && (
          <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft p-6">
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-tm-text-3" />
              <p className="text-tm-text-3">No upcoming fixture team selection available</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
          <StatCard
            title="Training Sessions Attended"
            value={trainingSessionsAttended}
            icon={CalendarDays}
            iconColor="bg-primary"
            iconTextColor="text-tm-on-secondary"
            description="Total training sessions"
            href="/training"
          />
          <StatCard
            title="Games Attended"
            value={gamesAttended}
            icon={Trophy}
            iconColor="bg-secondary"
            iconTextColor="text-tm-on-secondary"
            description="Total matches attended"
            href="/fixtures"
          />
          <StatCard
            title="Active Injuries"
            value={activeInjuries.length}
            icon={AlertCircle}
            iconColor="bg-warning"
            iconTextColor="text-white"
            onClick={() => { setFilterStatus('active'); document.getElementById('injury-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
          />
          <StatCard
            title="Cleared Injuries"
            value={clearedInjuries.length}
            icon={CheckCircle}
            iconColor="bg-success"
            iconTextColor="text-white"
            onClick={() => { setFilterStatus('cleared'); document.getElementById('injury-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
          />
        </div>

        <div id="injury-records" className="bg-tm-surface rounded-card border border-tm-border shadow-soft p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-tm-text-1">Injury Records</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'all' 
                    ? 'bg-primary text-tm-on-secondary' 
                    : 'bg-tm-surface-hover text-tm-text-3 hover:bg-tm-surface-hover/80'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'active' 
                    ? 'bg-secondary text-tm-on-secondary' 
                    : 'bg-tm-surface-hover text-tm-text-3 hover:bg-tm-surface-hover/80'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilterStatus('cleared')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'cleared' 
                    ? 'bg-success text-white' 
                    : 'bg-tm-surface-hover text-tm-text-3 hover:bg-tm-surface-hover/80'
                }`}
              >
                Cleared
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredInjuries.length === 0 ? (
              <div className="text-center py-12 text-tm-text-3">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-tm-text-3" />
                <p>No injuries found</p>
              </div>
            ) : (
              filteredInjuries.map((injury) => (
                <div
                  key={injury.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    injury.status === 'active'
                      ? 'border-secondary bg-[#E05757]/10'
                      : injury.status === 'cleared'
                      ? 'border-success bg-success/10'
                      : 'border-tm-border bg-tm-surface'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <User className="w-5 h-5 text-tm-text-3 flex-shrink-0" />
                        <h3 className="text-lg font-bold text-tm-text-1 break-words">{injury.player_name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                          injury.status === 'active'
                            ? 'bg-secondary text-tm-on-secondary'
                            : injury.status === 'cleared'
                            ? 'bg-success text-white'
                            : 'bg-tm-surface-hover text-tm-text-3'
                        }`}>
                          {injury.status.toUpperCase()}
                        </span>
                        {injury.healing_duration && (
                          <span className="text-sm text-tm-text-3 whitespace-nowrap inline-flex items-center">
                            <Clock className="w-4 h-4 inline mr-1" />
                            {injury.healing_duration} days
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="text-xs font-semibold text-tm-text-3 uppercase">Date</label>
                          <p className="text-tm-text-1">{new Date(injury.injury_date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-tm-text-3 uppercase">Cause</label>
                          <p className="text-tm-text-1">{injury.cause}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-tm-text-3 uppercase">Diagnosis</label>
                          <p className="text-tm-text-1">{injury.diagnosis}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-tm-text-3 uppercase">Action Taken</label>
                          <p className="text-tm-text-1">{injury.action_taken}</p>
                        </div>
                        {injury.further_treatment && (
                          <div>
                            <label className="text-xs font-semibold text-tm-text-3 uppercase">Further Treatment</label>
                            <p className="text-tm-text-1">{injury.further_treatment}</p>
                          </div>
                        )}
                        {injury.medication && (
                          <div>
                            <label className="text-xs font-semibold text-tm-text-3 uppercase flex items-center">
                              <Pill className="w-3 h-3 mr-1" />
                              Medication
                            </label>
                            <p className="text-tm-text-1">{injury.medication}</p>
                          </div>
                        )}
                        {injury.return_to_training_date && (
                          <div>
                            <label className="text-xs font-semibold text-tm-text-3 uppercase flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              Return to Training
                            </label>
                            <p className="text-tm-text-1">{new Date(injury.return_to_training_date).toLocaleDateString()}</p>
                          </div>
                        )}
                        {injury.return_to_play_date && (
                          <div>
                            <label className="text-xs font-semibold text-tm-text-3 uppercase flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              Return to Play
                            </label>
                            <p className="text-tm-text-1">{new Date(injury.return_to_play_date).toLocaleDateString()}</p>
                          </div>
                        )}
                        {injury.notes && (
                          <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-tm-text-3 uppercase flex items-center">
                              <FileText className="w-3 h-3 mr-1" />
                              Notes
                            </label>
                            <p className="text-tm-text-1">{injury.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {injury.status === 'active' && (
                      <div className="flex items-center gap-2 flex-shrink-0 sm:ml-4">
                        <button
                          onClick={() => handleEditInjury(injury)}
                          className="p-2 text-info hover:bg-info/10 rounded-lg transition-colors"
                          title="Edit Injury"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleClearInjury(injury.id)}
                          className="p-2 text-success hover:bg-success/10 rounded-lg transition-colors"
                          title="Clear Injury"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showInjuryForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-tm-surface rounded-card shadow-soft max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-tm-border">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-tm-text-1">
                  {editingInjury ? 'Edit Injury' : 'Record New Injury'}
                </h3>
                <button
                  onClick={() => {
                    setShowInjuryForm(false)
                    setEditingInjury(null)
                  }}
                  className="text-tm-text-3 hover:text-tm-text-1 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-tm-text-3 mb-1">
                    Player <span className="text-secondary">*</span>
                  </label>
                  <select
                    value={injuryForm.player_id}
                    onChange={(e) => setInjuryForm({ ...injuryForm, player_id: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Select a player</option>
                    {players.map((player) => (
                      <option key={player.user_id} value={player.user_id}>
                        {player.name} {player.jersey_number ? `#${player.jersey_number}` : ''} {player.position ? `- ${player.position}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-3 mb-1">
                    Injury Date <span className="text-secondary">*</span>
                  </label>
                  <input
                    type="date"
                    value={injuryForm.injury_date}
                    onChange={(e) => setInjuryForm({ ...injuryForm, injury_date: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-tm-text-3 mb-1">
                    Cause <span className="text-secondary">*</span>
                  </label>
                  <input
                    type="text"
                    value={injuryForm.cause}
                    onChange={(e) => setInjuryForm({ ...injuryForm, cause: e.target.value })}
                    placeholder="e.g., Training collision, Match injury, etc."
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-tm-text-3 mb-1">
                    Diagnosis <span className="text-secondary">*</span>
                  </label>
                  <input
                    type="text"
                    value={injuryForm.diagnosis}
                    onChange={(e) => setInjuryForm({ ...injuryForm, diagnosis: e.target.value })}
                    placeholder="e.g., Sprained ankle, Shoulder dislocation, etc."
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-tm-text-3 mb-1">
                    Action Taken <span className="text-secondary">*</span>
                  </label>
                  <textarea
                    value={injuryForm.action_taken}
                    onChange={(e) => setInjuryForm({ ...injuryForm, action_taken: e.target.value })}
                    placeholder="Describe the immediate action taken"
                    rows={3}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-tm-text-3 mb-1">
                    Further Treatment
                  </label>
                  <textarea
                    value={injuryForm.further_treatment}
                    onChange={(e) => setInjuryForm({ ...injuryForm, further_treatment: e.target.value })}
                    placeholder="Describe ongoing treatment plan"
                    rows={2}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-tm-text-3 mb-1 flex items-center">
                    <Pill className="w-4 h-4 mr-1" />
                    Medication
                  </label>
                  <input
                    type="text"
                    value={injuryForm.medication}
                    onChange={(e) => setInjuryForm({ ...injuryForm, medication: e.target.value })}
                    placeholder="e.g., Ibuprofen 400mg twice daily"
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-3 mb-1 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Return to Training Date
                  </label>
                  <input
                    type="date"
                    value={injuryForm.return_to_training_date}
                    onChange={(e) => setInjuryForm({ ...injuryForm, return_to_training_date: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-tm-text-3 mb-1 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Return to Play Date
                  </label>
                  <input
                    type="date"
                    value={injuryForm.return_to_play_date}
                    onChange={(e) => setInjuryForm({ ...injuryForm, return_to_play_date: e.target.value })}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-tm-text-3 mb-1 flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    Notes
                  </label>
                  <textarea
                    value={injuryForm.notes}
                    onChange={(e) => setInjuryForm({ ...injuryForm, notes: e.target.value })}
                    placeholder="Additional notes or observations"
                    rows={3}
                    className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="md:col-span-2 mt-4 p-4 bg-tm-surface-hover border border-tm-border rounded-lg">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendInjuryMessage}
                      onChange={(e) => setSendInjuryMessage(e.target.checked)}
                      disabled={!injuryForm.player_id}
                      className="w-4 h-4 text-primary border-tm-border rounded focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm text-tm-text-1">
                      <strong>Send complete injury information to player via message</strong>
                      {!injuryForm.player_id && (
                        <span className="block text-xs text-tm-text-3 mt-1">(Select a player first)</span>
                      )}
                    </span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-tm-border flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowInjuryForm(false)
                  setEditingInjury(null)
                  setSendInjuryMessage(false)
                }}
                className="px-6 py-2 border border-tm-border rounded-[6px] font-semibold text-tm-text-1 hover:bg-tm-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInjury}
                disabled={saving}
                className="px-6 py-2 bg-primary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>Save Injury</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}




