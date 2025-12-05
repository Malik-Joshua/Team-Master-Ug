'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { Activity, AlertCircle, CheckCircle, Clock, Plus, X, Save, Edit, Calendar, Pill, FileText, User, CalendarDays, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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

  useEffect(() => {
    const loadData = async () => {
      // Check for dev mode
      if (typeof window !== 'undefined') {
        const devUser = localStorage.getItem('dev_user')
        if (devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            
            // Mock players for dev mode
            setPlayers([
              { user_id: '1', name: 'John Doe', position: 'Fly Half', jersey_number: 10 },
              { user_id: '2', name: 'Jane Smith', position: 'Prop', jersey_number: 1 },
              { user_id: '3', name: 'Mike Johnson', position: 'Wing', jersey_number: 14 },
            ])
            
            // Mock injuries for dev mode
            setInjuries([
              {
                id: '1',
                player_id: '1',
                player_name: 'John Doe',
                injury_date: '2024-12-01',
                cause: 'Training collision',
                diagnosis: 'Sprained ankle',
                action_taken: 'RICE treatment, compression bandage',
                further_treatment: 'Physiotherapy sessions 3x/week',
                medication: 'Ibuprofen 400mg twice daily',
                return_to_training_date: '2024-12-15',
                return_to_play_date: '2024-12-22',
                status: 'active',
                notes: 'Player responding well to treatment',
                created_at: '2024-12-01T10:00:00Z',
                healing_duration: 21,
              },
              {
                id: '2',
                player_id: '2',
                player_name: 'Jane Smith',
                injury_date: '2024-11-15',
                cause: 'Match injury',
                diagnosis: 'Shoulder dislocation',
                action_taken: 'Immediate reduction, sling applied',
                further_treatment: 'Rest and rehabilitation',
                medication: 'Paracetamol 500mg as needed',
                return_to_training_date: '2024-12-10',
                return_to_play_date: '2024-12-20',
                status: 'cleared',
                cleared_at: '2024-12-20T10:00:00Z',
                notes: 'Full recovery achieved',
                created_at: '2024-11-15T14:00:00Z',
                healing_duration: 35,
              },
            ])
            // Mock stats for dev mode
            setTrainingSessionsAttended(18)
            setGamesAttended(12)
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

          // Fetch players
          const { data: playersData } = await supabase
            .from('user_profiles')
            .select('user_id, name')
            .eq('role', 'player')
            .order('name', { ascending: true })

          if (playersData) {
            // Fetch player details
            const playersWithDetails = await Promise.all(
              playersData.map(async (p) => {
                const { data: playerData } = await supabase
                  .from('players')
                  .select('position, jersey_number')
                  .eq('user_id', p.user_id)
                  .single()
                
                return {
                  ...p,
                  position: playerData?.position,
                  jersey_number: playerData?.jersey_number,
                } as Player
              })
            )
            setPlayers(playersWithDetails)
          }

          // Fetch injuries
          await loadInjuries()

          // Load training sessions and games attended
          try {
            const { db } = await import('@/lib/db-helpers')
            const sessionsCount = await db.getTotalTrainingSessions()
            const matchesCount = await db.getTotalMatches()
            setTrainingSessionsAttended(sessionsCount)
            setGamesAttended(matchesCount)
          } catch (error) {
            console.error('Error loading physio stats:', error)
          }
        }
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const loadInjuries = async () => {
    const supabase = createClient()
    const { data: injuriesData, error } = await supabase
      .from('injuries')
      .select(`
        *,
        player:user_profiles!injuries_player_id_fkey(name)
      `)
      .order('injury_date', { ascending: false })

    if (error) {
      console.error('Error loading injuries:', error)
      return
    }

    if (injuriesData) {
      const injuriesWithDetails = injuriesData.map((injury: any) => {
        const healingDuration = injury.return_to_play_date && injury.injury_date
          ? Math.ceil((new Date(injury.return_to_play_date).getTime() - new Date(injury.injury_date).getTime()) / (1000 * 60 * 60 * 24))
          : null

        return {
          ...injury,
          player_name: injury.player?.name || 'Unknown Player',
          healing_duration: healingDuration,
        } as Injury
      })
      setInjuries(injuriesWithDetails)
    }
  }

  const handleSaveInjury = async () => {
    if (!injuryForm.player_id || !injuryForm.injury_date || !injuryForm.cause || !injuryForm.diagnosis || !injuryForm.action_taken) {
      alert('Please fill in all required fields (Player, Date, Cause, Diagnosis, Action Taken)')
      return
    }

    setSaving(true)
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
        // Dev mode
        const newInjury: Injury = {
          id: editingInjury?.id || `injury-${Date.now()}`,
          player_id: injuryForm.player_id,
          player_name: players.find(p => p.user_id === injuryForm.player_id)?.name,
          injury_date: injuryForm.injury_date,
          cause: injuryForm.cause,
          diagnosis: injuryForm.diagnosis,
          action_taken: injuryForm.action_taken,
          further_treatment: injuryForm.further_treatment || undefined,
          medication: injuryForm.medication || undefined,
          return_to_training_date: injuryForm.return_to_training_date || undefined,
          return_to_play_date: injuryForm.return_to_play_date || undefined,
          status: editingInjury?.status || 'active',
          notes: injuryForm.notes || undefined,
          created_at: editingInjury?.created_at || new Date().toISOString(),
        }

        if (editingInjury) {
          setInjuries(injuries.map(i => i.id === editingInjury.id ? newInjury : i))
        } else {
          setInjuries([newInjury, ...injuries])
        }
        alert('Injury saved! (Dev Mode)')
      } else {
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
        alert('Injury saved successfully!')
      }

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
      if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
        // Dev mode
        setInjuries(injuries.map(i => 
          i.id === injuryId 
            ? { ...i, status: 'cleared' as const, cleared_at: new Date().toISOString() }
            : i
        ))
        alert('Injury cleared! (Dev Mode)')
      } else {
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
      }
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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-neutral-text">Injury Management</h1>
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
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-button font-semibold hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Record New Injury</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard 
            title="Training Sessions Attended" 
            value={trainingSessionsAttended} 
            icon={CalendarDays} 
            iconColor="bg-primary" 
            description="Total training sessions"
          />
          <StatCard 
            title="Games Attended" 
            value={gamesAttended} 
            icon={Trophy} 
            iconColor="bg-secondary" 
            description="Total matches attended"
          />
          <StatCard 
            title="Active Injuries" 
            value={activeInjuries.length} 
            icon={AlertCircle} 
            iconColor="bg-warning" 
          />
          <StatCard 
            title="Cleared Injuries" 
            value={clearedInjuries.length} 
            icon={CheckCircle} 
            iconColor="bg-success" 
          />
        </div>

        <div className="bg-white rounded-card border border-neutral-light shadow-soft p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-neutral-text">Injury Records</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'all' 
                    ? 'bg-primary text-white' 
                    : 'bg-neutral-light text-neutral-medium hover:bg-neutral-light/80'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'active' 
                    ? 'bg-secondary text-white' 
                    : 'bg-neutral-light text-neutral-medium hover:bg-neutral-light/80'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilterStatus('cleared')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'cleared' 
                    ? 'bg-success text-white' 
                    : 'bg-neutral-light text-neutral-medium hover:bg-neutral-light/80'
                }`}
              >
                Cleared
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredInjuries.length === 0 ? (
              <div className="text-center py-12 text-neutral-medium">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-neutral-light" />
                <p>No injuries found</p>
              </div>
            ) : (
              filteredInjuries.map((injury) => (
                <div
                  key={injury.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    injury.status === 'active'
                      ? 'border-secondary bg-red-50'
                      : injury.status === 'cleared'
                      ? 'border-success bg-green-50'
                      : 'border-neutral-light bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <User className="w-5 h-5 text-neutral-medium" />
                        <h3 className="text-lg font-bold text-neutral-text">{injury.player_name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          injury.status === 'active'
                            ? 'bg-secondary text-white'
                            : injury.status === 'cleared'
                            ? 'bg-success text-white'
                            : 'bg-neutral-light text-neutral-medium'
                        }`}>
                          {injury.status.toUpperCase()}
                        </span>
                        {injury.healing_duration && (
                          <span className="text-sm text-neutral-medium">
                            <Clock className="w-4 h-4 inline mr-1" />
                            {injury.healing_duration} days
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="text-xs font-semibold text-neutral-medium uppercase">Date</label>
                          <p className="text-neutral-text">{new Date(injury.injury_date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-neutral-medium uppercase">Cause</label>
                          <p className="text-neutral-text">{injury.cause}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-neutral-medium uppercase">Diagnosis</label>
                          <p className="text-neutral-text">{injury.diagnosis}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-neutral-medium uppercase">Action Taken</label>
                          <p className="text-neutral-text">{injury.action_taken}</p>
                        </div>
                        {injury.further_treatment && (
                          <div>
                            <label className="text-xs font-semibold text-neutral-medium uppercase">Further Treatment</label>
                            <p className="text-neutral-text">{injury.further_treatment}</p>
                          </div>
                        )}
                        {injury.medication && (
                          <div>
                            <label className="text-xs font-semibold text-neutral-medium uppercase flex items-center">
                              <Pill className="w-3 h-3 mr-1" />
                              Medication
                            </label>
                            <p className="text-neutral-text">{injury.medication}</p>
                          </div>
                        )}
                        {injury.return_to_training_date && (
                          <div>
                            <label className="text-xs font-semibold text-neutral-medium uppercase flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              Return to Training
                            </label>
                            <p className="text-neutral-text">{new Date(injury.return_to_training_date).toLocaleDateString()}</p>
                          </div>
                        )}
                        {injury.return_to_play_date && (
                          <div>
                            <label className="text-xs font-semibold text-neutral-medium uppercase flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              Return to Play
                            </label>
                            <p className="text-neutral-text">{new Date(injury.return_to_play_date).toLocaleDateString()}</p>
                          </div>
                        )}
                        {injury.notes && (
                          <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-neutral-medium uppercase flex items-center">
                              <FileText className="w-3 h-3 mr-1" />
                              Notes
                            </label>
                            <p className="text-neutral-text">{injury.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {injury.status === 'active' && (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showInjuryForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card shadow-soft max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-light">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-neutral-text">
                  {editingInjury ? 'Edit Injury' : 'Record New Injury'}
                </h3>
                <button
                  onClick={() => {
                    setShowInjuryForm(false)
                    setEditingInjury(null)
                  }}
                  className="text-neutral-medium hover:text-neutral-text transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-medium mb-1">
                    Player <span className="text-secondary">*</span>
                  </label>
                  <select
                    value={injuryForm.player_id}
                    onChange={(e) => setInjuryForm({ ...injuryForm, player_id: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
                  <label className="block text-sm font-semibold text-neutral-medium mb-1">
                    Injury Date <span className="text-secondary">*</span>
                  </label>
                  <input
                    type="date"
                    value={injuryForm.injury_date}
                    onChange={(e) => setInjuryForm({ ...injuryForm, injury_date: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-neutral-medium mb-1">
                    Cause <span className="text-secondary">*</span>
                  </label>
                  <input
                    type="text"
                    value={injuryForm.cause}
                    onChange={(e) => setInjuryForm({ ...injuryForm, cause: e.target.value })}
                    placeholder="e.g., Training collision, Match injury, etc."
                    className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-neutral-medium mb-1">
                    Diagnosis <span className="text-secondary">*</span>
                  </label>
                  <input
                    type="text"
                    value={injuryForm.diagnosis}
                    onChange={(e) => setInjuryForm({ ...injuryForm, diagnosis: e.target.value })}
                    placeholder="e.g., Sprained ankle, Shoulder dislocation, etc."
                    className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-neutral-medium mb-1">
                    Action Taken <span className="text-secondary">*</span>
                  </label>
                  <textarea
                    value={injuryForm.action_taken}
                    onChange={(e) => setInjuryForm({ ...injuryForm, action_taken: e.target.value })}
                    placeholder="Describe the immediate action taken"
                    rows={3}
                    className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-neutral-medium mb-1">
                    Further Treatment
                  </label>
                  <textarea
                    value={injuryForm.further_treatment}
                    onChange={(e) => setInjuryForm({ ...injuryForm, further_treatment: e.target.value })}
                    placeholder="Describe ongoing treatment plan"
                    rows={2}
                    className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-neutral-medium mb-1 flex items-center">
                    <Pill className="w-4 h-4 mr-1" />
                    Medication
                  </label>
                  <input
                    type="text"
                    value={injuryForm.medication}
                    onChange={(e) => setInjuryForm({ ...injuryForm, medication: e.target.value })}
                    placeholder="e.g., Ibuprofen 400mg twice daily"
                    className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-medium mb-1 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Return to Training Date
                  </label>
                  <input
                    type="date"
                    value={injuryForm.return_to_training_date}
                    onChange={(e) => setInjuryForm({ ...injuryForm, return_to_training_date: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-medium mb-1 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Return to Play Date
                  </label>
                  <input
                    type="date"
                    value={injuryForm.return_to_play_date}
                    onChange={(e) => setInjuryForm({ ...injuryForm, return_to_play_date: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-neutral-medium mb-1 flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    Notes
                  </label>
                  <textarea
                    value={injuryForm.notes}
                    onChange={(e) => setInjuryForm({ ...injuryForm, notes: e.target.value })}
                    placeholder="Additional notes or observations"
                    rows={3}
                    className="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-light flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowInjuryForm(false)
                  setEditingInjury(null)
                }}
                className="px-6 py-2 border border-neutral-light rounded-button font-semibold text-neutral-text hover:bg-neutral-light transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInjury}
                disabled={saving}
                className="px-6 py-2 bg-primary text-white rounded-button font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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




