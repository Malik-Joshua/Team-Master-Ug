'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Layout from '@/components/Layout'
import { Calendar, Users, Save, Download, Plus, Clock, MapPin, FileText, X, Upload, Activity, ChevronDown, FileSpreadsheet, Trash2, CheckCircle2, AlertCircle, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RefreshButton from '@/components/RefreshButton'
import { generatePDFReport, generateExcelReport, generateCSVReport, downloadBlob, type ReportData } from '@/lib/report-export'
import { readTabularFile } from '@/lib/tabular-import'

interface Player {
  id: string
  name: string
  position: string
}

type AttendanceCode = 'P' | 'A' | 'X' | 'I' | ''

interface TrainingSession {
  id: string
  date: string
  title: string
  session_time?: string
  session_end_time?: string
  location?: string
  description?: string
  coach_name?: string
}

interface AttendanceRecord {
  playerId: string
  playerName: string
  sessions: AttendanceCode[]
  totals: {
    P: number
    A: number
    X: number
    I: number
  }
}

const ATTENDANCE_OPTIONS = [
  { value: '' as const,  label: '— Select status —',      color: 'bg-tm-surface text-tm-text-3', border: 'border-tm-border' },
  { value: 'P' as const, label: 'P — Present',            color: 'bg-success text-white',        border: 'border-green-600' },
  { value: 'A' as const, label: 'A — Justified Absence',  color: 'bg-info text-white',           border: 'border-blue-500' },
  { value: 'X' as const, label: 'X — Unjustified Absence',color: 'bg-white text-gray-900',       border: 'border-gray-300' },
  { value: 'I' as const, label: 'I — Injured',            color: 'bg-red-600 text-white',        border: 'border-red-700' },
]

function AttendanceDropdown({ value, onChange }: { value: AttendanceCode; onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = ATTENDANCE_OPTIONS.find((o) => o.value === value)

  return (
    <div ref={ref} className="relative w-full max-w-[210px] mx-auto">
      {/* Trigger button — neutral bg, colored badge only */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 rounded-lg font-semibold text-sm flex items-center justify-between gap-2 border border-tm-border bg-tm-surface text-tm-text-1 transition-all hover:bg-tm-surface-hover"
      >
        <span className="flex items-center gap-2 truncate">
          {selected ? (
            <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs flex-shrink-0 ${selected.color} border ${selected.border}`}>
              {selected.value}
            </span>
          ) : null}
          <span className="truncate">{selected ? selected.label.split('—')[1]?.trim() : '— Select status —'}</span>
        </span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-lg border border-tm-border shadow-lg overflow-hidden bg-tm-surface">
          {ATTENDANCE_OPTIONS.filter((o) => o.value !== '').map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full px-3 py-2 text-sm font-medium flex items-center gap-3 transition-colors bg-tm-surface hover:bg-tm-surface-hover text-tm-text-1 ${
                value === opt.value ? 'bg-tm-surface-hover' : ''
              }`}
            >
              <span className={`w-7 h-7 rounded flex items-center justify-center font-bold text-xs flex-shrink-0 ${opt.color} border ${opt.border}`}>
                {opt.value}
              </span>
              <span>{opt.label.split('—')[1]?.trim()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TimeDropdowns({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  const parts = (() => {
    if (!value) return { hour: '', minute: '', period: 'AM' as 'AM' | 'PM' }
    const [hourValue, minute = '00'] = value.split(':')
    const hour24 = Number(hourValue)
    return {
      hour: String(hour24 % 12 || 12),
      minute,
      period: (hour24 >= 12 ? 'PM' : 'AM') as 'AM' | 'PM',
    }
  })()

  const update = (hour: string, minute: string, period: 'AM' | 'PM') => {
    if (!hour) {
      onChange('')
      return
    }
    const hour12 = Number(hour)
    const hour24 = period === 'PM' ? (hour12 % 12) + 12 : hour12 % 12
    onChange(`${String(hour24).padStart(2, '0')}:${minute || '00'}`)
  }

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
      <select
        aria-label={`${label} hour`}
        value={parts.hour}
        onChange={(e) => update(e.target.value, parts.minute || '00', parts.period)}
        className="w-full px-4 py-2.5 border-2 border-tm-border bg-tm-surface text-tm-text-1 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
      >
        <option value="">Hour</option>
        {Array.from({ length: 12 }, (_, index) => String(index + 1)).map(hour => (
          <option key={hour} value={hour}>{hour}</option>
        ))}
      </select>
      <select
        aria-label={`${label} minute`}
        value={parts.minute}
        disabled={!parts.hour}
        onChange={(e) => update(parts.hour, e.target.value, parts.period)}
        className="w-full px-4 py-2.5 border-2 border-tm-border bg-tm-surface text-tm-text-1 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all disabled:opacity-50"
      >
        <option value="" disabled>Minute</option>
        {Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')).map(minute => (
          <option key={minute} value={minute}>{minute}</option>
        ))}
      </select>
      <select
        aria-label={`${label} AM or PM`}
        value={parts.period}
        disabled={!parts.hour}
        onChange={(e) => update(parts.hour, parts.minute || '00', e.target.value as 'AM' | 'PM')}
        className="px-4 py-2.5 border-2 border-tm-border bg-tm-surface text-tm-text-1 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all disabled:opacity-50"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  )
}

function formatSessionTime(time?: string) {
  if (!time) return ''
  const [hourValue, minute = '00'] = time.split(':')
  const hour24 = Number(hourValue)
  return `${hour24 % 12 || 12}:${minute} ${hour24 >= 12 ? 'PM' : 'AM'}`
}

function getSessionDuration(start?: string, end?: string) {
  if (!start || !end) return ''
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  const totalMinutes = endHour * 60 + endMinute - (startHour * 60 + startMinute)
  if (totalMinutes <= 0) return ''
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return [hours ? `${hours}h` : '', minutes ? `${minutes}m` : ''].filter(Boolean).join(' ')
}

function formatSessionTimeRange(start?: string, end?: string) {
  if (!start) return ''
  if (!end) return formatSessionTime(start)
  const duration = getSessionDuration(start, end)
  return `${formatSessionTime(start)} – ${formatSessionTime(end)}${duration ? ` (${duration})` : ''}`
}

export default function TrainingPage() {
  const [user, setUser] = useState<any>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [attendance, setAttendance] = useState<Record<string, AttendanceCode>>({})
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<number>(1)
  const [selectedSessionId, setSelectedSessionId] = useState<string>('') // For attendance session selection
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    session_date: '',
    session_time: '',
    session_end_time: '',
    location: '',
    description: '',
  })
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  // CSV attendance import state
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStep, setUploadStep] = useState('')
  const [csvRows, setCsvRows] = useState<Array<{
    name: string
    status: AttendanceCode | null
    notes: string
    matchedPlayer: Player | null
    confidence: 'exact' | 'fuzzy' | 'none'
  }>>([])
  const [showCsvPreview, setShowCsvPreview] = useState(false)
  const [csvSessionId, setCsvSessionId] = useState('')
  // When the import modal is opened via "Import Attendance" (manager flow),
  // it's locked to CSV/Excel attendance only — the schedule TXT/PDF half of
  // the modal is hidden, since a manager doesn't create session schedules.
  const [attendanceOnly, setAttendanceOnly] = useState(false)
  const [showGymScheduleForm, setShowGymScheduleForm] = useState(false)
  const [gymScheduleForm, setGymScheduleForm] = useState({
    schedule_date: '',
    schedule_time: '',
    location: '',
    description: '',
    exercises: '',
  })
  const [sessionSummaries, setSessionSummaries] = useState<Array<{
    sessionId: string
    sessionDate: string
    sessionTime?: string
    sessionEndTime?: string
    location?: string
    description?: string
    drills?: string
    present: number
    absent: number
    justified: number
    injured: number
    total: number
    attendanceRate: number
  }>>([])
  const [gymSchedules, setGymSchedules] = useState<any[]>([])
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)

  // ── Training attendance file archive (localStorage-backed) ──────────────
  const [dismissedTrainingSessions, setDismissedTrainingSessions] = useState<Set<string>>(new Set())
  // Dismissed "Training Sessions Summary" cards (per user, persisted locally).
  const [dismissedSummaryCards, setDismissedSummaryCards] = useState<Set<string>>(new Set())
  const [showDismissedSummaries, setShowDismissedSummaries] = useState(false)
  const [recordedTrainingSessions, setRecordedTrainingSessions] = useState<Set<string>>(new Set())
  const [trainingFiles, setTrainingFiles] = useState<any[]>([])
  const [trainingFileFilter, setTrainingFileFilter] = useState<string>('all')
  const [trainingUploadSessionId, setTrainingUploadSessionId] = useState<string | null>(null)
  const [showTrainingFileUpload, setShowTrainingFileUpload] = useState(false)
  const [trainingUploadFile, setTrainingUploadFile] = useState<File | null>(null)
  const [trainingUploadError, setTrainingUploadError] = useState<string | null>(null)
  const [trainingFileUploading, setTrainingFileUploading] = useState(false)
  const trainingUserIdRef = useRef<string | null>(null)
  // Captures file info when a CSV is applied to the grid (uploadFile is
  // cleared at that point, so we snapshot it here before it's gone).
  const [pendingFileRecord, setPendingFileRecord] = useState<{
    file_name: string
    session_id: string
    rows: string[][]
  } | null>(null)
  const [savingDirectly, setSavingDirectly] = useState(false)
  const [viewingTrainingFile, setViewingTrainingFile] = useState<any | null>(null)
  const [deletingTrainingFileId, setDeletingTrainingFileId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
            setLoading(false)
            return
      }

      if (authUser) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (profile) {
          setUser(profile)

          // Load training session localStorage state
          trainingUserIdRef.current = authUser.id
          try {
            const rawDismissed = localStorage.getItem(`dismissed_training_sessions_${authUser.id}`)
            if (rawDismissed) setDismissedTrainingSessions(new Set(JSON.parse(rawDismissed)))
            const rawDismissedSummaries = localStorage.getItem(`dismissed_training_summaries_${authUser.id}`)
            if (rawDismissedSummaries) setDismissedSummaryCards(new Set(JSON.parse(rawDismissedSummaries)))
            const rawRecorded = localStorage.getItem(`recorded_training_sessions_${authUser.id}`)
            if (rawRecorded) setRecordedTrainingSessions(new Set(JSON.parse(rawRecorded)))
            const rawFiles = localStorage.getItem(`training_file_records_${authUser.id}`)
            if (rawFiles) setTrainingFiles(JSON.parse(rawFiles))
          } catch { /* ignore */ }

          // Fetch shared training attendance file records from DB
          if (['coach', 'asst_coach', 'data_admin', 'admin', 'finance_admin'].includes(profile.role)) {
            try {
              const filesRes = await fetch('/api/training-attendance-files', { cache: 'no-store' })
              if (filesRes.ok) {
                const dbFiles = (await filesRes.json()).files || []
                setTrainingFiles(prev => {
                  // DB records take precedence; keep any local-only extras
                  const dbIds = new Set(dbFiles.map((f: any) => f.id))
                  const localOnly = prev.filter((f: any) => f._local && !dbIds.has(f.id))
                  return [...dbFiles, ...localOnly]
                })
              }
            } catch { /* non-fatal */ }
          }

          // Fetch all registered players using API route to bypass RLS
          try {
            const playersResponse = await fetch('/api/admin/players')
            if (playersResponse.ok) {
              const playersData = await playersResponse.json()
              if (playersData.players && Array.isArray(playersData.players)) {
                setPlayers(playersData.players.map((p: any) => ({
                  id: p.user_id || p.id,
                  name: p.name || 'Unknown',
                  position: p.position || 'N/A',
                })))
                console.log(`Loaded ${playersData.players.length} players from API`)
              }
            } else {
              console.warn('API route failed, trying direct query as fallback...')
              // Fallback to direct query if API fails
              const { data: playersData } = await supabase
                .from('user_profiles')
                .select('user_id, name, position')
                .eq('role', 'player')
                .order('name', { ascending: true })

              if (playersData && playersData.length > 0) {
                setPlayers(playersData.map((p: any) => ({
                  id: p.user_id,
                  name: p.name || 'Unknown',
                  position: p.position || 'N/A',
                })))
                console.log(`Loaded ${playersData.length} players from direct query (fallback)`)
              } else {
                console.warn('No players found via direct query either')
              }
            }
          } catch (err) {
            console.error('Error fetching players:', err)
            // Fallback to direct query
            const { data: playersData } = await supabase
              .from('user_profiles')
              .select('user_id, name, position')
              .eq('role', 'player')
              .order('name', { ascending: true })

            if (playersData && playersData.length > 0) {
              setPlayers(playersData.map((p: any) => ({
                id: p.user_id,
                name: p.name || 'Unknown',
                position: p.position || 'N/A',
              })))
            }
          }

          // Fetch training sessions
          if (profile.role === 'coach' || profile.role === 'asst_coach' || profile.role === 'data_admin' || profile.role === 'admin') {
            // Coaches, data admins, and admins see all training sessions
            const { data: sessionsData } = await supabase
              .from('training_sessions')
              .select(`
                *,
                coach:user_profiles!training_sessions_coach_id_fkey(name)
              `)
              .order('session_date', { ascending: false })

            if (sessionsData) {
              const formattedSessions: TrainingSession[] = sessionsData.map((s: any) => ({
                id: s.id,
                date: s.session_date,
                title: s.description || `Training Session ${s.session_number}`,
                session_time: s.session_time,
                session_end_time: s.session_end_time,
                location: s.location,
                description: s.description,
                coach_name: s.coach?.name || 'Coach',
              }))
              setSessions(formattedSessions)

              // Fetch session summaries with attendance data for coaches, data admins, and admins
              const summaries = await Promise.all(
                sessionsData.map(async (session: any) => {
                  // Use API route to bypass RLS for attendance data
                  let attendanceData: any[] = []
                  
                  try {
                    const response = await fetch(`/api/training/attendance?session_id=${session.id}`)
                    if (response.ok) {
                      const apiData = await response.json()
                      attendanceData = apiData.attendance || []
                    } else {
                      console.warn(`Failed to fetch attendance for session ${session.id}:`, response.statusText)
                    }
                  } catch (err) {
                    console.error('Error fetching attendance via API:', err)
                  }

                  const present = attendanceData?.filter((a: any) => a.attendance_status === 'P').length || 0
                  const absent = attendanceData?.filter((a: any) => a.attendance_status === 'X').length || 0
                  const justified = attendanceData?.filter((a: any) => a.attendance_status === 'A').length || 0
                  const injured = attendanceData?.filter((a: any) => a.attendance_status === 'I').length || 0
                  const total = attendanceData?.length || 0
                  const attendanceRate = total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0

                  return {
                    sessionId: session.id,
                    sessionDate: session.session_date,
                    sessionTime: session.session_time,
                    sessionEndTime: session.session_end_time,
                    location: session.location,
                    description: session.description,
                    drills: session.description, // Using description as drills/activities
                    present,
                    absent,
                    justified,
                    injured,
                    total,
                    attendanceRate,
                  }
                })
              )
              setSessionSummaries(summaries)
            }
          } else if (profile.role === 'player') {
            // For players, fetch upcoming training sessions (from today onwards)
            const today = new Date().toISOString().split('T')[0]
            const { data: sessionsData } = await supabase
              .from('training_sessions')
              .select(`
                *,
                coach:user_profiles!training_sessions_coach_id_fkey(name)
              `)
              .gte('session_date', today)
              .order('session_date', { ascending: true })

            if (sessionsData) {
              const formattedSessions: TrainingSession[] = sessionsData.map((s: any) => ({
                id: s.id,
                date: s.session_date,
                title: s.description || `Training Session ${s.session_number}`,
                session_time: s.session_time,
                session_end_time: s.session_end_time,
                location: s.location,
                description: s.description,
                coach_name: s.coach?.name || 'Coach',
              }))
              setSessions(formattedSessions)
            }

            // Fetch gym schedules for players using API route
            try {
              const gymSchedulesResponse = await fetch('/api/gym-schedules', {
                cache: 'no-store',
              })
              
              if (gymSchedulesResponse.ok) {
                const gymSchedulesData = await gymSchedulesResponse.json()
                if (gymSchedulesData.schedules && gymSchedulesData.schedules.length > 0) {
                  // Filter to show upcoming gym schedules (from today onwards)
                  const todayDate = new Date()
                  todayDate.setHours(0, 0, 0, 0)
                  
                  const upcomingGymSchedules = gymSchedulesData.schedules
                    .filter((schedule: any) => {
                      const scheduleDate = new Date(schedule.schedule_date)
                      scheduleDate.setHours(0, 0, 0, 0)
                      return scheduleDate >= todayDate
                    })
                    .sort((a: any, b: any) => 
                      new Date(a.schedule_date).getTime() - new Date(b.schedule_date).getTime()
                    )
                  
                  setGymSchedules(upcomingGymSchedules)
                  console.log(`Loaded ${upcomingGymSchedules.length} upcoming gym schedule(s) for player`)
                } else {
                  setGymSchedules([])
                  console.log('No gym schedules found')
                }
              } else {
                console.error('Error fetching gym schedules via API:', gymSchedulesResponse.status)
                setGymSchedules([])
              }
            } catch (gymError) {
              console.error('Error fetching gym schedules:', gymError)
              setGymSchedules([])
            }
          } else {
            // For other roles, fetch all sessions
            const { data: sessionsData } = await supabase
              .from('training_sessions')
              .select('*')
              .order('session_date', { ascending: false })

            if (sessionsData) {
              const formattedSessions: TrainingSession[] = sessionsData.map((s: any) => ({
                id: s.id,
                date: s.session_date,
                title: s.description || `Training Session ${s.session_number}`,
                session_time: s.session_time,
                session_end_time: s.session_end_time,
                location: s.location,
                description: s.description,
              }))
              setSessions(formattedSessions)
            }
          }
        }
      }
      setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    // Close export menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showExportMenu && !target.closest('.export-menu-container')) {
        setShowExportMenu(false)
      }
    }

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportMenu])

  const parseTextFile = async (file: File): Promise<Array<{
    date: string
    time?: string
    location?: string
    description?: string
  }>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const lines = text.split('\n').filter(line => line.trim())
          const sessions: Array<{
            date: string
            time?: string
            location?: string
            description?: string
          }> = []

          // Try to parse different formats
          // Format 1: Date, Time, Location, Description (comma or tab separated)
          // Format 2: Date - Description
          // Format 3: Date | Time | Location | Description
          
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            // Try comma-separated
            if (trimmed.includes(',')) {
              const parts = trimmed.split(',').map(p => p.trim())
              if (parts.length >= 1) {
                const dateStr = parts[0]
                const date = parseDate(dateStr)
                if (date) {
                  sessions.push({
                    date,
                    time: parts[1] || undefined,
                    location: parts[2] || undefined,
                    description: parts.slice(3).join(', ') || parts[2] || undefined,
                  })
                }
              }
            }
            // Try pipe-separated
            else if (trimmed.includes('|')) {
              const parts = trimmed.split('|').map(p => p.trim())
              if (parts.length >= 1) {
                const dateStr = parts[0]
                const date = parseDate(dateStr)
                if (date) {
                  sessions.push({
                    date,
                    time: parts[1] || undefined,
                    location: parts[2] || undefined,
                    description: parts.slice(3).join(' | ') || parts[2] || undefined,
                  })
                }
              }
            }
            // Try tab-separated
            else if (trimmed.includes('\t')) {
              const parts = trimmed.split('\t').map(p => p.trim())
              if (parts.length >= 1) {
                const dateStr = parts[0]
                const date = parseDate(dateStr)
                if (date) {
                  sessions.push({
                    date,
                    time: parts[1] || undefined,
                    location: parts[2] || undefined,
                    description: parts.slice(3).join(' ') || parts[2] || undefined,
                  })
                }
              }
            }
            // Try dash-separated (Date - Description)
            else if (trimmed.includes(' - ')) {
              const parts = trimmed.split(' - ').map(p => p.trim())
              if (parts.length >= 1) {
                const dateStr = parts[0]
                const date = parseDate(dateStr)
                if (date) {
                  sessions.push({
                    date,
                    description: parts.slice(1).join(' - ') || undefined,
                  })
                }
              }
            }
            // Try to parse as just a date
            else {
              const date = parseDate(trimmed)
              if (date) {
                sessions.push({ date })
              }
            }
          }

          resolve(sessions)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  const parseDate = (dateStr: string): string | null => {
    // Try various date formats
    const formats = [
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
      /(\d{2})\/(\d{2})\/(\d{2})/, // MM/DD/YY
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // M/D/YYYY
      /(\d{1,2})-(\d{1,2})-(\d{4})/, // M-D-YYYY
      /(\d{1,2})\s+(\w+)\s+(\d{4})/, // D Month YYYY
    ]

    for (const format of formats) {
      const match = dateStr.match(format)
      if (match) {
        try {
          const date = new Date(dateStr)
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0]
          }
        } catch (e) {
          // Continue to next format
        }
      }
    }

    // Try direct Date parsing
    try {
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]
      }
    } catch (e) {
      // Ignore
    }

    return null
  }

  const parsePDFFile = async (file: File): Promise<Array<{
    date: string
    time?: string
    location?: string
    description?: string
  }>> => {
    try {
      // Dynamically import pdfjs-dist only when needed and in browser
      if (typeof window === 'undefined') {
        throw new Error('PDF parsing is only available in the browser')
      }

      const pdfjsLib = await import('pdfjs-dist')
      
      // Set worker source
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const sessions: Array<{
        date: string
        time?: string
        location?: string
        description?: string
      }> = []

      // Extract text from all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const text = textContent.items.map((item: any) => item.str).join('\n')
        
        // Parse the text similar to text file parsing
        const lines = text.split('\n').filter(line => line.trim())
        
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          // Try comma-separated
          if (trimmed.includes(',')) {
            const parts = trimmed.split(',').map(p => p.trim())
            if (parts.length >= 1) {
              const dateStr = parts[0]
              const date = parseDate(dateStr)
              if (date) {
                sessions.push({
                  date,
                  time: parts[1] || undefined,
                  location: parts[2] || undefined,
                  description: parts.slice(3).join(', ') || parts[2] || undefined,
                })
              }
            }
          }
          // Try dash-separated
          else if (trimmed.includes(' - ')) {
            const parts = trimmed.split(' - ').map(p => p.trim())
            if (parts.length >= 1) {
              const dateStr = parts[0]
              const date = parseDate(dateStr)
              if (date) {
                sessions.push({
                  date,
                  description: parts.slice(1).join(' - ') || undefined,
                })
              }
            }
          }
          // Try to parse as just a date
          else {
            const date = parseDate(trimmed)
            if (date) {
              sessions.push({ date })
            }
          }
        }
      }

      return sessions
    } catch (error) {
      console.error('Error parsing PDF:', error)
      throw new Error('Failed to parse PDF file. Please ensure the PDF contains readable text.')
    }
  }

  // ── CSV attendance import ──────────────────────────────────────────────────
  // Parses a CSV whose rows are: player_name, status (P/A/X/I or words),
  // optional notes.  Animates a progress bar through four labelled steps,
  // then fuzzy-matches each name against the live players roster and fills
  // the csvRows state so the coach can review before applying to the grid.
  const handleCsvImport = async (file: File) => {
    setUploading(true)
    setUploadProgress(0)
    setShowCsvPreview(false)
    setCsvRows([])

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    try {
      // Step 1 — read the raw file (CSV, TSV, or Excel)
      setUploadStep('Reading file…')
      setUploadProgress(10)
      const grid = await readTabularFile(file)
      await sleep(300)
      setUploadProgress(25)

      // Step 2 — parse rows
      setUploadStep('Parsing rows…')
      await sleep(200)

      // Detect header — skip if first row looks like column names
      const HEADER_WORDS = ['player', 'name', 'status', 'attendance', 'note']
      const firstRowLower = (grid[0]?.join(' ') ?? '').toLowerCase()
      const hasHeader = HEADER_WORDS.some(w => firstRowLower.includes(w))
      const dataRows = hasHeader ? grid.slice(1) : grid

      // Normalise status string → AttendanceCode
      const normaliseStatus = (raw: string): AttendanceCode | null => {
        const s = raw.trim().toUpperCase()
        if (s === 'P' || s.startsWith('PRES')) return 'P'
        if (s === 'A' || s.startsWith('EXC') || s.startsWith('JUST')) return 'A'
        if (s === 'X' || s.startsWith('ABS') || s.startsWith('UNEXC')) return 'X'
        if (s === 'I' || s.startsWith('INJ')) return 'I'
        return null
      }

      type RawRow = { name: string; status: AttendanceCode | null; notes: string }
      const rawRows: RawRow[] = []
      for (const parts of dataRows) {
        if (!parts[0]) continue
        rawRows.push({
          name:   parts[0],
          status: normaliseStatus(parts[1] ?? ''),
          notes:  parts.slice(2).join(', '),
        })
      }
      setUploadProgress(50)
      await sleep(300)

      // Step 3 — match names to roster.
      // Always work from a guaranteed-fresh roster: if the in-memory list is
      // empty (e.g. the modal was opened before players finished loading) the
      // matcher would mark everyone "Not found", so refetch before matching.
      setUploadStep('Matching players to roster…')
      let roster = players
      if (roster.length === 0) {
        try {
          const rosterRes = await fetch('/api/admin/players', { cache: 'no-store' })
          if (rosterRes.ok) {
            const rosterData = await rosterRes.json()
            if (Array.isArray(rosterData.players)) {
              roster = rosterData.players.map((p: any) => ({
                id: p.user_id || p.id,
                name: p.name || 'Unknown',
                position: p.position || 'N/A',
              }))
              setPlayers(roster)
            }
          }
        } catch (err) {
          console.error('Could not refresh roster for matching:', err)
        }
      }

      const normaliseName = (value: string) =>
        value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

      const matched = []
      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i]
        const nameLower = normaliseName(row.name)

        // Exact match first
        let player = roster.find(p => normaliseName(p.name) === nameLower) ?? null
        let confidence: 'exact' | 'fuzzy' | 'none' = player ? 'exact' : 'none'

        // Fuzzy: every word in the CSV name appears in the player name, or vice
        // versa (handles "Allan" vs "Allan Karuhanga" and reordered names).
        if (!player && nameLower) {
          const words = nameLower.split(' ').filter(Boolean)
          player = roster.find(p => {
            const pn = normaliseName(p.name)
            const pnWords = pn.split(' ').filter(Boolean)
            return (
              words.every(w => pn.includes(w)) ||
              pnWords.every(w => nameLower.includes(w))
            )
          }) ?? null
          if (player) confidence = 'fuzzy'
        }

        matched.push({ ...row, matchedPlayer: player, confidence })
        // Animate progress across players
        setUploadProgress(50 + Math.round(((i + 1) / rawRows.length) * 35))
        await sleep(60)
      }
      setUploadProgress(90)
      await sleep(200)

      // Step 4 — done
      setUploadStep('Done — review below')
      setUploadProgress(100)
      await sleep(250)

      setCsvRows(matched)
      setShowCsvPreview(true)
      // Pre-select the first available session if none chosen
      if (!csvSessionId && sessions.length > 0) {
        setCsvSessionId(sessions[0].id ?? '')
      }
    } catch (err: any) {
      console.error('CSV parse error', err)
      alert(`Could not read file: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  // Apply the reviewed CSV rows to the live attendance grid and close the modal
  const applyCSVToGrid = () => {
    if (!csvSessionId) {
      alert('Please select a session to apply the attendance to.')
      return
    }
    const updates: Record<string, AttendanceCode> = {}
    for (const row of csvRows) {
      if (row.matchedPlayer && row.status) {
        updates[`${row.matchedPlayer.id}-${csvSessionId}`] = row.status
      }
    }
    if (Object.keys(updates).length === 0) {
      alert('No matched players with a valid status were found. Check the CSV format.')
      return
    }
    setAttendance(prev => ({ ...prev, ...updates }))
    setSelectedSessionId(csvSessionId)
    // Snapshot the file name + session before uploadFile is cleared
    if (uploadFile && csvSessionId) {
      setPendingFileRecord({
        file_name: uploadFile.name,
        session_id: csvSessionId,
        rows: [
          ['Player', 'Status', 'Notes'],
          ...csvRows.map(row => [row.name, row.status ?? '', row.notes]),
        ].slice(0, 300),
      })
    }
    // Close and reset
    setShowUploadForm(false)
    setUploadFile(null)
    setShowCsvPreview(false)
    setCsvRows([])
    setUploadProgress(0)
    setUploadStep('')
  }

  const resetUploadModal = () => {
    setShowUploadForm(false)
    setUploadFile(null)
    setShowCsvPreview(false)
    setCsvRows([])
    setUploadProgress(0)
    setUploadStep('')
    setAttendanceOnly(false)
    setCsvSessionId('')
    setUploading(false)
  }

  // Opens the attendance import modal from a clean state so a previous run
  // (rows, preview, progress) can never leak into the new upload.
  const openAttendanceImport = (sessionId?: string) => {
    setUploadFile(null)
    setShowCsvPreview(false)
    setCsvRows([])
    setUploadProgress(0)
    setUploadStep('')
    setUploading(false)
    setAttendanceOnly(true)
    setCsvSessionId(sessionId || '')
    setShowUploadForm(true)
  }
  // ─────────────────────────────────────────────────────────────────────────

  const handleFileUpload = async () => {
    if (!uploadFile) {
      alert('Please select a file to upload')
      return
    }

    // CSV / Excel files → player attendance import flow (progress bar +
    // preview). In attendance-only mode (manager) everything routes here.
    const nameLower = uploadFile.name.toLowerCase()
    const isSpreadsheet =
      nameLower.endsWith('.csv') ||
      nameLower.endsWith('.xlsx') ||
      nameLower.endsWith('.xls') ||
      uploadFile.type === 'text/csv' ||
      uploadFile.type.includes('spreadsheetml') ||
      uploadFile.type === 'application/vnd.ms-excel'
    if (attendanceOnly || isSpreadsheet) {
      await handleCsvImport(uploadFile)
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        alert('Please log in to upload training schedule')
        return
      }

      let parsedSessions: Array<{
        date: string
        time?: string
        location?: string
        description?: string
      }> = []

      // Parse file based on type
      if (uploadFile.type === 'application/pdf' || uploadFile.name.endsWith('.pdf')) {
        parsedSessions = await parsePDFFile(uploadFile)
      } else if (uploadFile.type === 'text/plain' || uploadFile.name.endsWith('.txt')) {
        parsedSessions = await parseTextFile(uploadFile)
      } else {
        // Try to parse as text anyway
        parsedSessions = await parseTextFile(uploadFile)
      }

      if (parsedSessions.length === 0) {
        alert('No training sessions found in the file. Please check the file format.')
        setUploading(false)
        return
      }

      // Get the next session number for this coach
      const { data: existingSessions } = await supabase
        .from('training_sessions')
        .select('session_number')
        .eq('coach_id', authUser.id)
        .order('session_number', { ascending: false })
        .limit(1)

      let nextSessionNumber = existingSessions && existingSessions.length > 0 
        ? existingSessions[0].session_number + 1 
        : 1

      // Create training sessions
      const sessionsToCreate = parsedSessions.map((session, index) => ({
        session_number: nextSessionNumber + index,
        session_date: session.date,
        session_time: session.time || null,
        location: session.location || null,
        description: session.description || null,
        coach_id: authUser.id,
      }))

      const { data: newSessions, error } = await supabase
        .from('training_sessions')
        .insert(sessionsToCreate)
        .select()

      if (error) throw error

      // Put each new session on the coach collaboration feed and alert the
      // other coach(es), so the Head Coach and Assistant can review and
      // discuss each other's scheduling instead of silently clashing.
      // Non-blocking: the sessions are already saved.
      for (const s of newSessions || []) {
        try {
          await fetch('/api/collaboration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: 'training_session',
              referenceId: s.id,
              subject: `Session #${s.session_number}`,
              date: s.session_date,
            }),
          })
        } catch (e) { console.warn('Collaboration feed post failed:', e) }
      }

      // Refresh sessions list
      const { data: coachSessions } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('coach_id', authUser.id)
        .order('session_date', { ascending: true })

      if (coachSessions) {
        const formattedSessions: TrainingSession[] = coachSessions.map((s: any) => ({
          id: s.id,
          date: s.session_date,
          title: s.description || `Training Session ${s.session_number}`,
          session_time: s.session_time,
          session_end_time: s.session_end_time,
          location: s.location,
          description: s.description,
        }))
        setSessions(formattedSessions)
      }

      setUploadFile(null)
      setShowUploadForm(false)
      alert(`Successfully imported ${parsedSessions.length} training session(s)!`)
    } catch (error: any) {
      console.error('Error uploading file:', error)
      alert(`Error uploading file: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleCreateSchedule = async () => {
    if (savingSchedule) return
    try {
      setSavingSchedule(true)
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        alert('Please log in to create training schedule')
        return
      }

      if (!scheduleForm.session_date) {
        alert('Please select a date for the training session')
        return
      }
      if (!scheduleForm.session_time || !scheduleForm.session_end_time) {
        alert('Please select both a start time and finish time')
        return
      }
      if (scheduleForm.session_end_time <= scheduleForm.session_time) {
        alert('Finish time must be later than start time')
        return
      }

      // Create through the server API so coach, assistant coach, and manager
      // accounts all use the same validated flow without client-side RLS issues.
      const createResponse = await fetch('/api/training/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleForm),
      })
      const createResult = await createResponse.json()
      if (!createResponse.ok) {
        throw new Error(createResult.error || 'Failed to create training session')
      }
      const newSession = createResult.session

      // Feed + alert the other coach(es) — see the bulk-create path above.
      try {
        await fetch('/api/collaboration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'training_session',
            referenceId: newSession.id,
            subject: `Session #${newSession.session_number}`,
            date: newSession.session_date,
          }),
        })
      } catch (e) { console.warn('Collaboration feed post failed:', e) }

      // Get coach name for notification
      const { data: coachProfile } = await supabase
        .from('user_profiles')
        .select('name')
        .eq('user_id', authUser.id)
        .single()

      const coachName = coachProfile?.name || 'Coach'

      // Create notifications for all users about the new training session
      try {
        const { db } = await import('@/lib/db-helpers')
        
        // Get all user IDs
        const { data: allUsers } = await supabase
          .from('user_profiles')
          .select('user_id')
        
        if (allUsers && allUsers.length > 0) {
          const userIds = allUsers.map((u: any) => u.user_id)
          const sessionDate = new Date(scheduleForm.session_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
          
          await db.createNotificationForUsers(userIds, {
            title: 'New Training Session Scheduled',
            message: `${coachName} has scheduled a new training session on ${sessionDate} from ${formatSessionTime(scheduleForm.session_time)} to ${formatSessionTime(scheduleForm.session_end_time)}${scheduleForm.location ? ` - ${scheduleForm.location}` : ''}`,
            type: 'info',
            action_url: '/training',
            reference_id: newSession.id,
            reference_type: 'training_session',
          })
        }
      } catch (notifError) {
        console.error('Error creating notifications:', notifError)
        // Don't fail the whole operation if notifications fail
      }

      setScheduleForm({ session_date: '', session_time: '', session_end_time: '', location: '', description: '' })
      setShowScheduleForm(false)
      await loadData()
      alert('Training session created successfully! All users have been notified.')
    } catch (error: any) {
      console.error('Error creating schedule:', error)
      alert(`Error creating schedule: ${error.message}`)
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this training session? This will also remove all attendance records for this session.')) {
      return
    }

    setDeletingSessionId(sessionId)
    try {
      const response = await fetch(`/api/training/sessions?session_id=${sessionId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete training session')
      }

      setSessions(prev => prev.filter(s => s.id !== sessionId))
      setSessionSummaries(prev => prev.filter(s => s.sessionId !== sessionId))
      if (selectedSessionId === sessionId) {
        setSelectedSessionId('')
        setAttendance({})
      }
    } catch (error: any) {
      console.error('Error deleting session:', error)
      alert(`Error deleting session: ${error.message}`)
    } finally {
      setDeletingSessionId(null)
    }
  }

  const handleCreateGymSchedule = async () => {
    try {
      if (!gymScheduleForm.schedule_date || !gymScheduleForm.description) {
        alert('Please fill in the required fields (date and description)')
        return
      }

      // Use API route to create gym schedule (bypasses RLS and handles table creation errors)
      const response = await fetch('/api/gym-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule_date: gymScheduleForm.schedule_date,
          schedule_time: gymScheduleForm.schedule_time || null,
          location: gymScheduleForm.location || null,
          description: gymScheduleForm.description,
          exercises: gymScheduleForm.exercises || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        // Check if it's a table not found error
        if (result.code === 'TABLE_NOT_FOUND') {
          alert(`Error: The gym_schedules table does not exist in your database.\n\nPlease run the migration file in your Supabase SQL Editor:\n${result.migration_file}\n\nThis will create the necessary table and permissions.`)
        } else {
          alert(`Error creating gym schedule: ${result.error || 'Unknown error'}`)
        }
        return
      }

      setGymScheduleForm({ schedule_date: '', schedule_time: '', location: '', description: '', exercises: '' })
      setShowGymScheduleForm(false)
      alert('Gym schedule created successfully! Players, data managers, and admins have been notified.')
      
      // Optionally reload the page to show the new schedule
      // window.location.reload()
    } catch (error: any) {
      console.error('Error creating gym schedule:', error)
      alert(`Error creating gym schedule: ${error.message || 'Unknown error'}`)
    }
  }

  const handleAttendanceChange = (playerId: string, sessionId: string, code: AttendanceCode) => {
    setAttendance((prev) => ({
      ...prev,
      [`${playerId}-${sessionId}`]: code,
    }))
  }

  // Load existing attendance for a specific session
  const loadAttendanceForSession = async (sessionId: string) => {
    try {
      const supabase = createClient()
      const { data: attendanceData, error } = await supabase
        .from('training_attendance')
        .select('player_id, attendance_status')
        .eq('session_id', sessionId)

      if (error) {
        console.error('Error loading attendance:', error)
        return
      }

      if (attendanceData) {
        const attendanceMap: Record<string, AttendanceCode> = {}
        attendanceData.forEach((record: any) => {
          attendanceMap[`${record.player_id}-${sessionId}`] = record.attendance_status as AttendanceCode
        })
        setAttendance(attendanceMap)
      }
    } catch (err) {
      console.error('Error loading attendance:', err)
    }
  }

  const calculateTotals = (playerId: string) => {
    const totals = { P: 0, A: 0, X: 0, I: 0 }
    for (let i = 1; i <= sessions.length; i++) {
      const code = attendance[`${playerId}-${i}`]
      if (code === 'P') totals.P++
      else if (code === 'A') totals.A++
      else if (code === 'X') totals.X++
      else if (code === 'I') totals.I++
    }
    return totals
  }

  const handleSave = async () => {
    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        alert('Please log in to save attendance')
        return
      }

      // Validate session selection
      if (!selectedSessionId && (user?.role === 'coach' || user?.role === 'asst_coach' || user?.role === 'data_admin')) {
        alert('Please select a training session to record attendance for')
        return
      }

      // Use selected session ID or fallback to selectedSession index for backward compatibility
      let sessionId: string
      if (selectedSessionId) {
        sessionId = selectedSessionId
      } else {
        const session = sessions[selectedSession - 1]
        if (session && session.id && !session.id.startsWith('session-')) {
          sessionId = session.id
        } else {
          alert('Please select a valid training session')
          return
        }
      }

      // Prepare attendance records - only include valid attendance codes
      const attendanceRecords = players
        .map(player => {
          const key = `${player.id}-${sessionId}`
          const code: AttendanceCode | undefined = attendance[key]
          
          // Check if code is valid - explicitly check for each valid value
          if (!code) {
            return null
          }
          
          // Check if it's a valid non-empty code
          if (code !== 'P' && code !== 'A' && code !== 'X' && code !== 'I') {
            return null
          }
          
          // At this point, TypeScript knows code is 'P' | 'A' | 'X' | 'I'
          return {
            session_id: sessionId,
            player_id: player.id,
            attendance_status: code,
            recorded_by: authUser.id,
          }
        })
        .filter((item): item is {
          session_id: string
          player_id: string
          attendance_status: 'P' | 'A' | 'X' | 'I'
          recorded_by: string
        } => item !== null)

      if (attendanceRecords.length === 0) {
        alert('Please mark attendance for at least one player')
        return
      }

      // Log what we're sending for debugging
      console.log('Sending attendance records:', JSON.stringify(attendanceRecords, null, 2))
      
      // Double-check all records have valid attendance_status
      const invalidRecords = attendanceRecords.filter(r => 
        !r.attendance_status || 
        (r.attendance_status !== 'P' && r.attendance_status !== 'A' && r.attendance_status !== 'X' && r.attendance_status !== 'I')
      )
      
      if (invalidRecords.length > 0) {
        console.error('Found invalid records before sending:', invalidRecords)
        alert('Error: Some attendance records have invalid status. Please try again.')
        return
      }

      // Insert attendance records using API route to bypass RLS
      const response = await fetch('/api/training/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceRecords }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save attendance')
      }

      alert('Attendance saved successfully!')

      // If this save came from a CSV import, save the file record to the DB
      // so all accounts see it in the "Uploaded attendance files" archive.
      if (pendingFileRecord) {
        const sessionCtx = sessions.find(s => s.id === pendingFileRecord.session_id)
        // 1. Save to DB (cross-account)
        try {
          const fileRes = await fetch('/api/training-attendance-files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: pendingFileRecord.session_id,
              file_name: pendingFileRecord.file_name,
              rows: pendingFileRecord.rows,
            }),
          })
          if (fileRes.ok) {
            const { file: savedFile } = await fileRes.json()
            // Optimistically add to local state with enriched info
            const enriched = {
              ...savedFile,
              uploader_name: user?.name ?? null,
              session: sessionCtx
                ? { title: sessionCtx.title ?? sessionCtx.description, date: sessionCtx.date }
                : null,
            }
            setTrainingFiles(prev => [enriched, ...prev.filter(f => f.id !== enriched.id)])
          }
        } catch { /* non-fatal */ }
        // 2. Also mark in localStorage as fallback
        markTrainingSessionRecorded(pendingFileRecord.session_id)
        saveLocalTrainingFileRecord({
          session_id: pendingFileRecord.session_id,
          file_name: pendingFileRecord.file_name,
          session_title: sessionCtx?.title ?? sessionCtx?.description ?? undefined,
          session_date: sessionCtx?.date ?? undefined,
          uploader_name: user?.name ?? undefined,
          rows: pendingFileRecord.rows,
        })
        setPendingFileRecord(null)
      }

      // Refresh session summaries so past-session cards update immediately.
      await loadData()
    } catch (error: any) {
      console.error('Error saving attendance:', error)
      alert(`Error saving attendance: ${error.message}`)
    }
  }

  // ── Direct attendance save (used when uploading from a past-session card) ─
  const saveAttendanceDirectly = async () => {
    if (!csvSessionId) { alert('Please select a session'); return }
    const matchedRows = csvRows.filter(r => r.matchedPlayer && r.status)
    if (matchedRows.length === 0) {
      alert('No matched players found. Check the CSV format and make sure player names match the roster.')
      return
    }
    setSavingDirectly(true)
    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { alert('Please log in'); return }

      const attendanceRecords = matchedRows.map(row => ({
        session_id: csvSessionId,
        player_id: row.matchedPlayer!.id,
        attendance_status: row.status! as 'P' | 'A' | 'X' | 'I',
        recorded_by: authUser.id,
      }))

      const response = await fetch('/api/training/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceRecords }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to save attendance')
      }

      // Save file record to DB so all accounts see it
      const fileName = uploadFile?.name
      if (fileName) {
        const previewRows = [
          ['Player', 'Status', 'Notes'],
          ...csvRows.map(row => [row.name, row.status ?? '', row.notes]),
        ].slice(0, 300)
        const fileRes = await fetch('/api/training-attendance-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: csvSessionId,
            file_name: fileName,
            rows: previewRows,
          }),
        })
        if (!fileRes.ok) {
          const fileError = await fileRes.json()
          throw new Error(fileError.error || 'Attendance was saved, but the uploaded file could not be archived')
        }

        const { file: savedFile } = await fileRes.json()
        const sessionCtx = sessions.find(s => s.id === csvSessionId)
        const enriched = {
          ...savedFile,
          uploader_name: user?.name ?? null,
          session: sessionCtx
            ? { title: sessionCtx.title ?? sessionCtx.description, date: sessionCtx.date }
            : null,
        }
        setTrainingFiles(prev => [enriched, ...prev.filter(f => f.id !== enriched.id)])
        markTrainingSessionRecorded(csvSessionId)
      }

      resetUploadModal()
      await loadData()
      alert(`Attendance saved! ${matchedRows.length} of ${csvRows.length} players recorded.`)
    } catch (err: any) {
      alert(`Error saving attendance: ${err.message}`)
    } finally {
      setSavingDirectly(false)
    }
  }
  // ── Training file archive helpers ──────────────────────────────────────
  const downloadTrainingFileFromRows = (f: any) => {
    const rows: string[][] = f.rows
    if (!rows || rows.length === 0) return
    const csv = rows.map((r: string[]) =>
      r.map((c: string) => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = f.file_name || 'attendance.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDeleteTrainingFile = async (f: any) => {
    if (!window.confirm(`Delete "${f.file_name}" from the archive? The saved attendance records will not be affected.`)) return
    setDeletingTrainingFileId(f.id)
    try {
      if (f._local) {
        setTrainingFiles(prev => {
          const next = prev.filter((x: any) => x.id !== f.id)
          try {
            localStorage.setItem(
              `training_file_records_${trainingUserIdRef.current}`,
              JSON.stringify(next.filter((x: any) => x._local))
            )
          } catch { /* ignore */ }
          return next
        })
        return
      }
      const res = await fetch('/api/training-attendance-files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: f.id }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed')
      setTrainingFiles(prev => prev.filter((x: any) => x.id !== f.id))
    } catch (e: any) {
      alert(`Could not delete file: ${e.message}`)
    } finally {
      setDeletingTrainingFileId(null)
    }
  }

  const dismissTrainingSession = (id: string) => {
    setDismissedTrainingSessions(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem(`dismissed_training_sessions_${trainingUserIdRef.current}`, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  const persistDismissedSummaries = (next: Set<string>) => {
    try { localStorage.setItem(`dismissed_training_summaries_${trainingUserIdRef.current}`, JSON.stringify([...next])) } catch { /* ignore */ }
  }

  const dismissSummaryCard = (id: string) => {
    setDismissedSummaryCards(prev => {
      const next = new Set(prev)
      next.add(id)
      persistDismissedSummaries(next)
      return next
    })
  }

  const restoreSummaryCard = (id: string) => {
    setDismissedSummaryCards(prev => {
      const next = new Set(prev)
      next.delete(id)
      persistDismissedSummaries(next)
      return next
    })
  }

  const markTrainingSessionRecorded = (id: string) => {
    setRecordedTrainingSessions(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem(`recorded_training_sessions_${trainingUserIdRef.current}`, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  const saveLocalTrainingFileRecord = (record: {
    session_id: string | null
    file_name: string
    session_title?: string
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
      download_url: null,
      uploader_name: record.uploader_name ?? null,
      session: record.session_title
        ? { title: record.session_title, date: record.session_date ?? '' }
        : null,
      rows: record.rows ? record.rows.slice(0, 300) : undefined,
    }
    setTrainingFiles(prev => {
      const next = [entry, ...prev]
      try { localStorage.setItem(`training_file_records_${trainingUserIdRef.current}`, JSON.stringify(next.filter((f: any) => f._local))) } catch { /* ignore */ }
      return next
    })
  }

  const handleTrainingFileUpload = async () => {
    if (!trainingUploadFile) { setTrainingUploadError('Please select a file'); return }
    setTrainingFileUploading(true)
    setTrainingUploadError(null)
    try {
      // Parse the file so we can show its content in-app
      let rows: string[][] | undefined
      try {
        rows = await readTabularFile(trainingUploadFile)
      } catch { rows = undefined }

      const sessionCtx = trainingUploadSessionId
        ? sessions.find(s => s.id === trainingUploadSessionId)
        : null
      if (trainingUploadSessionId) markTrainingSessionRecorded(trainingUploadSessionId)
      saveLocalTrainingFileRecord({
        session_id: trainingUploadSessionId,
        file_name: trainingUploadFile.name,
        session_title: sessionCtx?.title ?? sessionCtx?.description ?? undefined,
        session_date: sessionCtx?.date ?? undefined,
        rows,
        uploader_name: user?.name ?? undefined,
      })
      setShowTrainingFileUpload(false)
      setTrainingUploadFile(null)
      setTrainingUploadSessionId(null)
    } catch (e: any) {
      setTrainingUploadError(e.message)
    } finally {
      setTrainingFileUploading(false)
    }
  }
  // ───────────────────────────────────────────────────────────────────────────

  const getCodeColor = (code: AttendanceCode) => {
    switch (code) {
      case 'P': return 'bg-success text-white'
      case 'A': return 'bg-info text-white'
      case 'X': return 'bg-white text-gray-900'
      case 'I': return 'bg-red-600 text-white'
      default:  return 'bg-tm-surface-hover text-tm-text-3'
    }
  }

  const handleExportTraining = async (format: 'pdf' | 'excel' | 'csv') => {
    try {
      setExporting(true)
      const supabase = createClient()
      
      // Get all training sessions with attendance data
      const exportData: any[] = []
      
      for (const session of sessions) {
        // Fetch attendance for this session directly from database
        const supabase = createClient()
        const { data: fullAttendance } = await supabase
          .from('training_attendance')
          .select('player_id, attendance_status')
          .eq('session_id', session.id)
        
        // Get player names for attendance records
        const attendanceWithNames = (fullAttendance || []).map((att: any) => {
          const player = players.find(p => p.id === att.player_id)
          return {
            playerName: player?.name || 'Unknown',
            playerId: att.player_id,
            status: att.attendance_status,
            statusLabel: att.attendance_status === 'P' ? 'Present' : 
                        att.attendance_status === 'A' ? 'Justified Absence' :
                        att.attendance_status === 'X' ? 'Unjustified Absence' :
                        att.attendance_status === 'I' ? 'Injured' : 'Unknown'
          }
        })

        exportData.push({
          sessionId: session.id,
          sessionDate: session.date,
          sessionTime: session.session_time || 'N/A',
          location: session.location || 'N/A',
          description: session.description || 'N/A',
          attendance: attendanceWithNames,
          totalPlayers: attendanceWithNames.length,
          present: attendanceWithNames.filter((a: any) => a.status === 'P').length,
          absent: attendanceWithNames.filter((a: any) => a.status === 'X').length,
          justified: attendanceWithNames.filter((a: any) => a.status === 'A').length,
          injured: attendanceWithNames.filter((a: any) => a.status === 'I').length,
        })
      }

      // Create formatted report data for better presentation
      const formattedSessions = exportData.map(session => ({
        date: new Date(session.sessionDate).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        time: session.sessionTime || 'N/A',
        location: session.location,
        description: session.description,
        attendance: session.attendance.map((att: any) => ({
          player: att.playerName,
          status: att.statusLabel
        })),
        summary: {
          total: session.totalPlayers,
          present: session.present,
          absent: session.absent,
          justified: session.justified,
          injured: session.injured
        }
      }))

      const totalPresent = exportData.reduce((sum, s) => sum + s.present, 0)
      const totalPlayers = exportData.reduce((sum, s) => sum + s.totalPlayers, 0)
      const overallAttendanceRate = totalPlayers > 0 ? Math.round((totalPresent / totalPlayers) * 100) : 0

      // Create report data
      const reportData: ReportData = {
        id: 'training-export',
        title: 'Training Attendance Report',
        type: 'training',
        dateRange: sessions.length > 0 
          ? `${new Date(sessions[sessions.length - 1].date).toLocaleDateString()} - ${new Date(sessions[0].date).toLocaleDateString()}`
          : new Date().toLocaleDateString(),
        generatedAt: new Date().toISOString(),
        data: {
          formattedSessions,
          summary: {
            totalSessions: sessions.length,
            totalPlayers: players.length,
            overallAttendanceRate
          }
        }
      }

      let blob: Blob
      let filename: string
      const safeTitle = 'training_attendance_report'

      switch (format) {
        case 'pdf':
          blob = await generatePDFReport(reportData)
          filename = `${safeTitle}.pdf`
          break
        case 'excel':
          blob = generateExcelReport(reportData)
          filename = `${safeTitle}.xlsx`
          break
        case 'csv':
          // Use the library function which formats the data properly
          blob = generateCSVReport(reportData)
          filename = `${safeTitle}.csv`
          break
        default:
          throw new Error('Unsupported format')
      }

      downloadBlob(blob, filename)
      setShowExportMenu(false)
      alert(`Training attendance exported as ${format.toUpperCase()}!`)
    } catch (error: any) {
      console.error('Error exporting training data:', error)
      alert(`Error exporting training data: ${error.message}`)
    } finally {
      setExporting(false)
    }
  }


  if (loading) {
    return (
      <Layout pageTitle="Training">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!user) return null

  // Block Finance Admin from accessing training page
  if (user.role === 'finance_admin') {
    return (
      <Layout pageTitle="Training">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Calendar className="w-16 h-16 text-tm-text-3 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-tm-text-1 mb-2">Access Restricted</h2>
            <p className="text-tm-text-3">Finance Admin does not have access to the Training feature.</p>
          </div>
        </div>
      </Layout>
    )
  }

  // Player-specific view: Show upcoming training sessions with drills
  if (user.role === 'player') {
    const upcomingSessions = sessions.filter(session => {
      const sessionDate = new Date(session.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return sessionDate >= today
    })

    return (
      <Layout pageTitle="Training Schedule">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-[20px] font-medium text-tm-text-1">Upcoming Training Sessions</h1>
              <p className="mt-[2px] text-[13px] text-tm-text-3">
                View your upcoming training sessions, drills, and activities scheduled by your coach
              </p>
            </div>
            <RefreshButton onRefresh={loadData} size="sm" />
          </div>

          {/* Training Sessions List */}
          {upcomingSessions.length === 0 ? (
            <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft p-12 text-center">
              <Calendar className="w-16 h-16 text-tm-text-3 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-tm-text-1 mb-2">No Upcoming Sessions</h3>
              <p className="text-tm-text-3">
                There are no upcoming training sessions scheduled at the moment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingSessions.map((session) => {
                const sessionDate = new Date(session.date)
                const isToday = sessionDate.toDateString() === new Date().toDateString()
                const isTomorrow = sessionDate.toDateString() === new Date(Date.now() + 86400000).toDateString()
                
                return (
                  <div
                    key={session.id}
                    className="bg-tm-surface rounded-card border border-tm-border shadow-soft hover:shadow-medium transition-all duration-300 overflow-hidden"
                  >
                    {/* Date Header */}
                    <div className="bg-tm-surface-hover border-b border-tm-border p-4 text-tm-text-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-medium ${isToday ? 'text-tm-secondary' : isTomorrow ? 'text-info' : 'text-tm-text-3'}`}>
                            {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : sessionDate.toLocaleDateString('en-US', { weekday: 'long' })}
                          </p>
                          <p className="text-2xl font-bold text-tm-text-1">
                            {sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <Calendar className="w-8 h-8 text-tm-text-3" />
                      </div>
                    </div>

                    {/* Session Details */}
                    <div className="p-6 space-y-4">
                      {/* Time and Location */}
                      {(session.session_time || session.location) && (
                        <div className="space-y-2">
                          {session.session_time && (
                            <div className="flex items-center text-tm-text-3">
                              <Clock className="w-4 h-4 mr-2" />
                              <span className="text-sm font-medium">{formatSessionTimeRange(session.session_time, session.session_end_time)}</span>
                            </div>
                          )}
                          {session.location && (
                            <div className="flex items-center text-tm-text-3">
                              <MapPin className="w-4 h-4 mr-2" />
                              <span className="text-sm font-medium">{session.location}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Coach Name */}
                      {session.coach_name && (
                        <div className="pt-2 border-t border-tm-border">
                          <p className="text-xs text-tm-text-3 mb-1">Coach</p>
                          <p className="text-sm font-semibold text-tm-text-1">{session.coach_name}</p>
                        </div>
                      )}

                      {/* Drills/Activities */}
                      {session.description && (
                        <div className="pt-2 border-t border-tm-border">
                          <p className="text-xs text-tm-text-3 mb-2 font-semibold uppercase tracking-wide">
                            Training Drills & Activities
                          </p>
                          <div className="bg-tm-surface-hover rounded-lg p-3">
                            <p className="text-sm text-tm-text-1 leading-relaxed whitespace-pre-line">
                              {session.description}
                            </p>
                          </div>
                        </div>
                      )}

                      {!session.description && (
                        <div className="pt-2 border-t border-tm-border">
                          <p className="text-xs text-tm-text-3 italic">
                            No specific drills or activities listed for this session.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Summary Card */}
          {upcomingSessions.length > 0 && (
            <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-tm-text-1 mb-1">Training Summary</h3>
                  <p className="text-sm text-tm-text-3">
                    You have <span className="font-bold text-primary">{upcomingSessions.length}</span> upcoming training session{upcomingSessions.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="bg-tm-secondary text-tm-on-secondary rounded-lg p-4">
                  <Calendar className="w-8 h-8" />
                </div>
              </div>
            </div>
          )}

          {/* Gym Schedules Section */}
          {gymSchedules.length > 0 && (
            <>
              <div>
                <h2 className="text-[20px] font-medium text-tm-text-1">Upcoming Gym Schedules</h2>
                <p className="mt-[2px] text-[13px] text-tm-text-3">
                  View your upcoming gym sessions and workout plans scheduled by your coach
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {gymSchedules.map((schedule: any) => {
                  const scheduleDate = new Date(schedule.schedule_date)
                  const isToday = scheduleDate.toDateString() === new Date().toDateString()
                  const isTomorrow = scheduleDate.toDateString() === new Date(Date.now() + 86400000).toDateString()
                  
                  return (
                    <div
                      key={schedule.id}
                      className="bg-tm-surface rounded-card border border-tm-border shadow-soft hover:shadow-medium transition-all duration-300 overflow-hidden"
                    >
                      {/* Date Header */}
                      <div className={`${isToday ? 'bg-tm-secondary text-tm-on-secondary' : isTomorrow ? 'bg-info text-white' : 'bg-purple-600 text-white'} p-4`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium opacity-90">
                              {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : scheduleDate.toLocaleDateString('en-US', { weekday: 'long' })}
                            </p>
                            <p className="text-2xl font-bold">
                              {scheduleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                          <Activity className="w-8 h-8 opacity-80" />
                        </div>
                      </div>

                      {/* Schedule Details */}
                      <div className="p-6 space-y-4">
                        {/* Description */}
                        <div>
                          <h4 className="font-semibold text-tm-text-1 mb-2">{schedule.description}</h4>
                          <span className="px-2 py-1 bg-[#E05757]/10 text-[#E05757] rounded text-xs font-medium">
                            Gym Session
                          </span>
                        </div>

                        {/* Time and Location */}
                        {(schedule.schedule_time || schedule.location) && (
                          <div className="space-y-2">
                            {schedule.schedule_time && (
                              <div className="flex items-center text-tm-text-3">
                                <Clock className="w-4 h-4 mr-2" />
                                <span className="text-sm font-medium">{schedule.schedule_time}</span>
                              </div>
                            )}
                            {schedule.location && (
                              <div className="flex items-center text-tm-text-3">
                                <MapPin className="w-4 h-4 mr-2" />
                                <span className="text-sm font-medium">{schedule.location}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Coach Name */}
                        {schedule.coach?.name && (
                          <div className="pt-2 border-t border-tm-border">
                            <p className="text-xs text-tm-text-3 mb-1">Created by</p>
                            <p className="text-sm font-semibold text-tm-text-1">{schedule.coach.name}</p>
                          </div>
                        )}

                        {/* Exercises */}
                        {schedule.exercises && (
                          <div className="pt-2 border-t border-tm-border">
                            <p className="text-xs text-tm-text-3 mb-2 font-semibold uppercase tracking-wide">
                              Exercises & Workout Plan
                            </p>
                            <div className="bg-info/10 rounded-lg p-3">
                              <p className="text-sm text-tm-text-1 leading-relaxed whitespace-pre-line">
                                {schedule.exercises}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Gym Summary Card */}
              <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-tm-text-1 mb-1">Gym Schedule Summary</h3>
                    <p className="text-sm text-tm-text-3">
                      You have <span className="font-bold text-secondary">{gymSchedules.length}</span> upcoming gym session{gymSchedules.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="bg-tm-secondary text-tm-on-secondary rounded-lg p-4">
                    <Activity className="w-8 h-8" />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* No Gym Schedules Message */}
          {gymSchedules.length === 0 && (
            <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft p-12 text-center">
              <Activity className="w-16 h-16 text-tm-text-3 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-tm-text-1 mb-2">No Upcoming Gym Schedules</h3>
              <p className="text-tm-text-3">
                There are no upcoming gym schedules at the moment. Check back later for updates.
              </p>
            </div>
          )}
        </div>
      </Layout>
    )
  }

  return (
    <Layout pageTitle="Training">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-[20px] font-medium text-tm-text-1">Player Attendance at Training Sessions</h1>
              <p className="mt-[2px] text-[13px] text-tm-text-3">
                {user?.role === 'admin'
                  ? 'View training attendance summary and statistics'
                  : 'Track and record player attendance for all training sessions'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(user?.role === 'coach' || user?.role === 'asst_coach' || user?.role === 'data_admin') && (
                <>
                  {(user?.role === 'coach' || user?.role === 'asst_coach') && (
                    <>
                      <button
                        onClick={() => setShowUploadForm(true)}
                        className="bg-info text-white px-4 py-2.5 rounded-[6px] text-sm font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center whitespace-nowrap"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Import Schedule
                      </button>
                      <button
                        onClick={() => setShowScheduleForm(true)}
                        className="bg-secondary text-tm-on-secondary px-4 py-2.5 rounded-[6px] text-sm font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Training Session
                      </button>
                      <button
                        onClick={() => setShowGymScheduleForm(true)}
                        className="bg-warning text-white px-4 py-2.5 rounded-[6px] text-sm font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Gym Schedule
                      </button>
                    </>
                  )}
                  {/* Manager: create training session */}
                  {user?.role === 'data_admin' && (
                    <button
                      onClick={() => setShowScheduleForm(true)}
                      className="bg-secondary text-tm-on-secondary px-4 py-2.5 rounded-[6px] text-sm font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Training Session
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    className="bg-success text-white px-4 py-2.5 rounded-[6px] text-sm font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center whitespace-nowrap"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Attendance
                  </button>
                </>
              )}

            </div>
          </div>
        </div>

        {/* ── Import modal (Schedule TXT/PDF  OR  Attendance CSV/Excel) ── */}
        {showUploadForm && (user?.role === 'coach' || user?.role === 'asst_coach' || user?.role === 'data_admin') && (
          <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 backdrop-blur-sm">
            <div className="bg-tm-surface rounded-t-2xl sm:rounded-card shadow-large w-full sm:max-w-2xl border border-tm-border max-h-[92vh] flex flex-col">

              {/* Header */}
              <div className="p-5 border-b border-tm-border flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-tm-text-1">
                    {attendanceOnly ? 'Import Attendance' : 'Import File'}
                  </h2>
                  <p className="text-xs text-tm-text-3 mt-0.5">
                    {attendanceOnly
                      ? 'Upload a CSV or Excel file to auto-fill the attendance grid'
                      : 'CSV/Excel → player attendance · TXT/PDF → session schedule'}
                  </p>
                </div>
                <button onClick={resetUploadModal} disabled={uploading} className="modal-close-btn">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1">

                {/* ── Phase 1: file picker (shown until processing starts) ── */}
                {!uploading && !showCsvPreview && (
                  <>
                    {/* Drop zone */}
                    <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-tm-border rounded-xl p-8 cursor-pointer hover:border-primary hover:bg-tm-surface-hover transition-all">
                      <Upload className="w-8 h-8 text-tm-text-3" />
                      <span className="text-sm font-medium text-tm-text-2">
                        {uploadFile ? uploadFile.name : (attendanceOnly ? 'Tap to choose a CSV or Excel file' : 'Tap to choose a file')}
                      </span>
                      {uploadFile && (
                        <span className="text-xs text-tm-text-3">
                          {(uploadFile.size / 1024).toFixed(1)} KB
                        </span>
                      )}
                      <input
                        type="file"
                        accept={attendanceOnly
                          ? '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
                          : '.csv,.xlsx,.xls,.txt,.pdf,text/csv,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'}
                        className="sr-only"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      />
                    </label>

                    {/* Format guide */}
                    <div className={`grid grid-cols-1 gap-3 ${attendanceOnly ? '' : 'sm:grid-cols-2'}`}>
                      <div className="bg-tm-surface-hover rounded-lg p-3 border border-tm-border">
                        <p className="text-xs font-semibold text-secondary mb-1.5 uppercase tracking-wide">
                          CSV / Excel — attendance import
                        </p>
                        <p className="text-[11px] text-tm-text-3 leading-relaxed font-mono">
                          player_name, status, notes<br />
                          Patrick Allan, P<br />
                          John Smith, A, sick<br />
                          Jane Doe, X, work<br />
                          Tom Brown, I, knee
                        </p>
                        <p className="text-[10px] text-tm-text-3 mt-2">
                          Status: P Present · A Absent · X Excused · I Injured
                        </p>
                      </div>
                      {!attendanceOnly && (
                        <div className="bg-tm-surface-hover rounded-lg p-3 border border-tm-border">
                          <p className="text-xs font-semibold text-info mb-1.5 uppercase tracking-wide">
                            TXT/PDF — session schedule
                          </p>
                          <p className="text-[11px] text-tm-text-3 leading-relaxed font-mono">
                            2024-12-15, 18:00, Pitch, Scrums<br />
                            2024-12-18, 09:00, Gym, Conditioning<br />
                            2024-12-22 | 17:30 | Pitch
                          </p>
                          <p className="text-[10px] text-tm-text-3 mt-2">
                            One session per line, comma or pipe separated
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ── Phase 2: animated progress (CSV only) ── */}
                {uploading && (
                  <div className="py-6 space-y-6">
                    {/* Spinning icon */}
                    <div className="flex justify-center">
                      <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-tm-border" />
                        <div
                          className="absolute inset-0 rounded-full border-4 border-secondary border-t-transparent animate-spin"
                          style={{ animationDuration: '0.9s' }}
                        />
                        <FileText className="absolute inset-0 m-auto w-6 h-6 text-secondary" />
                      </div>
                    </div>

                    {/* Step label */}
                    <div className="text-center">
                      <p className="text-sm font-semibold text-tm-text-1">{uploadStep}</p>
                      <p className="text-xs text-tm-text-3 mt-1">Please wait…</p>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-xs text-tm-text-3 mb-1.5">
                        <span>Progress</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2.5 bg-tm-surface-hover rounded-full overflow-hidden">
                        <div
                          className="h-full bg-secondary rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>

                    {/* Step milestones */}
                    <div className="flex justify-between text-[10px] text-tm-text-3 px-1">
                      {['Reading', 'Parsing', 'Matching players', 'Complete'].map((s, i) => {
                        const threshold = [10, 50, 85, 100][i]
                        const done = uploadProgress >= threshold
                        return (
                          <span key={s} className={`flex flex-col items-center gap-1 transition-colors ${done ? 'text-secondary font-semibold' : ''}`}>
                            <span className={`w-3 h-3 rounded-full border-2 transition-all ${done ? 'bg-secondary border-secondary' : 'border-tm-border'}`} />
                            {s}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Phase 3: CSV preview table ── */}
                {showCsvPreview && !uploading && (
                  <div className="space-y-4">
                    {/* Summary chips */}
                    <div className="flex flex-wrap gap-2">
                      {(['exact', 'fuzzy', 'none'] as const).map(c => {
                        const count = csvRows.filter(r => r.confidence === c).length
                        if (!count) return null
                        const cfg = { exact: { label: 'Matched', cls: 'bg-success/15 text-success border-success/30' }, fuzzy: { label: 'Fuzzy match', cls: 'bg-warning/15 text-warning border-warning/30' }, none: { label: 'Not found', cls: 'bg-[#E05757]/15 text-[#E05757] border-[#E05757]/30' } }[c]
                        return (
                          <span key={c} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
                            {count} {cfg.label}
                          </span>
                        )
                      })}
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-tm-surface-hover text-tm-text-3 border-tm-border">
                        {csvRows.length} rows total
                      </span>
                    </div>

                    {/* Session selector */}
                    <div>
                      <label className="block text-xs font-medium text-tm-text-3 mb-1.5">
                        Apply attendance to session
                      </label>
                      <select
                        value={csvSessionId}
                        onChange={(e) => setCsvSessionId(e.target.value)}
                        className="w-full tm-select rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">— Select a session —</option>
                        {sessions.map(s => (
                          <option key={s.id} value={s.id}>
                            {new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                            {s.title ? ` — ${s.title}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Player rows */}
                    <div className="rounded-xl border border-tm-border overflow-hidden">
                      <div className="grid grid-cols-[1fr_auto_auto] text-[11px] font-semibold uppercase tracking-wide text-tm-text-3 bg-tm-surface-hover px-3 py-2 border-b border-tm-border">
                        <span>Player</span>
                        <span className="pr-6">Status</span>
                        <span>Match</span>
                      </div>
                      <div className="divide-y divide-tm-border max-h-56 overflow-y-auto">
                        {csvRows.map((row, i) => {
                          const statusCfg: Record<string, { label: string; cls: string }> = {
                            P: { label: 'Present', cls: 'bg-success/15 text-success' },
                            A: { label: 'Absent', cls: 'bg-[#E05757]/15 text-[#E05757]' },
                            X: { label: 'Excused', cls: 'bg-tm-surface-hover text-tm-text-2' },
                            I: { label: 'Injured', cls: 'bg-warning/15 text-warning' },
                          }
                          const sc = row.status ? statusCfg[row.status] : null
                          return (
                            <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center px-3 py-2.5 text-sm hover:bg-tm-surface-hover">
                              <div className="min-w-0">
                                <p className="font-medium text-tm-text-1 truncate">{row.name}</p>
                                {row.matchedPlayer && row.matchedPlayer.name !== row.name && (
                                  <p className="text-[10px] text-tm-text-3 truncate">→ {row.matchedPlayer.name}</p>
                                )}
                                {row.notes && <p className="text-[10px] text-tm-text-3 truncate">{row.notes}</p>}
                              </div>
                              <div className="px-3">
                                {sc ? (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.cls}`}>{sc.label}</span>
                                ) : (
                                  <span className="text-xs text-tm-text-3">—</span>
                                )}
                              </div>
                              <div>
                                {row.confidence === 'exact' && <CheckCircle2 className="w-4 h-4 text-success" />}
                                {row.confidence === 'fuzzy' && <AlertCircle className="w-4 h-4 text-warning" />}
                                {row.confidence === 'none'  && <X className="w-4 h-4 text-[#E05757]" />}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {csvRows.some(r => r.confidence === 'none') && (
                      <p className="text-xs text-tm-text-3 bg-tm-surface-hover rounded-lg px-3 py-2 border border-tm-border">
                        <AlertCircle className="w-3.5 h-3.5 inline mr-1 text-warning" />
                        Unmatched players won&apos;t be applied. Check spelling or add them to the roster first.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="p-5 border-t border-tm-border flex-shrink-0">
                {!uploading && !showCsvPreview && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleFileUpload}
                      disabled={!uploadFile}
                      className="flex-1 px-4 py-2.5 bg-secondary text-tm-on-secondary rounded-[6px] font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Import
                    </button>
                    <button
                      onClick={resetUploadModal}
                      className="px-4 py-2.5 bg-tm-surface-hover text-tm-text-1 rounded-[6px] font-semibold text-sm hover:opacity-80 transition-all border border-tm-border"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {showCsvPreview && !uploading && (
                  <div className="flex gap-3">
                    {attendanceOnly ? (
                      // Past-session flow: save directly to DB in one step
                      <button
                        onClick={saveAttendanceDirectly}
                        disabled={savingDirectly || !csvSessionId || csvRows.filter(r => r.matchedPlayer && r.status).length === 0}
                        className="flex-1 px-4 py-2.5 bg-success text-white rounded-[6px] font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                      >
                        {savingDirectly ? (
                          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                        ) : (
                          <><Save className="w-4 h-4" /> Save attendance — {csvRows.filter(r => r.matchedPlayer && r.status).length} players</>
                        )}
                      </button>
                    ) : (
                      // Coach live-grid flow: apply then save separately
                      <button
                        onClick={applyCSVToGrid}
                        disabled={!csvSessionId || csvRows.filter(r => r.matchedPlayer && r.status).length === 0}
                        className="flex-1 px-4 py-2.5 bg-success text-white rounded-[6px] font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                      >
                        <UserCheck className="w-4 h-4" />
                        Apply {csvRows.filter(r => r.matchedPlayer && r.status).length} players to grid
                      </button>
                    )}
                    <button
                      onClick={resetUploadModal}
                      disabled={savingDirectly}
                      className="px-4 py-2.5 bg-tm-surface-hover text-tm-text-1 rounded-[6px] font-semibold text-sm hover:opacity-80 transition-all border border-tm-border disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Gym Schedule Modal for Coaches */}
        {showGymScheduleForm && (user?.role === 'coach' || user?.role === 'asst_coach') && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-tm-surface rounded-card shadow-large max-w-2xl w-full border border-tm-border">
              <div className="p-6 border-b border-tm-border">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-tm-text-1">Create Gym Schedule</h2>
                  <button
                    onClick={() => {
                      setShowGymScheduleForm(false)
                      setGymScheduleForm({ schedule_date: '', schedule_time: '', location: '', description: '', exercises: '' })
                    }}
                    className="modal-close-btn"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Gym Schedule Date <span className="text-[#E05757]">*</span>
                  </label>
                  <input
                    type="date"
                    value={gymScheduleForm.schedule_date}
                    onChange={(e) => setGymScheduleForm({ ...gymScheduleForm, schedule_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Schedule Time <span className="text-xs text-tm-text-3">(e.g., 18:00, 6:00 PM)</span>
                  </label>
                  <input
                    type="text"
                    value={gymScheduleForm.schedule_time}
                    onChange={(e) => setGymScheduleForm({ ...gymScheduleForm, schedule_time: e.target.value })}
                    placeholder="e.g., 18:00 or 6:00 PM"
                    className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    Location
                  </label>
                  <input
                    type="text"
                    value={gymScheduleForm.location}
                    onChange={(e) => setGymScheduleForm({ ...gymScheduleForm, location: e.target.value })}
                    placeholder="e.g., Main Gym, Fitness Center"
                    className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Description <span className="text-[#E05757]">*</span>
                  </label>
                  <textarea
                    value={gymScheduleForm.description}
                    onChange={(e) => setGymScheduleForm({ ...gymScheduleForm, description: e.target.value })}
                    rows={3}
                    placeholder="e.g., Strength training session focusing on upper body"
                    className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Exercises/Program Details
                  </label>
                  <textarea
                    value={gymScheduleForm.exercises}
                    onChange={(e) => setGymScheduleForm({ ...gymScheduleForm, exercises: e.target.value })}
                    rows={4}
                    placeholder="e.g., Bench Press 3x8, Squats 3x10, Deadlifts 3x5, Pull-ups 3x8"
                    className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCreateGymSchedule}
                    className="flex-1 px-6 py-3 bg-secondary text-tm-on-secondary rounded-[6px] hover:opacity-90 transition-all duration-300 font-semibold shadow-soft hover:shadow-medium"
                  >
                    Create Gym Schedule
                  </button>
                  <button
                    onClick={() => {
                      setShowGymScheduleForm(false)
                      setGymScheduleForm({ schedule_date: '', schedule_time: '', location: '', description: '', exercises: '' })
                    }}
                    className="px-6 py-3 bg-tm-surface-hover text-tm-text-1 rounded-[6px] hover:bg-tm-surface-hover transition-all duration-300 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Training Session modal */}
        {showScheduleForm && ['coach', 'asst_coach', 'data_admin'].includes(user?.role || '') && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-tm-surface rounded-card shadow-large max-w-2xl max-h-[90vh] overflow-y-auto w-full border border-tm-border">
              <div className="p-6 border-b border-tm-border">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-tm-text-1">Create Training Session</h2>
                  <button
                    onClick={() => {
                      setShowScheduleForm(false)
                      setScheduleForm({ session_date: '', session_time: '', session_end_time: '', location: '', description: '' })
                    }}
                    className="modal-close-btn"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Training Date <span className="text-[#E05757]">*</span>
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.session_date}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, session_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Start Time <span className="text-[#E05757]">*</span>
                  </label>
                  <TimeDropdowns
                    label="Start time"
                    value={scheduleForm.session_time}
                    onChange={(value) => setScheduleForm(prev => ({ ...prev, session_time: value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Finish Time <span className="text-[#E05757]">*</span>
                  </label>
                  <TimeDropdowns
                    label="Finish time"
                    value={scheduleForm.session_end_time}
                    onChange={(value) => setScheduleForm(prev => ({ ...prev, session_end_time: value }))}
                  />
                  {scheduleForm.session_time && scheduleForm.session_end_time && (
                    <p className={`mt-2 text-xs font-medium ${scheduleForm.session_end_time > scheduleForm.session_time ? 'text-green-500' : 'text-[#E05757]'}`}>
                      {scheduleForm.session_end_time > scheduleForm.session_time
                        ? `Duration: ${getSessionDuration(scheduleForm.session_time, scheduleForm.session_end_time)}`
                        : 'Finish time must be later than start time.'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    Location
                  </label>
                  <input
                    type="text"
                    value={scheduleForm.location}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                    placeholder="e.g., Training Ground, Main Pitch"
                    className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Description
                  </label>
                  <textarea
                    value={scheduleForm.description}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                    rows={4}
                    placeholder="e.g., Focus on scrummaging and lineout drills"
                    className="w-full px-4 py-2 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCreateSchedule}
                    disabled={savingSchedule || !scheduleForm.session_date || !scheduleForm.session_time || !scheduleForm.session_end_time || scheduleForm.session_end_time <= scheduleForm.session_time}
                    className="flex-1 px-6 py-3 bg-tm-secondary text-tm-on-secondary rounded-[6px] hover:opacity-90 transition-all duration-300 font-semibold shadow-soft hover:shadow-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingSchedule ? 'Creating...' : 'Create Training Session'}
                  </button>
                  <button
                    onClick={() => {
                      setShowScheduleForm(false)
                      setScheduleForm({ session_date: '', session_time: '', session_end_time: '', location: '', description: '' })
                    }}
                    className="px-6 py-3 bg-tm-surface-hover text-tm-text-1 rounded-[6px] hover:bg-tm-surface-hover transition-all duration-300 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin, Coach, and Data Admin Summary View */}
        {['admin', 'coach', 'data_admin'].includes(user?.role || '') && (
          <div className="space-y-4">
            <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-tm-text-1 mb-2">Training Sessions Summary</h2>
                  <p className="text-tm-text-3">Overview of all training sessions with attendance and activities</p>
                </div>
                {dismissedSummaryCards.size > 0 && (
                  <button
                    onClick={() => setShowDismissedSummaries(v => !v)}
                    className="text-xs font-medium text-tm-text-3 hover:text-tm-text-1 underline underline-offset-2"
                  >
                    {showDismissedSummaries ? 'Hide dismissed' : `Show dismissed (${dismissedSummaryCards.size})`}
                  </button>
                )}
              </div>

              {sessionSummaries.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-tm-text-3 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-tm-text-1 mb-2">No Training Sessions</h3>
                  <p className="text-tm-text-3">No training sessions have been recorded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessionSummaries
                  .filter(summary => showDismissedSummaries || !dismissedSummaryCards.has(summary.sessionId))
                  .map((summary) => {
                  const isDismissed = dismissedSummaryCards.has(summary.sessionId)
                  return (
                  <div
                    key={summary.sessionId}
                    className={`bg-tm-surface rounded-lg border border-tm-border shadow-soft p-5 hover:shadow-medium transition-all ${isDismissed ? 'opacity-60' : ''}`}
                  >
                    {/* Session Header */}
                    <div className="mb-4 pb-4 border-b border-tm-border">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-tm-text-1">
                          {new Date(summary.sessionDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2 py-1 bg-tm-secondary text-tm-on-secondary rounded-full">
                            {summary.attendanceRate}%
                          </span>
                          {(user?.role === 'coach' || user?.role === 'admin') && (
                            <button
                              onClick={() => handleDeleteSession(summary.sessionId)}
                              disabled={deletingSessionId === summary.sessionId}
                              className="p-1.5 rounded-lg text-tm-text-3 hover:text-[#E05757] hover:bg-[#E05757]/10 transition-all disabled:opacity-50"
                              title="Delete session"
                            >
                              {deletingSessionId === summary.sessionId ? (
                                <div className="w-4 h-4 animate-spin rounded-full border-2 border-[#E05757] border-t-transparent" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => isDismissed ? restoreSummaryCard(summary.sessionId) : dismissSummaryCard(summary.sessionId)}
                            className="p-1.5 rounded-lg text-tm-text-3 hover:text-tm-text-1 hover:bg-tm-surface-hover transition-all"
                            title={isDismissed ? 'Restore card' : 'Dismiss card'}
                          >
                            {isDismissed ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-tm-text-3">
                        {summary.sessionTime && (
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatSessionTimeRange(summary.sessionTime, summary.sessionEndTime)}
                          </div>
                        )}
                        {summary.location && (
                          <div className="flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {summary.location}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Drills/Activities */}
                    {summary.drills && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-tm-text-1 mb-2 flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          Drills & Activities
                        </h4>
                        <p className="text-sm text-tm-text-3 bg-tm-surface-hover rounded-lg p-3 border border-tm-border">
                          {summary.drills}
                        </p>
                      </div>
                    )}

                    {/* Attendance Summary */}
                    <div>
                      <h4 className="text-sm font-semibold text-tm-text-1 mb-3">Attendance Summary</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-success/10 rounded-lg p-2 border border-success/30">
                          <div className="text-xs text-tm-text-3">Present</div>
                          <div className="text-lg font-bold text-success">{summary.present}</div>
                        </div>
                        <div className="bg-[#E05757]/10 rounded-lg p-2 border border-[#E05757]/30">
                          <div className="text-xs text-tm-text-3">Absent</div>
                          <div className="text-lg font-bold text-secondary">{summary.absent}</div>
                        </div>
                        <div className="bg-tm-surface-hover rounded-lg p-2 border border-tm-border">
                          <div className="text-xs text-tm-text-3">Justified</div>
                          <div className="text-lg font-bold text-info">{summary.justified}</div>
                        </div>
                        <div className="bg-warning/10 rounded-lg p-2 border border-warning/30">
                          <div className="text-xs text-tm-text-3">Injured</div>
                          <div className="text-lg font-bold text-warning">{summary.injured}</div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-tm-border">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-tm-text-3">Total Players</span>
                          <span className="text-sm font-bold text-tm-text-1">{summary.total}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  )
                })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        {user?.role !== 'admin' && user?.role !== 'finance_admin' && (
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <h2 className="text-lg font-bold text-tm-text-1 mb-3">Attendance Codes</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-success rounded-lg flex items-center justify-center text-white font-bold">
                P
              </div>
              <div>
                <p className="font-medium text-tm-text-1">Present</p>
                <p className="text-sm text-tm-text-3">Player attended</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-info rounded-lg flex items-center justify-center text-white font-bold">
                A
              </div>
              <div>
                <p className="font-medium text-tm-text-1">Justified Absence</p>
                <p className="text-sm text-tm-text-3">Excused absence</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white border border-gray-300 rounded-lg flex items-center justify-center text-gray-900 font-bold">
                X
              </div>
              <div>
                <p className="font-medium text-tm-text-1">Unjustified Absence</p>
                <p className="text-sm text-tm-text-3">Unexcused absence</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold">
                I
              </div>
              <div>
                <p className="font-medium text-tm-text-1">Injured</p>
                <p className="text-sm text-tm-text-3">Player injured</p>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Session Selection for Attendance - Coach and Data Admin */}
        {(user?.role === 'coach' || user?.role === 'data_admin') && sessions.length > 0 && (
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-tm-text-1 mb-2">Select Training Session for Attendance</h2>
                <p className="text-sm text-tm-text-3">Choose which training session you want to record attendance for</p>
              </div>
              <button
                onClick={() => openAttendanceImport(selectedSessionId)}
                className="bg-info text-white px-4 py-2.5 rounded-[6px] text-sm font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center justify-center whitespace-nowrap"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Attendance
              </button>
            </div>
            <select
              value={selectedSessionId}
              onChange={async (e) => {
                setSelectedSessionId(e.target.value)
                // Reload players to ensure we have the latest list
                try {
                  const playersResponse = await fetch('/api/admin/players')
                  if (playersResponse.ok) {
                    const playersData = await playersResponse.json()
                    if (playersData.players && Array.isArray(playersData.players)) {
                      setPlayers(playersData.players.map((p: any) => ({
                        id: p.user_id || p.id,
                        name: p.name || 'Unknown',
                        position: p.position || 'N/A',
                      })))
                    }
                  }
                } catch (err) {
                  console.error('Error reloading players:', err)
                }
                // Load existing attendance for this session
                if (e.target.value) {
                  loadAttendanceForSession(e.target.value)
                } else {
                  setAttendance({})
                }
              }}
              className="w-full px-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm font-medium"
            >
              <option value="">Select a training session...</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {new Date(session.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                  {session.session_time ? ` at ${formatSessionTimeRange(session.session_time, session.session_end_time)}` : ''}
                  {session.location ? ` - ${session.location}` : ''}
                  {session.description ? `: ${session.description}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Attendance Table - Hidden for Admin and Finance Admin */}
        {user?.role !== 'admin' && user?.role !== 'finance_admin' && (
          <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft overflow-hidden">
            {(user?.role === 'coach' || user?.role === 'data_admin') && !selectedSessionId && (
              <div className="p-6 text-center text-tm-text-3">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-tm-text-3" />
                <p className="text-lg font-semibold">Please select a training session above to record attendance</p>
              </div>
            )}
            {((user?.role === 'coach' || user?.role === 'data_admin') && selectedSessionId) || (user?.role !== 'coach' && user?.role !== 'data_admin') ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-success text-white">
                      <th className="px-4 py-4 text-left text-sm font-bold sticky left-0 bg-success z-10 min-w-[200px]">
                        Player&apos;s Name
                      </th>
                      <th className="px-4 py-4 text-center text-sm font-bold min-w-[150px]">
                        Attendance Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-tm-text-3">
                          No players found. Please ensure players are registered in the system.
                        </td>
                      </tr>
                    ) : (
                      players.map((player, rowIndex) => {
                        const code = attendance[`${player.id}-${selectedSessionId}`] || ''
                        const canEdit = user?.role === 'coach' || user?.role === 'data_admin'
                        return (
                          <tr
                            key={player.id}
                            className={rowIndex % 2 === 0 ? 'bg-tm-surface' : 'bg-tm-surface-hover'}
                          >
                            <td className="px-4 py-3 text-sm font-medium text-tm-text-1 sticky left-0 bg-inherit z-10 border-r border-tm-border">
                              {player.name}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {canEdit ? (
                                <AttendanceDropdown
                                  value={code as AttendanceCode}
                                  onChange={(val) => handleAttendanceChange(player.id, selectedSessionId, val as AttendanceCode)}
                                />
                              ) : (
                                <div className={`w-full max-w-[210px] mx-auto px-3 py-2 rounded-lg font-semibold text-sm text-center flex items-center justify-center border ${
                                  code === 'X' ? 'border-gray-300' : 'border-transparent'
                                } ${getCodeColor(code as AttendanceCode)}`}>
                                  {code === 'P' ? 'P — Present' : code === 'A' ? 'A — Justified Absence' : code === 'X' ? 'X — Unjustified Absence' : code === 'I' ? 'I — Injured' : '—'}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}

        {/* Session Dates Reference - Hidden for Admin and Finance Admin */}
        {user?.role !== 'admin' && user?.role !== 'finance_admin' && (
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <h2 className="text-lg font-bold text-tm-text-1 mb-4">Training Session Dates</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {sessions.map((session, index) => (
              <div
                key={session.id}
                className="p-3 bg-tm-surface-hover rounded-lg text-center hover:bg-tm-surface-hover transition-colors"
              >
                <p className="text-xs font-medium text-tm-text-3">Session {index + 1}</p>
                <p className="text-sm font-semibold text-tm-text-1">
                  {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                {session.session_time && (
                  <p className="text-xs text-tm-text-3 mt-1">
                    {formatSessionTimeRange(session.session_time, session.session_end_time)}
                  </p>
                )}
                {session.location && (
                  <p className="text-xs text-tm-text-3 mt-1">
                    {session.location}
                  </p>
                )}
              </div>
            ))}
          </div>
          </div>
        )}

        {/* ── Past training sessions (with Upload Attendance + Dismiss) ── */}
        {(user?.role === 'coach' || user?.role === 'asst_coach' || user?.role === 'data_admin') && (() => {
          const now = new Date()
          const pastSessions = sessions
            .filter(s => {
              const d = new Date(s.date)
              d.setHours(23, 59, 59, 999)
              return d < now && !dismissedTrainingSessions.has(s.id)
            })
            .slice(0, 10)
          if (pastSessions.length === 0) return null
          // A session is "recorded" if the DB has attendance rows for it (shared
          // across all accounts) OR if this user marked it locally as a fallback.
          const isRecorded = (s: any) =>
            sessionSummaries.some(sum => sum.sessionId === s.id && sum.total > 0)
            || recordedTrainingSessions.has(s.id)
            || trainingFiles.some(f => f.session_id === s.id)
          const recordedCount = pastSessions.filter(isRecorded).length
          return (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[16px] font-medium text-tm-text-1">Past training sessions</h2>
                <span className="text-xs text-tm-text-3">{recordedCount} of {pastSessions.length} attendance recorded</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pastSessions.map(session => {
                  const hasRecord = isRecorded(session)
                  const summary = sessionSummaries.find(s => s.sessionId === session.id)
                  const fileRecord = trainingFiles.find(f => f.session_id === session.id)
                  const sessionDate = new Date(session.date)
                  return (
                    <div key={session.id} className="bg-tm-surface rounded-card border border-tm-border overflow-hidden">
                      {/* Header */}
                      <div className={`p-4 flex items-center justify-between ${hasRecord ? 'bg-green-500/10' : 'bg-amber-400/10'}`}>
                        <div>
                          <p className="text-xs text-tm-text-3">Past session</p>
                          <p className="text-base font-bold text-tm-text-1">
                            {sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasRecord
                            ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                            : <AlertCircle className="h-5 w-5 text-amber-400" />}
                          <button
                            onClick={() => dismissTrainingSession(session.id)}
                            title="Dismiss"
                            className="rounded-full p-1 text-tm-text-3 hover:text-tm-text-1 hover:bg-tm-surface-hover transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {/* Body */}
                      <div className="p-4 space-y-2">
                        <p className="font-semibold text-sm text-tm-text-1">{session.title || session.description || `Session #${session.id.slice(0,6)}`}</p>
                        {session.location && <p className="text-xs text-tm-text-3 flex items-center gap-1"><MapPin className="h-3 w-3" />{session.location}</p>}
                        {summary && summary.total > 0 ? (
                          <div className="grid grid-cols-4 gap-1 pt-1">
                            {[
                              { label: 'Present', val: summary.present, cls: 'text-green-500' },
                              { label: 'Absent',  val: summary.absent,  cls: 'text-[#E05757]' },
                              { label: 'Excused', val: summary.justified, cls: 'text-tm-text-3' },
                              { label: 'Injured', val: summary.injured, cls: 'text-amber-400' },
                            ].map(({ label, val, cls }) => (
                              <div key={label} className="text-center">
                                <p className={`text-sm font-bold ${cls}`}>{val}</p>
                                <p className="text-[10px] text-tm-text-3">{label}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={`text-xs font-semibold ${hasRecord ? 'text-green-500' : 'text-amber-400'}`}>
                            {hasRecord ? '✓ Attendance recorded' : '⚠ Not yet recorded'}
                          </p>
                        )}
                        {fileRecord?.uploader_name && (
                          <p className="text-[11px] text-tm-text-3 pt-1">
                            Recorded by <span className="font-medium text-tm-text-2">{fileRecord.uploader_name}</span>
                            {fileRecord.uploaded_at
                              ? ` · ${new Date(fileRecord.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                              : ''}
                          </p>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex gap-2 border-t border-tm-border px-4 py-3">
                        {!hasRecord && (
                          <button
                            onClick={() => openAttendanceImport(session.id)}
                            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                            style={{ background: 'rgba(45,184,138,0.12)', color: '#2DB88A' }}
                          >
                            <Upload className="h-3.5 w-3.5" /> Upload Attendance
                          </button>
                        )}
                        {hasRecord && (
                          <button
                            onClick={() => dismissTrainingSession(session.id)}
                            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-tm-text-3 hover:text-tm-text-1 ml-auto"
                            style={{ background: 'var(--tm-surface-hover)' }}
                          >
                            <X className="h-3.5 w-3.5" /> Dismiss
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ── Uploaded attendance files archive ── */}
        {(user?.role === 'coach' || user?.role === 'asst_coach' || user?.role === 'data_admin') && (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-[16px] font-medium text-tm-text-1 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Uploaded attendance files
                <span className="text-xs font-normal text-tm-text-3">({(() => {
                  const f = trainingFiles.filter(f => {
                    if (trainingFileFilter === 'all') return true
                    if (trainingFileFilter === 'unsorted') return !f.session_id
                    return f.session_id === trainingFileFilter
                  })
                  return f.length
                })()} files)</span>
              </h2>
              <div className="flex items-center gap-2">
                <label className="text-xs text-tm-text-3 whitespace-nowrap">Filter by session:</label>
                <div className="relative">
                  <select
                    value={trainingFileFilter}
                    onChange={e => setTrainingFileFilter(e.target.value)}
                    className="text-xs bg-tm-surface border border-tm-border rounded-md pl-2 pr-6 py-1.5 text-tm-text-1 appearance-none cursor-pointer"
                  >
                    <option value="all">All sessions</option>
                    <option value="unsorted">No session linked</option>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {s.title || s.description || `Session #${s.id.slice(0,6)}`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-tm-text-3 pointer-events-none" />
                </div>
              </div>
            </div>
            {(() => {
              const filtered = trainingFiles.filter(f => {
                if (trainingFileFilter === 'all') return true
                if (trainingFileFilter === 'unsorted') return !f.session_id
                return f.session_id === trainingFileFilter
              })
              return filtered.length === 0 ? (
                <div className="bg-tm-surface rounded-card border border-tm-border p-8 text-center">
                  <FileSpreadsheet className="mx-auto mb-2 h-10 w-10 text-tm-text-3" />
                  <p className="text-sm font-medium text-tm-text-1">
                    {trainingFileFilter === 'all' ? 'No attendance files uploaded yet' : 'No files for this session'}
                  </p>
                  <p className="text-xs text-tm-text-3 mt-1">
                    {trainingFileFilter === 'all'
                      ? 'Upload attendance files from session cards below and they will appear here.'
                      : 'Try selecting a different session or "All sessions".'}
                  </p>
                </div>
              ) : (
                <div className="bg-tm-surface rounded-card border border-tm-border overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-tm-surface-hover border-b border-tm-border">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-tm-text-2">File</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-tm-text-2">Session</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-tm-text-2">Uploaded by</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-tm-text-2">Date</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-tm-border">
                      {filtered.map((f, i) => (
                        <tr key={f.id} className={i % 2 === 0 ? 'bg-tm-surface' : 'bg-tm-surface-hover'}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 text-green-500 shrink-0" />
                              <span className="text-xs font-medium text-tm-text-1 truncate max-w-[180px]" title={f.file_name}>{f.file_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-tm-text-3">
                            {f.session?.title || f.session?.description
                              ? <>{f.session?.date ? new Date(f.session.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' — ' : ''}{f.session?.title || f.session?.description}</>
                              : <span className="italic">No session</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-tm-text-1 font-medium">
                            {f.uploader_name ?? <span className="text-tm-text-3">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-tm-text-3">
                            {new Date(f.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setViewingTrainingFile(f)}
                              className="flex items-center gap-1 text-xs font-medium rounded-md px-2.5 py-1.5 transition-colors"
                              style={{ background: 'rgba(45,184,138,0.12)', color: '#2DB88A' }}
                            >
                              View
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            {f.download_url ? (
                              <a
                                href={f.download_url}
                                download={f.file_name}
                                className="flex items-center gap-1 text-xs font-medium rounded-md px-2.5 py-1.5"
                                style={{ background: 'var(--acc-dim,rgba(91,163,217,0.10))', color: 'var(--acc,#5BA3D9)' }}
                              >
                                <Download className="h-3.5 w-3.5" /> Download
                              </a>
                            ) : f.rows?.length > 0 ? (
                              <button
                                onClick={() => downloadTrainingFileFromRows(f)}
                                className="flex items-center gap-1 text-xs font-medium rounded-md px-2.5 py-1.5"
                                style={{ background: 'var(--acc-dim,rgba(91,163,217,0.10))', color: 'var(--acc,#5BA3D9)' }}
                              >
                                <Download className="h-3.5 w-3.5" /> Download
                              </button>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleDeleteTrainingFile(f)}
                              disabled={deletingTrainingFileId === f.id}
                              className="flex items-center gap-1 text-xs font-medium rounded-md px-2.5 py-1.5 transition-colors disabled:opacity-50"
                              style={{ background: 'rgba(224,87,87,0.10)', color: '#E05757' }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {deletingTrainingFileId === f.id ? '…' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── Training file viewer modal ── */}
        {viewingTrainingFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[10px] border border-tm-border bg-tm-surface shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-tm-border flex-shrink-0">
                <div>
                  <h3 className="font-semibold text-tm-text-1 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-secondary" />
                    {viewingTrainingFile.file_name}
                  </h3>
                  {viewingTrainingFile.session?.title || viewingTrainingFile.session?.description ? (
                    <p className="text-xs text-tm-text-3 mt-0.5">
                      {viewingTrainingFile.session?.date
                        ? new Date(viewingTrainingFile.session.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' — '
                        : ''}
                      {viewingTrainingFile.session?.title || viewingTrainingFile.session?.description}
                    </p>
                  ) : null}
                </div>
                <button onClick={() => setViewingTrainingFile(null)} className="modal-close-btn">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Content */}
              <div className="overflow-auto flex-1 p-2">
                {viewingTrainingFile.rows && viewingTrainingFile.rows.length > 0 ? (
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-tm-surface-hover sticky top-0">
                      <tr>
                        {viewingTrainingFile.rows[0].map((h: string, i: number) => (
                          <th key={i} className="text-left px-3 py-2 font-semibold text-tm-text-2 border border-tm-border whitespace-nowrap">{h || `Col ${i+1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {viewingTrainingFile.rows.slice(1).map((row: string[], ri: number) => (
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
                  {viewingTrainingFile.rows ? `${viewingTrainingFile.rows.length - 1} data rows` : 'No data stored'}
                  {viewingTrainingFile.rows && viewingTrainingFile.rows.length >= 300 ? ' (preview capped at 300 rows)' : ''}
                </span>
                <button onClick={() => setViewingTrainingFile(null)} className="px-4 py-2 rounded-md text-sm font-medium border border-tm-border text-tm-text-1 hover:bg-tm-surface-hover">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Training file upload modal ── */}
        {showTrainingFileUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-[10px] border border-tm-border bg-tm-surface shadow-xl">
              <div className="flex items-center justify-between p-5 border-b border-tm-border">
                <div>
                  <h3 className="font-semibold text-tm-text-1 flex items-center gap-2">
                    <Upload className="h-4 w-4 text-tm-secondary" />
                    Upload attendance file
                  </h3>
                  {trainingUploadSessionId && (() => {
                    const s = sessions.find(x => x.id === trainingUploadSessionId)
                    return s ? <p className="text-xs text-tm-text-3 mt-0.5">{new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} — {s.title || s.description || 'Training session'}</p> : null
                  })()}
                </div>
                <button onClick={() => { setShowTrainingFileUpload(false); setTrainingUploadFile(null); setTrainingUploadError(null) }} className="modal-close-btn">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-tm-border rounded-xl p-6 cursor-pointer hover:border-primary hover:bg-tm-surface-hover transition-all">
                  <Upload className="h-8 w-8 text-tm-text-3" />
                  <span className="text-sm font-medium text-tm-text-2">
                    {trainingUploadFile ? trainingUploadFile.name : 'Tap to choose a CSV or Excel file'}
                  </span>
                  {trainingUploadFile && <span className="text-xs text-tm-text-3">{(trainingUploadFile.size / 1024).toFixed(1)} KB</span>}
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="sr-only"
                    onChange={e => { setTrainingUploadFile(e.target.files?.[0] || null); setTrainingUploadError(null) }}
                  />
                </label>
                <div className="rounded-md bg-tm-surface-hover p-3">
                  <p className="text-xs font-semibold text-tm-text-3 mb-1 uppercase tracking-wide">Expected format</p>
                  <p className="text-[11px] font-mono text-tm-text-2">
                    player_name, status, notes<br />
                    Patrick Allan, P<br />
                    John Smith, A, excused
                  </p>
                  <p className="text-[10px] text-tm-text-3 mt-1">P Present · A Justified absence · X Unjustified absence · I Injured</p>
                </div>
                {trainingUploadError && (
                  <div className="rounded-md bg-[#E05757]/10 p-3">
                    <p className="text-sm text-[#E05757]">{trainingUploadError}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 p-5 border-t border-tm-border">
                <button
                  onClick={() => { setShowTrainingFileUpload(false); setTrainingUploadFile(null); setTrainingUploadError(null) }}
                  className="px-4 py-2 rounded-md text-sm font-medium border border-tm-border text-tm-text-1 hover:bg-tm-surface-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTrainingFileUpload}
                  disabled={trainingFileUploading || !trainingUploadFile}
                  className="px-4 py-2 rounded-md text-sm font-semibold bg-tm-secondary text-tm-on-secondary disabled:opacity-50 flex items-center gap-2"
                >
                  {trainingFileUploading ? <><div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save file</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
