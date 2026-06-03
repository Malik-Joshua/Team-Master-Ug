'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import ConceptStatCard from '@/components/ConceptStatCard'
import { PageHeader, Button, Card, StatGrid } from '@/components/ui'
import { Dumbbell, Activity, Clock, MapPin, Plus, X, Save, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface GymStats {
  benchPressPB: number | null
  squatPB: number | null
  deadliftPB: number | null
  pullUpPB: number | null
}

export default function GymPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState<any[]>([])
  const [gymStats, setGymStats] = useState<GymStats | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    schedule_date: '',
    schedule_time: '',
    location: '',
    description: '',
    exercises: '',
  })

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', authUser.id)
      .single()

    setUser(profile)

    // Gym schedules (everyone)
    try {
      const res = await fetch('/api/gym-schedules', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setSchedules(data.schedules || [])
      }
    } catch (e) {
      console.error('Error loading gym schedules:', e)
    }

    // Personal bests (players only)
    if (profile?.role === 'player') {
      try {
        const res = await fetch(`/api/players/${authUser.id}/gym-stats`, { cache: 'no-store' })
        if (res.ok) setGymStats(await res.json())
      } catch (e) {
        console.error('Error loading gym stats:', e)
      }
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const canCreate = user?.role === 'coach' || user?.role === 'admin'

  const handleCreate = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/gym-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error || 'Failed to create gym session')
      }
      setShowCreate(false)
      setForm({ schedule_date: '', schedule_time: '', location: '', description: '', exercises: '' })
      await loadData()
      alert('Gym session created!')
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Layout pageTitle="Gym & fitness">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tm-secondary"></div>
        </div>
      </Layout>
    )
  }

  if (!user) return null

  const todayStr = new Date().toDateString()
  const upcoming = schedules.filter(
    (s) => new Date(s.schedule_date) >= new Date(todayStr)
  )

  return (
    <Layout pageTitle="Gym & fitness">
      <div className="space-y-5">
        <PageHeader
          title="Gym & fitness"
          subtitle="Training schedules and personal bests"
          actions={
            <>
              <Button variant="secondary" icon={RefreshCw} onClick={loadData}>
                Refresh
              </Button>
              {canCreate && (
                <Button icon={Plus} onClick={() => setShowCreate(true)}>
                  New gym session
                </Button>
              )}
            </>
          }
        />

        {/* Personal bests (players only) */}
        {user.role === 'player' && (
          <StatGrid cols={4}>
            <ConceptStatCard
              label="Bench press"
              value={gymStats?.benchPressPB != null ? `${gymStats.benchPressPB} kg` : '—'}
              meta="Personal best"
              icon={Dumbbell}
              iconBgColor="rgba(91, 163, 217, 0.12)"
              iconTextColor="#5BA3D9"
            />
            <ConceptStatCard
              label="Squat"
              value={gymStats?.squatPB != null ? `${gymStats.squatPB} kg` : '—'}
              meta="Personal best"
              icon={Dumbbell}
              iconBgColor="rgba(45, 184, 138, 0.12)"
              iconTextColor="#2DB88A"
            />
            <ConceptStatCard
              label="Deadlift"
              value={gymStats?.deadliftPB != null ? `${gymStats.deadliftPB} kg` : '—'}
              meta="Personal best"
              icon={Dumbbell}
              iconBgColor="rgba(224, 159, 66, 0.12)"
              iconTextColor="#E09F42"
            />
            <ConceptStatCard
              label="Pull-ups"
              value={gymStats?.pullUpPB != null ? `${gymStats.pullUpPB} reps` : '—'}
              meta="Personal best"
              icon={Activity}
              iconBgColor="rgba(155, 110, 232, 0.12)"
              iconTextColor="#9B6EE8"
            />
          </StatGrid>
        )}

        {/* Upcoming gym sessions */}
        <div>
          <h2 className="mb-3 text-sm font-medium text-tm-text-1">Upcoming gym sessions</h2>
          {upcoming.length === 0 ? (
            <Card className="p-12 text-center">
              <Dumbbell className="mx-auto mb-4 h-16 w-16 text-tm-text-3" />
              <h3 className="mb-2 text-xl font-semibold text-tm-text-1">No gym sessions scheduled</h3>
              <p className="text-tm-text-3">
                {canCreate
                  ? 'Create a gym session to get the squad in the gym.'
                  : 'Check back later for gym sessions from your coach.'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((schedule) => {
                const scheduleDate = new Date(schedule.schedule_date)
                const isToday = scheduleDate.toDateString() === new Date().toDateString()
                const isTomorrow =
                  scheduleDate.toDateString() === new Date(Date.now() + 86400000).toDateString()
                return (
                  <Card key={schedule.id} padded={false}>
                    <div
                      className={`${
                        isToday
                          ? 'bg-tm-secondary text-tm-on-secondary'
                          : isTomorrow
                            ? 'bg-info text-white'
                            : 'bg-tm-surface-hover text-tm-text-1'
                      } p-4`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium opacity-90">
                            {isToday
                              ? 'Today'
                              : isTomorrow
                                ? 'Tomorrow'
                                : scheduleDate.toLocaleDateString('en-US', { weekday: 'long' })}
                          </p>
                          <p className="text-2xl font-bold">
                            {scheduleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <Activity className="h-8 w-8 opacity-80" />
                      </div>
                    </div>
                    <div className="space-y-4 p-5">
                      <div>
                        <h4 className="mb-2 font-semibold text-tm-text-1">{schedule.description}</h4>
                        <span className="rounded bg-[#E05757]/10 px-2 py-1 text-xs font-medium text-[#E05757]">
                          Gym session
                        </span>
                      </div>
                      {(schedule.schedule_time || schedule.location) && (
                        <div className="space-y-2">
                          {schedule.schedule_time && (
                            <div className="flex items-center text-tm-text-3">
                              <Clock className="mr-2 h-4 w-4" />
                              <span className="text-sm font-medium">{schedule.schedule_time}</span>
                            </div>
                          )}
                          {schedule.location && (
                            <div className="flex items-center text-tm-text-3">
                              <MapPin className="mr-2 h-4 w-4" />
                              <span className="text-sm font-medium">{schedule.location}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {schedule.exercises && (
                        <div className="border-t border-tm-border pt-2">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-tm-text-3">
                            Exercises &amp; workout plan
                          </p>
                          <div className="rounded-lg bg-info/10 p-3">
                            <p className="whitespace-pre-line text-sm leading-relaxed text-tm-text-1">
                              {schedule.exercises}
                            </p>
                          </div>
                        </div>
                      )}
                      {schedule.coach?.name && (
                        <div className="border-t border-tm-border pt-2">
                          <p className="mb-1 text-xs text-tm-text-3">Created by</p>
                          <p className="text-sm font-semibold text-tm-text-1">{schedule.coach.name}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create gym session modal */}
      {showCreate && canCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[10px] border border-tm-border bg-tm-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-tm-border p-5">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-tm-text-1">
                <Dumbbell className="h-[18px] w-[18px] text-tm-secondary" />
                New gym session
              </h3>
              <button
                onClick={() => setShowCreate(false)}
                className="text-tm-text-3 transition-opacity hover:opacity-80"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="tm-label">Date *</label>
                  <input
                    type="date"
                    value={form.schedule_date}
                    onChange={(e) => setForm({ ...form, schedule_date: e.target.value })}
                    className="tm-input"
                  />
                </div>
                <div>
                  <label className="tm-label">Time</label>
                  <input
                    type="time"
                    value={form.schedule_time}
                    onChange={(e) => setForm({ ...form, schedule_time: e.target.value })}
                    className="tm-input"
                  />
                </div>
              </div>
              <div>
                <label className="tm-label">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Main gym"
                  className="tm-input"
                />
              </div>
              <div>
                <label className="tm-label">Session title *</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Strength &amp; conditioning"
                  className="tm-input"
                />
              </div>
              <div>
                <label className="tm-label">Exercises &amp; workout plan</label>
                <textarea
                  rows={4}
                  value={form.exercises}
                  onChange={(e) => setForm({ ...form, exercises: e.target.value })}
                  placeholder={'e.g.\n3x5 Bench press\n3x5 Squat\n3x8 Pull-ups'}
                  className="tm-textarea"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-tm-border p-5">
              <Button variant="outline" onClick={() => setShowCreate(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                icon={Save}
                onClick={handleCreate}
                disabled={saving || !form.schedule_date || !form.description}
              >
                {saving ? 'Saving…' : 'Create session'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
