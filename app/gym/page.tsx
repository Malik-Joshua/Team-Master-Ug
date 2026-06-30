'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import ConceptStatCard from '@/components/ConceptStatCard'
import { PageHeader, Button, Card, StatGrid } from '@/components/ui'
import { Dumbbell, Activity, Clock, MapPin, Plus, X, Save, RefreshCw, Eye, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface GymStats {
  benchPressPB: number | null
  squatPB: number | null
  deadliftPB: number | null
  pullUpPB: number | null
}

const EMPTY_FORM = { schedule_date: '', schedule_time: '', location: '', description: '', exercises: '' }

/* ─── Shared modal form fields ───────────────────────────────────────────── */
const inputStyle = { color: 'var(--tm-text-1)', WebkitTextFillColor: 'var(--tm-text-1)' } as const

function SessionFormFields({
  form,
  onFieldChange,
}: {
  form: typeof EMPTY_FORM
  onFieldChange: (field: keyof typeof EMPTY_FORM, value: string) => void
}) {
  return (
    <div className="space-y-4 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="tm-label">Date *</label>
          <input type="date" value={form.schedule_date}
            onChange={e => onFieldChange('schedule_date', e.target.value)}
            className="tm-input" style={inputStyle} />
        </div>
        <div>
          <label className="tm-label">Time</label>
          <input type="time" value={form.schedule_time}
            onChange={e => onFieldChange('schedule_time', e.target.value)}
            className="tm-input" style={inputStyle} />
        </div>
      </div>
      <div>
        <label className="tm-label">Location</label>
        <input type="text" value={form.location}
          onChange={e => onFieldChange('location', e.target.value)}
          placeholder="e.g. Main gym" className="tm-input" style={inputStyle} />
      </div>
      <div>
        <label className="tm-label">Session title *</label>
        <input type="text" value={form.description}
          onChange={e => onFieldChange('description', e.target.value)}
          placeholder="e.g. Strength & conditioning" className="tm-input" style={inputStyle} />
      </div>
      <div>
        <label className="tm-label">Exercises & workout plan</label>
        <textarea rows={4} value={form.exercises}
          onChange={e => onFieldChange('exercises', e.target.value)}
          placeholder={'e.g.\n3x5 Bench press\n3x5 Squat\n3x8 Pull-ups'}
          className="tm-textarea" style={inputStyle} />
      </div>
    </div>
  )
}

/* ─── Shared modal shell ────────────────────────────────────────────────── */
function ModalShell({ title, icon: Icon, onClose, children, footer }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[10px] border border-tm-border bg-tm-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-tm-border p-5">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-tm-text-1">
            <Icon className="h-[18px] w-[18px] text-tm-secondary" />
            {title}
          </h3>
          <button onClick={onClose} className="modal-close-btn">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
        {footer && <div className="flex justify-end gap-2 border-t border-tm-border p-5">{footer}</div>}
      </div>
    </div>
  )
}

export default function GymPage() {
  const [user, setUser]           = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [schedules, setSchedules] = useState<any[]>([])
  const [gymStats, setGymStats]   = useState<GymStats | null>(null)

  /* modal states */
  const [showCreate, setShowCreate]   = useState(false)
  const [showView, setShowView]       = useState(false)
  const [showEdit, setShowEdit]       = useState(false)
  const [showDelete, setShowDelete]   = useState(false)
  const [selected, setSelected]       = useState<any>(null)

  /* form states */
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm]     = useState(EMPTY_FORM)

  /* async flags */
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('user_profiles').select('*').eq('user_id', authUser.id).single()
    setUser(profile)

    try {
      const res = await fetch('/api/gym-schedules', { cache: 'no-store' })
      if (res.ok) setSchedules((await res.json()).schedules || [])
    } catch (e) { console.error('Error loading gym schedules:', e) }

    if (profile?.role === 'player') {
      try {
        const res = await fetch(`/api/players/${authUser.id}/gym-stats`, { cache: 'no-store' })
        if (res.ok) setGymStats(await res.json())
      } catch (e) { console.error('Error loading gym stats:', e) }
    }

    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const canManage = user?.role === 'coach' || user?.role === 'admin'

  /* ── handlers ── */
  const handleCreate = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/gym-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create')
      setShowCreate(false)
      setCreateForm(EMPTY_FORM)
      await loadData()
    } catch (e: any) { alert(`Error: ${e.message}`) }
    finally { setSaving(false) }
  }

  const openEdit = (schedule: any) => {
    setSelected(schedule)
    setEditForm({
      schedule_date: schedule.schedule_date?.slice(0, 10) ?? '',
      schedule_time: schedule.schedule_time ?? '',
      location:      schedule.location ?? '',
      description:   schedule.description ?? '',
      exercises:     schedule.exercises ?? '',
    })
    setShowEdit(true)
  }

  const handleEdit = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch('/api/gym-schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, ...editForm }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update')
      setShowEdit(false)
      setSelected(null)
      await loadData()
    } catch (e: any) { alert(`Error: ${e.message}`) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!selected) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/gym-schedules?id=${selected.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete')
      setShowDelete(false)
      setSelected(null)
      await loadData()
    } catch (e: any) { alert(`Error: ${e.message}`) }
    finally { setDeleting(false) }
  }

  if (loading) {
    return (
      <Layout pageTitle="Gym & fitness">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tm-secondary" />
        </div>
      </Layout>
    )
  }

  if (!user) return null

  const todayStr = new Date().toDateString()
  const upcoming = schedules.filter(s => new Date(s.schedule_date) >= new Date(todayStr))

  return (
    <Layout pageTitle="Gym & fitness">
      <div className="space-y-5">
        <PageHeader
          title="Gym & fitness"
          subtitle="Training schedules and personal bests"
          actions={
            <>
              <Button variant="secondary" icon={RefreshCw} onClick={loadData}>Refresh</Button>
              {canManage && (
                <Button icon={Plus} onClick={() => setShowCreate(true)}>New gym session</Button>
              )}
            </>
          }
        />

        {/* Personal bests — players only */}
        {user.role === 'player' && (
          <StatGrid cols={4}>
            <ConceptStatCard label="Bench press"
              value={gymStats?.benchPressPB != null ? `${gymStats.benchPressPB} kg` : '—'}
              meta="Personal best" icon={Dumbbell}
              iconBgColor="rgba(91,163,217,0.12)" iconTextColor="#5BA3D9" />
            <ConceptStatCard label="Squat"
              value={gymStats?.squatPB != null ? `${gymStats.squatPB} kg` : '—'}
              meta="Personal best" icon={Dumbbell}
              iconBgColor="rgba(45,184,138,0.12)" iconTextColor="#2DB88A" />
            <ConceptStatCard label="Deadlift"
              value={gymStats?.deadliftPB != null ? `${gymStats.deadliftPB} kg` : '—'}
              meta="Personal best" icon={Dumbbell}
              iconBgColor="rgba(224,159,66,0.12)" iconTextColor="#E09F42" />
            <ConceptStatCard label="Pull-ups"
              value={gymStats?.pullUpPB != null ? `${gymStats.pullUpPB} reps` : '—'}
              meta="Personal best" icon={Activity}
              iconBgColor="rgba(155,110,232,0.12)" iconTextColor="#9B6EE8" />
          </StatGrid>
        )}

        {/* Upcoming sessions */}
        <div>
          <h2 className="mb-3 text-sm font-medium text-tm-text-1">Upcoming gym sessions</h2>
          {upcoming.length === 0 ? (
            <Card className="p-12 text-center">
              <Dumbbell className="mx-auto mb-4 h-16 w-16 text-tm-text-3" />
              <h3 className="mb-2 text-xl font-semibold text-tm-text-1">No gym sessions scheduled</h3>
              <p className="text-tm-text-3">
                {canManage ? 'Create a gym session to get the squad in the gym.' : 'Check back later for gym sessions from your coach.'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((schedule) => {
                const scheduleDate = new Date(schedule.schedule_date)
                const isToday    = scheduleDate.toDateString() === new Date().toDateString()
                const isTomorrow = scheduleDate.toDateString() === new Date(Date.now() + 86400000).toDateString()
                return (
                  <Card key={schedule.id} padded={false}>
                    {/* Colour header */}
                    <div className={`${isToday ? 'bg-tm-secondary text-tm-on-secondary' : isTomorrow ? 'bg-info text-white' : 'bg-tm-surface-hover text-tm-text-1'} p-4`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium opacity-90">
                            {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : scheduleDate.toLocaleDateString('en-US', { weekday: 'long' })}
                          </p>
                          <p className="text-2xl font-bold">
                            {scheduleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <Activity className="h-8 w-8 opacity-80" />
                      </div>
                    </div>

                    {/* Body */}
                    <div className="space-y-3 p-5">
                      <div>
                        <h4 className="mb-2 font-semibold text-tm-text-1">{schedule.description}</h4>
                        <span className="rounded bg-[#E05757]/10 px-2 py-1 text-xs font-medium text-[#E05757]">
                          Gym session
                        </span>
                      </div>
                      {(schedule.schedule_time || schedule.location) && (
                        <div className="space-y-1.5">
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
                            <p className="whitespace-pre-line text-sm leading-relaxed text-tm-text-1 line-clamp-3">
                              {schedule.exercises}
                            </p>
                          </div>
                        </div>
                      )}
                      {schedule.coach?.name && (
                        <div className="border-t border-tm-border pt-2">
                          <p className="mb-0.5 text-xs text-tm-text-3">Created by</p>
                          <p className="text-sm font-semibold text-tm-text-1">{schedule.coach.name}</p>
                        </div>
                      )}
                    </div>

                    {/* Action row — always visible at card bottom */}
                    <div className="flex items-center gap-2 border-t border-tm-border px-5 py-3">
                      {/* View — all users */}
                      <button
                        onClick={() => { setSelected(schedule); setShowView(true) }}
                        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors text-tm-text-3 hover:text-tm-text-1"
                        style={{ background: 'var(--tm-surface-hover)' }}
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>

                      {/* Edit + Delete — coaches / admins only */}
                      {canManage && (
                        <>
                          <button
                            onClick={() => openEdit(schedule)}
                            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                            style={{ background: 'var(--acc-dim,rgba(91,163,217,0.10))', color: 'var(--acc,#5BA3D9)' }}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => { setSelected(schedule); setShowDelete(true) }}
                            className="ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                            style={{ background: 'rgba(224,87,87,0.10)', color: '#E05757' }}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── CREATE modal ── */}
      {showCreate && canManage && (
        <ModalShell
          title="New gym session"
          icon={Dumbbell}
          onClose={() => { setShowCreate(false); setCreateForm(EMPTY_FORM) }}
          footer={
            <>
              <Button variant="outline" onClick={() => { setShowCreate(false); setCreateForm(EMPTY_FORM) }} disabled={saving}>
                Cancel
              </Button>
              <Button icon={Save} onClick={handleCreate} disabled={saving || !createForm.schedule_date || !createForm.description}>
                {saving ? 'Saving…' : 'Create session'}
              </Button>
            </>
          }
        >
          <SessionFormFields form={createForm} onFieldChange={(field, value) => setCreateForm(prev => ({ ...prev, [field]: value }))} />
        </ModalShell>
      )}

      {/* ── VIEW modal ── */}
      {showView && selected && (
        <ModalShell
          title="Gym session details"
          icon={Eye}
          onClose={() => { setShowView(false); setSelected(null) }}
          footer={
            <Button variant="outline" onClick={() => { setShowView(false); setSelected(null) }}>Close</Button>
          }
        >
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-tm-text-3 mb-1">Date</p>
                <p className="text-sm font-semibold text-tm-text-1">
                  {new Date(selected.schedule_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              {selected.schedule_time && (
                <div>
                  <p className="text-xs font-medium text-tm-text-3 mb-1">Time</p>
                  <p className="text-sm font-semibold text-tm-text-1">{selected.schedule_time}</p>
                </div>
              )}
              {selected.location && (
                <div>
                  <p className="text-xs font-medium text-tm-text-3 mb-1">Location</p>
                  <p className="text-sm font-semibold text-tm-text-1">{selected.location}</p>
                </div>
              )}
              {selected.coach?.name && (
                <div>
                  <p className="text-xs font-medium text-tm-text-3 mb-1">Created by</p>
                  <p className="text-sm font-semibold text-tm-text-1">{selected.coach.name}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-tm-text-3 mb-1">Session title</p>
              <p className="text-sm font-semibold text-tm-text-1">{selected.description}</p>
            </div>
            {selected.exercises && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-tm-text-3 mb-2">Exercises &amp; workout plan</p>
                <div className="rounded-lg bg-info/10 p-3">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-tm-text-1">{selected.exercises}</p>
                </div>
              </div>
            )}
          </div>
        </ModalShell>
      )}

      {/* ── EDIT modal ── */}
      {showEdit && selected && canManage && (
        <ModalShell
          title="Edit gym session"
          icon={Pencil}
          onClose={() => { setShowEdit(false); setSelected(null) }}
          footer={
            <>
              <Button variant="outline" onClick={() => { setShowEdit(false); setSelected(null) }} disabled={saving}>
                Cancel
              </Button>
              <Button icon={Save} onClick={handleEdit} disabled={saving || !editForm.schedule_date || !editForm.description}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </>
          }
        >
          <SessionFormFields form={editForm} onFieldChange={(field, value) => setEditForm(prev => ({ ...prev, [field]: value }))} />
        </ModalShell>
      )}

      {/* ── DELETE confirmation modal ── */}
      {showDelete && selected && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-[10px] border border-tm-border bg-tm-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-tm-border p-5">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-tm-text-1">
                <AlertTriangle className="h-[18px] w-[18px] text-[#E05757]" />
                Delete session
              </h3>
              <button onClick={() => { setShowDelete(false); setSelected(null) }} className="modal-close-btn">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-tm-text-2 mb-1">You are about to permanently delete:</p>
              <p className="text-sm font-semibold text-tm-text-1 mb-1">{selected.description}</p>
              <p className="text-sm text-tm-text-3">
                {new Date(selected.schedule_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                {selected.schedule_time ? ` at ${selected.schedule_time}` : ''}
              </p>
              <p className="mt-3 text-xs text-[#E05757]">This cannot be undone.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-tm-border p-5">
              <Button variant="outline" onClick={() => { setShowDelete(false); setSelected(null) }} disabled={deleting}>
                Cancel
              </Button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-[6px] px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: '#E05757' }}
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Deleting…' : 'Delete session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
