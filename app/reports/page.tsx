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
      if (type === 'financial') {
        // Financial reports don't need specific filters, they use date range
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

      // Ensure players are loaded before processing player reports
      let playersToUse = players
      if (report.type === 'player' && players.length === 0) {
        try {
          const playersResponse = await fetch('/api/admin/players')
          if (playersResponse.ok) {
            const playersData = await playersResponse.json()
            if (playersData.players && Array.isArray(playersData.players)) {
              playersToUse = playersData.players.map((p: any) => ({
                id: p.user_id || p.id,
                name: p.name || 'Unknown',
              }))
              setPlayers(playersToUse) // Update state for future use
            }
          }
        } catch (err) {
          console.error('Error loading players for download:', err)
        }
      }

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
        // Extract player name from title (format: "Player Report - PlayerName - Date" or "Player Report - PlayerName (Date)")
        // Try multiple patterns to handle different title formats
        let playerName: string | null = null
        
        // Pattern 1: "Player Report - PlayerName - Date"
        const pattern1 = report.title.match(/Player Report - (.+?) - \d{1,2}\/\d{1,2}\/\d{4}/)
        if (pattern1 && pattern1[1]) {
          playerName = pattern1[1].trim()
        }
        
        // Pattern 2: "Player Report - PlayerName (Date)"
        if (!playerName) {
          const pattern2 = report.title.match(/Player Report - (.+?)\s*\(/)
          if (pattern2 && pattern2[1]) {
            playerName = pattern2[1].trim()
          }
        }
        
        // Pattern 3: "Player Report - PlayerName" (no date)
        if (!playerName) {
          const pattern3 = report.title.match(/Player Report - (.+?)$/)
          if (pattern3 && pattern3[1]) {
            playerName = pattern3[1].trim()
          }
        }
        
        console.log('Extracted player name from title:', { title: report.title, playerName })
        
        let selectedPlayer: { id: string; name: string } | null = null
        
        if (playerName) {
          // Try case-insensitive match in local array first
          selectedPlayer = playersToUse.find(p => 
            p.name.toLowerCase().trim() === playerName.toLowerCase().trim()
          ) || null
          
          // If not found, try partial match
          if (!selectedPlayer) {
            selectedPlayer = playersToUse.find(p => 
              p.name.toLowerCase().trim().includes(playerName.toLowerCase().trim()) ||
              playerName.toLowerCase().trim().includes(p.name.toLowerCase().trim())
            ) || null
          }
        }
        
        // If player not found in local array, try database search
        if (!selectedPlayer && playerName) {
          try {
            // Try exact match (case-insensitive)
            let { data: playerProfiles } = await supabase
              .from('user_profiles')
              .select('user_id, name')
              .ilike('name', playerName.trim())
              .limit(1)
            
            // If no exact match, try partial match
            if (!playerProfiles || playerProfiles.length === 0) {
              const { data: partialMatch } = await supabase
                .from('user_profiles')
                .select('user_id, name')
                .ilike('name', `%${playerName.trim()}%`)
                .limit(1)
              playerProfiles = partialMatch
            }
            
            if (playerProfiles && playerProfiles.length > 0) {
              selectedPlayer = {
                id: playerProfiles[0].user_id,
                name: playerProfiles[0].name
              }
              console.log('Found player via database search:', selectedPlayer)
            } else {
              console.warn('Player not found in database:', playerName)
            }
          } catch (err) {
            console.error('Error searching for player:', err)
          }
        }
        
        if (selectedPlayer) {
          // Fetch player-specific data
          try {
            console.log('Fetching data for player:', selectedPlayer.name, 'ID:', selectedPlayer.id)
            
            // First, try direct query to players table (most reliable)
            let gymStats: {
              benchPressPB: number | null;
              squatPB: number | null;
              deadliftPB: number | null;
              pullUpPB: number | null;
            } = {
              benchPressPB: null,
              squatPB: null,
              deadliftPB: null,
              pullUpPB: null,
            }
            try {
              const { data: playerData, error: playerError } = await supabase
                .from('players')
                .select('gym_stats')
                .eq('user_id', selectedPlayer.id)
                .maybeSingle()
              
              if (!playerError && playerData) {
                console.log('Raw player data from database:', playerData)
                const rawStats = playerData.gym_stats as any
                if (rawStats && typeof rawStats === 'object') {
                  gymStats = {
                    benchPressPB: rawStats.bench_press_pb ?? rawStats.benchPressPB ?? rawStats['bench-press-pb'] ?? null,
                    squatPB: rawStats.squat_pb ?? rawStats.squatPB ?? rawStats['squat-pb'] ?? null,
                    deadliftPB: rawStats.deadlift_pb ?? rawStats.deadliftPB ?? rawStats['deadlift-pb'] ?? null,
                    pullUpPB: rawStats.pull_up_pb ?? rawStats.pullUpPB ?? rawStats.pull_up_PB ?? rawStats.pullUp_PB ?? rawStats['pull-up-pb'] ?? null,
                  }
                  // Convert to numbers if they're strings
                  if (gymStats.benchPressPB !== null) gymStats.benchPressPB = Number(gymStats.benchPressPB)
                  if (gymStats.squatPB !== null) gymStats.squatPB = Number(gymStats.squatPB)
                  if (gymStats.deadliftPB !== null) gymStats.deadliftPB = Number(gymStats.deadliftPB)
                  if (gymStats.pullUpPB !== null) gymStats.pullUpPB = Number(gymStats.pullUpPB)
                  console.log('Gym stats processed from direct query:', selectedPlayer.name, gymStats)
                } else {
                  console.warn('No gym_stats found in player record:', {
                    playerId: selectedPlayer.id,
                    hasGymStats: !!rawStats,
                    gymStatsType: typeof rawStats
                  })
                }
              } else {
                console.warn('Player not found in players table:', {
                  playerId: selectedPlayer.id,
                  error: playerError
                })
              }
            } catch (directQueryError) {
              console.error('Error in direct gym stats query:', directQueryError)
            }
            
            // Also try API route as backup/verification
            try {
              const playerResponse = await fetch(`/api/players/${selectedPlayer.id}/gym-stats`, {
                cache: 'no-store',
                headers: {
                  'Cache-Control': 'no-cache',
                }
              })
              
              if (playerResponse.ok) {
                const apiGymStats = await playerResponse.json() as {
                  benchPressPB: number | null;
                  squatPB: number | null;
                  deadliftPB: number | null;
                  pullUpPB: number | null;
                }
                console.log('Gym stats from API (for verification):', selectedPlayer.name, apiGymStats)
                // Use API stats if direct query didn't return data
                if (!gymStats.benchPressPB && !gymStats.squatPB && 
                    !gymStats.deadliftPB && !gymStats.pullUpPB) {
                  gymStats = apiGymStats
                  console.log('Using API gym stats as fallback')
                }
              }
            } catch (apiError) {
              console.error('Error fetching gym stats via API:', apiError)
            }
            
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
            
            const gymStatsForLog = (gymStats || {}) as any
            console.log('Player report data loaded:', {
              playerName: selectedPlayer.name,
              playerId: selectedPlayer.id,
              matchStatsCount: matchStats?.length || 0,
              attendanceCount: attendance?.length || 0,
              gymStats: gymStats,
              hasGymStats: !!gymStats && Object.keys(gymStats).length > 0,
              gymStatsKeys: Object.keys(gymStats || {}),
              benchPressPB: gymStatsForLog.benchPressPB,
              squatPB: gymStatsForLog.squatPB,
              deadliftPB: gymStatsForLog.deadliftPB
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
          console.warn('Player not found for report:', {
            title: report.title,
            extractedName: playerName,
            availablePlayers: playersToUse.map(p => p.name),
            playersCount: playersToUse.length
          })
          // Set empty data structure so report still generates
          reportData.data = {
            ...reportData.data,
            playerName: playerName || 'Unknown Player',
            gymStats: {},
            matchStats: [],
            trainingAttendance: [],
            summary: `Player data could not be loaded for ${playerName || 'unknown player'}.`,
          }
        }
      } else if (report.type === 'match') {
        // Extract match info - try multiple approaches
        let selectedMatch: any = null
        
        // Approach 1: Try to get match ID from reportFilters if still available (during same session)
        if (reportFilters.selectedMatch) {
          selectedMatch = matches.find(m => m.id === reportFilters.selectedMatch)
        }
        
        // Approach 2: Extract from title "Match Report - Opponent (Date)"
        if (!selectedMatch) {
          const matchMatch = report.title.match(/Match Report - (.+?)\s*\(/)
          if (matchMatch && matchMatch[1]) {
            const matchOpponent = matchMatch[1].trim()
            selectedMatch = matches.find(m => m.opponent === matchOpponent)
          }
        }
        
        // Approach 3: Try to find by date in title
        if (!selectedMatch) {
          const dateMatch = report.title.match(/\((\d{1,2}\/\d{1,2}\/\d{4})\)/)
          if (dateMatch) {
            const titleDate = dateMatch[1]
            // Try to find match by date and opponent if available
            const opponentMatch = report.title.match(/Match Report - (.+?)\s*\(/)
            if (opponentMatch) {
              const matchOpponent = opponentMatch[1].trim()
              selectedMatch = matches.find(m => {
                const matchDate = new Date(m.match_date).toLocaleDateString()
                return matchDate === titleDate && m.opponent === matchOpponent
              })
            }
            
            // If still not found, just match by date
            if (!selectedMatch) {
              selectedMatch = matches.find(m => {
                const matchDate = new Date(m.match_date).toLocaleDateString()
                return matchDate === titleDate
              })
            }
          }
        }
        
        // Approach 4: If still not found, try all matches and find the most recent one with stats
        if (!selectedMatch && matches.length > 0) {
          // Try to find a match that has stats
          for (const match of matches) {
            try {
              const { count } = await supabase
                .from('match_stats')
                .select('*', { count: 'exact', head: true })
                .eq('match_id', match.id)
              
              if (count && count > 0) {
                selectedMatch = match
                break
              }
            } catch (err) {
              // Continue to next match
            }
          }
          
          // If still no match found, use the first one
          if (!selectedMatch) {
            selectedMatch = matches[0]
          }
        }
        
        if (selectedMatch) {
          // Fetch match-specific data using service role to bypass RLS
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
              
              const { data: matchDetails } = await supabaseAdmin
                .from('matches')
                .select('*')
                .eq('id', selectedMatch.id)
                .single()
              
              // Fetch match stats first (without joins to avoid issues)
              const { data: matchStats, error: statsError } = await supabaseAdmin
                .from('match_stats')
                .select('*')
                .eq('match_id', selectedMatch.id)
              
              if (statsError) {
                console.error('Error fetching match stats:', statsError)
              }
              
              // Always fetch player names directly from user_profiles
              // player_id in match_stats is actually the user_id
              let processedStats: any[] = []
              
              if (matchStats && matchStats.length > 0) {
                // Get all unique player IDs (which are user_ids)
                const playerIds = [...new Set(matchStats.map((stat: any) => stat.player_id))]
                
                // Fetch all player names in one query
                const { data: playerProfiles, error: profilesError } = await supabaseAdmin
                  .from('user_profiles')
                  .select('user_id, name')
                  .in('user_id', playerIds)
                
                if (profilesError) {
                  console.error('Error fetching player profiles:', profilesError)
                }
                
                // Create a map for quick lookup
                const playerNameMap = new Map<string, string>()
                if (playerProfiles) {
                  playerProfiles.forEach((profile: any) => {
                    playerNameMap.set(profile.user_id, profile.name || 'Unknown')
                  })
                }
                
                // Process match stats and attach player names
                processedStats = matchStats.map((stat: any) => {
                  const playerName = playerNameMap.get(stat.player_id) || 'Unknown'
                  
                  return {
                    ...stat,
                    user_profiles: {
                      name: playerName
                    }
                  }
                })
                
                // Final verification: ensure all stats have player names
                const statsWithoutNames = processedStats.filter((s: any) => 
                  !s.user_profiles?.name || s.user_profiles.name === 'Unknown'
                )
                
                if (statsWithoutNames.length > 0) {
                  console.warn('Some stats still missing player names, attempting final fetch:', statsWithoutNames.length)
                  // Try one more time to fetch missing names
                  const missingPlayerIds = statsWithoutNames.map((s: any) => s.player_id)
                  const { data: missingProfiles, error: missingError } = await supabaseAdmin
                    .from('user_profiles')
                    .select('user_id, name')
                    .in('user_id', missingPlayerIds)
                  
                  if (missingError) {
                    console.error('Error fetching missing player profiles:', missingError)
                  }
                  
                  if (missingProfiles) {
                    const missingNameMap = new Map<string, string>()
                    missingProfiles.forEach((p: any) => {
                      missingNameMap.set(p.user_id, p.name || 'Unknown')
                    })
                    
                    processedStats.forEach((stat: any) => {
                      if (!stat.user_profiles?.name || stat.user_profiles.name === 'Unknown') {
                        const name = missingNameMap.get(stat.player_id)
                        if (name && name !== 'Unknown') {
                          stat.user_profiles = { name }
                        }
                      }
                    })
                  }
                }
                
                // Log for debugging
                console.log('Match stats processed:', {
                  totalStats: processedStats.length,
                  statsWithNames: processedStats.filter(s => s.user_profiles?.name && s.user_profiles.name !== 'Unknown').length,
                  statsWithoutNames: processedStats.filter(s => !s.user_profiles?.name || s.user_profiles.name === 'Unknown').length,
                  playerIdsFetched: playerIds.length,
                  playerProfilesFound: playerProfiles?.length || 0,
                  sampleNames: processedStats.slice(0, 5).map(s => ({ id: s.player_id, name: s.user_profiles?.name }))
                })
              }
              
              reportData.data = {
                ...reportData.data,
                matchId: selectedMatch.id,
                matchDetails: matchDetails || {},
                playerStats: processedStats || [],
                summary: `Match statistics report for ${matchDetails?.opponent || selectedMatch.opponent} on ${new Date(selectedMatch.match_date).toLocaleDateString()}.`,
              }
            } else {
              // Fallback to regular client if service role not available
              const { data: matchDetails } = await supabase
                .from('matches')
                .select('*')
                .eq('id', selectedMatch.id)
                .single()
              
              const { data: matchStats, error: statsError } = await supabase
                .from('match_stats')
                .select('*')
                .eq('match_id', selectedMatch.id)
              
              if (statsError) {
                console.error('Error fetching match stats (fallback):', statsError)
              }
              
              // Always fetch player names directly from user_profiles
              let processedStats: any[] = []
              
              if (matchStats && matchStats.length > 0) {
                // Get all unique player IDs (which are user_ids)
                const playerIds = [...new Set(matchStats.map((stat: any) => stat.player_id))]
                
                // Fetch all player names in one query
                const { data: playerProfiles, error: profilesError } = await supabase
                  .from('user_profiles')
                  .select('user_id, name')
                  .in('user_id', playerIds)
                
                if (profilesError) {
                  console.error('Error fetching player profiles (fallback):', profilesError)
                }
                
                // Create a map for quick lookup
                const playerNameMap = new Map<string, string>()
                if (playerProfiles) {
                  playerProfiles.forEach((profile: any) => {
                    playerNameMap.set(profile.user_id, profile.name || 'Unknown')
                  })
                }
                
                // Process match stats and attach player names
                processedStats = matchStats.map((stat: any) => {
                  const playerName = playerNameMap.get(stat.player_id) || 'Unknown'
                  
                  return {
                    ...stat,
                    user_profiles: {
                      name: playerName
                    }
                  }
                })
                
                console.log('Match stats processed (fallback):', {
                  totalStats: processedStats.length,
                  statsWithNames: processedStats.filter(s => s.user_profiles.name !== 'Unknown').length,
                  statsWithoutNames: processedStats.filter(s => s.user_profiles.name === 'Unknown').length
                })
              }
              
              reportData.data = {
                ...reportData.data,
                matchId: selectedMatch.id,
                matchDetails: matchDetails || {},
                playerStats: processedStats || [],
                summary: `Match statistics report for ${matchDetails?.opponent || selectedMatch.opponent} on ${new Date(selectedMatch.match_date).toLocaleDateString()}.`,
              }
            }
          } catch (err) {
            console.error('Error fetching match data:', err)
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
      } else if (report.type === 'financial') {
        // Fetch financial transactions for financial report
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
          
          let financialData: any[] = []
          
          if (supabaseUrl && supabaseServiceKey) {
            const { createClient: createServiceClient } = await import('@supabase/supabase-js')
            const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
              auth: {
                autoRefreshToken: false,
                persistSession: false
              }
            })
            
            // Build query with date filters if provided
            let query = supabaseAdmin
              .from('financial_transactions')
              .select(`
                *,
                created_by_profile:user_profiles!financial_transactions_created_by_fkey (
                  user_id,
                  name
                )
              `)
              .order('transaction_date', { ascending: false })
            
            if (reportDetails?.date_from) {
              query = query.gte('transaction_date', reportDetails.date_from)
            }
            if (reportDetails?.date_to) {
              query = query.lte('transaction_date', reportDetails.date_to)
            }
            
            const { data: transactions } = await query
            
            financialData = transactions || []
          } else {
            // Fallback to regular client
            let query = supabase
              .from('financial_transactions')
              .select('*')
              .order('transaction_date', { ascending: false })
            
            if (reportDetails?.date_from) {
              query = query.gte('transaction_date', reportDetails.date_from)
            }
            if (reportDetails?.date_to) {
              query = query.lte('transaction_date', reportDetails.date_to)
            }
            
            const { data: transactions } = await query
            financialData = transactions || []
          }
          
          // Calculate financial summary
          const totalRevenue = financialData
            .filter((t: any) => t.type === 'revenue')
            .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0)
          
          const totalExpenses = financialData
            .filter((t: any) => t.type === 'expense')
            .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0)
          
          const netBalance = totalRevenue - totalExpenses
          
          // Group by category
          const expensesByCategory: Record<string, number> = {}
          const revenueByCategory: Record<string, number> = {}
          
          financialData.forEach((t: any) => {
            const amount = parseFloat(t.amount || 0)
            if (t.type === 'expense') {
              expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + amount
            } else if (t.type === 'revenue') {
              revenueByCategory[t.category] = (revenueByCategory[t.category] || 0) + amount
            }
          })
          
          reportData.data = {
            ...reportData.data,
            transactions: financialData,
            summary: {
              totalRevenue,
              totalExpenses,
              netBalance,
              transactionCount: financialData.length,
              revenueCount: financialData.filter((t: any) => t.type === 'revenue').length,
              expenseCount: financialData.filter((t: any) => t.type === 'expense').length,
            },
            expensesByCategory,
            revenueByCategory,
          }
        } catch (err) {
          console.error('Error fetching financial data:', err)
          reportData.data = {
            ...reportData.data,
            transactions: [],
            summary: {
              totalRevenue: 0,
              totalExpenses: 0,
              netBalance: 0,
              transactionCount: 0,
              revenueCount: 0,
              expenseCount: 0,
            },
            expensesByCategory: {},
            revenueByCategory: {},
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

          <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-success rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-neutral-text">Financial Report</h3>
                <p className="text-sm text-neutral-medium">Transactions & budgets</p>
              </div>
            </div>
            <button
              onClick={() => handleGenerateReport('financial')}
              className="w-full px-4 py-2 bg-success text-white rounded-button font-medium hover:bg-success-dark transition-colors text-sm"
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


