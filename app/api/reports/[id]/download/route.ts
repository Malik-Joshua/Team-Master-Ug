import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import PDFDocument from 'pdfkit'
import { Readable } from 'stream'

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

    // Generate PDF
    const fileName = `${report.report_type}_report_${report.id.substring(0, 8)}.pdf`
    
    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    })

    // Collect PDF data
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))

    // Add header
    doc.fontSize(20).font('Helvetica-Bold').text(report.title, { align: 'center' })
    doc.moveDown(1)
    
    // Add report metadata
    doc.fontSize(12).font('Helvetica')
    doc.text(`Report Type: ${report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)}`, { align: 'left' })
    doc.text(`Generated: ${new Date(report.created_at).toLocaleString()}`, { align: 'left' })
    
    if (report.date_from && report.date_to) {
      doc.text(`Date Range: ${new Date(report.date_from).toLocaleDateString()} - ${new Date(report.date_to).toLocaleDateString()}`, { align: 'left' })
    }
    
    doc.moveDown(1)
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
    doc.moveDown(1)

    // Add report-specific content based on type
    doc.fontSize(14).font('Helvetica-Bold').text('Report Summary', { align: 'left' })
    doc.moveDown(0.5)
    doc.fontSize(11).font('Helvetica')

    switch (report.report_type) {
      case 'player':
        doc.text('Player Performance Report', { align: 'left' })
        doc.moveDown(0.5)
        doc.text('This report contains player performance data including:', { align: 'left' })
        doc.text('• Match statistics (tries, tackles, minutes played)', { align: 'left', indent: 20 })
        doc.text('• Training attendance records', { align: 'left', indent: 20 })
        doc.text('• Overall performance metrics', { align: 'left', indent: 20 })
        doc.moveDown(1)
        
        // Fetch and add player data if available
        try {
          const { data: players } = await supabaseAdmin
            .from('user_profiles')
            .select('user_id, name, status')
            .eq('role', 'player')
            .limit(10)
          
          if (players && players.length > 0) {
            doc.fontSize(12).font('Helvetica-Bold').text('Active Players:', { align: 'left' })
            doc.moveDown(0.3)
            doc.fontSize(10).font('Helvetica')
            players.forEach((player: any) => {
              doc.text(`• ${player.name} (${player.status})`, { align: 'left', indent: 20 })
            })
          }
        } catch (error) {
          console.error('Error fetching player data:', error)
        }
        break

      case 'match':
        doc.text('Match Statistics Report', { align: 'left' })
        doc.moveDown(0.5)
        doc.text('This report contains match statistics and results including:', { align: 'left' })
        doc.text('• Match results and scores', { align: 'left', indent: 20 })
        doc.text('• Player performance in matches', { align: 'left', indent: 20 })
        doc.text('• Team statistics and trends', { align: 'left', indent: 20 })
        doc.moveDown(1)
        
        // Fetch and add match data if available
        try {
          const { data: matches } = await supabaseAdmin
            .from('matches')
            .select('id, match_date, opponent, our_score, opponent_score')
            .order('match_date', { ascending: false })
            .limit(10)
          
          if (matches && matches.length > 0) {
            doc.fontSize(12).font('Helvetica-Bold').text('Recent Matches:', { align: 'left' })
            doc.moveDown(0.3)
            doc.fontSize(10).font('Helvetica')
            matches.forEach((match: any) => {
              const score = match.our_score !== null && match.opponent_score !== null
                ? `${match.our_score} - ${match.opponent_score}`
                : 'TBD'
              doc.text(`• ${new Date(match.match_date).toLocaleDateString()} vs ${match.opponent} (${score})`, { align: 'left', indent: 20 })
            })
          }
        } catch (error) {
          console.error('Error fetching match data:', error)
        }
        break

      case 'training':
        doc.text('Training Attendance Report', { align: 'left' })
        doc.moveDown(0.5)
        doc.text('This report contains training session attendance data including:', { align: 'left' })
        doc.text('• Training session schedules', { align: 'left', indent: 20 })
        doc.text('• Player attendance records', { align: 'left', indent: 20 })
        doc.text('• Attendance trends and statistics', { align: 'left', indent: 20 })
        doc.moveDown(1)
        
        // Fetch and add training data if available
        try {
          const { data: sessions } = await supabaseAdmin
            .from('training_sessions')
            .select('id, session_date, location, description')
            .order('session_date', { ascending: false })
            .limit(10)
          
          if (sessions && sessions.length > 0) {
            doc.fontSize(12).font('Helvetica-Bold').text('Recent Training Sessions:', { align: 'left' })
            doc.moveDown(0.3)
            doc.fontSize(10).font('Helvetica')
            sessions.forEach((session: any) => {
              doc.text(`• ${new Date(session.session_date).toLocaleDateString()} - ${session.location || 'TBD'}`, { align: 'left', indent: 20 })
            })
          }
        } catch (error) {
          console.error('Error fetching training data:', error)
        }
        break

      case 'financial':
        doc.text('Financial Report', { align: 'left' })
        doc.moveDown(0.5)
        doc.text('This report contains financial transactions and summaries including:', { align: 'left' })
        doc.text('• Revenue and expense records', { align: 'left', indent: 20 })
        doc.text('• Budget allocations and status', { align: 'left', indent: 20 })
        doc.text('• Financial trends and summaries', { align: 'left', indent: 20 })
        doc.moveDown(1)
        
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
            
            doc.fontSize(12).font('Helvetica-Bold').text('Financial Summary:', { align: 'left' })
            doc.moveDown(0.3)
            doc.fontSize(10).font('Helvetica')
            doc.text(`Total Revenue: $${totalRevenue.toFixed(2)}`, { align: 'left', indent: 20 })
            doc.text(`Total Expenses: $${totalExpenses.toFixed(2)}`, { align: 'left', indent: 20 })
            doc.text(`Net: $${(totalRevenue - totalExpenses).toFixed(2)}`, { align: 'left', indent: 20 })
          }
        } catch (error) {
          console.error('Error fetching financial data:', error)
        }
        break

      case 'summary':
        doc.text('Summary Report', { align: 'left' })
        doc.moveDown(0.5)
        doc.text('This report contains overall club summary data including:', { align: 'left' })
        doc.text('• Overall club statistics', { align: 'left', indent: 20 })
        doc.text('• Performance summaries across all areas', { align: 'left', indent: 20 })
        doc.text('• Key metrics and trends', { align: 'left', indent: 20 })
        break

      default:
        doc.text('General Report', { align: 'left' })
    }
    
    doc.moveDown(2)
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
    doc.moveDown(1)
    
    // Add footer
    doc.fontSize(9).font('Helvetica').fillColor('gray')
    doc.text(`Report ID: ${report.id}`, { align: 'left' })
    doc.text(`Status: ${report.status}`, { align: 'left' })
    doc.text(`Generated by: Mongers Rugby Club Management System`, { align: 'center' })

    // Finalize PDF and wait for completion
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
      doc.on('error', (error) => {
        reject(error)
      })
      doc.end()
    })

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

