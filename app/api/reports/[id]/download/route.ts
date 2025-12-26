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
    const doc = new jsPDF()
    
    let yPosition = 20
    const pageHeight = doc.internal.pageSize.height
    const margin = 20
    const lineHeight = 7
    const pageWidth = doc.internal.pageSize.width

    // Helper function to add new page if needed
    const checkPageBreak = (requiredSpace: number = lineHeight) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        doc.addPage()
        yPosition = margin
      }
    }

    // Add header
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    const titleWidth = doc.getTextWidth(report.title)
    doc.text(report.title, (pageWidth - titleWidth) / 2, yPosition)
    yPosition += lineHeight * 2

    // Add report metadata
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    checkPageBreak()
    doc.text(`Report Type: ${report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)}`, margin, yPosition)
    yPosition += lineHeight
    checkPageBreak()
    doc.text(`Generated: ${new Date(report.created_at).toLocaleString()}`, margin, yPosition)
    yPosition += lineHeight
    
    if (report.date_from && report.date_to) {
      checkPageBreak()
      doc.text(`Date Range: ${new Date(report.date_from).toLocaleDateString()} - ${new Date(report.date_to).toLocaleDateString()}`, margin, yPosition)
      yPosition += lineHeight
    }
    
    yPosition += lineHeight
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += lineHeight * 1.5

    // Add report-specific content based on type
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    checkPageBreak()
    doc.text('Report Summary', margin, yPosition)
    yPosition += lineHeight * 1.5
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')

    switch (report.report_type) {
      case 'player':
        checkPageBreak()
        doc.text('Player Performance Report', margin, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('This report contains player performance data including:', margin, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('• Match statistics (tries, tackles, minutes played)', margin + 10, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('• Training attendance records', margin + 10, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('• Overall performance metrics', margin + 10, yPosition)
        yPosition += lineHeight * 1.5
        
        // Fetch and add player data if available
        try {
          const { data: players } = await supabaseAdmin
            .from('user_profiles')
            .select('user_id, name, status')
            .eq('role', 'player')
            .limit(10)
          
          if (players && players.length > 0) {
            checkPageBreak(lineHeight * 2)
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Active Players:', margin, yPosition)
            yPosition += lineHeight
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            players.forEach((player: any) => {
              checkPageBreak()
              doc.text(`• ${player.name} (${player.status})`, margin + 10, yPosition)
              yPosition += lineHeight
            })
          }
        } catch (error) {
          console.error('Error fetching player data:', error)
        }
        break

      case 'match':
        checkPageBreak()
        doc.text('Match Statistics Report', margin, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('This report contains match statistics and results including:', margin, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('• Match results and scores', margin + 10, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('• Player performance in matches', margin + 10, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('• Team statistics and trends', margin + 10, yPosition)
        yPosition += lineHeight * 1.5
        
        // Fetch and add match data if available
        try {
          const { data: matches } = await supabaseAdmin
            .from('matches')
            .select('id, match_date, opponent, our_score, opponent_score')
            .order('match_date', { ascending: false })
            .limit(10)
          
          if (matches && matches.length > 0) {
            checkPageBreak(lineHeight * 2)
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Recent Matches:', margin, yPosition)
            yPosition += lineHeight
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            matches.forEach((match: any) => {
              const score = match.our_score !== null && match.opponent_score !== null
                ? `${match.our_score} - ${match.opponent_score}`
                : 'TBD'
              checkPageBreak()
              doc.text(`• ${new Date(match.match_date).toLocaleDateString()} vs ${match.opponent} (${score})`, margin + 10, yPosition)
              yPosition += lineHeight
            })
          }
        } catch (error) {
          console.error('Error fetching match data:', error)
        }
        break

      case 'training':
        checkPageBreak()
        doc.text('Training Attendance Report', margin, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('This report contains training session attendance data including:', margin, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('• Training session schedules', margin + 10, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('• Player attendance records', margin + 10, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('• Attendance trends and statistics', margin + 10, yPosition)
        yPosition += lineHeight * 1.5
        
        // Fetch and add training data if available
        try {
          const { data: sessions } = await supabaseAdmin
            .from('training_sessions')
            .select('id, session_date, location, description')
            .order('session_date', { ascending: false })
            .limit(10)
          
          if (sessions && sessions.length > 0) {
            checkPageBreak(lineHeight * 2)
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Recent Training Sessions:', margin, yPosition)
            yPosition += lineHeight
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            sessions.forEach((session: any) => {
              checkPageBreak()
              doc.text(`• ${new Date(session.session_date).toLocaleDateString()} - ${session.location || 'TBD'}`, margin + 10, yPosition)
              yPosition += lineHeight
            })
          }
        } catch (error) {
          console.error('Error fetching training data:', error)
        }
        break

      case 'financial':
        checkPageBreak()
        doc.text('Financial Report', margin, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('This report contains financial transactions and summaries including:', margin, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('• Revenue and expense records', margin + 10, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('• Budget allocations and status', margin + 10, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('• Financial trends and summaries', margin + 10, yPosition)
        yPosition += lineHeight * 1.5
        
        // Fetch and add financial data if available
        try {
          const { data: transactions } = await supabaseAdmin
            .from('financial_transactions')
            .select('type, amount, transaction_date, description')
            .order('transaction_date', { ascending: false })
            .limit(10)
          
          if (transactions && transactions.length > 0) {
            const totalRevenue = transactions
              .filter((t: any) => t.type === 'revenue')
              .reduce((sum: number, t: any) => sum + parseFloat(t.amount.toString()), 0)
            const totalExpenses = transactions
              .filter((t: any) => t.type === 'expense')
              .reduce((sum: number, t: any) => sum + parseFloat(t.amount.toString()), 0)
            
            checkPageBreak(lineHeight * 2)
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Financial Summary:', margin, yPosition)
            yPosition += lineHeight
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            checkPageBreak()
            doc.text(`Total Revenue: UGX ${totalRevenue.toLocaleString()}`, margin + 10, yPosition)
            yPosition += lineHeight
            checkPageBreak()
            doc.text(`Total Expenses: UGX ${totalExpenses.toLocaleString()}`, margin + 10, yPosition)
            yPosition += lineHeight
            checkPageBreak()
            doc.text(`Net: UGX ${(totalRevenue - totalExpenses).toLocaleString()}`, margin + 10, yPosition)
          }
        } catch (error) {
          console.error('Error fetching financial data:', error)
        }
        break

      case 'summary':
        checkPageBreak()
        doc.text('Summary Report', margin, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('This report contains overall club summary data including:', margin, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('• Overall club statistics', margin + 10, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('• Performance summaries across all areas', margin + 10, yPosition)
        yPosition += lineHeight
        checkPageBreak()
        doc.text('• Key metrics and trends', margin + 10, yPosition)
        break

      default:
        checkPageBreak()
        doc.text('General Report', margin, yPosition)
    }
    
    yPosition += lineHeight * 2
    checkPageBreak()
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += lineHeight * 1.5
    
    // Add footer
    doc.setFontSize(9)
    doc.setTextColor(128, 128, 128)
    checkPageBreak()
    doc.text(`Report ID: ${report.id}`, margin, yPosition)
    yPosition += lineHeight
    checkPageBreak()
    doc.text(`Status: ${report.status}`, margin, yPosition)
    yPosition += lineHeight
    checkPageBreak()
    const footerText = 'Generated by: Mongers Rugby Club Management System'
    const footerWidth = doc.getTextWidth(footerText)
    doc.text(footerText, (pageWidth - footerWidth) / 2, yPosition)

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
