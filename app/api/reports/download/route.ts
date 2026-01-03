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

    // Header
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(26, 26, 26)
    safeText('Mongers Rugby Club', pageWidth / 2, yPos, { align: 'center' })
    
    yPos += 10
    doc.setFontSize(16)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(102, 102, 102)
    safeText('Official Report', pageWidth / 2, yPos, { align: 'center' })

    // Report Title
    yPos += 15
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(26, 26, 26)
    const titleText = String(report.title || 'Report')
    const titleLines = doc.splitTextToSize(titleText, contentWidth)
    // Ensure we handle array of strings correctly
    if (Array.isArray(titleLines)) {
      titleLines.forEach((line: any, idx: number) => {
        safeText(String(line), pageWidth / 2, yPos + (idx * 7), { align: 'center' })
      })
      yPos += titleLines.length * 7
    } else {
      safeText(String(titleLines), pageWidth / 2, yPos, { align: 'center' })
      yPos += 7
    }

    // Report Details
    yPos += 10
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 51, 51)
    const reportTypeText = `Report Type: ${String(report.type || 'unknown').charAt(0).toUpperCase() + String(report.type || 'unknown').slice(1)}`
    safeText(reportTypeText, margin, yPos)
    
    yPos += 7
    const dateRangeText = `Date Range: ${String(report.dateRange || 'N/A')}`
    safeText(dateRangeText, margin, yPos)
    
    yPos += 7
    const generatedText = `Generated: ${new Date(report.generatedAt || Date.now()).toLocaleString()}`
    safeText(generatedText, margin, yPos)

    // Add a line separator
    yPos += 10
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
      if (report.type === 'player' && report.data.playerName) {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 26, 26)
        safeText('Player Performance Report', margin, yPos)
        yPos += 8
        
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        safeText(`Player: ${report.data.playerName}`, margin, yPos)
        yPos += 8
        
        // Calculate summary statistics
        const totalMatches = report.data.matchStats?.length || 0
        const totalTries = report.data.matchStats?.reduce((sum: number, stat: any) => sum + (stat.tries_scored || 0), 0) || 0
        const totalTackles = report.data.matchStats?.reduce((sum: number, stat: any) => sum + (stat.tackles_made || 0), 0) || 0
        const totalMinutes = report.data.matchStats?.reduce((sum: number, stat: any) => sum + (stat.minutes_played || 0), 0) || 0
        const avgTries = totalMatches > 0 ? (totalTries / totalMatches).toFixed(2) : 0
        const avgTackles = totalMatches > 0 ? (totalTackles / totalMatches).toFixed(2) : 0
        
        // Overall Statistics Summary
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        safeText('Overall Statistics:', margin, yPos)
        yPos += 7
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 51, 51)
        safeText(`Total Matches Played: ${totalMatches}`, margin + 5, yPos)
        yPos += 6
        safeText(`Total Tries Scored: ${totalTries}`, margin + 5, yPos)
        yPos += 6
        safeText(`Total Tackles Made: ${totalTackles}`, margin + 5, yPos)
        yPos += 6
        safeText(`Total Minutes Played: ${totalMinutes}`, margin + 5, yPos)
        yPos += 6
        safeText(`Average Tries per Match: ${avgTries}`, margin + 5, yPos)
        yPos += 6
        safeText(`Average Tackles per Match: ${avgTackles}`, margin + 5, yPos)
        yPos += 10
        
        // Gym Statistics
        if (report.data.gymStats && (report.data.gymStats.benchPressPB || report.data.gymStats.squatPB || report.data.gymStats.deadliftPB)) {
          if (yPos > pageHeight - 50) {
            doc.addPage()
            yPos = margin
          }
          doc.setFontSize(11)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(26, 26, 26)
          safeText('Gym Statistics:', margin, yPos)
          yPos += 7
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
          if (report.data.gymStats.benchPressPB) {
            safeText('Bench Press', margin + 5, yPos)
            safeText(`${report.data.gymStats.benchPressPB} kg`, margin + 60, yPos)
            yPos += 6
          }
          if (report.data.gymStats.squatPB) {
            safeText('Squat', margin + 5, yPos)
            safeText(`${report.data.gymStats.squatPB} kg`, margin + 60, yPos)
            yPos += 6
          }
          if (report.data.gymStats.deadliftPB) {
            safeText('Deadlift', margin + 5, yPos)
            safeText(`${report.data.gymStats.deadliftPB} kg`, margin + 60, yPos)
            yPos += 6
          }
          yPos += 8
        }
        
        // Match Statistics Table
        if (report.data.matchStats && report.data.matchStats.length > 0) {
          if (yPos > pageHeight - 50) {
            doc.addPage()
            yPos = margin
          }
          doc.setFontSize(11)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(26, 26, 26)
          safeText('Match Statistics:', margin, yPos)
          yPos += 7
          
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          safeText('Date', margin + 5, yPos)
          safeText('Opponent', margin + 35, yPos)
          safeText('Tries', margin + 75, yPos)
          safeText('Tackles', margin + 85, yPos)
          safeText('Minutes', margin + 100, yPos)
          yPos += 5
          doc.setDrawColor(200, 200, 200)
          doc.setLineWidth(0.2)
          doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos)
          yPos += 4
          
          doc.setFont('helvetica', 'normal')
          report.data.matchStats.forEach((stat: any) => {
            if (yPos > pageHeight - 20) {
              doc.addPage()
              yPos = margin
              // Re-add headers on new page
              doc.setFontSize(9)
              doc.setFont('helvetica', 'bold')
              safeText('Date', margin + 5, yPos)
              safeText('Opponent', margin + 35, yPos)
              safeText('Tries', margin + 75, yPos)
              safeText('Tackles', margin + 85, yPos)
              safeText('Minutes', margin + 100, yPos)
              yPos += 5
              doc.setDrawColor(200, 200, 200)
              doc.setLineWidth(0.2)
              doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos)
              yPos += 4
              doc.setFont('helvetica', 'normal')
            }
            const matchDate = stat.matches?.match_date 
              ? new Date(stat.matches.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'N/A'
            const opponent = stat.matches?.opponent || 'N/A'
            safeText(matchDate.substring(0, 12), margin + 5, yPos)
            safeText(opponent.substring(0, 20), margin + 35, yPos)
            safeText(String(stat.tries_scored || 0), margin + 75, yPos)
            safeText(String(stat.tackles_made || 0), margin + 85, yPos)
            safeText(String(stat.minutes_played || 0), margin + 100, yPos)
            yPos += 5
          })
          yPos += 8
        }
        
        // Training Attendance
        if (report.data.trainingAttendance && report.data.trainingAttendance.length > 0) {
          if (yPos > pageHeight - 50) {
            doc.addPage()
            yPos = margin
          }
          doc.setFontSize(11)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(26, 26, 26)
          safeText('Training Attendance:', margin, yPos)
          yPos += 7
          
          // Calculate attendance statistics
          const totalSessions = report.data.trainingAttendance.length
          const presentCount = report.data.trainingAttendance.filter((att: any) => 
            att.attendance_status === 'P' || att.training_sessions?.attendance_status === 'P'
          ).length
          const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0
          
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(51, 51, 51)
          safeText(`Total Training Sessions: ${totalSessions}`, margin + 5, yPos)
          yPos += 6
          safeText(`Sessions Attended: ${presentCount}`, margin + 5, yPos)
          yPos += 6
          safeText(`Attendance Rate: ${attendanceRate}%`, margin + 5, yPos)
          yPos += 8
          
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
        }
      }
      // Format match reports
      else if (report.type === 'match' && report.data.matchDetails) {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 26, 26)
        safeText('Match Statistics Report', margin, yPos)
        yPos += 8
        
        const match = report.data.matchDetails
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        safeText(`Match: ${match.opponent || 'Unknown'}`, margin, yPos)
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
        
        // Match Summary Statistics
        if (report.data.playerStats && report.data.playerStats.length > 0) {
          const totalPlayers = report.data.playerStats.length
          const totalTries = report.data.playerStats.reduce((sum: number, stat: any) => sum + (stat.tries_scored || 0), 0)
          const totalTackles = report.data.playerStats.reduce((sum: number, stat: any) => sum + (stat.tackles_made || 0), 0)
          const totalMinutes = report.data.playerStats.reduce((sum: number, stat: any) => sum + (stat.minutes_played || 0), 0)
          const topScorer = report.data.playerStats.reduce((top: any, stat: any) => 
            (stat.tries_scored || 0) > (top.tries_scored || 0) ? stat : top, report.data.playerStats[0])
          const topTackler = report.data.playerStats.reduce((top: any, stat: any) => 
            (stat.tackles_made || 0) > (top.tackles_made || 0) ? stat : top, report.data.playerStats[0])
          
          doc.setFontSize(11)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(26, 26, 26)
          safeText('Match Summary:', margin, yPos)
          yPos += 7
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(51, 51, 51)
          safeText(`Players Participated: ${totalPlayers}`, margin + 5, yPos)
          yPos += 6
          safeText(`Total Tries Scored: ${totalTries}`, margin + 5, yPos)
          yPos += 6
          safeText(`Total Tackles Made: ${totalTackles}`, margin + 5, yPos)
          yPos += 6
          safeText(`Total Minutes Played: ${totalMinutes}`, margin + 5, yPos)
          yPos += 6
          if (topScorer && topScorer.tries_scored > 0) {
            const scorerName = topScorer.user_profiles?.name || 'Unknown'
            safeText(`Top Scorer: ${scorerName} (${topScorer.tries_scored} tries)`, margin + 5, yPos)
            yPos += 6
          }
          if (topTackler && topTackler.tackles_made > 0) {
            const tacklerName = topTackler.user_profiles?.name || 'Unknown'
            safeText(`Top Tackler: ${tacklerName} (${topTackler.tackles_made} tackles)`, margin + 5, yPos)
            yPos += 6
          }
          yPos += 8
        }
        
        // Player Statistics Table
        if (report.data.playerStats && report.data.playerStats.length > 0) {
          if (yPos > pageHeight - 50) {
            doc.addPage()
            yPos = margin
          }
          doc.setFontSize(11)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(26, 26, 26)
          safeText('Player Statistics:', margin, yPos)
          yPos += 7
          
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          safeText('Player Name', margin + 5, yPos)
          safeText('Tries', margin + 70, yPos)
          safeText('Tackles', margin + 80, yPos)
          safeText('Minutes', margin + 95, yPos)
          yPos += 5
          doc.setDrawColor(200, 200, 200)
          doc.setLineWidth(0.2)
          doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos)
          yPos += 4
          
          doc.setFont('helvetica', 'normal')
          // Sort by tries scored (descending) for better readability
          const sortedStats = [...report.data.playerStats].sort((a: any, b: any) => 
            (b.tries_scored || 0) - (a.tries_scored || 0)
          )
          
          sortedStats.forEach((stat: any) => {
            if (yPos > pageHeight - 20) {
              doc.addPage()
              yPos = margin
              // Re-add headers on new page
              doc.setFontSize(9)
              doc.setFont('helvetica', 'bold')
              safeText('Player Name', margin + 5, yPos)
              safeText('Tries', margin + 70, yPos)
              safeText('Tackles', margin + 80, yPos)
              safeText('Minutes', margin + 95, yPos)
              yPos += 5
              doc.setDrawColor(200, 200, 200)
              doc.setLineWidth(0.2)
              doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos)
              yPos += 4
              doc.setFont('helvetica', 'normal')
            }
            const playerName = stat.user_profiles?.name || 'Unknown'
            safeText(playerName.substring(0, 50), margin + 5, yPos)
            safeText(String(stat.tries_scored || 0), margin + 70, yPos)
            safeText(String(stat.tackles_made || 0), margin + 80, yPos)
            safeText(String(stat.minutes_played || 0), margin + 95, yPos)
            yPos += 5
          })
        } else {
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(102, 102, 102)
          safeText('No player statistics available for this match.', margin, yPos)
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

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(153, 153, 153)
      const footerText = pageCount > 1 
        ? `Generated by Mongers Rugby Club Management System - Page ${i} of ${pageCount}`
        : 'Generated by Mongers Rugby Club Management System'
      safeText(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' })
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
