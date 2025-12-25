import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { jsPDF } from 'jspdf'

export const dynamic = 'force-dynamic'

// GET: Download a report
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reportId = params.id

    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Service role key is missing' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get report
    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    // Check if user has permission (admin can see all, others can only see their own)
    if (profile.role !== 'admin' && profile.role !== 'data_admin' && profile.role !== 'finance_admin') {
      if (report.generated_by !== authUser.id) {
        return NextResponse.json(
          { error: 'Unauthorized: You can only download your own reports' },
          { status: 403 }
        )
      }
    }

    // Check if report is ready
    if (report.status !== 'ready') {
      return NextResponse.json(
        { error: 'Report is not ready for download yet' },
        { status: 400 }
      )
    }

    // Generate PDF using jsPDF
    const fileName = `${report.report_type}_report_${report.id.substring(0, 8)}.pdf`
    
    // Create PDF document
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

    // Add header
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(report.title, pageWidth / 2, yPos, { align: 'center' })
    yPos += 10
    
    // Add report metadata
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Report Type: ${report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)}`, margin, yPos)
    yPos += 7
    
    doc.text(`Generated: ${new Date(report.created_at).toLocaleString()}`, margin, yPos)
    yPos += 7
    
    if (report.date_from && report.date_to) {
      doc.text(`Date Range: ${new Date(report.date_from).toLocaleDateString()} - ${new Date(report.date_to).toLocaleDateString()}`, margin, yPos)
      yPos += 7
    }
    
    yPos += 5
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 10

    // Add report-specific content based on type
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Report Summary', margin, yPos)
    yPos += 10
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')

    switch (report.report_type) {
      case 'player':
        doc.text('Player Performance Report', margin, yPos)
        yPos += 7
        doc.text('This report contains player performance data including:', margin, yPos)
        yPos += 7
        doc.text('• Match statistics (tries, tackles, minutes played)', margin + 5, yPos)
        yPos += 6
        doc.text('• Training attendance records', margin + 5, yPos)
        yPos += 6
        doc.text('• Overall performance metrics', margin + 5, yPos)
        yPos += 10
        
        // Fetch and add player data if available
        try {
          const { data: players } = await supabaseAdmin
            .from('user_profiles')
            .select('user_id, name, status')
            .eq('role', 'player')
            .limit(10)
          
          if (players && players.length > 0) {
            if (yPos > pageHeight - 40) {
              doc.addPage()
              yPos = margin
            }
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Active Players:', margin, yPos)
            yPos += 7
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            players.forEach((player: any) => {
              if (yPos > pageHeight - 20) {
                doc.addPage()
                yPos = margin
              }
              doc.text(`• ${player.name} (${player.status})`, margin + 5, yPos)
              yPos += 6
            })
          }
        } catch (error) {
          console.error('Error fetching player data:', error)
        }
        break

      case 'match':
        doc.text('Match Statistics Report', margin, yPos)
        yPos += 7
        doc.text('This report contains match statistics and results including:', margin, yPos)
        yPos += 7
        doc.text('• Match results and scores', margin + 5, yPos)
        yPos += 6
        doc.text('• Player performance in matches', margin + 5, yPos)
        yPos += 6
        doc.text('• Team statistics and trends', margin + 5, yPos)
        yPos += 10
        
        // Fetch and add match data if available
        try {
          const { data: matches } = await supabaseAdmin
            .from('matches')
            .select('id, match_date, opponent, score_our_team, score_opponent')
            .order('match_date', { ascending: false })
            .limit(10)
          
          if (matches && matches.length > 0) {
            if (yPos > pageHeight - 40) {
              doc.addPage()
              yPos = margin
            }
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Recent Matches:', margin, yPos)
            yPos += 7
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            matches.forEach((match: any) => {
              if (yPos > pageHeight - 20) {
                doc.addPage()
                yPos = margin
              }
              const score = match.score_our_team !== null && match.score_opponent !== null
                ? `${match.score_our_team} - ${match.score_opponent}`
                : 'TBD'
              doc.text(`• ${new Date(match.match_date).toLocaleDateString()} vs ${match.opponent} (${score})`, margin + 5, yPos)
              yPos += 6
            })
          }
        } catch (error) {
          console.error('Error fetching match data:', error)
        }
        break

      case 'training':
        doc.text('Training Attendance Report', margin, yPos)
        yPos += 7
        doc.text('This report contains training session attendance data including:', margin, yPos)
        yPos += 7
        doc.text('• Training session schedules', margin + 5, yPos)
        yPos += 6
        doc.text('• Player attendance records', margin + 5, yPos)
        yPos += 6
        doc.text('• Attendance trends and statistics', margin + 5, yPos)
        yPos += 10
        
        // Fetch and add training data if available
        try {
          const { data: sessions } = await supabaseAdmin
            .from('training_sessions')
            .select('id, session_date, location, description')
            .order('session_date', { ascending: false })
            .limit(10)
          
          if (sessions && sessions.length > 0) {
            if (yPos > pageHeight - 40) {
              doc.addPage()
              yPos = margin
            }
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Recent Training Sessions:', margin, yPos)
            yPos += 7
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            sessions.forEach((session: any) => {
              if (yPos > pageHeight - 20) {
                doc.addPage()
                yPos = margin
              }
              doc.text(`• ${new Date(session.session_date).toLocaleDateString()} - ${session.location || 'TBD'}`, margin + 5, yPos)
              yPos += 6
            })
          }
        } catch (error) {
          console.error('Error fetching training data:', error)
        }
        break

      case 'financial':
        doc.text('Financial Report', margin, yPos)
        yPos += 7
        doc.text('This report contains financial transactions and summaries including:', margin, yPos)
        yPos += 7
        doc.text('• Revenue and expense records', margin + 5, yPos)
        yPos += 6
        doc.text('• Budget allocations and status', margin + 5, yPos)
        yPos += 6
        doc.text('• Financial trends and summaries', margin + 5, yPos)
        yPos += 10
        
        // Fetch and add financial data if available
        try {
          const { data: transactions } = await supabaseAdmin
            .from('financial_transactions')
            .select('type, amount, transaction_date, description')
            .order('transaction_date', { ascending: false })
            .limit(10)
          
          if (transactions && transactions.length > 0) {
            if (yPos > pageHeight - 40) {
              doc.addPage()
              yPos = margin
            }
            const totalRevenue = transactions
              .filter((t: any) => t.type === 'revenue')
              .reduce((sum: number, t: any) => sum + parseFloat(t.amount.toString()), 0)
            const totalExpenses = transactions
              .filter((t: any) => t.type === 'expense')
              .reduce((sum: number, t: any) => sum + parseFloat(t.amount.toString()), 0)
            
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Financial Summary:', margin, yPos)
            yPos += 7
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            doc.text(`Total Revenue: $${totalRevenue.toFixed(2)}`, margin + 5, yPos)
            yPos += 6
            doc.text(`Total Expenses: $${totalExpenses.toFixed(2)}`, margin + 5, yPos)
            yPos += 6
            doc.text(`Net: $${(totalRevenue - totalExpenses).toFixed(2)}`, margin + 5, yPos)
          }
        } catch (error) {
          console.error('Error fetching financial data:', error)
        }
        break

      case 'summary':
        doc.text('Summary Report', margin, yPos)
        yPos += 7
        doc.text('This report contains overall club summary data including:', margin, yPos)
        yPos += 7
        doc.text('• Overall club statistics', margin + 5, yPos)
        yPos += 6
        doc.text('• Performance summaries across all areas', margin + 5, yPos)
        yPos += 6
        doc.text('• Key metrics and trends', margin + 5, yPos)
        break

      default:
        doc.text('General Report', margin, yPos)
    }
    
    // Add footer to all pages
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(128, 128, 128)
      doc.text(`Report ID: ${report.id}`, margin, pageHeight - 15)
      doc.text(`Status: ${report.status}`, margin, pageHeight - 10)
      doc.text('Generated by: Mongers Rugby Club Management System', pageWidth / 2, pageHeight - 5, { align: 'center' })
    }

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    // Return PDF as downloadable file
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: any) {
    console.error('Report download error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
