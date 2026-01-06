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

  // Create a worksheet with professional report metadata
  const metadata = [
    ['MONGERS RUGBY CLUB'],
    ['Official Performance Report'],
    [],
    ['Report Information'],
    ['Report Title', report.title],
    ['Report Type', report.type.charAt(0).toUpperCase() + report.type.slice(1) + ' Report'],
    ['Date Range', report.dateRange || 'All Time'],
    ['Generated At', new Date(report.generatedAt).toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    })],
    ['Report ID', report.id || 'N/A'],
    [],
  ]

  // Add report data if available
  if (report.data) {
    // Format player reports
    if (report.type === 'player' && report.data.playerName) {
      metadata.push(['EXECUTIVE SUMMARY'])
      metadata.push([`This report provides a comprehensive analysis of ${report.data.playerName}'s performance, including match statistics, training attendance, and physical fitness metrics. The data presented reflects the player's contribution to the team and overall development.`])
      metadata.push([])
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
      
      // Data Completeness Indicator
      const hasMatchStats = (report.data.matchStats?.length || 0) > 0
      const hasGymStats = report.data.gymStats && (report.data.gymStats.benchPressPB || report.data.gymStats.squatPB || report.data.gymStats.deadliftPB)
      const hasTrainingData = (report.data.trainingAttendance?.length || 0) > 0
      metadata.push(['Data Completeness'])
      metadata.push(['Match Statistics', hasMatchStats ? 'Available' : 'Not Available'])
      metadata.push(['Gym Statistics', hasGymStats ? 'Available' : 'Not Available'])
      metadata.push(['Training Attendance', hasTrainingData ? 'Available' : 'Not Available'])
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
      
      // Gym Statistics - Always show, even if empty
      metadata.push(['GYM STATISTICS'])
      const gymStats = (report.data.gymStats || {}) as any
      const hasBenchPress = gymStats.benchPressPB !== null && gymStats.benchPressPB !== undefined && gymStats.benchPressPB > 0
      const hasSquat = gymStats.squatPB !== null && gymStats.squatPB !== undefined && gymStats.squatPB > 0
      const hasDeadlift = gymStats.deadliftPB !== null && gymStats.deadliftPB !== undefined && gymStats.deadliftPB > 0
      
      if (hasBenchPress || hasSquat || hasDeadlift) {
        metadata.push(['Exercise', 'Personal Best (kg)'])
        if (hasBenchPress) {
          metadata.push(['Bench Press', String(gymStats.benchPressPB)])
        }
        if (hasSquat) {
          metadata.push(['Squat', String(gymStats.squatPB)])
        }
        if (hasDeadlift) {
          metadata.push(['Deadlift', String(gymStats.deadliftPB)])
        }
      } else {
        metadata.push(['No gym statistics recorded'])
      }
      metadata.push([])
      
      // Match Statistics - Always show, even if empty
      metadata.push(['MATCH-BY-MATCH PERFORMANCE'])
      if (report.data.matchStats && report.data.matchStats.length > 0) {
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
      } else {
        metadata.push(['No match statistics recorded'])
      }
      metadata.push([])
      
      // Training Attendance - Always show, even if empty
      metadata.push(['TRAINING ATTENDANCE SUMMARY'])
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
      } else {
        metadata.push(['No training attendance recorded'])
        metadata.push(['Metric', 'Value'])
        metadata.push(['Total Sessions', '0'])
        metadata.push(['Present', '0'])
        metadata.push(['Overall Attendance Rate', '0%'])
      }
      metadata.push([])
    }
    // Format match reports
    else if (report.type === 'match' && report.data.matchDetails) {
      const match = report.data.matchDetails
      metadata.push(['EXECUTIVE SUMMARY'])
      metadata.push([`This report provides a detailed analysis of the match against ${match.opponent || 'Opponent'}, including team performance metrics, individual player contributions, and key statistics. The data presented offers insights into team dynamics and player effectiveness during this match.`])
      metadata.push([])
      metadata.push(['MATCH STATISTICS REPORT'])
      metadata.push(['MATCH DETAILS'])
      metadata.push(['Opponent', match.opponent || 'Unknown'])
      metadata.push(['Date', new Date(match.match_date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })])
      if (match.venue) {
        metadata.push(['Venue', match.venue])
      }
      if (match.score_our_team !== null && match.score_opponent !== null) {
        metadata.push(['Final Score', `${match.score_our_team} - ${match.score_opponent}`])
      }
      metadata.push([])
      
      // Calculate match statistics (always show, even if empty)
      const totalPlayers = report.data.playerStats?.length || 0
      const totalTries = report.data.playerStats?.reduce((sum: number, stat: any) => sum + (stat.tries_scored || 0), 0) || 0
      const totalTackles = report.data.playerStats?.reduce((sum: number, stat: any) => sum + (stat.tackles_made || 0), 0) || 0
      const totalMinutes = report.data.playerStats?.reduce((sum: number, stat: any) => sum + (stat.minutes_played || 0), 0) || 0
      const avgTriesPerPlayer = totalPlayers > 0 ? (totalTries / totalPlayers).toFixed(2) : '0.00'
      const avgTacklesPerPlayer = totalPlayers > 0 ? (totalTackles / totalPlayers).toFixed(2) : '0.00'
      const avgMinutesPerPlayer = totalPlayers > 0 ? (totalMinutes / totalPlayers).toFixed(1) : '0.0'
      
      // Match Summary Statistics - Always show
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
      if (report.data.playerStats && report.data.playerStats.length > 0) {
        const topScorer = report.data.playerStats.reduce((top: any, stat: any) => 
          (stat.tries_scored || 0) > (top.tries_scored || 0) ? stat : top, report.data.playerStats[0])
        const topTackler = report.data.playerStats.reduce((top: any, stat: any) => 
          (stat.tackles_made || 0) > (top.tackles_made || 0) ? stat : top, report.data.playerStats[0])
        
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
      }
      
      // Player Statistics Table - Always show, even if empty
      metadata.push(['INDIVIDUAL PLAYER STATISTICS'])
      if (report.data.playerStats && report.data.playerStats.length > 0) {
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
      } else {
        metadata.push(['No player statistics recorded for this match'])
        metadata.push(['Players Participated', '0'])
        metadata.push(['Total Tries', '0'])
        metadata.push(['Total Tackles', '0'])
        metadata.push(['Total Minutes', '0'])
      }
    }
    // Format financial reports
    else if (report.type === 'financial' && report.data.transactions) {
      metadata.push(['EXECUTIVE SUMMARY'])
      metadata.push([`This financial report provides a comprehensive overview of all financial transactions, including revenues and expenses, categorized breakdowns, and net balance calculations. The data presented offers insights into the club's financial health and spending patterns.`])
      metadata.push([])
      metadata.push(['FINANCIAL REPORT'])
      metadata.push([])
      
      // Financial Summary
      const summary = report.data.summary || {}
      metadata.push(['FINANCIAL SUMMARY'])
      metadata.push(['Metric', 'Value'])
      metadata.push(['Total Revenue', `UGX ${(summary.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`])
      metadata.push(['Total Expenses', `UGX ${(summary.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`])
      metadata.push(['Net Balance', `UGX ${(summary.netBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`])
      metadata.push(['Total Transactions', String(summary.transactionCount || 0)])
      metadata.push(['Revenue Transactions', String(summary.revenueCount || 0)])
      metadata.push(['Expense Transactions', String(summary.expenseCount || 0)])
      metadata.push([])
      
      // Expenses by Category
      if (report.data.expensesByCategory && Object.keys(report.data.expensesByCategory).length > 0) {
        metadata.push(['EXPENSES BY CATEGORY'])
        metadata.push(['Category', 'Total Amount (UGX)'])
        Object.entries(report.data.expensesByCategory)
          .sort(([, a]: any, [, b]: any) => b - a)
          .forEach(([category, amount]: [string, any]) => {
            metadata.push([category, amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })])
          })
        metadata.push([])
      }
      
      // Revenue by Category
      if (report.data.revenueByCategory && Object.keys(report.data.revenueByCategory).length > 0) {
        metadata.push(['REVENUE BY CATEGORY'])
        metadata.push(['Category', 'Total Amount (UGX)'])
        Object.entries(report.data.revenueByCategory)
          .sort(([, a]: any, [, b]: any) => b - a)
          .forEach(([category, amount]: [string, any]) => {
            metadata.push([category, amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })])
          })
        metadata.push([])
      }
      
      // Transaction Details
      metadata.push(['TRANSACTION DETAILS'])
      if (report.data.transactions && report.data.transactions.length > 0) {
        metadata.push([`Showing ${report.data.transactions.length} transaction${report.data.transactions.length !== 1 ? 's' : ''} | Sorted by date (most recent first)`])
        metadata.push([])
        metadata.push(['Date', 'Type', 'Category', 'Description', 'Amount (UGX)', 'Created By'])
        
        report.data.transactions.forEach((transaction: any) => {
          const createdByName = transaction.created_by_profile?.name || 'Unknown'
          metadata.push([
            new Date(transaction.transaction_date).toLocaleDateString(),
            transaction.type === 'revenue' ? 'Revenue' : 'Expense',
            transaction.category || 'N/A',
            transaction.description || 'N/A',
            parseFloat(transaction.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            createdByName
          ])
        })
      } else {
        metadata.push(['No transactions found for the selected date range'])
      }
      metadata.push([])
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
  
  lines.push('MONGERS RUGBY CLUB')
  lines.push('Official Performance Report')
  lines.push('')
  lines.push('Report Information')
  lines.push(`Report Title,${report.title}`)
  lines.push(`Report Type,${report.type.charAt(0).toUpperCase() + report.type.slice(1)} Report`)
  lines.push(`Date Range,${report.dateRange || 'All Time'}`)
  lines.push(`Generated At,${new Date(report.generatedAt).toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  })}`)
  lines.push(`Report ID,${report.id || 'N/A'}`)
  lines.push('')

  if (report.data) {
    // Format player reports
    if (report.type === 'player' && report.data.playerName) {
      lines.push('EXECUTIVE SUMMARY')
      lines.push(`This report provides a comprehensive analysis of ${report.data.playerName}'s performance, including match statistics, training attendance, and physical fitness metrics. The data presented reflects the player's contribution to the team and overall development.`)
      lines.push('')
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
      
      // Data Completeness Indicator
      const hasMatchStats = (report.data.matchStats?.length || 0) > 0
      const gymStatsForCheckCSV = (report.data.gymStats || {}) as any
      const hasGymStats = (gymStatsForCheckCSV.benchPressPB !== null && gymStatsForCheckCSV.benchPressPB !== undefined && gymStatsForCheckCSV.benchPressPB > 0) ||
                         (gymStatsForCheckCSV.squatPB !== null && gymStatsForCheckCSV.squatPB !== undefined && gymStatsForCheckCSV.squatPB > 0) ||
                         (gymStatsForCheckCSV.deadliftPB !== null && gymStatsForCheckCSV.deadliftPB !== undefined && gymStatsForCheckCSV.deadliftPB > 0)
      const hasTrainingData = (report.data.trainingAttendance?.length || 0) > 0
      lines.push('Data Completeness')
      lines.push(`Match Statistics,${hasMatchStats ? 'Available' : 'Not Available'}`)
      lines.push(`Gym Statistics,${hasGymStats ? 'Available' : 'Not Available'}`)
      lines.push(`Training Attendance,${hasTrainingData ? 'Available' : 'Not Available'}`)
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
      
      // Gym Statistics - Always show, even if empty
      lines.push('GYM STATISTICS')
      const gymStatsCSV = (report.data.gymStats || {}) as any
      const hasBenchPressCSV = gymStatsCSV.benchPressPB !== null && gymStatsCSV.benchPressPB !== undefined && gymStatsCSV.benchPressPB > 0
      const hasSquatCSV = gymStatsCSV.squatPB !== null && gymStatsCSV.squatPB !== undefined && gymStatsCSV.squatPB > 0
      const hasDeadliftCSV = gymStatsCSV.deadliftPB !== null && gymStatsCSV.deadliftPB !== undefined && gymStatsCSV.deadliftPB > 0
      
      if (hasBenchPressCSV || hasSquatCSV || hasDeadliftCSV) {
        lines.push('Exercise,Personal Best (kg)')
        if (hasBenchPressCSV) {
          lines.push(`Bench Press,${gymStatsCSV.benchPressPB}`)
        }
        if (hasSquatCSV) {
          lines.push(`Squat,${gymStatsCSV.squatPB}`)
        }
        if (hasDeadliftCSV) {
          lines.push(`Deadlift,${gymStatsCSV.deadliftPB}`)
        }
      } else {
        lines.push('No gym statistics recorded')
      }
      lines.push('')
      
      // Match Statistics - Always show, even if empty
      lines.push('MATCH-BY-MATCH PERFORMANCE')
      if (report.data.matchStats && report.data.matchStats.length > 0) {
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
      } else {
        lines.push('No match statistics recorded')
      }
      lines.push('')
      
      // Training Attendance - Always show, even if empty
      lines.push('TRAINING ATTENDANCE SUMMARY')
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
      } else {
        lines.push('No training attendance recorded')
        lines.push('Metric,Value')
        lines.push('Total Sessions,0')
        lines.push('Present,0')
        lines.push('Overall Attendance Rate,0%')
      }
      lines.push('')
    }
    // Format match reports
    else if (report.type === 'match' && report.data.matchDetails) {
      const match = report.data.matchDetails
      lines.push('EXECUTIVE SUMMARY')
      lines.push(`This report provides a detailed analysis of the match against ${match.opponent || 'Opponent'}, including team performance metrics, individual player contributions, and key statistics. The data presented offers insights into team dynamics and player effectiveness during this match.`)
      lines.push('')
      lines.push('MATCH STATISTICS REPORT')
      lines.push('MATCH DETAILS')
      lines.push(`Opponent,${match.opponent || 'Unknown'}`)
      lines.push(`Date,${new Date(match.match_date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`)
      if (match.venue) {
        const venue = match.venue.includes(',') ? `"${match.venue}"` : match.venue
        lines.push(`Venue,${venue}`)
      }
      if (match.score_our_team !== null && match.score_opponent !== null) {
        lines.push(`Final Score,${match.score_our_team} - ${match.score_opponent}`)
      }
      lines.push('')
      
      // Calculate match statistics (always show, even if empty)
      const totalPlayers = report.data.playerStats?.length || 0
      const totalTries = report.data.playerStats?.reduce((sum: number, stat: any) => sum + (stat.tries_scored || 0), 0) || 0
      const totalTackles = report.data.playerStats?.reduce((sum: number, stat: any) => sum + (stat.tackles_made || 0), 0) || 0
      const totalMinutes = report.data.playerStats?.reduce((sum: number, stat: any) => sum + (stat.minutes_played || 0), 0) || 0
      const avgTriesPerPlayer = totalPlayers > 0 ? (totalTries / totalPlayers).toFixed(2) : '0.00'
      const avgTacklesPerPlayer = totalPlayers > 0 ? (totalTackles / totalPlayers).toFixed(2) : '0.00'
      const avgMinutesPerPlayer = totalPlayers > 0 ? (totalMinutes / totalPlayers).toFixed(1) : '0.0'
      
      // Match Summary Statistics - Always show
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
      if (report.data.playerStats && report.data.playerStats.length > 0) {
        const topScorer = report.data.playerStats.reduce((top: any, stat: any) => 
          (stat.tries_scored || 0) > (top.tries_scored || 0) ? stat : top, report.data.playerStats[0])
        const topTackler = report.data.playerStats.reduce((top: any, stat: any) => 
          (stat.tackles_made || 0) > (top.tackles_made || 0) ? stat : top, report.data.playerStats[0])
        
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
      }
      
      // Player Statistics Table - Always show, even if empty
      lines.push('INDIVIDUAL PLAYER STATISTICS')
      if (report.data.playerStats && report.data.playerStats.length > 0) {
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
      } else {
        lines.push('No player statistics recorded for this match')
        lines.push('Players Participated,0')
        lines.push('Total Tries,0')
        lines.push('Total Tackles,0')
        lines.push('Total Minutes,0')
      }
    }
    // Format financial reports
    else if (report.type === 'financial' && report.data.transactions) {
      lines.push('EXECUTIVE SUMMARY')
      lines.push(`This financial report provides a comprehensive overview of all financial transactions, including revenues and expenses, categorized breakdowns, and net balance calculations. The data presented offers insights into the club's financial health and spending patterns.`)
      lines.push('')
      lines.push('FINANCIAL REPORT')
      lines.push('')
      
      // Financial Summary
      const summary = report.data.summary || {}
      lines.push('FINANCIAL SUMMARY')
      lines.push('Metric,Value')
      lines.push(`Total Revenue,UGX ${(summary.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      lines.push(`Total Expenses,UGX ${(summary.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      lines.push(`Net Balance,UGX ${(summary.netBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      lines.push(`Total Transactions,${summary.transactionCount || 0}`)
      lines.push(`Revenue Transactions,${summary.revenueCount || 0}`)
      lines.push(`Expense Transactions,${summary.expenseCount || 0}`)
      lines.push('')
      
      // Expenses by Category
      if (report.data.expensesByCategory && Object.keys(report.data.expensesByCategory).length > 0) {
        lines.push('EXPENSES BY CATEGORY')
        lines.push('Category,Total Amount (UGX)')
        Object.entries(report.data.expensesByCategory)
          .sort(([, a]: any, [, b]: any) => b - a)
          .forEach(([category, amount]: [string, any]) => {
            const cat = category.includes(',') ? `"${category}"` : category
            lines.push(`${cat},${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
          })
        lines.push('')
      }
      
      // Revenue by Category
      if (report.data.revenueByCategory && Object.keys(report.data.revenueByCategory).length > 0) {
        lines.push('REVENUE BY CATEGORY')
        lines.push('Category,Total Amount (UGX)')
        Object.entries(report.data.revenueByCategory)
          .sort(([, a]: any, [, b]: any) => b - a)
          .forEach(([category, amount]: [string, any]) => {
            const cat = category.includes(',') ? `"${category}"` : category
            lines.push(`${cat},${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
          })
        lines.push('')
      }
      
      // Transaction Details
      lines.push('TRANSACTION DETAILS')
      if (report.data.transactions && report.data.transactions.length > 0) {
        lines.push(`Showing ${report.data.transactions.length} transaction${report.data.transactions.length !== 1 ? 's' : ''} | Sorted by date (most recent first)`)
        lines.push('')
        lines.push('Date,Type,Category,Description,Amount (UGX),Created By')
        
        report.data.transactions.forEach((transaction: any) => {
          const createdByName = transaction.created_by_profile?.name || 'Unknown'
          const date = new Date(transaction.transaction_date).toLocaleDateString()
          const type = transaction.type === 'revenue' ? 'Revenue' : 'Expense'
          const category = (transaction.category || 'N/A').includes(',') ? `"${transaction.category || 'N/A'}"` : (transaction.category || 'N/A')
          const description = (transaction.description || 'N/A').includes(',') ? `"${transaction.description || 'N/A'}"` : (transaction.description || 'N/A')
          const amount = parseFloat(transaction.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          const creator = createdByName.includes(',') ? `"${createdByName}"` : createdByName
          
          lines.push(`${date},${type},${category},${description},${amount},${creator}`)
        })
      } else {
        lines.push('No transactions found for the selected date range')
      }
      lines.push('')
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

