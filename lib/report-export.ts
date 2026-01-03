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
    // Format training attendance data specially
    if (report.type === 'training' && report.data.formattedSessions) {
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
    // Format training attendance data specially
    if (report.type === 'training' && report.data.formattedSessions) {
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

