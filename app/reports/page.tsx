'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { FileText, Download, Filter, Calendar, BarChart3, TrendingUp, Users, Trophy, ChevronDown, FileSpreadsheet, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RefreshButton from '@/components/RefreshButton'
import { generatePDFReport, generateExcelReport, generateCSVReport, downloadBlob, type ReportData } from '@/lib/report-export'

interface Report {
  id: string
  title: string
  type: 'player' | 'match' | 'training' | 'financial' | 'summary'
  dateRange: string
  generatedAt: string
  status: 'ready' | 'generating' | 'error'
}

export default function ReportsPage() {
  const [user, setUser] = useState<any>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilter, setShowFilter] = useState(false)
  const [filterData, setFilterData] = useState({
    reportType: 'all',
    dateFrom: '',
    dateTo: '',
  })
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null)
  const [showDownloadMenu, setShowDownloadMenu] = useState<string | null>(null)
  const [players, setPlayers] = useState<Array<{ id: string; name: string }>>([])
  const [matches, setMatches] = useState<Array<{ id: string; opponent: string; match_date: string }>>([])
  const [trainingSessions, setTrainingSessions] = useState<Array<{ id: string; session_date: string; description?: string }>>([])
  const [reportFilters, setReportFilters] = useState({
    selectedPlayer: '',
    selectedMatch: '',
    selectedTrainingSession: '',
  })

  useEffect(() => {
    // Close download menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showDownloadMenu && !target.closest('.download-menu-container')) {
        setShowDownloadMenu(null)
      }
    }

    if (showDownloadMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDownloadMenu])

  useEffect(() => {
    // Close download menu on scroll
    const handleScroll = () => {
      if (showDownloadMenu) {
        setShowDownloadMenu(null)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [showDownloadMenu])

  const loadData = async () => {
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
          
          // Fetch real reports from database
          const { data: reportsData, error: reportsError } = await supabase
            .from('reports')
            .select('*')
            .eq('generated_by', authUser.id)
            .order('created_at', { ascending: false })

          if (reportsData && !reportsError) {
            // Fix any reports stuck in "generating" status (older than 5 minutes)
            const now = new Date()
            const stuckReports = reportsData.filter((r: any) => {
              if (r.status === 'generating') {
                const created = new Date(r.created_at)
                const minutesAgo = (now.getTime() - created.getTime()) / (1000 * 60)
                return minutesAgo > 5 // Stuck for more than 5 minutes
              }
              return false
            })

            // Update stuck reports to ready
            if (stuckReports.length > 0) {
              const stuckIds = stuckReports.map((r: any) => r.id)
              await supabase
                .from('reports')
                .update({ status: 'ready' })
                .in('id', stuckIds)
            }

            const formattedReports: Report[] = reportsData.map((r: any) => {
              // If report was stuck, mark as ready in local state
              const isStuck = stuckReports.some((sr: any) => sr.id === r.id)
              return {
              id: r.id,
              title: r.title,
              type: r.report_type as Report['type'],
              dateRange: r.date_from && r.date_to
                ? `${new Date(r.date_from).toLocaleDateString()} - ${new Date(r.date_to).toLocaleDateString()}`
                : new Date(r.created_at).toLocaleDateString(),
              generatedAt: r.created_at,
                status: (isStuck ? 'ready' : r.status) as Report['status'],
              }
            })
            setReports(formattedReports)
          }

          // Load players for player reports
          try {
            const playersResponse = await fetch('/api/admin/players')
            if (playersResponse.ok) {
              const playersData = await playersResponse.json()
              if (playersData.players && Array.isArray(playersData.players)) {
                setPlayers(playersData.players.map((p: any) => ({
                  id: p.user_id || p.id,
                  name: p.name || 'Unknown',
                })))
              }
            }
          } catch (err) {
            console.error('Error loading players:', err)
          }

          // Load matches for match reports
          try {
            const matchesResponse = await fetch('/api/fixtures?all=true')
            if (matchesResponse.ok) {
              const matchesData = await matchesResponse.json()
              if (matchesData.fixtures && Array.isArray(matchesData.fixtures)) {
                setMatches(matchesData.fixtures.map((m: any) => ({
                  id: m.id,
                  opponent: m.opponent || 'Unknown',
                  match_date: m.match_date,
                })))
              }
            }
          } catch (err) {
            console.error('Error loading matches:', err)
          }

          // Load training sessions for training reports
          try {
            const { data: sessionsData } = await supabase
              .from('training_sessions')
              .select('id, session_date, description')
              .order('session_date', { ascending: false })
            
            if (sessionsData) {
              setTrainingSessions(sessionsData.map((s: any) => ({
                id: s.id,
                session_date: s.session_date,
                description: s.description,
              })))
            }
          } catch (err) {
            console.error('Error loading training sessions:', err)
          }
        }
      }
      setLoading(false)
    }

  useEffect(() => {
    loadData()
  }, [])

  const handleGenerateReport = async (type: string) => {
    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        alert('Please log in to generate reports')
        return
      }

      // Validate filters based on report type
      if (type === 'player' && !reportFilters.selectedPlayer) {
        alert('Please select a player for the player performance report')
        return
      }
      if (type === 'match' && !reportFilters.selectedMatch) {
        alert('Please select a match for the match stats report')
        return
      }
      if (type === 'training' && !reportFilters.selectedTrainingSession) {
        alert('Please select a training session for the training report')
        return
      }

      // Determine date range
      const dateFrom = filterData.dateFrom ? new Date(filterData.dateFrom).toISOString().split('T')[0] : null
      const dateTo = filterData.dateTo ? new Date(filterData.dateTo).toISOString().split('T')[0] : null

      // Create report title with selected filters
      let reportTitle = `${type.charAt(0).toUpperCase() + type.slice(1)} Report`
      
      if (type === 'player' && reportFilters.selectedPlayer) {
        const selectedPlayer = players.find(p => p.id === reportFilters.selectedPlayer)
        reportTitle += ` - ${selectedPlayer?.name || 'Player'}`
      } else if (type === 'match' && reportFilters.selectedMatch) {
        const selectedMatch = matches.find(m => m.id === reportFilters.selectedMatch)
        reportTitle += ` - ${selectedMatch?.opponent || 'Match'} (${selectedMatch?.match_date ? new Date(selectedMatch.match_date).toLocaleDateString() : ''})`
      } else if (type === 'training' && reportFilters.selectedTrainingSession) {
        const selectedSession = trainingSessions.find(s => s.id === reportFilters.selectedTrainingSession)
        reportTitle += ` - ${selectedSession?.session_date ? new Date(selectedSession.session_date).toLocaleDateString() : 'Session'}`
      }
      
      if (dateFrom && dateTo) {
        reportTitle += ` (${new Date(dateFrom).toLocaleDateString()} to ${new Date(dateTo).toLocaleDateString()})`
      } else {
        reportTitle += ` - ${new Date().toLocaleDateString()}`
      }

      // Create report in database with filter metadata
      const { data: newReport, error } = await supabase
        .from('reports')
        .insert({
          title: reportTitle,
          report_type: type,
          date_from: dateFrom,
          date_to: dateTo,
          generated_by: authUser.id,
          status: 'generating',
          // Store filter selections in metadata (if you have a metadata column, otherwise we'll handle it in the data)
        })
        .select()
        .single()

      if (error) throw error

      // Add to local state
      const formattedReport: Report = {
        id: newReport.id,
        title: newReport.title,
        type: newReport.report_type as Report['type'],
        dateRange: dateFrom && dateTo
          ? `${new Date(dateFrom).toLocaleDateString()} - ${new Date(dateTo).toLocaleDateString()}`
          : new Date().toLocaleDateString(),
        generatedAt: newReport.created_at,
        status: 'generating',
      }

      setReports([formattedReport, ...reports])
      
      // Reset filters after generating report
      setReportFilters({
        selectedPlayer: '',
        selectedMatch: '',
        selectedTrainingSession: '',
      })
      
      // Update status to ready immediately (reports are generated on-demand when downloaded)
      try {
        const { error: updateError } = await supabase
          .from('reports')
          .update({ status: 'ready' })
          .eq('id', newReport.id)

        if (!updateError) {
        setReports((prev) =>
          prev.map((r) => (r.id === newReport.id ? { ...r, status: 'ready' as const } : r))
        )
        } else {
          console.error('Error updating report status:', updateError)
          // Set to ready in local state anyway
          setReports((prev) =>
            prev.map((r) => (r.id === newReport.id ? { ...r, status: 'ready' as const } : r))
          )
        }
      } catch (updateErr) {
        console.error('Error updating report status:', updateErr)
        // Set to ready in local state anyway
        setReports((prev) =>
          prev.map((r) => (r.id === newReport.id ? { ...r, status: 'ready' as const } : r))
        )
      }
      
      alert('Report generated successfully! You can now download it.')
    } catch (error: any) {
      console.error('Error generating report:', error)
      alert(`Error generating report: ${error.message}`)
    }
  }

  const handleDownload = async (report: Report, format: 'pdf' | 'excel' | 'csv') => {
    try {
      setDownloadingReport(report.id)
      
      // Fetch actual report data from database if needed
      const supabase = createClient()
      const { data: reportDetails } = await supabase
        .from('reports')
        .select('*')
        .eq('id', report.id)
        .single()

      // Extract filter information from report title (we stored it there)
      let reportData: ReportData = {
        id: report.id,
        title: report.title,
        type: report.type,
        dateRange: report.dateRange,
        generatedAt: report.generatedAt,
        data: {
          reportId: report.id,
          reportType: report.type,
          dateFrom: reportDetails?.date_from || null,
          dateTo: reportDetails?.date_to || null,
          generatedBy: reportDetails?.generated_by || null,
          summary: `This ${report.type} report contains detailed information.`,
          details: 'Report data loaded from database.',
        },
      }

      // Fetch specific data based on report type and title (which contains filter info)
      if (report.type === 'player') {
        // Extract player name from title (format: "Player Report - PlayerName")
        const playerMatch = report.title.match(/Player Report - (.+?)(?:\s*\(|$)/)
        let selectedPlayer: { id: string; name: string } | null = null
        
        if (playerMatch && playerMatch[1]) {
          const playerName = playerMatch[1].trim()
          selectedPlayer = players.find(p => p.name === playerName) || null
        }
        
        // If player not found in local array, try to fetch from database
        if (!selectedPlayer && playerMatch && playerMatch[1]) {
          try {
            const playerName = playerMatch[1].trim()
            const { data: playerProfiles } = await supabase
              .from('user_profiles')
              .select('user_id, name')
              .ilike('name', `%${playerName}%`)
              .limit(1)
            
            if (playerProfiles && playerProfiles.length > 0) {
              selectedPlayer = {
                id: playerProfiles[0].user_id,
                name: playerProfiles[0].name
              }
            }
          } catch (err) {
            console.error('Error searching for player:', err)
          }
        }
        
        if (selectedPlayer) {
          // Fetch player-specific data
          try {
            // Fetch gym stats
            const playerResponse = await fetch(`/api/players/${selectedPlayer.id}/gym-stats`)
            const gymStats = playerResponse.ok ? await playerResponse.json() : {}
            
            // Fetch match stats for this player with matches relationship
            const { data: matchStats, error: matchStatsError } = await supabase
              .from('match_stats')
              .select(`
                *,
                matches (
                  id,
                  match_date,
                  opponent,
                  venue,
                  score_our_team,
                  score_opponent
                )
              `)
              .eq('player_id', selectedPlayer.id)
            
            if (matchStatsError) {
              console.error('Error fetching match stats:', matchStatsError)
            }
            
            // Fetch training attendance for this player
            const { data: attendance, error: attendanceError } = await supabase
              .from('training_attendance')
              .select(`
                *,
                training_sessions (
                  id,
                  session_date,
                  session_time,
                  location,
                  description
                )
              `)
              .eq('player_id', selectedPlayer.id)
            
            if (attendanceError) {
              console.error('Error fetching training attendance:', attendanceError)
            }
            
            reportData.data = {
              ...reportData.data,
              playerId: selectedPlayer.id,
              playerName: selectedPlayer.name,
              gymStats: gymStats || {},
              matchStats: matchStats || [],
              trainingAttendance: attendance || [],
              summary: `Performance report for ${selectedPlayer.name} including match statistics, training attendance, and gym metrics.`,
            }
            
            console.log('Player report data loaded:', {
              playerName: selectedPlayer.name,
              matchStatsCount: matchStats?.length || 0,
              attendanceCount: attendance?.length || 0,
              hasGymStats: !!gymStats && Object.keys(gymStats).length > 0
            })
          } catch (err) {
            console.error('Error fetching player data:', err)
            // Still set player name even if data fetch fails
            reportData.data = {
              ...reportData.data,
              playerId: selectedPlayer.id,
              playerName: selectedPlayer.name,
              gymStats: {},
              matchStats: [],
              trainingAttendance: [],
              summary: `Performance report for ${selectedPlayer.name}.`,
            }
          }
        } else {
          console.warn('Player not found for report:', report.title)
          // Set empty data structure so report still generates
          reportData.data = {
            ...reportData.data,
            playerName: playerMatch?.[1]?.trim() || 'Unknown Player',
            gymStats: {},
            matchStats: [],
            trainingAttendance: [],
            summary: 'Player data could not be loaded.',
          }
        }
      } else if (report.type === 'match') {
        // Extract match info from title
        const matchMatch = report.title.match(/Match Report - (.+?)\s*\(/)
        if (matchMatch && matchMatch[1]) {
          const matchOpponent = matchMatch[1].trim()
          const selectedMatch = matches.find(m => m.opponent === matchOpponent)
          
          if (selectedMatch) {
            // Fetch match-specific data
            try {
              const { data: matchDetails } = await supabase
                .from('matches')
                .select('*')
                .eq('id', selectedMatch.id)
                .single()
              
              // Fetch match stats
              const { data: matchStats } = await supabase
                .from('match_stats')
                .select('*')
                .eq('match_id', selectedMatch.id)
              
              // Fetch player names separately and map them
              if (matchStats && matchStats.length > 0) {
                const playerIds = matchStats.map((stat: any) => stat.player_id)
                const { data: playerProfiles } = await supabase
                  .from('user_profiles')
                  .select('user_id, name')
                  .in('user_id', playerIds)
                
                // Map player names to stats
                matchStats.forEach((stat: any) => {
                  const player = playerProfiles?.find((p: any) => p.user_id === stat.player_id)
                  stat.user_profiles = player ? { name: player.name } : { name: 'Unknown' }
                })
              }
              
              reportData.data = {
                ...reportData.data,
                matchId: selectedMatch.id,
                matchDetails: matchDetails || {},
                playerStats: matchStats || [],
                summary: `Match statistics report for ${matchDetails?.opponent || matchOpponent} on ${new Date(selectedMatch.match_date).toLocaleDateString()}.`,
              }
            } catch (err) {
              console.error('Error fetching match data:', err)
            }
          }
        }
      } else if (report.type === 'training') {
        // For training reports, always fetch all training sessions with attendance
        try {
          // Fetch all training sessions
          const { data: allSessions } = await supabase
            .from('training_sessions')
            .select('*')
            .order('session_date', { ascending: false })
            .limit(50) // Limit to recent 50 sessions
          
          if (allSessions && allSessions.length > 0) {
            // Fetch attendance for all sessions
            const formattedSessions = await Promise.all(
              allSessions.map(async (session: any) => {
                // Fetch attendance for this session directly from database
                const { data: attendanceData } = await supabase
                  .from('training_attendance')
                  .select('player_id, attendance_status')
                  .eq('session_id', session.id)
                
                // Get player names for attendance
                const attendanceWithNames = (attendanceData || []).map((att: any) => {
                  const player = players.find(p => p.id === att.player_id)
                  return {
                    player: player?.name || 'Unknown',
                    status: att.attendance_status === 'P' ? 'Present' : 
                            att.attendance_status === 'A' ? 'Justified Absence' :
                            att.attendance_status === 'X' ? 'Unjustified Absence' :
                            att.attendance_status === 'I' ? 'Injured' : 'Unknown'
                  }
                })
                
                return {
                  date: new Date(session.session_date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  }),
                  time: session.session_time || 'N/A',
                  location: session.location || 'N/A',
                  description: session.description || 'N/A',
                  attendance: attendanceWithNames,
                  summary: {
                    total: attendanceWithNames.length,
                    present: attendanceWithNames.filter((a: any) => a.status === 'Present').length,
                    absent: attendanceWithNames.filter((a: any) => a.status === 'Unjustified Absence').length,
                    justified: attendanceWithNames.filter((a: any) => a.status === 'Justified Absence').length,
                    injured: attendanceWithNames.filter((a: any) => a.status === 'Injured').length,
                  }
                }
              })
            )
            
            // Calculate overall statistics
            const totalPresent = formattedSessions.reduce((sum, s) => sum + s.summary.present, 0)
            const totalPlayers = formattedSessions.reduce((sum, s) => sum + s.summary.total, 0)
            const overallAttendanceRate = totalPlayers > 0 ? Math.round((totalPresent / totalPlayers) * 100) : 0
            
            reportData.data = {
              formattedSessions,
              summary: {
                totalSessions: formattedSessions.length,
                totalPlayers: players.length,
                overallAttendanceRate
              }
            }
          } else {
            // No sessions found, show message
            reportData.data = {
              formattedSessions: [],
              summary: {
                totalSessions: 0,
                totalPlayers: players.length,
                overallAttendanceRate: 0
              }
            }
          }
        } catch (err) {
          console.error('Error fetching training session data:', err)
          // Fallback: try to extract from title if available
          const sessionMatch = report.title.match(/Training Report - (.+?)(?:\s*\(|$)/)
          if (sessionMatch && sessionMatch[1]) {
            const sessionDateStr = sessionMatch[1].trim()
            const selectedSession = trainingSessions.find(s => 
              new Date(s.session_date).toLocaleDateString() === sessionDateStr
            )
            
            if (selectedSession) {
              try {
                const { data: sessionDetails } = await supabase
                  .from('training_sessions')
                  .select('*')
                  .eq('id', selectedSession.id)
                  .single()
                
                const { data: attendanceData } = await supabase
                  .from('training_attendance')
                  .select('player_id, attendance_status')
                  .eq('session_id', selectedSession.id)
                
                const attendanceWithNames = (attendanceData || []).map((att: any) => {
                  const player = players.find(p => p.id === att.player_id)
                  return {
                    player: player?.name || 'Unknown',
                    status: att.attendance_status === 'P' ? 'Present' : 
                            att.attendance_status === 'A' ? 'Justified Absence' :
                            att.attendance_status === 'X' ? 'Unjustified Absence' :
                            att.attendance_status === 'I' ? 'Injured' : 'Unknown'
                  }
                })
                
                const formattedSession = {
                  date: new Date(selectedSession.session_date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  }),
                  time: sessionDetails?.session_time || 'N/A',
                  location: sessionDetails?.location || 'N/A',
                  description: sessionDetails?.description || 'N/A',
                  attendance: attendanceWithNames,
                  summary: {
                    total: attendanceWithNames.length,
                    present: attendanceWithNames.filter((a: any) => a.status === 'Present').length,
                    absent: attendanceWithNames.filter((a: any) => a.status === 'Unjustified Absence').length,
                    justified: attendanceWithNames.filter((a: any) => a.status === 'Justified Absence').length,
                    injured: attendanceWithNames.filter((a: any) => a.status === 'Injured').length,
                  }
                }
                
                reportData.data = {
                  formattedSessions: [formattedSession],
                  summary: {
                    totalSessions: 1,
                    totalPlayers: players.length,
                    overallAttendanceRate: attendanceWithNames.length > 0
                      ? Math.round((formattedSession.summary.present / attendanceWithNames.length) * 100)
                      : 0
                  }
                }
              } catch (fallbackErr) {
                console.error('Error in fallback training data fetch:', fallbackErr)
              }
            }
          }
        }
      }

      let blob: Blob
      let filename: string
      const safeTitle = report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()

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
          blob = generateCSVReport(reportData)
          filename = `${safeTitle}.csv`
          break
        default:
          throw new Error('Unsupported format')
      }

      downloadBlob(blob, filename)
      setShowDownloadMenu(null)
      alert(`Report downloaded as ${format.toUpperCase()}!`)
    } catch (error: any) {
      console.error('Error downloading report:', error)
      alert(`Error downloading report: ${error.message}`)
    } finally {
      setDownloadingReport(null)
    }
  }

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'player':
        return Users
      case 'match':
        return Trophy
      case 'training':
        return Calendar
      case 'financial':
        return BarChart3
      default:
        return FileText
    }
  }

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'player':
        return 'bg-primary'
      case 'match':
        return 'bg-secondary'
      case 'training':
        return 'bg-info'
      case 'financial':
        return 'bg-success'
      default:
        return 'bg-warning'
    }
  }

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) {
      return
    }

    try {
      // Use API route to delete report (bypasses RLS)
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete report')
      }

      // Remove from local state
      setReports((prev) => prev.filter((r) => r.id !== reportId))
      alert('Report deleted successfully!')
    } catch (error: any) {
      console.error('Error deleting report:', error)
      alert(`Error deleting report: ${error.message}`)
    }
  }

  const handleClearAllReports = async () => {
    if (!confirm('Are you sure you want to delete all reports? This action cannot be undone.')) {
      return
    }

    try {
      // Use API route to delete all reports (bypasses RLS)
      const response = await fetch('/api/reports/clear', {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete reports')
      }

      // Clear local state
      setReports([])
      alert('All reports deleted successfully!')
    } catch (error: any) {
      console.error('Error clearing reports:', error)
      alert(`Error clearing reports: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <Layout pageTitle="Reports">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!user) return null

  const filteredReports = reports.filter((report) => {
    if (filterData.reportType !== 'all' && report.type !== filterData.reportType) return false
    return true
  })

  return (
    <Layout pageTitle="Reports">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-extrabold text-club-gradient mb-2">Reports</h1>
            <p className="text-lg text-neutral-medium font-medium">Generate and manage data reports</p>
          </div>
          <div className="flex items-center space-x-3">
            <RefreshButton onRefresh={loadData} />
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="bg-white text-neutral-text px-6 py-3 rounded-button font-semibold hover:bg-neutral-light transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center border border-neutral-light"
            >
              <Filter className="w-5 h-5 mr-2" />
              Filter
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilter && (
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
            <h2 className="text-xl font-bold text-neutral-text mb-4">Filter Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-2">Report Type</label>
                <select
                  value={filterData.reportType}
                  onChange={(e) => setFilterData({ ...filterData, reportType: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                >
                  <option value="all">All Types</option>
                  <option value="player">Player Reports</option>
                  <option value="match">Match Reports</option>
                  <option value="training">Training Reports</option>
                  <option value="financial">Financial Reports</option>
                  <option value="summary">Summary Reports</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-2">Date From</label>
                <input
                  type="date"
                  value={filterData.dateFrom}
                  onChange={(e) => setFilterData({ ...filterData, dateFrom: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-2">Date To</label>
                <input
                  type="date"
                  value={filterData.dateTo}
                  onChange={(e) => setFilterData({ ...filterData, dateTo: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Quick Generate Reports */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-neutral-text">Player Report</h3>
                <p className="text-sm text-neutral-medium">Performance & stats</p>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-neutral-medium mb-1">Select Player</label>
              <select
                value={reportFilters.selectedPlayer}
                onChange={(e) => setReportFilters({ ...reportFilters, selectedPlayer: e.target.value })}
                className="w-full px-3 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm"
              >
                <option value="">Choose a player...</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => handleGenerateReport('player')}
              disabled={!reportFilters.selectedPlayer}
              className="w-full px-4 py-2 bg-primary text-white rounded-button font-medium hover:bg-primary-dark transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate
            </button>
          </div>

          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-neutral-text">Match Report</h3>
                <p className="text-sm text-neutral-medium">Match statistics</p>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-neutral-medium mb-1">Select Match</label>
              <select
                value={reportFilters.selectedMatch}
                onChange={(e) => setReportFilters({ ...reportFilters, selectedMatch: e.target.value })}
                className="w-full px-3 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary transition-all text-sm"
              >
                <option value="">Choose a match...</option>
                {matches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.opponent} - {new Date(match.match_date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => handleGenerateReport('match')}
              disabled={!reportFilters.selectedMatch}
              className="w-full px-4 py-2 bg-secondary text-white rounded-button font-medium hover:bg-secondary-dark transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate
            </button>
          </div>

          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-info rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-neutral-text">Training Report</h3>
                <p className="text-sm text-neutral-medium">Attendance & sessions</p>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-neutral-medium mb-1">Select Training Session</label>
              <select
                value={reportFilters.selectedTrainingSession}
                onChange={(e) => setReportFilters({ ...reportFilters, selectedTrainingSession: e.target.value })}
                className="w-full px-3 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-info focus:border-info transition-all text-sm"
              >
                <option value="">Choose a session...</option>
                {trainingSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {new Date(session.session_date).toLocaleDateString()} {session.description ? `- ${session.description.substring(0, 30)}...` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => handleGenerateReport('training')}
              disabled={!reportFilters.selectedTrainingSession}
              className="w-full px-4 py-2 bg-info text-white rounded-button font-medium hover:bg-info-dark transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate
            </button>
          </div>

          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift cursor-pointer">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-warning rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-neutral-text">Summary Report</h3>
                <p className="text-sm text-neutral-medium">Overall summary</p>
              </div>
            </div>
            <button
              onClick={() => handleGenerateReport('summary')}
              className="w-full px-4 py-2 bg-warning text-white rounded-button font-medium hover:bg-warning-dark transition-colors text-sm"
            >
              Generate
            </button>
          </div>
        </div>

        {/* Reports List */}
        <div className="bg-white rounded-card border border-neutral-light shadow-soft overflow-hidden">
          <div className="p-6 border-b border-neutral-light flex justify-between items-center">
            <h2 className="text-2xl font-bold text-neutral-text">Generated Reports</h2>
            {filteredReports.length > 0 && (
              <button
                onClick={handleClearAllReports}
                className="px-4 py-2 bg-secondary text-white rounded-button font-medium hover:bg-secondary-dark transition-colors text-sm inline-flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </button>
            )}
          </div>
          {filteredReports.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-neutral-light rounded-full mb-4">
                <FileText className="w-10 h-10 text-neutral-medium" />
              </div>
              <h3 className="text-xl font-bold text-neutral-text mb-2">No Reports Found</h3>
              <p className="text-neutral-medium">Generate your first report using the options above</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-light">
              {filteredReports.map((report) => {
                const Icon = getReportTypeIcon(report.type)
                const typeColor = getReportTypeColor(report.type)
                return (
                  <div
                    key={report.id}
                    className="p-6 hover:bg-neutral-light transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className={`${typeColor} w-12 h-12 rounded-xl flex items-center justify-center`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-neutral-text mb-1">{report.title}</h3>
                          <div className="flex items-center space-x-4 text-sm text-neutral-medium">
                            <span className="capitalize">{report.type} Report</span>
                            <span>•</span>
                            <span>{report.dateRange}</span>
                            <span>•</span>
                            <span>Generated {new Date(report.generatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          className="px-3 py-2 text-secondary hover:bg-red-50 rounded-button transition-colors"
                          title="Delete report"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {report.status === 'ready' && (
                          <div className="relative download-menu-container">
                          <button
                              onClick={() => setShowDownloadMenu(showDownloadMenu === report.id ? null : report.id)}
                              disabled={downloadingReport === report.id}
                              className="px-4 py-2 bg-club-gradient text-white rounded-button font-medium hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center disabled:opacity-50"
                          >
                              {downloadingReport === report.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Downloading...
                                </>
                              ) : (
                                <>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                                  <ChevronDown className="w-4 h-4 ml-2" />
                                </>
                              )}
                            </button>
                            {showDownloadMenu === report.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-neutral-light z-50 overflow-hidden">
                                <button
                                  onClick={() => handleDownload(report, 'pdf')}
                                  className="w-full text-left px-4 py-3 hover:bg-neutral-light transition-colors flex items-center space-x-2 text-neutral-text"
                                >
                                  <FileText className="w-4 h-4 text-primary" />
                                  <span className="text-neutral-text">Download as PDF</span>
                                </button>
                                <button
                                  onClick={() => handleDownload(report, 'excel')}
                                  className="w-full text-left px-4 py-3 hover:bg-neutral-light transition-colors flex items-center space-x-2 text-neutral-text border-t border-neutral-light"
                                >
                                  <FileSpreadsheet className="w-4 h-4 text-success" />
                                  <span className="text-neutral-text">Download as Excel</span>
                                </button>
                                <button
                                  onClick={() => handleDownload(report, 'csv')}
                                  className="w-full text-left px-4 py-3 hover:bg-neutral-light transition-colors flex items-center space-x-2 text-neutral-text border-t border-neutral-light"
                                >
                                  <FileText className="w-4 h-4 text-info" />
                                  <span className="text-neutral-text">Download as CSV</span>
                          </button>
                              </div>
                            )}
                          </div>
                        )}
                        {report.status === 'generating' && (
                          <div className="flex items-center space-x-2 text-info">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-info"></div>
                            <span className="text-sm font-medium">Generating...</span>
                          </div>
                        )}
                        {report.status === 'error' && (
                          <span className="text-sm font-medium text-secondary">Error</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Report Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Total Reports"
            value={reports.length}
            icon={FileText}
            iconColor="bg-primary"
            description="All generated reports"
          />
          <StatCard
            title="Ready Reports"
            value={reports.filter((r) => r.status === 'ready').length}
            icon={TrendingUp}
            iconColor="bg-success"
            description="Available for download"
          />
          <StatCard
            title="This Month"
            value={reports.filter((r) => {
              const reportDate = new Date(r.generatedAt)
              const now = new Date()
              return reportDate.getMonth() === now.getMonth() && reportDate.getFullYear() === now.getFullYear()
            }).length}
            icon={BarChart3}
            iconColor="bg-info"
            description="Reports generated this month"
          />
        </div>
      </div>
    </Layout>
  )
}


