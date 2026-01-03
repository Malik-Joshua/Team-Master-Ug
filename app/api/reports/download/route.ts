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

    // Header
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(26, 26, 26)
    doc.text('Mongers Rugby Club', pageWidth / 2, yPos, { align: 'center' })
    
    yPos += 10
    doc.setFontSize(16)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(102, 102, 102)
    doc.text('Official Report', pageWidth / 2, yPos, { align: 'center' })

    // Report Title
    yPos += 15
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(26, 26, 26)
    const titleLines = doc.splitTextToSize(report.title, contentWidth)
    // Ensure we handle array of strings correctly
    if (Array.isArray(titleLines)) {
      titleLines.forEach((line: string, idx: number) => {
        doc.text(line, pageWidth / 2, yPos + (idx * 7), { align: 'center' })
      })
      yPos += titleLines.length * 7
    } else {
      doc.text(titleLines, pageWidth / 2, yPos, { align: 'center' })
      yPos += 7
    }

    // Report Details
    yPos += 10
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 51, 51)
    doc.text(`Report Type: ${report.type.charAt(0).toUpperCase() + report.type.slice(1)}`, margin, yPos)
    
    yPos += 7
    doc.text(`Date Range: ${report.dateRange}`, margin, yPos)
    
    yPos += 7
    doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, margin, yPos)

    // Add a line separator
    yPos += 10
    doc.setDrawColor(204, 204, 204)
    doc.setLineWidth(0.5)
    doc.line(margin, yPos, pageWidth - margin, yPos)

    // Report Content
    yPos += 10
    
    // Format training attendance data properly
    if (report.type === 'training' && report.data?.formattedSessions) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(26, 26, 26)
      doc.text('Training Sessions Summary', margin, yPos)
      yPos += 8
      
      // Overall summary
      if (report.data.summary) {
        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 51, 51)
        doc.text(`Total Sessions: ${report.data.summary.totalSessions}`, margin, yPos)
        yPos += 6
        doc.text(`Total Players: ${report.data.summary.totalPlayers}`, margin, yPos)
        yPos += 6
        doc.text(`Overall Attendance Rate: ${report.data.summary.overallAttendanceRate}%`, margin, yPos)
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
        doc.text(`Session ${index + 1}: ${session.date}`, margin, yPos)
        yPos += 7
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 51, 51)
        
        if (session.time && session.time !== 'N/A') {
          doc.text(`Time: ${session.time}`, margin + 5, yPos)
          yPos += 5
        }
        if (session.location) {
          doc.text(`Location: ${session.location}`, margin + 5, yPos)
          yPos += 5
        }
        if (session.description) {
          const descLines = doc.splitTextToSize(`Description: ${session.description}`, contentWidth - 10)
          // Handle array of strings correctly
          if (Array.isArray(descLines)) {
            descLines.forEach((line: string, idx: number) => {
              doc.text(line, margin + 5, yPos + (idx * 5))
            })
            yPos += descLines.length * 5
          } else {
            doc.text(descLines, margin + 5, yPos)
            yPos += 5
          }
        }
        
        yPos += 3
        
        // Attendance table header
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('Attendance:', margin + 5, yPos)
        yPos += 6
        
        // Table headers
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text('Player Name', margin + 10, yPos)
        doc.text('Status', margin + 80, yPos)
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
            doc.text(att.player || 'Unknown', margin + 10, yPos)
            doc.text(att.status || 'N/A', margin + 80, yPos)
            yPos += 5
          })
        } else {
          doc.text('No attendance recorded', margin + 10, yPos)
          yPos += 5
        }
        
        yPos += 3
        
        // Session summary
        if (session.summary) {
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          doc.text(`Summary: Present: ${session.summary.present}, Absent: ${session.summary.absent}, Justified: ${session.summary.justified}, Injured: ${session.summary.injured}`, margin + 5, yPos)
          yPos += 6
        }
        
        yPos += 5
        // Separator line
        doc.setDrawColor(220, 220, 220)
        doc.setLineWidth(0.3)
        doc.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 8
      })
    } else if (report.data) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(26, 26, 26)
      doc.text('Report Summary', margin, yPos)
      
      yPos += 8
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(51, 51, 51)
      
      // Format player reports
      if (report.type === 'player' && report.data.playerName) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(`Player: ${report.data.playerName}`, margin, yPos)
        yPos += 8
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        
        if (report.data.gymStats) {
          doc.setFont('helvetica', 'bold')
          doc.text('Gym Statistics:', margin, yPos)
          yPos += 6
          doc.setFont('helvetica', 'normal')
          if (report.data.gymStats.benchPressPB) {
            doc.text(`Bench Press PB: ${report.data.gymStats.benchPressPB} kg`, margin + 5, yPos)
            yPos += 5
          }
          if (report.data.gymStats.squatPB) {
            doc.text(`Squat PB: ${report.data.gymStats.squatPB} kg`, margin + 5, yPos)
            yPos += 5
          }
          if (report.data.gymStats.deadliftPB) {
            doc.text(`Deadlift PB: ${report.data.gymStats.deadliftPB} kg`, margin + 5, yPos)
            yPos += 5
          }
          yPos += 3
        }
        
        if (report.data.matchStats && report.data.matchStats.length > 0) {
          doc.setFont('helvetica', 'bold')
          doc.text('Match Statistics:', margin, yPos)
          yPos += 6
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          doc.text('Match Date', margin + 5, yPos)
          doc.text('Tries', margin + 50, yPos)
          doc.text('Tackles', margin + 70, yPos)
          doc.text('Minutes', margin + 90, yPos)
          yPos += 5
          doc.setDrawColor(200, 200, 200)
          doc.setLineWidth(0.2)
          doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos)
          yPos += 3
          
          report.data.matchStats.slice(0, 10).forEach((stat: any) => {
            if (yPos > pageHeight - 20) {
              doc.addPage()
              yPos = margin
            }
            const matchDate = stat.matches?.match_date 
              ? new Date(stat.matches.match_date).toLocaleDateString()
              : 'N/A'
            doc.text(matchDate.substring(0, 10), margin + 5, yPos)
            doc.text(String(stat.tries_scored || 0), margin + 50, yPos)
            doc.text(String(stat.tackles_made || 0), margin + 70, yPos)
            doc.text(String(stat.minutes_played || 0), margin + 90, yPos)
            yPos += 5
          })
          yPos += 3
        }
        
        if (report.data.trainingAttendance && report.data.trainingAttendance.length > 0) {
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.text(`Training Sessions Attended: ${report.data.trainingAttendance.length}`, margin, yPos)
          yPos += 6
        }
      }
      // Format match reports
      else if (report.type === 'match' && report.data.matchDetails) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        const match = report.data.matchDetails
        doc.text(`Match: ${match.opponent || 'Unknown'}`, margin, yPos)
        yPos += 6
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(`Date: ${new Date(match.match_date).toLocaleDateString()}`, margin, yPos)
        yPos += 5
        if (match.venue) {
          doc.text(`Venue: ${match.venue}`, margin, yPos)
          yPos += 5
        }
        if (match.score_our_team !== null && match.score_opponent !== null) {
          doc.text(`Score: ${match.score_our_team} - ${match.score_opponent}`, margin, yPos)
          yPos += 5
        }
        yPos += 3
        
        if (report.data.playerStats && report.data.playerStats.length > 0) {
          doc.setFont('helvetica', 'bold')
          doc.text('Player Statistics:', margin, yPos)
          yPos += 6
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          doc.text('Player', margin + 5, yPos)
          doc.text('Tries', margin + 60, yPos)
          doc.text('Tackles', margin + 75, yPos)
          doc.text('Minutes', margin + 90, yPos)
          yPos += 5
          doc.setDrawColor(200, 200, 200)
          doc.setLineWidth(0.2)
          doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos)
          yPos += 3
          
          report.data.playerStats.forEach((stat: any) => {
            if (yPos > pageHeight - 20) {
              doc.addPage()
              yPos = margin
            }
            const playerName = stat.user_profiles?.name || 'Unknown'
            doc.text(playerName.substring(0, 25), margin + 5, yPos)
            doc.text(String(stat.tries_scored || 0), margin + 60, yPos)
            doc.text(String(stat.tackles_made || 0), margin + 75, yPos)
            doc.text(String(stat.minutes_played || 0), margin + 90, yPos)
            yPos += 5
          })
        }
      }
      // For other report types, show formatted data if available
      else if (report.data.summary) {
        Object.entries(report.data.summary).forEach(([key, value]) => {
          if (yPos > pageHeight - 20) {
            doc.addPage()
            yPos = margin
          }
          doc.text(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`, margin, yPos)
          yPos += 6
        })
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
            doc.text(line, margin, yPos + (idx * 5))
          })
          yPos += messageLines.length * 5
        } else {
          doc.text(messageLines, margin, yPos)
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
          doc.text(line, margin, yPos + (idx * 5))
        })
        yPos += defaultLines.length * 5
      } else {
        doc.text(defaultLines, margin, yPos)
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
      doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' })
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
