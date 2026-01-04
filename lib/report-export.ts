import * as XLSX from 'xlsx'

export interface ReportData {
  id: string
  title: string
  type: 'player' | 'match' | 'training' | 'financial' | 'summary'
  dateRange: string
  generatedAt: string
  data?: any
}

/**
 * Generate a PDF report with professional formatting (server-side)
 */
export async function generatePDFReport(report: ReportData): Promise<Blob> {
  const response = await fetch('/api/reports/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ report }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage = errorData?.message || errorData?.error || 'Failed to generate PDF'
    throw new Error(errorMessage)
  }

  return await response.blob()
}

/**
 * Generate an Excel report
 */
export function generateExcelReport(report: ReportData): Blob {
  const workbook = XLSX.utils.book_new()

  // Create a worksheet with report metadata
  const metadata = [
    ['Mongers Rugby Club - Official Report'],
    [],
    ['Report Title', report.title],
    ['Report Type', report.type.charAt(0).toUpperCase() + report.type.slice(1)],
    ['Date Range', report.dateRange],
    ['Generated At', new Date(report.generatedAt).toLocaleString()],
    [],
  ]

  // Add report data if available
  if (report.data) {
    // Format player reports
    if (report.type === 'player' && report.data.playerName) {
      metadata.push(['PLAYER PERFORMANCE REPORT'])
      metadata.push(['Player Name', report.data.playerName])
      metadata.push([])
      
      // Calculate comprehensive statistics
      const totalMatches = report.data.matchStats?.length || 0
      const totalTries = report.data.matchStats?.reduce((sum: number, stat: any) => sum + (stat.tries_scored || 0), 0) || 0
      const totalTackles = report.data.matchStats?.reduce((sum: number, stat: any) => sum + (stat.tackles_made || 0), 0) || 0
      const totalMinutes = report.data.matchStats?.reduce((sum: number, stat: any) => sum + (stat.minutes_played || 0), 0) || 0
      const avgTries = totalMatches > 0 ? String((totalTries / totalMatches).toFixed(2)) : '0.00'
      const avgTackles = totalMatches > 0 ? String((totalTackles / totalMatches).toFixed(2)) : '0.00'
      const avgMinutes = totalMatches > 0 ? String((totalMinutes / totalMatches).toFixed(1)) : '0.0'
      
      // Find best performance
      const bestMatch = report.data.matchStats?.reduce((best: any, stat: any) => {
        const bestScore = (best?.tries_scored || 0) + (best?.tackles_made || 0)
        const currentScore = (stat.tries_scored || 0) + (stat.tackles_made || 0)
        return currentScore > bestScore ? stat : best
      }, null)
      
      // Key Performance Indicators
      metadata.push(['KEY PERFORMANCE INDICATORS'])
      metadata.push(['Metric', 'Value'])
      metadata.push(['Total Matches', String(totalMatches)])
      metadata.push(['Total Tries', String(totalTries)])
      metadata.push(['Total Tackles', String(totalTackles)])
      metadata.push(['Total Minutes', String(totalMinutes)])
      metadata.push(['Average Tries per Match', avgTries])
      metadata.push(['Average Tackles per Match', avgTackles])
      metadata.push(['Average Minutes per Match', avgMinutes])
      metadata.push([])
      
      // Best Performance
      if (bestMatch && totalMatches > 0) {
        const bestOpponent = bestMatch.matches?.opponent || 'Unknown'
        const bestDate = bestMatch.matches?.match_date 
          ? new Date(bestMatch.matches.match_date).toLocaleDateString()
          : 'N/A'
        metadata.push(['Best Performance'])
        metadata.push(['Date', bestDate])
        metadata.push(['Opponent', bestOpponent])
        metadata.push(['Tries', String(bestMatch.tries_scored || 0)])
        metadata.push(['Tackles', String(bestMatch.tackles_made || 0)])
        metadata.push(['Minutes', String(bestMatch.minutes_played || 0)])
        metadata.push([])
      }
      
      // Gym Statistics
      if (report.data.gymStats && (report.data.gymStats.benchPressPB || report.data.gymStats.squatPB || report.data.gymStats.deadliftPB)) {
        metadata.push(['Gym Statistics'])
        metadata.push(['Exercise', 'Personal Best (kg)'])
        if (report.data.gymStats.benchPressPB) {
          metadata.push(['Bench Press', report.data.gymStats.benchPressPB])
        }
        if (report.data.gymStats.squatPB) {
          metadata.push(['Squat', report.data.gymStats.squatPB])
        }
        if (report.data.gymStats.deadliftPB) {
          metadata.push(['Deadlift', report.data.gymStats.deadliftPB])
        }
        metadata.push([])
      }
      
      // Match Statistics
      if (report.data.matchStats && report.data.matchStats.length > 0) {
        metadata.push(['MATCH-BY-MATCH PERFORMANCE'])
        metadata.push([`Showing ${totalMatches} match${totalMatches !== 1 ? 'es' : ''} | Sorted by date (most recent first)`])
        metadata.push([])
        metadata.push(['Date', 'Opponent', 'Tries', 'Tackles', 'Minutes'])
        
        // Sort matches by date (most recent first)
        const sortedMatchStats = [...(report.data.matchStats || [])].sort((a: any, b: any) => {
          const dateA = a.matches?.match_date ? new Date(a.matches.match_date).getTime() : 0
          const dateB = b.matches?.match_date ? new Date(b.matches.match_date).getTime() : 0
          return dateB - dateA
        })
        
        sortedMatchStats.forEach((stat: any) => {
          const matchDate = stat.matches?.match_date 
            ? new Date(stat.matches.match_date).toLocaleDateString()
            : 'N/A'
          metadata.push([
            matchDate,
            stat.matches?.opponent || 'N/A',
            stat.tries_scored || 0,
            stat.tackles_made || 0,
            stat.minutes_played || 0
          ])
        })
        metadata.push([])
      }
      
      // Training Attendance
      if (report.data.trainingAttendance && report.data.trainingAttendance.length > 0) {
        const totalSessions = report.data.trainingAttendance.length
        const presentCount = report.data.trainingAttendance.filter((att: any) => 
          att.attendance_status === 'P' || att.training_sessions?.attendance_status === 'P'
        ).length
        const absentCount = report.data.trainingAttendance.filter((att: any) => 
          att.attendance_status === 'X' || att.training_sessions?.attendance_status === 'X'
        ).length
        const justifiedCount = report.data.trainingAttendance.filter((att: any) => 
          att.attendance_status === 'A' || att.training_sessions?.attendance_status === 'A'
        ).length
        const injuredCount = report.data.trainingAttendance.filter((att: any) => 
          att.attendance_status === 'I' || att.training_sessions?.attendance_status === 'I'
        ).length
        const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0
        
        metadata.push(['TRAINING ATTENDANCE SUMMARY'])
        metadata.push(['Metric', 'Value'])
        metadata.push(['Total Sessions', totalSessions])
        metadata.push(['Present', presentCount])
        metadata.push(['Absent (Unjustified)', absentCount])
        metadata.push(['Justified Absence', justifiedCount])
        metadata.push(['Injured', injuredCount])
        metadata.push(['Overall Attendance Rate', `${attendanceRate}%`])
        metadata.push([])
        
        if (totalSessions > 0 && totalSessions <= 30) {
          metadata.push(['Session Date', 'Location', 'Status'])
          report.data.trainingAttendance.slice(0, 30).forEach((att: any) => {
            const sessionDate = att.training_sessions?.session_date
              ? new Date(att.training_sessions.session_date).toLocaleDateString()
              : 'N/A'
            const location = att.training_sessions?.location || 'N/A'
            const status = att.attendance_status === 'P' ? 'Present' :
                          att.attendance_status === 'A' ? 'Justified Absence' :
                          att.attendance_status === 'X' ? 'Unjustified Absence' :
                          att.attendance_status === 'I' ? 'Injured' : 'Unknown'
            metadata.push([sessionDate, location, status])
          })
        }
      }
    }
    // Format match reports
    else if (report.type === 'match' && report.data.matchDetails) {
      const match = report.data.matchDetails
      metadata.push(['MATCH STATISTICS REPORT'])
      metadata.push(['Match', match.opponent || 'Unknown'])
      metadata.push(['Date', new Date(match.match_date).toLocaleDateString()])
      if (match.venue) {
        metadata.push(['Venue', match.venue])
      }
      if (match.score_our_team !== null && match.score_opponent !== null) {
        metadata.push(['Final Score', `${match.score_our_team} - ${match.score_opponent}`])
      }
      metadata.push([])
      
      // Match Summary
      if (report.data.playerStats && report.data.playerStats.length > 0) {
        const totalPlayers = report.data.playerStats.length
        const totalTries = report.data.playerStats.reduce((sum: number, stat: any) => sum + (stat.tries_scored || 0), 0)
        const totalTackles = report.data.playerStats.reduce((sum: number, stat: any) => sum + (stat.tackles_made || 0), 0)
        const totalMinutes = report.data.playerStats.reduce((sum: number, stat: any) => sum + (stat.minutes_played || 0), 0)
        const avgTriesPerPlayer = totalPlayers > 0 ? (totalTries / totalPlayers).toFixed(2) : '0.00'
        const avgTacklesPerPlayer = totalPlayers > 0 ? (totalTackles / totalPlayers).toFixed(2) : '0.00'
        const avgMinutesPerPlayer = totalPlayers > 0 ? (totalMinutes / totalPlayers).toFixed(1) : '0.0'
        const topScorer = report.data.playerStats.reduce((top: any, stat: any) => 
          (stat.tries_scored || 0) > (top.tries_scored || 0) ? stat : top, report.data.playerStats[0])
        const topTackler = report.data.playerStats.reduce((top: any, stat: any) => 
          (stat.tackles_made || 0) > (top.tackles_made || 0) ? stat : top, report.data.playerStats[0])
        
        metadata.push(['MATCH SUMMARY STATISTICS'])
        metadata.push(['Metric', 'Value'])
        metadata.push(['Players Participated', totalPlayers])
        metadata.push(['Total Tries Scored', totalTries])
        metadata.push(['Total Tackles Made', totalTackles])
        metadata.push(['Total Minutes Played', totalMinutes])
        metadata.push(['Average Tries per Player', avgTriesPerPlayer])
        metadata.push(['Average Tackles per Player', avgTacklesPerPlayer])
        metadata.push(['Average Minutes per Player', avgMinutesPerPlayer])
        metadata.push([])
        
        // Top Performers
        metadata.push(['Top Performers'])
        if (topScorer && topScorer.tries_scored > 0) {
          const scorerName = topScorer.user_profiles?.name || 'Unknown'
          metadata.push(['Top Scorer', `${scorerName} (${topScorer.tries_scored} tries)`])
        }
        if (topTackler && topTackler.tackles_made > 0) {
          const tacklerName = topTackler.user_profiles?.name || 'Unknown'
          metadata.push(['Top Tackler', `${tacklerName} (${topTackler.tackles_made} tackles)`])
        }
        metadata.push([])
        
        // Player Statistics Table
        metadata.push(['INDIVIDUAL PLAYER STATISTICS'])
        metadata.push([`Showing ${totalPlayers} player${totalPlayers !== 1 ? 's' : ''} | Sorted by tries scored (highest first)`])
        metadata.push([])
        metadata.push(['Player Name', 'Tries', 'Tackles', 'Minutes'])
        const sortedStats = [...report.data.playerStats].sort((a: any, b: any) => 
          (b.tries_scored || 0) - (a.tries_scored || 0)
        )
        sortedStats.forEach((stat: any) => {
          const playerName = stat.user_profiles?.name || 'Unknown'
          metadata.push([
            playerName,
            stat.tries_scored || 0,
            stat.tackles_made || 0,
            stat.minutes_played || 0
          ])
        })
      }
    }
    // Format training attendance data specially
    else if (report.type === 'training' && report.data.formattedSessions) {
      metadata.push(['Training Sessions Summary'])
      if (report.data.summary) {
        metadata.push(['Total Sessions', report.data.summary.totalSessions])
        metadata.push(['Total Players', report.data.summary.totalPlayers])
        metadata.push(['Overall Attendance Rate', `${report.data.summary.overallAttendanceRate}%`])
      }
      metadata.push([])
      
      // Add each session
      report.data.formattedSessions.forEach((session: any, index: number) => {
        metadata.push([`Session ${index + 1}: ${session.date}`])
        if (session.time && session.time !== 'N/A') {
          metadata.push(['Time', session.time])
        }
        if (session.location) {
          metadata.push(['Location', session.location])
        }
        if (session.description) {
          metadata.push(['Description', session.description])
        }
        metadata.push([])
        metadata.push(['Player Name', 'Attendance Status'])
        
        if (session.attendance && session.attendance.length > 0) {
          session.attendance.forEach((att: any) => {
            metadata.push([att.player || 'Unknown', att.status || 'N/A'])
          })
        } else {
          metadata.push(['No attendance recorded', ''])
        }
        
        metadata.push([])
        if (session.summary) {
          metadata.push(['Summary', `Present: ${session.summary.present}, Absent: ${session.summary.absent}, Justified: ${session.summary.justified}, Injured: ${session.summary.injured}`])
        }
        metadata.push([])
        metadata.push([]) // Extra spacing between sessions
      })
    } else if (Array.isArray(report.data)) {
      // If data is an array, add headers and rows
      metadata.push(['Report Data'])
      if (report.data.length > 0) {
        const headers = Object.keys(report.data[0])
        metadata.push(headers)
        report.data.forEach((row: any) => {
          metadata.push(headers.map((header) => row[header] || ''))
        })
      }
    } else {
      // If data is an object, add key-value pairs
      metadata.push(['Report Data'])
      Object.entries(report.data).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          metadata.push([key, JSON.stringify(value)])
        } else {
          metadata.push([key, String(value)])
        }
      })
    }
  }

  const worksheet = XLSX.utils.aoa_to_sheet(metadata)

  // Set column widths
  worksheet['!cols'] = [{ wch: 30 }, { wch: 50 }]

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report')

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/**
 * Generate a CSV report
 */
export function generateCSVReport(report: ReportData): Blob {
  const lines: string[] = []
  
  lines.push('Mongers Rugby Club - Official Report')
  lines.push('')
  lines.push(`Report Title,${report.title}`)
  lines.push(`Report Type,${report.type.charAt(0).toUpperCase() + report.type.slice(1)}`)
  lines.push(`Date Range,${report.dateRange}`)
  lines.push(`Generated At,${new Date(report.generatedAt).toLocaleString()}`)
  lines.push('')

  if (report.data) {
    // Format player reports
    if (report.type === 'player' && report.data.playerName) {
      lines.push('PLAYER PERFORMANCE REPORT')
      lines.push('')
      lines.push(`Player Name,${report.data.playerName}`)
      lines.push('')
      
      // Calculate comprehensive statistics
      const totalMatches = report.data.matchStats?.length || 0
      const totalTries = report.data.matchStats?.reduce((sum: number, stat: any) => sum + (stat.tries_scored || 0), 0) || 0
      const totalTackles = report.data.matchStats?.reduce((sum: number, stat: any) => sum + (stat.tackles_made || 0), 0) || 0
      const totalMinutes = report.data.matchStats?.reduce((sum: number, stat: any) => sum + (stat.minutes_played || 0), 0) || 0
      const avgTries = totalMatches > 0 ? (totalTries / totalMatches).toFixed(2) : '0.00'
      const avgTackles = totalMatches > 0 ? (totalTackles / totalMatches).toFixed(2) : '0.00'
      const avgMinutes = totalMatches > 0 ? (totalMinutes / totalMatches).toFixed(1) : '0.0'
      
      // Find best performance
      const bestMatch = report.data.matchStats?.reduce((best: any, stat: any) => {
        const bestScore = (best?.tries_scored || 0) + (best?.tackles_made || 0)
        const currentScore = (stat.tries_scored || 0) + (stat.tackles_made || 0)
        return currentScore > bestScore ? stat : best
      }, null)
      
      // Key Performance Indicators
      lines.push('KEY PERFORMANCE INDICATORS')
      lines.push('Metric,Value')
      lines.push(`Total Matches,${totalMatches}`)
      lines.push(`Total Tries,${totalTries}`)
      lines.push(`Total Tackles,${totalTackles}`)
      lines.push(`Total Minutes,${totalMinutes}`)
      lines.push(`Average Tries per Match,${avgTries}`)
      lines.push(`Average Tackles per Match,${avgTackles}`)
      lines.push(`Average Minutes per Match,${avgMinutes}`)
      lines.push('')
      
      // Best Performance
      if (bestMatch && totalMatches > 0) {
        const bestOpponent = bestMatch.matches?.opponent || 'Unknown'
        const bestDate = bestMatch.matches?.match_date 
          ? new Date(bestMatch.matches.match_date).toLocaleDateString()
          : 'N/A'
        lines.push('Best Performance')
        lines.push(`Date,${bestDate}`)
        const opponent = bestOpponent.includes(',') ? `"${bestOpponent}"` : bestOpponent
        lines.push(`Opponent,${opponent}`)
        lines.push(`Tries,${bestMatch.tries_scored || 0}`)
        lines.push(`Tackles,${bestMatch.tackles_made || 0}`)
        lines.push(`Minutes,${bestMatch.minutes_played || 0}`)
        lines.push('')
      }
      
      // Gym Statistics
      if (report.data.gymStats && (report.data.gymStats.benchPressPB || report.data.gymStats.squatPB || report.data.gymStats.deadliftPB)) {
        lines.push('Gym Statistics')
        lines.push('Exercise,Personal Best (kg)')
        if (report.data.gymStats.benchPressPB) {
          lines.push(`Bench Press,${report.data.gymStats.benchPressPB}`)
        }
        if (report.data.gymStats.squatPB) {
          lines.push(`Squat,${report.data.gymStats.squatPB}`)
        }
        if (report.data.gymStats.deadliftPB) {
          lines.push(`Deadlift,${report.data.gymStats.deadliftPB}`)
        }
        lines.push('')
      }
      
      // Match Statistics
      if (report.data.matchStats && report.data.matchStats.length > 0) {
        lines.push('MATCH-BY-MATCH PERFORMANCE')
        lines.push(`Showing ${totalMatches} match${totalMatches !== 1 ? 'es' : ''} | Sorted by date (most recent first)`)
        lines.push('')
        lines.push('Date,Opponent,Tries,Tackles,Minutes')
        
        // Sort matches by date (most recent first)
        const sortedMatchStats = [...(report.data.matchStats || [])].sort((a: any, b: any) => {
          const dateA = a.matches?.match_date ? new Date(a.matches.match_date).getTime() : 0
          const dateB = b.matches?.match_date ? new Date(b.matches.match_date).getTime() : 0
          return dateB - dateA
        })
        
        sortedMatchStats.forEach((stat: any) => {
          const matchDate = stat.matches?.match_date 
            ? new Date(stat.matches.match_date).toLocaleDateString()
            : 'N/A'
          const opponent = (stat.matches?.opponent || 'N/A').includes(',') 
            ? `"${stat.matches?.opponent || 'N/A'}"` 
            : (stat.matches?.opponent || 'N/A')
          lines.push(`${matchDate},${opponent},${stat.tries_scored || 0},${stat.tackles_made || 0},${stat.minutes_played || 0}`)
        })
        lines.push('')
      }
      
      // Training Attendance
      if (report.data.trainingAttendance && report.data.trainingAttendance.length > 0) {
        const totalSessions = report.data.trainingAttendance.length
        const presentCount = report.data.trainingAttendance.filter((att: any) => 
          att.attendance_status === 'P' || att.training_sessions?.attendance_status === 'P'
        ).length
        const absentCount = report.data.trainingAttendance.filter((att: any) => 
          att.attendance_status === 'X' || att.training_sessions?.attendance_status === 'X'
        ).length
        const justifiedCount = report.data.trainingAttendance.filter((att: any) => 
          att.attendance_status === 'A' || att.training_sessions?.attendance_status === 'A'
        ).length
        const injuredCount = report.data.trainingAttendance.filter((att: any) => 
          att.attendance_status === 'I' || att.training_sessions?.attendance_status === 'I'
        ).length
        const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0
        
        lines.push('TRAINING ATTENDANCE SUMMARY')
        lines.push('Metric,Value')
        lines.push(`Total Sessions,${totalSessions}`)
        lines.push(`Present,${presentCount}`)
        lines.push(`Absent (Unjustified),${absentCount}`)
        lines.push(`Justified Absence,${justifiedCount}`)
        lines.push(`Injured,${injuredCount}`)
        lines.push(`Overall Attendance Rate,${attendanceRate}%`)
        lines.push('')
        
        if (totalSessions > 0 && totalSessions <= 30) {
          lines.push('Session Date,Location,Status')
          report.data.trainingAttendance.slice(0, 30).forEach((att: any) => {
            const sessionDate = att.training_sessions?.session_date
              ? new Date(att.training_sessions.session_date).toLocaleDateString()
              : 'N/A'
            const location = (att.training_sessions?.location || 'N/A').includes(',')
              ? `"${att.training_sessions?.location || 'N/A'}"`
              : (att.training_sessions?.location || 'N/A')
            const status = att.attendance_status === 'P' ? 'Present' :
                          att.attendance_status === 'A' ? 'Justified Absence' :
                          att.attendance_status === 'X' ? 'Unjustified Absence' :
                          att.attendance_status === 'I' ? 'Injured' : 'Unknown'
            lines.push(`${sessionDate},${location},${status}`)
          })
        }
      }
    }
    // Format match reports
    else if (report.type === 'match' && report.data.matchDetails) {
      const match = report.data.matchDetails
      lines.push('MATCH STATISTICS REPORT')
      lines.push('')
      lines.push(`Match,${match.opponent || 'Unknown'}`)
      lines.push(`Date,${new Date(match.match_date).toLocaleDateString()}`)
      if (match.venue) {
        const venue = match.venue.includes(',') ? `"${match.venue}"` : match.venue
        lines.push(`Venue,${venue}`)
      }
      if (match.score_our_team !== null && match.score_opponent !== null) {
        lines.push(`Final Score,${match.score_our_team} - ${match.score_opponent}`)
      }
      lines.push('')
      
      // Match Summary
      if (report.data.playerStats && report.data.playerStats.length > 0) {
        const totalPlayers = report.data.playerStats.length
        const totalTries = report.data.playerStats.reduce((sum: number, stat: any) => sum + (stat.tries_scored || 0), 0)
        const totalTackles = report.data.playerStats.reduce((sum: number, stat: any) => sum + (stat.tackles_made || 0), 0)
        const totalMinutes = report.data.playerStats.reduce((sum: number, stat: any) => sum + (stat.minutes_played || 0), 0)
        const avgTriesPerPlayer = totalPlayers > 0 ? (totalTries / totalPlayers).toFixed(2) : '0.00'
        const avgTacklesPerPlayer = totalPlayers > 0 ? (totalTackles / totalPlayers).toFixed(2) : '0.00'
        const avgMinutesPerPlayer = totalPlayers > 0 ? (totalMinutes / totalPlayers).toFixed(1) : '0.0'
        const topScorer = report.data.playerStats.reduce((top: any, stat: any) => 
          (stat.tries_scored || 0) > (top.tries_scored || 0) ? stat : top, report.data.playerStats[0])
        const topTackler = report.data.playerStats.reduce((top: any, stat: any) => 
          (stat.tackles_made || 0) > (top.tackles_made || 0) ? stat : top, report.data.playerStats[0])
        
        lines.push('MATCH SUMMARY STATISTICS')
        lines.push('Metric,Value')
        lines.push(`Players Participated,${totalPlayers}`)
        lines.push(`Total Tries Scored,${totalTries}`)
        lines.push(`Total Tackles Made,${totalTackles}`)
        lines.push(`Total Minutes Played,${totalMinutes}`)
        lines.push(`Average Tries per Player,${avgTriesPerPlayer}`)
        lines.push(`Average Tackles per Player,${avgTacklesPerPlayer}`)
        lines.push(`Average Minutes per Player,${avgMinutesPerPlayer}`)
        lines.push('')
        
        // Top Performers
        lines.push('Top Performers')
        if (topScorer && topScorer.tries_scored > 0) {
          const scorerName = (topScorer.user_profiles?.name || 'Unknown').includes(',')
            ? `"${topScorer.user_profiles?.name || 'Unknown'}"`
            : (topScorer.user_profiles?.name || 'Unknown')
          lines.push(`Top Scorer,${scorerName} (${topScorer.tries_scored} tries)`)
        }
        if (topTackler && topTackler.tackles_made > 0) {
          const tacklerName = (topTackler.user_profiles?.name || 'Unknown').includes(',')
            ? `"${topTackler.user_profiles?.name || 'Unknown'}"`
            : (topTackler.user_profiles?.name || 'Unknown')
          lines.push(`Top Tackler,${tacklerName} (${topTackler.tackles_made} tackles)`)
        }
        lines.push('')
        
        // Player Statistics Table
        lines.push('INDIVIDUAL PLAYER STATISTICS')
        lines.push(`Showing ${totalPlayers} player${totalPlayers !== 1 ? 's' : ''} | Sorted by tries scored (highest first)`)
        lines.push('')
        lines.push('Player Name,Tries,Tackles,Minutes')
        const sortedStats = [...report.data.playerStats].sort((a: any, b: any) => 
          (b.tries_scored || 0) - (a.tries_scored || 0)
        )
        sortedStats.forEach((stat: any) => {
          const playerName = (stat.user_profiles?.name || 'Unknown').includes(',')
            ? `"${stat.user_profiles?.name || 'Unknown'}"`
            : (stat.user_profiles?.name || 'Unknown')
          lines.push(`${playerName},${stat.tries_scored || 0},${stat.tackles_made || 0},${stat.minutes_played || 0}`)
        })
      }
    }
    // Format training attendance data specially
    else if (report.type === 'training' && report.data.formattedSessions) {
      lines.push('Training Sessions Summary')
      lines.push('')
      if (report.data.summary) {
        lines.push(`Total Sessions,${report.data.summary.totalSessions}`)
        lines.push(`Total Players,${report.data.summary.totalPlayers}`)
        lines.push(`Overall Attendance Rate,${report.data.summary.overallAttendanceRate}%`)
      }
      lines.push('')
      
      // Add each session
      report.data.formattedSessions.forEach((session: any, index: number) => {
        lines.push(`Session ${index + 1}: ${session.date}`)
        if (session.time && session.time !== 'N/A') {
          lines.push(`Time,${session.time}`)
        }
        if (session.location) {
          const location = session.location.includes(',') ? `"${session.location}"` : session.location
          lines.push(`Location,${location}`)
        }
        if (session.description) {
          const desc = session.description.includes(',') ? `"${session.description}"` : session.description
          lines.push(`Description,${desc}`)
        }
        lines.push('')
        lines.push('Player Name,Attendance Status')
        
        if (session.attendance && session.attendance.length > 0) {
          session.attendance.forEach((att: any) => {
            const player = (att.player || 'Unknown').includes(',') ? `"${att.player || 'Unknown'}"` : (att.player || 'Unknown')
            const status = (att.status || 'N/A').includes(',') ? `"${att.status || 'N/A'}"` : (att.status || 'N/A')
            lines.push(`${player},${status}`)
          })
        } else {
          lines.push('No attendance recorded,')
        }
        
        lines.push('')
        if (session.summary) {
          lines.push(`Summary,Present: ${session.summary.present}, Absent: ${session.summary.absent}, Justified: ${session.summary.justified}, Injured: ${session.summary.injured}`)
        }
        lines.push('')
        lines.push('') // Extra spacing between sessions
      })
    } else if (Array.isArray(report.data)) {
      if (report.data.length > 0) {
        const headers = Object.keys(report.data[0])
        lines.push(headers.join(','))
        report.data.forEach((row: any) => {
          lines.push(headers.map((header) => {
            const value = row[header] || ''
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`
            }
            return value
          }).join(','))
        })
      }
    } else {
      Object.entries(report.data).forEach(([key, value]) => {
        const val = typeof value === 'object' ? JSON.stringify(value) : String(value)
        const escapedVal = val.includes(',') ? `"${val.replace(/"/g, '""')}"` : val
        lines.push(`${key},${escapedVal}`)
      })
    }
  }

  return new Blob([lines.join('\n')], { type: 'text/csv' })
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

