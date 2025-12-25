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
    metadata.push(['Report Data'])
    if (Array.isArray(report.data)) {
      // If data is an array, add headers and rows
      if (report.data.length > 0) {
        const headers = Object.keys(report.data[0])
        metadata.push(headers)
        report.data.forEach((row: any) => {
          metadata.push(headers.map((header) => row[header] || ''))
        })
      }
    } else {
      // If data is an object, add key-value pairs
      Object.entries(report.data).forEach(([key, value]) => {
        metadata.push([key, String(value)])
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
    if (Array.isArray(report.data)) {
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
        lines.push(`${key},${value}`)
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

