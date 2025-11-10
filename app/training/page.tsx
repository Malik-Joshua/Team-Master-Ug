'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import { Calendar, Users, Save, Download, Plus, Trash2, Edit } from 'lucide-react'
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
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [newSession, setNewSession] = useState({ date: '', title: '' })

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
            }))

            // Initialize empty attendance record
            const mockAttendance: Record<string, AttendanceCode> = {}
            
            setPlayers(mockPlayers)
            setSessions(mockSessions)
            setAttendance(mockAttendance)
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
          // Fetch real data
        }
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const handleAttendanceChange = (playerId: string, sessionNumber: number, code: AttendanceCode) => {
    setAttendance((prev) => ({
      ...prev,
      [`${playerId}-${sessionNumber}`]: code,
    }))
  }

  const calculateTotals = (playerId: string) => {
    const totals = { P: 0, A: 0, X: 0, I: 0 }
    for (let i = 1; i <= 20; i++) {
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
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        alert('Please log in to save attendance')
        return
      }

      // Get or create training session
      let sessionId: string
      const { data: existingSession } = await supabase
        .from('training_sessions')
        .select('id')
        .eq('session_number', selectedSession)
        .single()

      if (existingSession) {
        sessionId = existingSession.id
      } else {
        // Create new session
        const sessionDate = new Date()
        sessionDate.setDate(sessionDate.getDate() - (20 - selectedSession))
        
        const { data: newSession, error: sessionError } = await supabase
          .from('training_sessions')
          .insert({
            session_number: selectedSession,
            session_date: sessionDate.toISOString().split('T')[0],
            coach_id: user.id,
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
            recorded_by: user.id,
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

  return (
    <Layout pageTitle="Training">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-club-gradient rounded-card p-6 text-white shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Player Attendance at Training Sessions</h1>
              <p className="text-blue-100">
                Track and record player attendance for all training sessions
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSave}
                className="bg-white text-primary px-6 py-3 rounded-button font-semibold hover:bg-blue-50 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
              >
                <Save className="w-5 h-5 mr-2" />
                Save Attendance
              </button>
              <button className="bg-white/20 text-white px-6 py-3 rounded-button font-semibold hover:bg-white/30 transition-all duration-300 inline-flex items-center border border-white/30">
                <Download className="w-5 h-5 mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Instructions */}
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

        {/* Attendance Table */}
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
                        return (
                          <td
                            key={session.id}
                            className="px-2 py-2 text-center border-l border-neutral-light"
                          >
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

        {/* Session Dates Reference */}
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
