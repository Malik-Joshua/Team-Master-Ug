'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import { Calendar, Users, Save, Download, Plus, Clock, MapPin, FileText, X, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

export default function TrainingPage() {
  const [user, setUser] = useState<any>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [attendance, setAttendance] = useState<Record<string, AttendanceCode>>({})
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<number>(1)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    session_date: '',
    session_time: '',
    location: '',
    description: '',
  })
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [sessionSummaries, setSessionSummaries] = useState<Array<{
    sessionId: string
    sessionDate: string
    sessionTime?: string
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

  useEffect(() => {
    const loadData = async () => {
      // Check for dev mode
      if (typeof window !== 'undefined') {
        const devUser = localStorage.getItem('dev_user')
        if (devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            
            // Mock players data
            const mockPlayers: Player[] = [
              { id: '1', name: 'John Doe', position: 'Fly Half' },
              { id: '2', name: 'Jane Smith', position: 'Prop' },
              { id: '3', name: 'Mike Johnson', position: 'Wing' },
              { id: '4', name: 'Sarah Williams', position: 'Scrum Half' },
              { id: '5', name: 'David Brown', position: 'Lock' },
              { id: '6', name: 'Emma Davis', position: 'Hooker' },
              { id: '7', name: 'Chris Wilson', position: 'Number 8' },
              { id: '8', name: 'Lisa Anderson', position: 'Flanker' },
              { id: '9', name: 'Tom Taylor', position: 'Centre' },
              { id: '10', name: 'Amy Martinez', position: 'Fullback' },
            ]

            // Mock training sessions (20 sessions)
            const mockSessions: TrainingSession[] = Array.from({ length: 20 }, (_, i) => ({
              id: `session-${i + 1}`,
              date: new Date(2024, 10, 1 + i * 7).toISOString().split('T')[0],
              title: `Training Session ${i + 1}`,
              session_time: '18:00',
              location: 'Training Ground',
              description: `Focus on ${i % 3 === 0 ? 'scrummaging and lineout drills' : i % 3 === 1 ? 'backline moves and kicking' : 'fitness and conditioning'}`,
              coach_name: 'Coach Smith',
            }))

            // Initialize empty attendance record
            const mockAttendance: Record<string, AttendanceCode> = {}
            
            setPlayers(mockPlayers)
            setSessions(mockSessions)
            setAttendance(mockAttendance)

            // Mock session summaries for admin
            if (userData.role === 'admin') {
              const mockSummaries = Array.from({ length: 10 }, (_, i) => ({
                sessionId: `session-${i + 1}`,
                sessionDate: new Date(2024, 10, 1 + i * 7).toISOString().split('T')[0],
                sessionTime: '18:00',
                location: 'Training Ground',
                description: `Training Session ${i + 1}`,
                drills: i % 3 === 0 
                  ? 'Scrummaging drills, Lineout practice, Maul defense'
                  : i % 3 === 1 
                  ? 'Backline moves, Kicking practice, Attack patterns'
                  : 'Fitness circuits, Speed training, Endurance drills',
                present: 22 + (i % 5),
                absent: 5 - (i % 3),
                justified: 2 + (i % 2),
                injured: 1,
                total: 30,
                attendanceRate: Math.round(((22 + (i % 5)) / 30) * 100 * 10) / 10,
              }))
              setSessionSummaries(mockSummaries)
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
          
          // Fetch players
          const { data: playersData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('role', 'player')

          if (playersData) {
            setPlayers(playersData.map((p: any) => ({
              id: p.user_id,
              name: p.name,
              position: p.position || 'N/A',
            })))
          }

          // Fetch training sessions
          if (profile.role === 'coach') {
            const { data: sessionsData } = await supabase
              .from('training_sessions')
              .select('*')
              .eq('coach_id', authUser.id)
              .order('session_date', { ascending: true })

            if (sessionsData) {
              const formattedSessions: TrainingSession[] = sessionsData.map((s: any) => ({
                id: s.id,
                date: s.session_date,
                title: s.description || `Training Session ${s.session_number}`,
                session_time: s.session_time,
                location: s.location,
                description: s.description,
              }))
              setSessions(formattedSessions)
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
                location: s.location,
                description: s.description,
                coach_name: s.coach?.name || 'Coach',
              }))
              setSessions(formattedSessions)
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
                location: s.location,
                description: s.description,
              }))
              setSessions(formattedSessions)

              // For admin, fetch session summaries with attendance data
              if (profile.role === 'admin') {
                const summaries = await Promise.all(
                  sessionsData.map(async (session: any) => {
                    const { data: attendanceData } = await supabase
                      .from('training_attendance')
                      .select('attendance_status')
                      .eq('session_id', session.id)

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
            }
          }
        }
      }
      setLoading(false)
    }

    loadData()
  }, [])

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

  const handleFileUpload = async () => {
    if (!uploadFile) {
      alert('Please select a file to upload')
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
    try {
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

      // Get the next session number for this coach
      const { data: existingSessions } = await supabase
        .from('training_sessions')
        .select('session_number')
        .eq('coach_id', authUser.id)
        .order('session_number', { ascending: false })
        .limit(1)

      const nextSessionNumber = existingSessions && existingSessions.length > 0 
        ? existingSessions[0].session_number + 1 
        : 1

      // Create the training session
      const { data: newSession, error } = await supabase
        .from('training_sessions')
        .insert({
          session_number: nextSessionNumber,
          session_date: scheduleForm.session_date,
          session_time: scheduleForm.session_time || null,
          location: scheduleForm.location || null,
          description: scheduleForm.description || null,
          coach_id: authUser.id,
        })
        .select()
        .single()

      if (error) throw error

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
          location: s.location,
          description: s.description,
        }))
        setSessions(formattedSessions)
      }

      setScheduleForm({ session_date: '', session_time: '', location: '', description: '' })
      setShowScheduleForm(false)
      alert('Training schedule created successfully!')
    } catch (error: any) {
      console.error('Error creating schedule:', error)
      alert(`Error creating schedule: ${error.message}`)
    }
  }

  const handleAttendanceChange = (playerId: string, sessionNumber: number, code: AttendanceCode) => {
    setAttendance((prev) => ({
      ...prev,
      [`${playerId}-${sessionNumber}`]: code,
    }))
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

      // Get or create training session
      let sessionId: string
      const session = sessions[selectedSession - 1]
      
      if (session && session.id && !session.id.startsWith('session-')) {
        sessionId = session.id
      } else {
        // Create new session
        const sessionDate = new Date()
        sessionDate.setDate(sessionDate.getDate() - (sessions.length - selectedSession))
        
        const { data: newSession, error: sessionError } = await supabase
          .from('training_sessions')
          .insert({
            session_number: selectedSession,
            session_date: sessionDate.toISOString().split('T')[0],
            coach_id: authUser.id,
          })
          .select('id')
          .single()

        if (sessionError) throw sessionError
        sessionId = newSession.id
      }

      // Delete existing attendance for this session
      await supabase
        .from('training_attendance')
        .delete()
        .eq('session_id', sessionId)

      // Prepare attendance records
      const attendanceRecords = players
        .map(player => {
          const key = `${player.id}-${selectedSession}`
          const code = attendance[key]
          if (!code || (code !== 'P' && code !== 'A' && code !== 'X' && code !== 'I')) {
            return null
          }
          
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

      // Insert attendance records
      const { error: attendanceError } = await supabase
        .from('training_attendance')
        .insert(attendanceRecords)

      if (attendanceError) throw attendanceError

      alert('Attendance saved successfully!')
    } catch (error: any) {
      console.error('Error saving attendance:', error)
      alert(`Error saving attendance: ${error.message}`)
    }
  }

  const getCodeColor = (code: AttendanceCode) => {
    switch (code) {
      case 'P':
        return 'bg-success text-white'
      case 'A':
        return 'bg-info text-white'
      case 'X':
        return 'bg-secondary text-white'
      case 'I':
        return 'bg-warning text-white'
      default:
        return 'bg-neutral-light text-neutral-medium'
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
          <div className="bg-club-gradient rounded-card p-6 text-white shadow-soft">
            <div>
              <h1 className="text-3xl font-bold mb-2">Upcoming Training Sessions</h1>
              <p className="text-blue-100">
                View your upcoming training sessions, drills, and activities scheduled by your coach
              </p>
            </div>
          </div>

          {/* Training Sessions List */}
          {upcomingSessions.length === 0 ? (
            <div className="bg-white rounded-card border border-neutral-light shadow-soft p-12 text-center">
              <Calendar className="w-16 h-16 text-neutral-medium mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-neutral-text mb-2">No Upcoming Sessions</h3>
              <p className="text-neutral-medium">
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
                    className="bg-white rounded-card border border-neutral-light shadow-soft hover:shadow-medium transition-all duration-300 overflow-hidden"
                  >
                    {/* Date Header */}
                    <div className={`${isToday ? 'bg-primary' : isTomorrow ? 'bg-info' : 'bg-club-gradient'} p-4 text-white`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium opacity-90">
                            {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : sessionDate.toLocaleDateString('en-US', { weekday: 'long' })}
                          </p>
                          <p className="text-2xl font-bold">
                            {sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <Calendar className="w-8 h-8 opacity-80" />
                      </div>
                    </div>

                    {/* Session Details */}
                    <div className="p-6 space-y-4">
                      {/* Time and Location */}
                      {(session.session_time || session.location) && (
                        <div className="space-y-2">
                          {session.session_time && (
                            <div className="flex items-center text-neutral-medium">
                              <Clock className="w-4 h-4 mr-2" />
                              <span className="text-sm font-medium">{session.session_time}</span>
                            </div>
                          )}
                          {session.location && (
                            <div className="flex items-center text-neutral-medium">
                              <MapPin className="w-4 h-4 mr-2" />
                              <span className="text-sm font-medium">{session.location}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Coach Name */}
                      {session.coach_name && (
                        <div className="pt-2 border-t border-neutral-light">
                          <p className="text-xs text-neutral-medium mb-1">Coach</p>
                          <p className="text-sm font-semibold text-neutral-text">{session.coach_name}</p>
                        </div>
                      )}

                      {/* Drills/Activities */}
                      {session.description && (
                        <div className="pt-2 border-t border-neutral-light">
                          <p className="text-xs text-neutral-medium mb-2 font-semibold uppercase tracking-wide">
                            Training Drills & Activities
                          </p>
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-sm text-neutral-text leading-relaxed whitespace-pre-line">
                              {session.description}
                            </p>
                          </div>
                        </div>
                      )}

                      {!session.description && (
                        <div className="pt-2 border-t border-neutral-light">
                          <p className="text-xs text-neutral-medium italic">
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
            <div className="bg-white rounded-card border border-neutral-light shadow-soft p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-text mb-1">Training Summary</h3>
                  <p className="text-sm text-neutral-medium">
                    You have <span className="font-bold text-primary">{upcomingSessions.length}</span> upcoming training session{upcomingSessions.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="bg-club-gradient rounded-lg p-4 text-white">
                  <Calendar className="w-8 h-8" />
                </div>
              </div>
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
        <div className="bg-club-gradient rounded-card p-6 text-white shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Player Attendance at Training Sessions</h1>
              <p className="text-blue-100">
                {user?.role === 'admin' 
                  ? 'View training attendance summary and statistics'
                  : 'Track and record player attendance for all training sessions'}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {(user?.role === 'coach' || user?.role === 'data_admin') && (
                <>
                  {user?.role === 'coach' && (
                    <>
                      <button
                        onClick={() => setShowUploadForm(true)}
                        className="bg-white text-primary px-6 py-3 rounded-button font-semibold hover:bg-blue-50 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
                      >
                        <Upload className="w-5 h-5 mr-2" />
                        Import Schedule
                      </button>
                      <button
                        onClick={() => setShowScheduleForm(true)}
                        className="bg-white text-primary px-6 py-3 rounded-button font-semibold hover:bg-blue-50 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Create Schedule
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleSave}
                    className="bg-white text-primary px-6 py-3 rounded-button font-semibold hover:bg-blue-50 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
                  >
                    <Save className="w-5 h-5 mr-2" />
                    Save Attendance
                  </button>
                </>
              )}
              <button className="bg-white/20 text-white px-6 py-3 rounded-button font-semibold hover:bg-white/30 transition-all duration-300 inline-flex items-center border border-white/30">
                <Download className="w-5 h-5 mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Upload Training Schedule Modal for Coaches */}
        {showUploadForm && user?.role === 'coach' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-card shadow-large max-w-2xl w-full border border-neutral-light">
              <div className="p-6 border-b border-neutral-light">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-neutral-text">Import Training Schedule</h2>
                  <button
                    onClick={() => {
                      setShowUploadForm(false)
                      setUploadFile(null)
                    }}
                    className="text-neutral-medium hover:text-neutral-text"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">
                    <Upload className="w-4 h-4 inline mr-2" />
                    Upload File (TXT or PDF)
                  </label>
                  <input
                    type="file"
                    accept=".txt,.pdf,text/plain,application/pdf"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                  {uploadFile && (
                    <p className="mt-2 text-sm text-neutral-medium">
                      Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-text mb-2">File Format Guidelines:</h3>
                  <ul className="text-sm text-neutral-medium space-y-1 list-disc list-inside">
                    <li>Each line should contain a training session</li>
                    <li>Format: Date, Time, Location, Description (comma-separated)</li>
                    <li>Or: Date | Time | Location | Description (pipe-separated)</li>
                    <li>Or: Date - Description (dash-separated)</li>
                    <li>Date formats: YYYY-MM-DD, MM/DD/YYYY, or DD Month YYYY</li>
                    <li>Example: 2024-12-15, 18:00, Training Ground, Focus on scrummaging</li>
                  </ul>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleFileUpload}
                    disabled={!uploadFile || uploading}
                    className="flex-1 px-6 py-3 bg-club-gradient text-white rounded-button hover:opacity-90 transition-all duration-300 font-semibold shadow-soft hover:shadow-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Importing...' : 'Import Schedule'}
                  </button>
                  <button
                    onClick={() => {
                      setShowUploadForm(false)
                      setUploadFile(null)
                    }}
                    disabled={uploading}
                    className="px-6 py-3 bg-neutral-light text-neutral-text rounded-button hover:bg-neutral-medium transition-all duration-300 font-semibold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Training Schedule Modal for Coaches */}
        {showScheduleForm && user?.role === 'coach' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-card shadow-large max-w-2xl w-full border border-neutral-light">
              <div className="p-6 border-b border-neutral-light">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-neutral-text">Create Training Schedule</h2>
                  <button
                    onClick={() => {
                      setShowScheduleForm(false)
                      setScheduleForm({ session_date: '', session_time: '', location: '', description: '' })
                    }}
                    className="text-neutral-medium hover:text-neutral-text"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Training Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.session_date}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, session_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Training Time
                  </label>
                  <input
                    type="time"
                    value={scheduleForm.session_time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, session_time: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    Location
                  </label>
                  <input
                    type="text"
                    value={scheduleForm.location}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                    placeholder="e.g., Training Ground, Main Pitch"
                    className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Description
                  </label>
                  <textarea
                    value={scheduleForm.description}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                    rows={4}
                    placeholder="e.g., Focus on scrummaging and lineout drills"
                    className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCreateSchedule}
                    className="flex-1 px-6 py-3 bg-club-gradient text-white rounded-button hover:opacity-90 transition-all duration-300 font-semibold shadow-soft hover:shadow-medium"
                  >
                    Create Schedule
                  </button>
                  <button
                    onClick={() => {
                      setShowScheduleForm(false)
                      setScheduleForm({ session_date: '', session_time: '', location: '', description: '' })
                    }}
                    className="px-6 py-3 bg-neutral-light text-neutral-text rounded-button hover:bg-neutral-medium transition-all duration-300 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Summary View */}
        {user?.role === 'admin' && (
          <div className="space-y-4">
            <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
              <h2 className="text-2xl font-bold text-neutral-text mb-4">Training Sessions Summary</h2>
              <p className="text-neutral-medium mb-6">Overview of all training sessions with attendance and activities</p>
              
              {sessionSummaries.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-neutral-medium mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-neutral-text mb-2">No Training Sessions</h3>
                  <p className="text-neutral-medium">No training sessions have been recorded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessionSummaries.map((summary) => (
                  <div
                    key={summary.sessionId}
                    className="bg-gradient-to-br from-white to-blue-50/30 rounded-lg border border-neutral-light shadow-soft p-5 hover:shadow-medium transition-all"
                  >
                    {/* Session Header */}
                    <div className="mb-4 pb-4 border-b border-neutral-light">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-neutral-text">
                          {new Date(summary.sessionDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </h3>
                        <span className="text-xs font-semibold px-2 py-1 bg-club-gradient text-white rounded-full">
                          {summary.attendanceRate}%
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-neutral-medium">
                        {summary.sessionTime && (
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {summary.sessionTime}
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
                        <h4 className="text-sm font-semibold text-neutral-text mb-2 flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          Drills & Activities
                        </h4>
                        <p className="text-sm text-neutral-medium bg-blue-50 rounded-lg p-3 border border-blue-200">
                          {summary.drills}
                        </p>
                      </div>
                    )}

                    {/* Attendance Summary */}
                    <div>
                      <h4 className="text-sm font-semibold text-neutral-text mb-3">Attendance Summary</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-green-50 rounded-lg p-2 border border-green-200">
                          <div className="text-xs text-neutral-medium">Present</div>
                          <div className="text-lg font-bold text-success">{summary.present}</div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-2 border border-red-200">
                          <div className="text-xs text-neutral-medium">Absent</div>
                          <div className="text-lg font-bold text-secondary">{summary.absent}</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
                          <div className="text-xs text-neutral-medium">Justified</div>
                          <div className="text-lg font-bold text-info">{summary.justified}</div>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-2 border border-yellow-200">
                          <div className="text-xs text-neutral-medium">Injured</div>
                          <div className="text-lg font-bold text-warning">{summary.injured}</div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-neutral-light">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-neutral-medium">Total Players</span>
                          <span className="text-sm font-bold text-neutral-text">{summary.total}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        {user?.role !== 'admin' && (
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <h2 className="text-lg font-bold text-neutral-text mb-3">Attendance Codes</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-success rounded-lg flex items-center justify-center text-white font-bold">
                P
              </div>
              <div>
                <p className="font-medium text-neutral-text">Present</p>
                <p className="text-sm text-neutral-medium">Player attended</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-info rounded-lg flex items-center justify-center text-white font-bold">
                A
              </div>
              <div>
                <p className="font-medium text-neutral-text">Justified Absence</p>
                <p className="text-sm text-neutral-medium">Excused absence</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center text-white font-bold">
                X
              </div>
              <div>
                <p className="font-medium text-neutral-text">Unjustified Absence</p>
                <p className="text-sm text-neutral-medium">Unexcused absence</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-warning rounded-lg flex items-center justify-center text-white font-bold">
                I
              </div>
              <div>
                <p className="font-medium text-neutral-text">Injured</p>
                <p className="text-sm text-neutral-medium">Player injured</p>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Attendance Table - Hidden for Admin */}
        {user?.role !== 'admin' && (
          <div className="bg-white rounded-card border border-neutral-light shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="bg-success text-white">
                  <th className="px-4 py-4 text-left text-sm font-bold sticky left-0 bg-success z-10 min-w-[200px]">
                    Player&apos;s Name
                  </th>
                  {sessions.map((session, index) => (
                    <th
                      key={session.id}
                      className="px-3 py-4 text-center text-xs font-bold border-l border-white/20 min-w-[50px]"
                    >
                      {index + 1}
                    </th>
                  ))}
                  <th className="px-4 py-4 text-center text-sm font-bold bg-success-light border-l-2 border-white min-w-[80px]">
                    Totals
                  </th>
                  <th className="px-3 py-4 text-center text-xs font-bold bg-success-light min-w-[50px]">P</th>
                  <th className="px-3 py-4 text-center text-xs font-bold bg-success-light min-w-[50px]">A</th>
                  <th className="px-3 py-4 text-center text-xs font-bold bg-success-light min-w-[50px]">X</th>
                  <th className="px-3 py-4 text-center text-xs font-bold bg-success-light min-w-[50px]">I</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, rowIndex) => {
                  const totals = calculateTotals(player.id)
                  return (
                    <tr
                      key={player.id}
                      className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-neutral-text sticky left-0 bg-inherit z-10 border-r border-neutral-light">
                        {player.name}
                      </td>
                      {sessions.map((session, sessionIndex) => {
                        const sessionNumber = sessionIndex + 1
                        const code = attendance[`${player.id}-${sessionNumber}`] || ''
                        const canEdit = user?.role === 'coach' || user?.role === 'data_admin'
                        return (
                          <td
                            key={session.id}
                            className="px-2 py-2 text-center border-l border-neutral-light"
                          >
                            {canEdit ? (
                              <select
                                value={code}
                                onChange={(e) =>
                                  handleAttendanceChange(player.id, sessionNumber, e.target.value as AttendanceCode)
                                }
                                className={`w-full h-10 rounded-lg font-bold text-sm text-center cursor-pointer transition-all hover:scale-105 ${getCodeColor(code)} border-2 border-transparent hover:border-primary`}
                              >
                                <option value="">-</option>
                                <option value="P">P</option>
                                <option value="A">A</option>
                                <option value="X">X</option>
                                <option value="I">I</option>
                              </select>
                            ) : (
                              <div className={`w-full h-10 rounded-lg font-bold text-sm text-center flex items-center justify-center ${getCodeColor(code)}`}>
                                {code || '-'}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-center text-sm font-semibold text-neutral-text bg-green-50 border-l-2 border-success">
                        Total
                      </td>
                      <td className="px-3 py-3 text-center text-sm font-bold text-neutral-text bg-green-50">
                        {totals.P}
                      </td>
                      <td className="px-3 py-3 text-center text-sm font-bold text-neutral-text bg-green-50">
                        {totals.A}
                      </td>
                      <td className="px-3 py-3 text-center text-sm font-bold text-neutral-text bg-green-50">
                        {totals.X}
                      </td>
                      <td className="px-3 py-3 text-center text-sm font-bold text-neutral-text bg-green-50">
                        {totals.I}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Session Dates Reference - Hidden for Admin */}
        {user?.role !== 'admin' && (
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <h2 className="text-lg font-bold text-neutral-text mb-4">Training Session Dates</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {sessions.map((session, index) => (
              <div
                key={session.id}
                className="p-3 bg-neutral-light rounded-lg text-center hover:bg-neutral-medium/20 transition-colors"
              >
                <p className="text-xs font-medium text-neutral-medium">Session {index + 1}</p>
                <p className="text-sm font-semibold text-neutral-text">
                  {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                {session.session_time && (
                  <p className="text-xs text-neutral-medium mt-1">
                    {session.session_time}
                  </p>
                )}
                {session.location && (
                  <p className="text-xs text-neutral-medium mt-1">
                    {session.location}
                  </p>
                )}
              </div>
            ))}
          </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
