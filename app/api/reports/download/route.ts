import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { report } = body

    if (!report) {
      return NextResponse.json(
        { error: 'Report data is required', message: 'No report data provided' },
        { status: 400 }
      )
    }

    if (!report.title || !report.type || !report.generatedAt) {
      return NextResponse.json(
        { error: 'Invalid report data', message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create PDF using jsPDF (works in serverless environments)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // Set margins
    const margin = 20
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const contentWidth = pageWidth - (margin * 2)

    let yPos = margin
    
    // Helper function to safely render text (prevents character-by-character rendering)
    const safeText = (text: any, x: number, y: number, options?: any) => {
      const textStr = String(text || '')
      // Ensure we're not passing an array or object
      if (typeof textStr === 'string' && textStr.length > 0) {
        doc.text(textStr, x, y, options)
      }
    }

    // Professional Header with Company Branding
    doc.setFillColor(26, 26, 26)
    doc.rect(0, 0, pageWidth, 35, 'F')
    
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    safeText('MONGERS RUGBY CLUB', pageWidth / 2, 20, { align: 'center' })
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(220, 220, 220)
    safeText('Official Performance Report', pageWidth / 2, 28, { align: 'center' })
    
    yPos = 45
    
    // Report Title Section
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(26, 26, 26)
    const titleText = String(report.title || 'Report')
    const titleLines = doc.splitTextToSize(titleText, contentWidth)
    if (Array.isArray(titleLines)) {
      titleLines.forEach((line: any, idx: number) => {
        safeText(String(line), pageWidth / 2, yPos + (idx * 8), { align: 'center' })
      })
      yPos += titleLines.length * 8
    } else {
      safeText(String(titleLines), pageWidth / 2, yPos, { align: 'center' })
      yPos += 8
    }

    // Report Metadata Box
    yPos += 12
    doc.setFillColor(250, 250, 250)
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.5)
    doc.roundedRect(margin, yPos - 5, contentWidth, 35, 3, 3, 'FD')
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 51, 51)
    
    const reportTypeText = `Report Type: ${String(report.type || 'unknown').charAt(0).toUpperCase() + String(report.type || 'unknown').slice(1)} Report`
    safeText(reportTypeText, margin + 8, yPos)
    
    yPos += 7
    const dateRangeText = `Date Range: ${String(report.dateRange || 'All Time')}`
    safeText(dateRangeText, margin + 8, yPos)
    
    yPos += 7
    const generatedText = `Generated: ${new Date(report.generatedAt || Date.now()).toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`
    safeText(generatedText, margin + 8, yPos)
    
    yPos += 7
    const reportIdText = `Report ID: ${report.id || 'N/A'}`
    doc.setFontSize(9)
    doc.setTextColor(102, 102, 102)
    safeText(reportIdText, margin + 8, yPos)

    // Add a line separator
    yPos += 15
    doc.setDrawColor(204, 204, 204)
    doc.setLineWidth(0.5)
    doc.line(margin, yPos, pageWidth - margin, yPos)

    // Report Content
    yPos += 10
    
    // Format training attendance data properly
    // Check for both formattedSessions (from training export) and attendance (from reports page)
    if (report.type === 'training' && (report.data?.formattedSessions || report.data?.attendance)) {
      // If we have attendance but not formattedSessions, format it
      if (!report.data.formattedSessions && report.data.attendance && report.data.sessionDetails) {
        const session = report.data.sessionDetails
        const attendance = report.data.attendance || []
        report.data.formattedSessions = [{
          date: new Date(session.session_date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          time: session.session_time || 'N/A',
          location: session.location || 'N/A',
          description: session.description || 'N/A',
          attendance: attendance.map((att: any) => ({
            player: att.playerName || 'Unknown',
            status: att.statusLabel || att.attendance_status || 'N/A'
          })),
          summary: {
            total: attendance.length,
            present: attendance.filter((a: any) => (a.attendance_status || a.status) === 'P').length,
            absent: attendance.filter((a: any) => (a.attendance_status || a.status) === 'X').length,
            justified: attendance.filter((a: any) => (a.attendance_status || a.status) === 'A').length,
            injured: attendance.filter((a: any) => (a.attendance_status || a.status) === 'I').length,
          }
        }]
        report.data.summary = report.data.summary || {
          totalSessions: 1,
          totalPlayers: attendance.length,
          overallAttendanceRate: attendance.length > 0
            ? Math.round((report.data.formattedSessions[0].summary.present / attendance.length) * 100)
            : 0
        }
      }
      
      if (report.data?.formattedSessions) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(26, 26, 26)
      safeText('Training Sessions Summary', margin, yPos)
      yPos += 8
      
      // Overall summary
      if (report.data.summary) {
        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 51, 51)
        safeText(`Total Sessions: ${report.data.summary.totalSessions}`, margin, yPos)
        yPos += 6
        safeText(`Total Players: ${report.data.summary.totalPlayers}`, margin, yPos)
        yPos += 6
        safeText(`Overall Attendance Rate: ${report.data.summary.overallAttendanceRate}%`, margin, yPos)
        yPos += 10
      }
      
      // Each session
      report.data.formattedSessions.forEach((session: any, index: number) => {
        // Check if we need a new page
        if (yPos > pageHeight - 60) {
          doc.addPage()
          yPos = margin
        }
        
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 26, 26)
        safeText(`Session ${index + 1}: ${session.date}`, margin, yPos)
        yPos += 7
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 51, 51)
        
        if (session.time && session.time !== 'N/A') {
          safeText(`Time: ${session.time}`, margin + 5, yPos)
          yPos += 5
        }
        if (session.location) {
          safeText(`Location: ${session.location}`, margin + 5, yPos)
          yPos += 5
        }
        if (session.description) {
          const descText = `Description: ${String(session.description)}`
          const descLines = doc.splitTextToSize(descText, contentWidth - 10)
          // Handle array of strings correctly
          if (Array.isArray(descLines)) {
            descLines.forEach((line: any, idx: number) => {
              safeText(String(line), margin + 5, yPos + (idx * 5))
            })
            yPos += descLines.length * 5
          } else {
            safeText(String(descLines), margin + 5, yPos)
            yPos += 5
          }
        }
        
        yPos += 3
        
        // Attendance table header
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        safeText('Attendance:', margin + 5, yPos)
        yPos += 6
        
        // Table headers
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        safeText('Player Name', margin + 10, yPos)
        safeText('Status', margin + 80, yPos)
        yPos += 5
        
        // Draw table line
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(0.2)
        doc.line(margin + 10, yPos, pageWidth - margin - 10, yPos)
        yPos += 3
        
        // Attendance rows
        doc.setFont('helvetica', 'normal')
        if (session.attendance && session.attendance.length > 0) {
          session.attendance.forEach((att: any) => {
            if (yPos > pageHeight - 20) {
              doc.addPage()
              yPos = margin
            }
            const playerName = String(att.player || 'Unknown')
            const statusText = String(att.status || 'N/A')
            safeText(playerName, margin + 10, yPos)
            safeText(statusText, margin + 80, yPos)
            yPos += 5
          })
        } else {
          safeText('No attendance recorded', margin + 10, yPos)
          yPos += 5
        }
        
        yPos += 3
        
        // Session summary
        if (session.summary) {
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          const summaryText = `Summary: Present: ${session.summary.present || 0}, Absent: ${session.summary.absent || 0}, Justified: ${session.summary.justified || 0}, Injured: ${session.summary.injured || 0}`
          safeText(summaryText, margin + 5, yPos)
          yPos += 6
        }
        
        yPos += 5
        // Separator line
        doc.setDrawColor(220, 220, 220)
        doc.setLineWidth(0.3)
        doc.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 8
      })
      }
    } else if (report.data) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(26, 26, 26)
      safeText('Report Summary', margin, yPos)
      
      yPos += 8
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(51, 51, 51)
      
      // If there's a summary string, render it properly
      if (report.data.summary && typeof report.data.summary === 'string') {
        const summaryText = String(report.data.summary)
        const summaryLines = doc.splitTextToSize(summaryText, contentWidth)
        if (Array.isArray(summaryLines)) {
          summaryLines.forEach((line: any, idx: number) => {
            if (yPos > pageHeight - 20) {
              doc.addPage()
              yPos = margin
            }
            safeText(String(line), margin, yPos + (idx * 5))
          })
          yPos += summaryLines.length * 5
        } else {
          safeText(String(summaryLines), margin, yPos)
          yPos += 5
        }
        yPos += 5
      }
      
      // Format player reports
      if (report.type === 'player') {
        // Log for debugging
        const gymStatsForLog = (report.data?.gymStats || {}) as any
        console.log('Processing player report:', {
          hasPlayerName: !!report.data?.playerName,
          playerName: report.data?.playerName,
          hasMatchStats: !!(report.data?.matchStats?.length),
          matchStatsCount: report.data?.matchStats?.length || 0,
          hasGymStats: !!report.data?.gymStats,
          gymStats: report.data?.gymStats,
          gymStatsKeys: report.data?.gymStats ? Object.keys(report.data.gymStats) : [],
          benchPressPB: gymStatsForLog.benchPressPB,
          squatPB: gymStatsForLog.squatPB,
          deadliftPB: gymStatsForLog.deadliftPB,
          hasTrainingAttendance: !!(report.data?.trainingAttendance?.length),
          trainingAttendanceCount: report.data?.trainingAttendance?.length || 0
        })
        
        const playerName = report.data?.playerName || 'Unknown Player'
        
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 26, 26)
        safeText('PLAYER PERFORMANCE REPORT', pageWidth / 2, yPos, { align: 'center' })
        yPos += 10
        
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(51, 51, 51)
        safeText(`Player: ${playerName}`, pageWidth / 2, yPos, { align: 'center' })
        yPos += 12
        
        // Draw separator line
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(0.5)
        doc.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 10
        
        // Calculate comprehensive statistics
        const totalMatches = report.data.matchStats?.length || 0
        const totalTries = report.data.matchStats?.reduce((sum: number, stat: any) => sum + (stat.tries_scored || 0), 0) || 0
        const totalTackles = report.data.matchStats?.reduce((sum: number, stat: any) => sum + (stat.tackles_made || 0), 0) || 0
        const totalMinutes = report.data.matchStats?.reduce((sum: number, stat: any) => sum + (stat.minutes_played || 0), 0) || 0
        const avgTries = totalMatches > 0 ? parseFloat((totalTries / totalMatches).toFixed(2)) : 0
        const avgTackles = totalMatches > 0 ? parseFloat((totalTackles / totalMatches).toFixed(2)) : 0
        const avgMinutes = totalMatches > 0 ? parseFloat((totalMinutes / totalMatches).toFixed(1)) : 0
        
        // Find best performance
        const bestMatch = report.data.matchStats?.reduce((best: any, stat: any) => {
          const bestScore = (best?.tries_scored || 0) + (best?.tackles_made || 0)
          const currentScore = (stat.tries_scored || 0) + (stat.tackles_made || 0)
          return currentScore > bestScore ? stat : best
        }, null)
        
        // Executive Summary Section
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 26, 26)
        safeText('EXECUTIVE SUMMARY', margin, yPos)
        yPos += 8
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 51, 51)
        const summaryText = `This report provides a comprehensive analysis of ${report.data.playerName}'s performance, including match statistics, training attendance, and physical fitness metrics. The data presented reflects the player's contribution to the team and overall development.`
        const summaryLines = doc.splitTextToSize(summaryText, contentWidth)
        if (Array.isArray(summaryLines)) {
          summaryLines.forEach((line: any, idx: number) => {
            safeText(String(line), margin, yPos + (idx * 5))
          })
          yPos += summaryLines.length * 5
        } else {
          safeText(String(summaryLines), margin, yPos)
          yPos += 5
        }
        yPos += 10
        
        // Key Performance Indicators Section
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 26, 26)
        safeText('KEY PERFORMANCE INDICATORS', margin, yPos)
        yPos += 8
        
        // Create a two-column layout for KPIs
        const kpiLeftX = margin + 5
        const kpiRightX = pageWidth / 2 + 10
        const kpiLineHeight = 6
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 51, 51)
        
        // Left column
        safeText(`Total Matches: ${totalMatches}`, kpiLeftX, yPos)
        yPos += kpiLineHeight
        safeText(`Total Tries: ${totalTries}`, kpiLeftX, yPos)
        yPos += kpiLineHeight
        safeText(`Total Tackles: ${totalTackles}`, kpiLeftX, yPos)
        yPos += kpiLineHeight
        safeText(`Total Minutes: ${totalMinutes}`, kpiLeftX, yPos)
        
        // Right column
        const rightYStart = yPos - (kpiLineHeight * 3)
        safeText(`Avg Tries/Match: ${avgTries}`, kpiRightX, rightYStart)
        safeText(`Avg Tackles/Match: ${avgTackles}`, kpiRightX, rightYStart + kpiLineHeight)
        safeText(`Avg Minutes/Match: ${avgMinutes}`, kpiRightX, rightYStart + (kpiLineHeight * 2))
        
        yPos += kpiLineHeight + 8
        
        // Best Performance Highlight
        if (bestMatch && totalMatches > 0) {
          doc.setFillColor(245, 247, 250)
          doc.roundedRect(margin + 5, yPos - 3, contentWidth - 10, 20, 2, 2, 'FD')
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(26, 26, 26)
          const bestOpponent = bestMatch.matches?.opponent || 'Unknown'
          const bestDate = bestMatch.matches?.match_date 
            ? new Date(bestMatch.matches.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'N/A'
          safeText(`🏆 Best Performance: ${bestDate} vs ${bestOpponent}`, margin + 8, yPos + 3)
          yPos += 8
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(51, 51, 51)
          safeText(`Tries: ${bestMatch.tries_scored || 0}  |  Tackles: ${bestMatch.tackles_made || 0}  |  Minutes: ${bestMatch.minutes_played || 0}`, margin + 8, yPos + 3)
          yPos += 12
        } else if (totalMatches === 0) {
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(102, 102, 102)
          safeText('No match performances recorded yet', margin + 5, yPos)
          yPos += 8
        }
        
        // Data Completeness Indicator
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(102, 102, 102)
        const hasMatchStats = (report.data.matchStats?.length || 0) > 0
        const gymStatsForCompleteness = (report.data.gymStats || {}) as any
        const hasGymStats = (gymStatsForCompleteness.benchPressPB !== null && gymStatsForCompleteness.benchPressPB !== undefined && gymStatsForCompleteness.benchPressPB > 0) ||
                           (gymStatsForCompleteness.squatPB !== null && gymStatsForCompleteness.squatPB !== undefined && gymStatsForCompleteness.squatPB > 0) ||
                           (gymStatsForCompleteness.deadliftPB !== null && gymStatsForCompleteness.deadliftPB !== undefined && gymStatsForCompleteness.deadliftPB > 0)
        const hasTrainingData = (report.data.trainingAttendance?.length || 0) > 0
        const dataCompleteness = [
          hasMatchStats ? '✓ Match Statistics' : '○ Match Statistics',
          hasGymStats ? '✓ Gym Statistics' : '○ Gym Statistics',
          hasTrainingData ? '✓ Training Attendance' : '○ Training Attendance'
        ].join('  |  ')
        safeText(`Data Available: ${dataCompleteness}`, margin + 5, yPos)
        yPos += 10
        
        // Draw separator
        doc.setDrawColor(220, 220, 220)
        doc.setLineWidth(0.3)
        doc.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 10
        
        // Gym Statistics - Always show, even if empty
        if (yPos > pageHeight - 50) {
          doc.addPage()
          yPos = margin
        }
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 26, 26)
        safeText('GYM STATISTICS', margin, yPos)
        yPos += 8
        
        // Check for gym stats - handle both null and undefined, and check if values are > 0
        const gymStats = (report.data.gymStats || {}) as any
        const hasBenchPress = gymStats.benchPressPB !== null && gymStats.benchPressPB !== undefined && gymStats.benchPressPB > 0
        const hasSquat = gymStats.squatPB !== null && gymStats.squatPB !== undefined && gymStats.squatPB > 0
        const hasDeadlift = gymStats.deadliftPB !== null && gymStats.deadliftPB !== undefined && gymStats.deadliftPB > 0
        
        if (hasBenchPress || hasSquat || hasDeadlift) {
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(51, 51, 51)
          
          // Table header
          doc.setFont('helvetica', 'bold')
          safeText('Exercise', margin + 5, yPos)
          safeText('Personal Best', margin + 60, yPos)
          yPos += 6
          doc.setDrawColor(200, 200, 200)
          doc.setLineWidth(0.2)
          doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos)
          yPos += 4
          
          // Table rows
          doc.setFont('helvetica', 'normal')
          if (hasBenchPress) {
            safeText('Bench Press', margin + 5, yPos)
            safeText(`${gymStats.benchPressPB} kg`, margin + 60, yPos)
            yPos += 6
          }
          if (hasSquat) {
            safeText('Squat', margin + 5, yPos)
            safeText(`${gymStats.squatPB} kg`, margin + 60, yPos)
            yPos += 6
          }
          if (hasDeadlift) {
            safeText('Deadlift', margin + 5, yPos)
            safeText(`${gymStats.deadliftPB} kg`, margin + 60, yPos)
            yPos += 6
          }
        } else {
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(102, 102, 102)
          safeText('No gym statistics recorded', margin + 5, yPos)
        }
        yPos += 10
        
        // Draw separator
        doc.setDrawColor(220, 220, 220)
        doc.setLineWidth(0.3)
        doc.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 10
        
        // Match Statistics Table - Always show, even if empty
        if (yPos > pageHeight - 50) {
          doc.addPage()
          yPos = margin
        }
        
        // Section header
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 26, 26)
        safeText('MATCH-BY-MATCH PERFORMANCE', margin, yPos)
        yPos += 8
        
        if (report.data.matchStats && report.data.matchStats.length > 0) {
          // Summary before table
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(102, 102, 102)
          safeText(`Showing ${totalMatches} match${totalMatches !== 1 ? 'es' : ''} | Sorted by date (most recent first)`, margin + 5, yPos)
          yPos += 7
          
          // Table header with background
          doc.setFillColor(240, 240, 240)
          doc.rect(margin + 5, yPos - 4, pageWidth - (margin * 2) - 10, 6, 'F')
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(26, 26, 26)
          safeText('Date', margin + 8, yPos)
          safeText('Opponent', margin + 38, yPos)
          safeText('Tries', margin + 75, yPos)
          safeText('Tackles', margin + 85, yPos)
          safeText('Minutes', margin + 100, yPos)
          yPos += 6
          doc.setDrawColor(200, 200, 200)
          doc.setLineWidth(0.3)
          doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos)
          yPos += 4
          
          // Sort matches by date (most recent first)
          const sortedMatchStats = [...(report.data.matchStats || [])].sort((a: any, b: any) => {
            const dateA = a.matches?.match_date ? new Date(a.matches.match_date).getTime() : 0
            const dateB = b.matches?.match_date ? new Date(b.matches.match_date).getTime() : 0
            return dateB - dateA
          })
          
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          sortedMatchStats.forEach((stat: any, index: number) => {
            if (yPos > pageHeight - 20) {
              doc.addPage()
              yPos = margin
              // Re-add headers on new page
              doc.setFillColor(240, 240, 240)
              doc.rect(margin + 5, yPos - 4, pageWidth - (margin * 2) - 10, 6, 'F')
              doc.setFontSize(9)
              doc.setFont('helvetica', 'bold')
              doc.setTextColor(26, 26, 26)
              safeText('Date', margin + 8, yPos)
              safeText('Opponent', margin + 38, yPos)
              safeText('Tries', margin + 75, yPos)
              safeText('Tackles', margin + 85, yPos)
              safeText('Minutes', margin + 100, yPos)
              yPos += 6
              doc.setDrawColor(200, 200, 200)
              doc.setLineWidth(0.3)
              doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos)
              yPos += 4
              doc.setFont('helvetica', 'normal')
              doc.setFontSize(9)
            }
            
            // Alternate row background for readability
            if (index % 2 === 0) {
              doc.setFillColor(250, 250, 250)
              doc.rect(margin + 5, yPos - 3, pageWidth - (margin * 2) - 10, 5, 'F')
            }
            
            const matchDate = stat.matches?.match_date 
              ? new Date(stat.matches.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'N/A'
            const opponent = stat.matches?.opponent || 'N/A'
            doc.setTextColor(51, 51, 51)
            safeText(matchDate.substring(0, 12), margin + 8, yPos)
            safeText(opponent.substring(0, 22), margin + 38, yPos)
            // Highlight tries and tackles in bold if they're above average
            if ((stat.tries_scored || 0) >= avgTries) {
              doc.setFont('helvetica', 'bold')
              doc.setTextColor(26, 26, 26)
            } else {
              doc.setFont('helvetica', 'normal')
              doc.setTextColor(102, 102, 102)
            }
            safeText(String(stat.tries_scored || 0), margin + 75, yPos)
            if ((stat.tackles_made || 0) >= avgTackles) {
              doc.setFont('helvetica', 'bold')
              doc.setTextColor(26, 26, 26)
            } else {
              doc.setFont('helvetica', 'normal')
              doc.setTextColor(102, 102, 102)
            }
            safeText(String(stat.tackles_made || 0), margin + 85, yPos)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(51, 51, 51)
            safeText(String(stat.minutes_played || 0), margin + 100, yPos)
            yPos += 5
          })
        } else {
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(102, 102, 102)
          safeText('No match statistics recorded', margin + 5, yPos)
        }
        yPos += 10
        
        // Draw separator
        doc.setDrawColor(220, 220, 220)
        doc.setLineWidth(0.3)
        doc.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 10
        
        // Training Attendance - Always show, even if empty
        if (yPos > pageHeight - 50) {
          doc.addPage()
          yPos = margin
        }
        
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 26, 26)
        safeText('TRAINING ATTENDANCE SUMMARY', margin, yPos)
        yPos += 8
        
        if (report.data.trainingAttendance && report.data.trainingAttendance.length > 0) {
          // Calculate comprehensive attendance statistics
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
          
          // Attendance statistics in two columns
          const attLeftX = margin + 5
          const attRightX = pageWidth / 2 + 10
          const attLineHeight = 6
          
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(51, 51, 51)
          
          safeText(`Total Sessions: ${totalSessions}`, attLeftX, yPos)
          yPos += attLineHeight
          safeText(`Present: ${presentCount}`, attLeftX, yPos)
          yPos += attLineHeight
          safeText(`Absent (Unjustified): ${absentCount}`, attLeftX, yPos)
          
          const attRightYStart = yPos - (attLineHeight * 2)
          safeText(`Justified Absence: ${justifiedCount}`, attRightX, attRightYStart)
          safeText(`Injured: ${injuredCount}`, attRightX, attRightYStart + attLineHeight)
          
          yPos += attLineHeight + 6
          
          // Attendance rate with visual indicator
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          if (attendanceRate >= 80) {
            doc.setTextColor(34, 139, 34) // Green for good attendance
          } else if (attendanceRate >= 60) {
            doc.setTextColor(255, 140, 0) // Orange for moderate
          } else {
            doc.setTextColor(220, 20, 60) // Red for poor
          }
          safeText(`Overall Attendance Rate: ${attendanceRate}%`, margin + 5, yPos)
          doc.setTextColor(51, 51, 51)
          yPos += 10
          
          // Training sessions table
          if (totalSessions > 0 && totalSessions <= 20) {
            doc.setFontSize(9)
            doc.setFont('helvetica', 'bold')
            safeText('Session Date', margin + 5, yPos)
            safeText('Location', margin + 50, yPos)
            safeText('Status', margin + 90, yPos)
            yPos += 5
            doc.setDrawColor(200, 200, 200)
            doc.setLineWidth(0.2)
            doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos)
            yPos += 4
            
            doc.setFont('helvetica', 'normal')
            report.data.trainingAttendance.slice(0, 20).forEach((att: any) => {
              if (yPos > pageHeight - 20) {
                doc.addPage()
                yPos = margin
              }
              const sessionDate = att.training_sessions?.session_date
                ? new Date(att.training_sessions.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'N/A'
              const location = att.training_sessions?.location || 'N/A'
              const status = att.attendance_status === 'P' ? 'Present' :
                            att.attendance_status === 'A' ? 'Justified Absence' :
                            att.attendance_status === 'X' ? 'Unjustified Absence' :
                            att.attendance_status === 'I' ? 'Injured' : 'Unknown'
              safeText(sessionDate.substring(0, 12), margin + 5, yPos)
              safeText(location.substring(0, 30), margin + 50, yPos)
              safeText(status, margin + 90, yPos)
              yPos += 5
            })
          }
        } else {
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(102, 102, 102)
          safeText('No training attendance recorded', margin + 5, yPos)
          yPos += 6
          safeText('Total Sessions: 0', margin + 5, yPos)
          yPos += 6
          safeText('Present: 0', margin + 5, yPos)
          yPos += 6
          safeText('Overall Attendance Rate: 0%', margin + 5, yPos)
        }
      }
      // Format match reports
      else if (report.type === 'match' && report.data.matchDetails) {
        // Executive Summary Section
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 26, 26)
        safeText('EXECUTIVE SUMMARY', margin, yPos)
        yPos += 8
        
        const match = report.data.matchDetails
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 51, 51)
        const matchSummaryText = `This report provides a detailed analysis of the match against ${match.opponent || 'Opponent'}, including team performance metrics, individual player contributions, and key statistics. The data presented offers insights into team dynamics and player effectiveness during this match.`
        const matchSummaryLines = doc.splitTextToSize(matchSummaryText, contentWidth)
        if (Array.isArray(matchSummaryLines)) {
          matchSummaryLines.forEach((line: any, idx: number) => {
            safeText(String(line), margin, yPos + (idx * 5))
          })
          yPos += matchSummaryLines.length * 5
        } else {
          safeText(String(matchSummaryLines), margin, yPos)
          yPos += 5
        }
        yPos += 10
        
        // Match Details Section
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 26, 26)
        safeText('MATCH DETAILS', margin, yPos)
        yPos += 8
        
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        safeText(`Opponent: ${match.opponent || 'Unknown'}`, margin, yPos)
        yPos += 8
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 51, 51)
        safeText(`Date: ${new Date(match.match_date).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}`, margin, yPos)
        yPos += 6
        if (match.venue) {
          safeText(`Venue: ${match.venue}`, margin, yPos)
          yPos += 6
        }
        if (match.score_our_team !== null && match.score_opponent !== null) {
          doc.setFont('helvetica', 'bold')
          safeText(`Final Score: ${match.score_our_team} - ${match.score_opponent}`, margin, yPos)
          doc.setFont('helvetica', 'normal')
          yPos += 6
        }
        yPos += 5
        
        // Calculate match statistics (available for both summary and table sections)
        const totalPlayers = report.data.playerStats?.length || 0
        const totalTries = report.data.playerStats?.reduce((sum: number, stat: any) => sum + (stat.tries_scored || 0), 0) || 0
        const totalTackles = report.data.playerStats?.reduce((sum: number, stat: any) => sum + (stat.tackles_made || 0), 0) || 0
        const totalMinutes = report.data.playerStats?.reduce((sum: number, stat: any) => sum + (stat.minutes_played || 0), 0) || 0
        const avgTriesPerPlayer = totalPlayers > 0 ? parseFloat((totalTries / totalPlayers).toFixed(2)) : 0
        const avgTacklesPerPlayer = totalPlayers > 0 ? parseFloat((totalTackles / totalPlayers).toFixed(2)) : 0
        const avgMinutesPerPlayer = totalPlayers > 0 ? parseFloat((totalMinutes / totalPlayers).toFixed(1)) : 0
        
        // Match Summary Statistics - Always show
        // Draw separator
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(0.5)
        doc.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 10
        
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 26, 26)
        safeText('MATCH SUMMARY STATISTICS', margin, yPos)
        yPos += 8
        
        // Two-column layout for match stats
        const matchLeftX = margin + 5
        const matchRightX = pageWidth / 2 + 10
        const matchLineHeight = 6
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 51, 51)
        
        safeText(`Players Participated: ${totalPlayers}`, matchLeftX, yPos)
        yPos += matchLineHeight
        safeText(`Total Tries Scored: ${totalTries}`, matchLeftX, yPos)
        yPos += matchLineHeight
        safeText(`Total Tackles Made: ${totalTackles}`, matchLeftX, yPos)
        yPos += matchLineHeight
        safeText(`Total Minutes Played: ${totalMinutes}`, matchLeftX, yPos)
        
        const matchRightYStart = yPos - (matchLineHeight * 3)
        safeText(`Avg Tries/Player: ${avgTriesPerPlayer}`, matchRightX, matchRightYStart)
        safeText(`Avg Tackles/Player: ${avgTacklesPerPlayer}`, matchRightX, matchRightYStart + matchLineHeight)
        safeText(`Avg Minutes/Player: ${avgMinutesPerPlayer}`, matchRightX, matchRightYStart + (matchLineHeight * 2))
        
        yPos += matchLineHeight + 8
        
        // Top performers highlight
        if (report.data.playerStats && report.data.playerStats.length > 0) {
          const topScorer = report.data.playerStats.reduce((top: any, stat: any) => 
            (stat.tries_scored || 0) > (top.tries_scored || 0) ? stat : top, report.data.playerStats[0])
          const topTackler = report.data.playerStats.reduce((top: any, stat: any) => 
            (stat.tackles_made || 0) > (top.tackles_made || 0) ? stat : top, report.data.playerStats[0])
          
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(26, 26, 26)
          if (topScorer && topScorer.tries_scored > 0) {
            const scorerName = topScorer.user_profiles?.name || 'Unknown'
            safeText(`🏆 Top Scorer: ${scorerName} (${topScorer.tries_scored} tries)`, margin + 5, yPos)
            yPos += 6
          }
          if (topTackler && topTackler.tackles_made > 0) {
            const tacklerName = topTackler.user_profiles?.name || 'Unknown'
            safeText(`🏆 Top Tackler: ${tacklerName} (${topTackler.tackles_made} tackles)`, margin + 5, yPos)
            yPos += 6
          }
        }
        yPos += 8
        
        // Player Statistics Table - Always show, even if empty
        if (yPos > pageHeight - 50) {
          doc.addPage()
          yPos = margin
        }
        
        // Draw separator
        doc.setDrawColor(220, 220, 220)
        doc.setLineWidth(0.3)
        doc.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 10
        
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 26, 26)
        safeText('INDIVIDUAL PLAYER STATISTICS', margin, yPos)
        yPos += 8
        
        if (report.data.playerStats && report.data.playerStats.length > 0) {
          // Summary before table
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(102, 102, 102)
          safeText(`Showing ${report.data.playerStats.length} player${report.data.playerStats.length !== 1 ? 's' : ''} | Sorted by tries scored (highest first)`, margin + 5, yPos)
          yPos += 7
          
          // Table header with background
          doc.setFillColor(240, 240, 240)
          doc.rect(margin + 5, yPos - 4, pageWidth - (margin * 2) - 10, 6, 'F')
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(26, 26, 26)
          safeText('Player Name', margin + 8, yPos)
          safeText('Tries', margin + 70, yPos)
          safeText('Tackles', margin + 80, yPos)
          safeText('Minutes', margin + 95, yPos)
          yPos += 6
          doc.setDrawColor(200, 200, 200)
          doc.setLineWidth(0.3)
          doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos)
          yPos += 4
          
          doc.setFont('helvetica', 'normal')
          // Sort by tries scored (descending) for better readability
          const sortedStats = [...report.data.playerStats].sort((a: any, b: any) => 
            (b.tries_scored || 0) - (a.tries_scored || 0)
          )
          
          // Calculate averages for highlighting
          const avgTries = totalPlayers > 0 ? totalTries / totalPlayers : 0
          const avgTackles = totalPlayers > 0 ? totalTackles / totalPlayers : 0
          
          sortedStats.forEach((stat: any, index: number) => {
            if (yPos > pageHeight - 20) {
              doc.addPage()
              yPos = margin
              // Re-add headers on new page
              doc.setFillColor(240, 240, 240)
              doc.rect(margin + 5, yPos - 4, pageWidth - (margin * 2) - 10, 6, 'F')
              doc.setFontSize(9)
              doc.setFont('helvetica', 'bold')
              doc.setTextColor(26, 26, 26)
              safeText('Player Name', margin + 8, yPos)
              safeText('Tries', margin + 70, yPos)
              safeText('Tackles', margin + 80, yPos)
              safeText('Minutes', margin + 95, yPos)
              yPos += 6
              doc.setDrawColor(200, 200, 200)
              doc.setLineWidth(0.3)
              doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos)
              yPos += 4
              doc.setFont('helvetica', 'normal')
              doc.setFontSize(9)
            }
            
            // Alternate row background
            if (index % 2 === 0) {
              doc.setFillColor(250, 250, 250)
              doc.rect(margin + 5, yPos - 3, pageWidth - (margin * 2) - 10, 5, 'F')
            }
            
            const playerName = stat.user_profiles?.name || 'Unknown'
            doc.setTextColor(51, 51, 51)
            safeText(playerName.substring(0, 48), margin + 8, yPos)
            
            // Highlight above-average performers
            if ((stat.tries_scored || 0) >= avgTries) {
              doc.setFont('helvetica', 'bold')
              doc.setTextColor(26, 26, 26)
            } else {
              doc.setFont('helvetica', 'normal')
              doc.setTextColor(102, 102, 102)
            }
            safeText(String(stat.tries_scored || 0), margin + 70, yPos)
            
            if ((stat.tackles_made || 0) >= avgTackles) {
              doc.setFont('helvetica', 'bold')
              doc.setTextColor(26, 26, 26)
            } else {
              doc.setFont('helvetica', 'normal')
              doc.setTextColor(102, 102, 102)
            }
            safeText(String(stat.tackles_made || 0), margin + 80, yPos)
            
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(51, 51, 51)
            safeText(String(stat.minutes_played || 0), margin + 95, yPos)
            yPos += 5
          })
        } else {
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(102, 102, 102)
          safeText('No player statistics recorded for this match', margin + 5, yPos)
          yPos += 6
          safeText('Players Participated: 0', margin + 5, yPos)
          yPos += 6
          safeText('Total Tries: 0', margin + 5, yPos)
          yPos += 6
          safeText('Total Tackles: 0', margin + 5, yPos)
          yPos += 6
          safeText('Total Minutes: 0', margin + 5, yPos)
        }
      }
      // For other report types, show formatted data if available
      else if (report.data.summary) {
        // Check if summary is a string (not an object)
        if (typeof report.data.summary === 'string') {
          // Render the summary string properly
          const summaryText = String(report.data.summary)
          const summaryLines = doc.splitTextToSize(summaryText, contentWidth)
          if (Array.isArray(summaryLines)) {
            summaryLines.forEach((line: any, idx: number) => {
              if (yPos > pageHeight - 20) {
                doc.addPage()
                yPos = margin
              }
              safeText(String(line), margin, yPos + (idx * 5))
            })
            yPos += summaryLines.length * 5
          } else {
            safeText(String(summaryLines), margin, yPos)
            yPos += 5
          }
        } else if (typeof report.data.summary === 'object' && !Array.isArray(report.data.summary)) {
          // Summary is an object, render key-value pairs
          Object.entries(report.data.summary).forEach(([key, value]) => {
            if (yPos > pageHeight - 20) {
              doc.addPage()
              yPos = margin
            }
            safeText(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${String(value)}`, margin, yPos)
            yPos += 6
          })
        }
      } else {
        // Fallback: show a message instead of raw JSON
        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 51, 51)
        const message = 'Report data is available. Please use the download options to view detailed information.'
        const messageLines = doc.splitTextToSize(message, contentWidth)
        if (Array.isArray(messageLines)) {
          messageLines.forEach((line: string, idx: number) => {
            if (yPos > pageHeight - 20) {
              doc.addPage()
              yPos = margin
            }
            // Ensure line is a string, not an array
            const lineText = typeof line === 'string' ? line : String(line)
            safeText(lineText, margin, yPos + (idx * 5))
          })
          yPos += messageLines.length * 5
        } else {
          // Ensure messageLines is a string
          const messageText = typeof messageLines === 'string' ? messageLines : String(messageLines)
          safeText(messageText, margin, yPos)
          yPos += 5
        }
      }
    } else {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(102, 102, 102)
      const defaultText = 'This report contains detailed information about the selected category.'
      const defaultLines = doc.splitTextToSize(defaultText, contentWidth)
      if (Array.isArray(defaultLines)) {
        defaultLines.forEach((line: string, idx: number) => {
          // Ensure line is a string, not an array
          const lineText = typeof line === 'string' ? line : String(line)
          safeText(lineText, margin, yPos + (idx * 5))
        })
        yPos += defaultLines.length * 5
      } else {
        // Ensure defaultLines is a string
        const defaultTextStr = typeof defaultLines === 'string' ? defaultLines : String(defaultLines)
        safeText(defaultTextStr, margin, yPos)
        yPos += 5
      }
    }

    // Professional Footer with Confidentiality Notice
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      
      // Footer background
      doc.setFillColor(245, 245, 245)
      doc.rect(0, pageHeight - 20, pageWidth, 20, 'F')
      
      // Footer line
      doc.setDrawColor(220, 220, 220)
      doc.setLineWidth(0.5)
      doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20)
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(102, 102, 102)
      
      const pageText = pageCount > 1 ? `Page ${i} of ${pageCount}` : 'Page 1'
      safeText(pageText, pageWidth / 2, pageHeight - 15, { align: 'center' })
      
      doc.setFontSize(8)
      const footerText = `Generated by Mongers Rugby Club Management System | ${new Date(report.generatedAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
      safeText(footerText, pageWidth / 2, pageHeight - 8, { align: 'center' })
      
      // Confidentiality notice
      doc.setFontSize(7)
      doc.setTextColor(153, 153, 153)
      safeText('This report contains confidential information and is intended for authorized use only.', pageWidth / 2, pageHeight - 3, { align: 'center' })
    }

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating PDF:', error)
    const errorMessage = error?.message || 'Unknown error occurred'
    const errorStack = error?.stack || ''
    
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF', 
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}
