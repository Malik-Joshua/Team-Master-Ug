'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Layout from '@/components/Layout'
import ConceptStatCard from '@/components/ConceptStatCard'
import { PageHeader, Button, Card, StatGrid } from '@/components/ui'
import { Dumbbell, Activity, Clock, MapPin, Plus, X, Save, RefreshCw, Eye, Pencil, Trash2, AlertTriangle, Upload, Loader2, ScanLine, CheckCircle2, Users, ClipboardList, Download, FileSpreadsheet, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { readTabularFile } from '@/lib/tabular-import'

interface GymStats {
  benchPressPB: number | null
  squatPB: number | null
  deadliftPB: number | null
  pullUpPB: number | null
}

interface PlayerGymMetric {
  user_id: string
  name: string
  position: string | null
  jersey_number: number | null
  pull_up_pb: number | null
  bench_press_pb: number | null
  deadlift_pb: number | null
  squat_pb: number | null
  gym_stats_updated_at: string | null
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
  const [gymStats, setGymStats]           = useState<GymStats | null>(null)
  const [playerMetrics, setPlayerMetrics]   = useState<PlayerGymMetric[]>([])
  const [metricFiles, setMetricFiles]       = useState<any[]>([])
  const [fileSessionFilter, setFileSessionFilter] = useState<string>('all')
  const [dismissedSessions, setDismissedSessions] = useState<Set<string>>(new Set())
  // recordedSessionIds: persisted in localStorage so "recorded" state survives
  // page refreshes even when the gym_metric_files DB table isn't set up yet.
  const [recordedSessionIds, setRecordedSessionIds] = useState<Set<string>>(new Set())
  const userIdRef = useRef<string | null>(null)

  /* modal states */
  const [showCreate, setShowCreate]     = useState(false)
  const [showPostCreate, setShowPostCreate] = useState(false)
  const [newlyCreatedSession, setNewlyCreatedSession] = useState<any>(null)
  const [showView, setShowView]         = useState(false)
  const [showEdit, setShowEdit]         = useState(false)
  const [showDelete, setShowDelete]     = useState(false)
  const [showUpload, setShowUpload]     = useState(false)
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null)
  const [selected, setSelected]         = useState<any>(null)

  /* form states */
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm]     = useState(EMPTY_FORM)

  /* async flags */
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [previewMetrics, setPreviewMetrics] = useState<Array<{
    player_name: string
    pull_up_pb: number | null
    bench_press_pb: number | null
    deadlift_pb: number | null
    squat_pb: number | null
  }> | null>(null)
  const [rawFileRows, setRawFileRows] = useState<string[][] | null>(null)
  const [viewingFile, setViewingFile] = useState<any | null>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('user_profiles').select('*').eq('user_id', authUser.id).single()
    setUser(profile)

    userIdRef.current = authUser.id
    // Load dismissed + recorded session IDs from localStorage (per user)
    try {
      const rawDismissed = localStorage.getItem(`dismissed_gym_sessions_${authUser.id}`)
      if (rawDismissed) setDismissedSessions(new Set(JSON.parse(rawDismissed)))
      const rawRecorded = localStorage.getItem(`recorded_gym_sessions_${authUser.id}`)
      if (rawRecorded) setRecordedSessionIds(new Set(JSON.parse(rawRecorded)))
    } catch { /* ignore */ }

    // Eagerly populate metricFiles from localStorage so the archive shows
    // even before (or instead of) the DB table existing.
    try {
      const rawFiles = localStorage.getItem(`gym_metric_file_records_${authUser.id}`)
      if (rawFiles) setMetricFiles(JSON.parse(rawFiles))
    } catch { /* ignore */ }

    try {
      const res = await fetch('/api/gym-schedules', { cache: 'no-store' })
      if (res.ok) setSchedules((await res.json()).schedules || [])
    } catch (e) { console.error('Error loading gym schedules:', e) }

    if (profile?.role === 'player') {
      try {
        const res = await fetch(`/api/players/${authUser.id}/gym-stats`, { cache: 'no-store' })
        if (res.ok) setGymStats(await res.json())
      } catch (e) { console.error('Error loading gym stats:', e) }
    } else {
      // Coaches / managers: load full squad metrics + metric files
      try {
        const [metricsRes, filesRes] = await Promise.all([
          fetch('/api/gym-metrics', { cache: 'no-store' }),
          fetch('/api/gym-metric-files', { cache: 'no-store' }),
        ])
        if (metricsRes.ok) setPlayerMetrics((await metricsRes.json()).metrics || [])
        if (filesRes.ok) {
          // DB records take precedence; merge over localStorage records
          const dbFiles: any[] = (await filesRes.json()).files || []
          setMetricFiles(prev => {
            // Keep any localStorage-only records that don't have a DB counterpart
            const dbIds = new Set(dbFiles.map((f: any) => f.id))
            const localOnly = prev.filter((f: any) => f._local && !dbIds.has(f.id))
            return [...dbFiles, ...localOnly]
          })
        }
      } catch (e) { console.error('Error loading squad gym metrics:', e) }
    }

    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const dismissSession = (id: string) => {
    setDismissedSessions(prev => {
      const next = new Set(prev)
      next.add(id)
      try {
        localStorage.setItem(
          `dismissed_gym_sessions_${userIdRef.current}`,
          JSON.stringify([...next])
        )
      } catch { /* ignore */ }
      return next
    })
  }

  const markSessionRecorded = (id: string) => {
    setRecordedSessionIds(prev => {
      const next = new Set(prev)
      next.add(id)
      try {
        localStorage.setItem(
          `recorded_gym_sessions_${userIdRef.current}`,
          JSON.stringify([...next])
        )
      } catch { /* ignore */ }
      return next
    })
  }

  // Saves a file record to localStorage AND to metricFiles state so the
  // archive shows up immediately without needing the DB table.
  const saveLocalFileRecord = (record: {
    session_id: string | null
    file_name: string
    metrics_captured: number
    metrics_total: number
    session_description?: string
    session_date?: string
    rows?: string[][]
    uploader_name?: string
  }) => {
    const entry = {
      id: `local_${Date.now()}`,
      _local: true,
      session_id: record.session_id,
      file_name: record.file_name,
      uploaded_at: new Date().toISOString(),
      metrics_captured: record.metrics_captured,
      metrics_total: record.metrics_total,
      download_url: null,
      uploader: record.uploader_name ? { name: record.uploader_name } : null,
      session: record.session_description
        ? { description: record.session_description, schedule_date: record.session_date ?? '' }
        : null,
      rows: record.rows ? record.rows.slice(0, 300) : undefined,
    }
    setMetricFiles(prev => {
      const next = [entry, ...prev]
      try {
        const localOnly = next.filter((f: any) => f._local)
        localStorage.setItem(
          `gym_metric_file_records_${userIdRef.current}`,
          JSON.stringify(localOnly)
        )
      } catch { /* ignore */ }
      return next
    })
  }

  const canManage = user?.role === 'coach' || user?.role === 'asst_coach' || user?.role === 'admin' || user?.role === 'data_admin' || user?.role === 'finance_admin'

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
      const json = await res.json()
      setShowCreate(false)
      setCreateForm(EMPTY_FORM)
      await loadData()
      // Prompt to add metrics immediately after creation
      setNewlyCreatedSession(json.schedule)
      setShowPostCreate(true)
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFile(file)
      setUploadError(null)
      setPreviewMetrics(null)
      setRawFileRows(null)
    }
  }

  const handleScanFile = async () => {
    if (!uploadFile) { setUploadError('Please select a file'); return }
    setScanning(true)
    setUploadError(null)
    setPreviewMetrics(null)
    try {
      const rows = await readTabularFile(uploadFile)
      if (rows.length < 2) throw new Error('File must have at least a header row and one data row')

      const headers = rows[0].map(h => h.toLowerCase().trim())
      const dataRows = rows.slice(1)

      // Flexible column detection — matches any header that contains these keywords
      const nameIndex     = headers.findIndex(h => h.includes('player') || h === 'name')
      const pullupIndex   = headers.findIndex(h => h.includes('pull'))
      const benchIndex    = headers.findIndex(h => h.includes('bench'))
      const deadliftIndex = headers.findIndex(h => h.includes('deadlift'))
      const squatIndex    = headers.findIndex(h => h.includes('squat'))

      if (nameIndex === -1) throw new Error(
        `Could not find a Player Name column. Headers detected: ${rows[0].join(', ')}`
      )

      const parsed = dataRows
        .map(row => {
          const playerName = row[nameIndex]?.trim()
          if (!playerName) return null
          const num = (idx: number) => idx !== -1 ? (parseFloat(row[idx]) || null) : null
          return {
            player_name:    playerName,
            pull_up_pb:     num(pullupIndex),
            bench_press_pb: num(benchIndex),
            deadlift_pb:    num(deadliftIndex),
            squat_pb:       num(squatIndex),
          }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)

      if (parsed.length === 0) throw new Error('No player rows found. Check that the file has data below the header row.')
      setRawFileRows(rows)
      setPreviewMetrics(parsed)
    } catch (e: any) {
      setUploadError(e.message)
    } finally {
      setScanning(false)
    }
  }

  const handleUpload = async () => {
    if (!previewMetrics || previewMetrics.length === 0) {
      setUploadError('Please scan a file first')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      // 1. Upload raw file to Supabase Storage so the club keeps the full data
      let storagePath: string | null = null
      if (uploadFile) {
        const supabase = createClient()
        const ext = uploadFile.name.split('.').pop() || 'csv'
        const ts = Date.now()
        const folder = uploadSessionId ?? 'unsorted'
        storagePath = `${folder}/${ts}_${uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error: storageError } = await supabase.storage
          .from('gym-metric-files')
          .upload(storagePath, uploadFile, { contentType: uploadFile.type || 'text/csv', upsert: false })
        if (storageError) {
          console.warn('File storage failed (non-fatal):', storageError.message)
          storagePath = null // don't block the metric save
        }
      }

      // 2. Save metrics + record the file
      const res = await fetch('/api/gym-metrics/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: previewMetrics,
          session_id: uploadSessionId ?? null,
          file_name: uploadFile?.name ?? null,
          storage_path: storagePath,
        }),
      })

      if (!res.ok) throw new Error((await res.json()).error || 'Failed to upload gym metrics')

      const result = await res.json()

      // Persist to localStorage immediately — works even without DB migration.
      if (uploadSessionId) markSessionRecorded(uploadSessionId)

      // Find the session details for the archive label
      const sessionCtx = uploadSessionId
        ? schedules.find((s: any) => s.id === uploadSessionId)
        : null

      if (uploadFile) {
        saveLocalFileRecord({
          session_id: uploadSessionId,
          file_name: uploadFile.name,
          metrics_captured: result.uploaded ?? 0,
          metrics_total: result.total ?? previewMetrics.length,
          session_description: sessionCtx?.description,
          session_date: sessionCtx?.schedule_date,
          rows: rawFileRows ?? undefined,
          uploader_name: user?.name ?? undefined,
        })
      }

      setShowUpload(false)
      setUploadFile(null)
      setPreviewMetrics(null)
      setUploadSessionId(null)
      await loadData()

      const msg = result.uploaded > 0
        ? `Successfully saved ${result.uploaded} of ${result.total} player metrics.${ storagePath ? ' Full file archived.' : ''}`
        : `Saved 0 metrics. ${result.errors?.length ? result.errors.join('; ') : 'Player names in the file may not match the roster.'}`
      alert(msg)
    } catch (e: any) {
      setUploadError(e.message)
    } finally {
      setUploading(false)
    }
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

  const now = new Date()
  const todayStr = now.toDateString()

  // A session is "expired" if its date is before today (date-only comparison)
  const isExpired = (s: any) => {
    const d = new Date(s.schedule_date)
    d.setHours(23, 59, 59, 999)
    return d < now
  }

  const upcoming = schedules.filter(s => !isExpired(s))
  const pastSessions = schedules
    .filter(s => isExpired(s) && !dismissedSessions.has(s.id))
    .slice(0, 10)

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
                <>
                  <Button icon={Upload} onClick={() => { setUploadSessionId(null); setShowUpload(true) }}>Upload metrics</Button>
                  <Button icon={Plus} onClick={() => setShowCreate(true)}>New gym session</Button>
                </>
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

        {/* Squad gym metrics — coaches / managers */}
        {canManage && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-tm-text-1 flex items-center gap-2">
                <Users className="h-4 w-4" /> Squad gym metrics
              </h2>
              <span className="text-xs text-tm-text-3">{playerMetrics.filter(m => m.pull_up_pb || m.bench_press_pb || m.deadlift_pb).length} of {playerMetrics.length} players have metrics</span>
            </div>
            {playerMetrics.length === 0 ? (
              <Card className="p-8 text-center">
                <Dumbbell className="mx-auto mb-3 h-12 w-12 text-tm-text-3" />
                <p className="text-sm text-tm-text-1 font-medium">No gym metrics yet</p>
                <p className="text-xs text-tm-text-3 mt-1">Upload a CSV or Excel file to populate player personal bests.</p>
              </Card>
            ) : (
              <Card padded={false}>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-tm-surface-hover border-b border-tm-border">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-tm-text-2 text-xs uppercase tracking-wide">#</th>
                        <th className="text-left px-4 py-3 font-semibold text-tm-text-2 text-xs uppercase tracking-wide">Player</th>
                        <th className="text-left px-4 py-3 font-semibold text-tm-text-2 text-xs uppercase tracking-wide">Position</th>
                        <th className="text-center px-4 py-3 font-semibold text-tm-text-2 text-xs uppercase tracking-wide">Pull-up PB</th>
                        <th className="text-center px-4 py-3 font-semibold text-tm-text-2 text-xs uppercase tracking-wide">Bench (kg)</th>
                        <th className="text-center px-4 py-3 font-semibold text-tm-text-2 text-xs uppercase tracking-wide">Deadlift (kg)</th>
                        <th className="text-center px-4 py-3 font-semibold text-tm-text-2 text-xs uppercase tracking-wide">Squat (kg)</th>
                        <th className="text-left px-4 py-3 font-semibold text-tm-text-2 text-xs uppercase tracking-wide">Last updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-tm-border">
                      {playerMetrics.map((m, i) => {
                        const hasData = m.pull_up_pb || m.bench_press_pb || m.deadlift_pb || m.squat_pb
                        return (
                          <tr key={m.user_id} className={`${i % 2 === 0 ? 'bg-tm-surface' : 'bg-tm-surface-hover'} ${!hasData ? 'opacity-50' : ''}`}>
                            <td className="px-4 py-3 text-tm-text-3 text-xs">{m.jersey_number ?? '—'}</td>
                            <td className="px-4 py-3 font-medium text-tm-text-1">{m.name}</td>
                            <td className="px-4 py-3 text-tm-text-3 capitalize text-xs">{m.position ? m.position.replace(/_/g, ' ') : '—'}</td>
                            <td className="px-4 py-3 text-center">
                              {m.pull_up_pb != null ? <span className="font-semibold text-tm-text-1">{m.pull_up_pb} reps</span> : <span className="text-tm-text-3">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {m.bench_press_pb != null ? <span className="font-semibold text-tm-text-1">{m.bench_press_pb} kg</span> : <span className="text-tm-text-3">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {m.deadlift_pb != null ? <span className="font-semibold text-tm-text-1">{m.deadlift_pb} kg</span> : <span className="text-tm-text-3">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {m.squat_pb != null ? <span className="font-semibold text-tm-text-1">{m.squat_pb} kg</span> : <span className="text-tm-text-3">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-tm-text-3">
                              {m.gym_stats_updated_at ? new Date(m.gym_stats_updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
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

                    {/* Action row */}
                    <div className="flex flex-wrap items-center gap-2 border-t border-tm-border px-5 py-3">
                      <button
                        onClick={() => { setSelected(schedule); setShowView(true) }}
                        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors text-tm-text-3 hover:text-tm-text-1"
                        style={{ background: 'var(--tm-surface-hover)' }}
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>

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
                            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
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

        {/* Past sessions — coaches/managers, with "Record Metrics" + dismiss */}
        {canManage && pastSessions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-tm-text-1">Past gym sessions</h2>
              <span className="text-xs text-tm-text-3">{pastSessions.filter(s => metricFiles.some(f => f.session_id === s.id) || recordedSessionIds.has(s.id)).length} of {pastSessions.length} recorded</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pastSessions.map((schedule) => {
                const scheduleDate = new Date(schedule.schedule_date)
                // hasFile: true if DB has a record OR localStorage marks it recorded
                const hasFile = metricFiles.some(f => f.session_id === schedule.id)
                  || recordedSessionIds.has(schedule.id)
                return (
                  <Card key={schedule.id} padded={false}>
                    {/* Header */}
                    <div className={`p-4 flex items-center justify-between ${hasFile ? 'bg-green-500/10' : 'bg-amber-400/10'}`}>
                      <div>
                        <p className="text-xs text-tm-text-3">Past session</p>
                        <p className="text-lg font-bold text-tm-text-1">
                          {scheduleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasFile
                          ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                          : <AlertTriangle className="h-5 w-5 text-amber-400" />}
                        {/* Dismiss button */}
                        <button
                          onClick={() => dismissSession(schedule.id)}
                          title="Dismiss this session"
                          className="rounded-full p-1 text-tm-text-3 hover:text-tm-text-1 hover:bg-tm-surface transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-1">
                      <p className="font-semibold text-sm text-tm-text-1">{schedule.description}</p>
                      {schedule.location && (
                        <p className="text-xs text-tm-text-3 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{schedule.location}
                        </p>
                      )}
                      <p className={`text-xs font-semibold mt-1 ${hasFile ? 'text-green-500' : 'text-amber-400'}`}>
                        {hasFile ? '✓ Metrics recorded' : '⚠ Metrics not yet recorded'}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 border-t border-tm-border px-4 py-3">
                      <button
                        onClick={() => { setSelected(schedule); setShowView(true) }}
                        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-tm-text-3 hover:text-tm-text-1"
                        style={{ background: 'var(--tm-surface-hover)' }}
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                      {!hasFile && (
                        <button
                          onClick={() => {
                            setUploadSessionId(schedule.id)
                            setUploadFile(null)
                            setPreviewMetrics(null)
                            setUploadError(null)
                            setShowUpload(true)
                          }}
                          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                          style={{ background: 'rgba(45,184,138,0.12)', color: '#2DB88A' }}
                        >
                          <ClipboardList className="h-3.5 w-3.5" /> Record Metrics
                        </button>
                      )}
                      {hasFile && (
                        <button
                          onClick={() => dismissSession(schedule.id)}
                          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-tm-text-3 hover:text-tm-text-1 ml-auto"
                          style={{ background: 'var(--tm-surface-hover)' }}
                        >
                          <X className="h-3.5 w-3.5" /> Dismiss
                        </button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Metric Files archive — coaches/managers */}
        {canManage && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-medium text-tm-text-1 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Uploaded metric files
                <span className="text-xs font-normal text-tm-text-3">({metricFiles.filter(f => {
                  if (fileSessionFilter === 'all') return true
                  if (fileSessionFilter === 'unsorted') return !f.session_id
                  return f.session_id === fileSessionFilter
                }).length} file{metricFiles.length !== 1 ? 's' : ''})</span>
              </h2>
              <div className="flex items-center gap-2">
                <label className="text-xs text-tm-text-3 whitespace-nowrap">Filter by session:</label>
                <div className="relative">
                  <select
                    value={fileSessionFilter}
                    onChange={e => setFileSessionFilter(e.target.value)}
                    className="text-xs bg-tm-surface border border-tm-border rounded-md pl-2 pr-6 py-1.5 text-tm-text-1 appearance-none cursor-pointer"
                  >
                    <option value="all">All sessions</option>
                    <option value="unsorted">No session linked</option>
                    {schedules.map(s => (
                      <option key={s.id} value={s.id}>
                        {new Date(s.schedule_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {s.description}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-tm-text-3 pointer-events-none" />
                </div>
              </div>
            </div>
            {(() => {
              const filtered = metricFiles.filter(f => {
                if (fileSessionFilter === 'all') return true
                if (fileSessionFilter === 'unsorted') return !f.session_id
                return f.session_id === fileSessionFilter
              })
              return filtered.length === 0 ? (
              <Card className="p-6 text-center">
                <FileSpreadsheet className="mx-auto mb-2 h-10 w-10 text-tm-text-3" />
                <p className="text-sm text-tm-text-1 font-medium">
                  {fileSessionFilter === 'all' ? 'No files uploaded yet' : 'No files for this session'}
                </p>
                <p className="text-xs text-tm-text-3 mt-1">
                  {fileSessionFilter === 'all'
                    ? 'When you upload a metric file it will be archived here so you can always access the full data.'
                    : 'Try selecting a different session or "All sessions".'}
                </p>
              </Card>
            ) : (
              <Card padded={false}>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-tm-surface-hover border-b border-tm-border">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-tm-text-2">File</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-tm-text-2">Session</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-tm-text-2">Metrics</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-tm-text-2">Uploaded</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-tm-text-2">By</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-tm-border">
                      {filtered.map((f, i) => (
                          <tr key={f.id} className={i % 2 === 0 ? 'bg-tm-surface' : 'bg-tm-surface-hover'}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <FileSpreadsheet className="h-4 w-4 text-green-500 shrink-0" />
                                <span className="text-xs font-medium text-tm-text-1 truncate max-w-[160px]" title={f.file_name}>{f.file_name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-tm-text-3">
                              {f.session?.description
                                ? <>{new Date(f.session.schedule_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {f.session.description}</>
                                : <span className="italic">No session</span>}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-tm-text-1">
                              <span className="font-semibold">{f.metrics_captured}</span>
                              <span className="text-tm-text-3"> / {f.metrics_total}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-tm-text-3">
                              {new Date(f.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-3 text-xs text-tm-text-3">{f.uploader?.name ?? '—'}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setViewingFile(f)}
                                className="flex items-center gap-1 text-xs font-medium rounded-md px-2.5 py-1.5 transition-colors"
                                style={{ background: 'rgba(45,184,138,0.12)', color: '#2DB88A' }}
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              {f.download_url && (
                                <a
                                  href={f.download_url}
                                  download={f.file_name}
                                  className="flex items-center gap-1 text-xs font-medium rounded-md px-2.5 py-1.5 transition-colors"
                                  style={{ background: 'var(--acc-dim,rgba(91,163,217,0.10))', color: 'var(--acc,#5BA3D9)' }}
                                >
                                  <Download className="h-3.5 w-3.5" /> Download
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
            })()}
          </div>
        )}
      </div>

      {/* ── POST-CREATE PROMPT modal ── */}
      {showPostCreate && newlyCreatedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-[10px] border border-tm-border bg-tm-surface shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-500/10 p-2">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-tm-text-1">Session created!</p>
                <p className="text-xs text-tm-text-3">{newlyCreatedSession?.description}</p>
              </div>
            </div>
            <p className="text-sm text-tm-text-2">Would you like to record gym metrics for this session now? This helps track player performance per session.</p>
            <div className="flex flex-col gap-2">
              <Button
                icon={Upload}
                onClick={() => {
                  setShowPostCreate(false)
                  setUploadSessionId(newlyCreatedSession.id)
                  setUploadFile(null)
                  setPreviewMetrics(null)
                  setUploadError(null)
                  setShowUpload(true)
                }}
              >
                Upload metrics file
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowPostCreate(false); setNewlyCreatedSession(null) }}
              >
                Skip for now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── FILE VIEWER modal ── */}
      {viewingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[10px] border border-tm-border bg-tm-surface shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-tm-border flex-shrink-0">
              <div>
                <h3 className="font-semibold text-tm-text-1 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-tm-secondary" />
                  {viewingFile.file_name}
                </h3>
                {viewingFile.session?.description && (
                  <p className="text-xs text-tm-text-3 mt-0.5">
                    {viewingFile.session.schedule_date
                      ? new Date(viewingFile.session.schedule_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' — '
                      : ''}
                    {viewingFile.session.description}
                  </p>
                )}
              </div>
              <button onClick={() => setViewingFile(null)} className="modal-close-btn">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Content */}
            <div className="overflow-auto flex-1 p-2">
              {viewingFile.rows && viewingFile.rows.length > 0 ? (
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-tm-surface-hover sticky top-0">
                    <tr>
                      {viewingFile.rows[0].map((h: string, i: number) => (
                        <th key={i} className="text-left px-3 py-2 font-semibold text-tm-text-2 border border-tm-border whitespace-nowrap">{h || `Col ${i+1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewingFile.rows.slice(1).map((row: string[], ri: number) => (
                      <tr key={ri} className={ri % 2 === 0 ? 'bg-tm-surface' : 'bg-tm-surface-hover'}>
                        {row.map((cell: string, ci: number) => (
                          <td key={ci} className="px-3 py-2 text-tm-text-1 border border-tm-border whitespace-nowrap">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-tm-text-3">No preview available for this file.</p>
                  <p className="text-xs text-tm-text-3 mt-1">Files uploaded before this update don&apos;t have stored content. Re-upload the file to enable viewing.</p>
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="flex justify-between items-center p-4 border-t border-tm-border flex-shrink-0">
              <span className="text-xs text-tm-text-3">
                {viewingFile.rows ? `${viewingFile.rows.length - 1} data rows` : 'No data stored'}
                {viewingFile.rows && viewingFile.rows.length >= 300 ? ' (preview capped at 300 rows)' : ''}
              </span>
              <button onClick={() => setViewingFile(null)} className="px-4 py-2 rounded-md text-sm font-medium border border-tm-border text-tm-text-1 hover:bg-tm-surface-hover">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* ── UPLOAD METRICS modal ── */}
      {showUpload && canManage && (() => {
        const sessionCtx = uploadSessionId ? schedules.find(s => s.id === uploadSessionId) : null
        return (
        <ModalShell
          title={sessionCtx ? `Record metrics — ${sessionCtx.description}` : 'Upload gym metrics'}
          icon={Upload}
          onClose={() => { setShowUpload(false); setUploadFile(null); setUploadError(null); setPreviewMetrics(null); setUploadSessionId(null) }}
          footer={
            <>
              <Button variant="outline" onClick={() => { setShowUpload(false); setUploadFile(null); setUploadError(null); setPreviewMetrics(null) }} disabled={uploading || scanning}>
                Cancel
              </Button>
              {!previewMetrics ? (
                <Button icon={ScanLine} onClick={handleScanFile} disabled={scanning || !uploadFile}>
                  {scanning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning…</> : 'Scan File'}
                </Button>
              ) : (
                <Button icon={Save} onClick={handleUpload} disabled={uploading}>
                  {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : `Save ${previewMetrics.length} metrics`}
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-4 p-5">
            {/* Step 1 — file picker */}
            {!previewMetrics && (
              <>
                <div>
                  <label className="tm-label">Select CSV or Excel file</label>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="mt-1 block w-full text-sm text-tm-text-3 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-tm-secondary file:text-tm-on-secondary hover:file:opacity-90"
                  />
                </div>
                {uploadFile && (
                  <div className="rounded-md bg-info/10 p-3">
                    <p className="text-sm font-medium text-tm-text-1">Selected: {uploadFile.name}</p>
                    <p className="text-xs text-tm-text-3">{(uploadFile.size / 1024).toFixed(2)} KB — click <strong>Scan File</strong> to preview</p>
                  </div>
                )}
                <div className="rounded-md bg-tm-surface-hover p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-tm-text-3 mb-1">Detected columns (any header containing these keywords)</p>
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    {[
                      ['Player / Name', 'required'],
                      ['Pull', 'pull-up reps'],
                      ['Bench', 'bench press kg'],
                      ['Deadlift', 'deadlift kg'],
                      ['Squat', 'squat kg'],
                    ].map(([kw, desc]) => (
                      <div key={kw} className="flex items-center gap-1 text-xs">
                        <span className="font-mono bg-tm-surface px-1.5 py-0.5 rounded text-tm-text-1">{kw}</span>
                        <span className="text-tm-text-3">→ {desc}</span>
                      </div>
                    ))}
                  </div>
                  <pre className="text-xs text-tm-text-1 bg-tm-surface p-2 rounded overflow-auto">
{`Player Name,Pull Ups,Bench Press (kg),Deadlift (kg),Squat (kg)
Allan Karuhanga,13,40,98,120
Douglas Komakech,12,68,103,115`}
                  </pre>
                </div>
              </>
            )}

            {/* Step 2 — preview table */}
            {previewMetrics && (
              <>
                <div className="flex items-center gap-2 text-sm text-green-500 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Scanned {previewMetrics.length} player{previewMetrics.length !== 1 ? 's' : ''} from {uploadFile?.name}
                </div>
                <div className="overflow-auto max-h-72 rounded-md border border-tm-border">
                  <table className="w-full text-xs">
                    <thead className="bg-tm-surface-hover sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-tm-text-2">#</th>
                        <th className="text-left px-3 py-2 font-semibold text-tm-text-2">Player Name</th>
                        <th className="text-center px-3 py-2 font-semibold text-tm-text-2">Pull-up PB</th>
                        <th className="text-center px-3 py-2 font-semibold text-tm-text-2">Bench (kg)</th>
                        <th className="text-center px-3 py-2 font-semibold text-tm-text-2">Deadlift (kg)</th>
                        <th className="text-center px-3 py-2 font-semibold text-tm-text-2">Squat (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewMetrics.map((m, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-tm-surface' : 'bg-tm-surface-hover'}>
                          <td className="px-3 py-2 text-tm-text-3">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-tm-text-1">{m.player_name}</td>
                          <td className="px-3 py-2 text-center text-tm-text-1">{m.pull_up_pb ?? <span className="text-tm-text-3">—</span>}</td>
                          <td className="px-3 py-2 text-center text-tm-text-1">{m.bench_press_pb ?? <span className="text-tm-text-3">—</span>}</td>
                          <td className="px-3 py-2 text-center text-tm-text-1">{m.deadlift_pb ?? <span className="text-tm-text-3">—</span>}</td>
                          <td className="px-3 py-2 text-center text-tm-text-1">{m.squat_pb ?? <span className="text-tm-text-3">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-tm-text-3">Review the data above. Click <strong>Save</strong> to persist to the database, or <strong>Cancel</strong> to start over.</p>
                <button
                  onClick={() => { setPreviewMetrics(null); setUploadFile(null); setUploadError(null) }}
                  className="text-xs text-tm-text-3 underline"
                >
                  ← Choose a different file
                </button>
              </>
            )}

            {uploadError && (
              <div className="rounded-md bg-[#E05757]/10 p-3">
                <p className="text-sm text-[#E05757]">{uploadError}</p>
              </div>
            )}
          </div>
        </ModalShell>
        )
      })()}

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
