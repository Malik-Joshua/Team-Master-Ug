import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

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

    // Generate report content based on type
    let reportContent = ''
    let fileName = `${report.report_type}_report_${report.id.substring(0, 8)}.txt`
    
    // Build report content
    reportContent += `REPORT: ${report.title}\n`
    reportContent += `Type: ${report.report_type}\n`
    reportContent += `Generated: ${new Date(report.created_at).toLocaleString()}\n`
    
    if (report.date_from && report.date_to) {
      reportContent += `Date Range: ${new Date(report.date_from).toLocaleDateString()} - ${new Date(report.date_to).toLocaleDateString()}\n`
    }
    
    reportContent += `\n${'='.repeat(50)}\n\n`
    
    // Add report-specific content based on type
    switch (report.report_type) {
      case 'player':
        reportContent += 'Player Performance Report\n'
        reportContent += 'This report contains player performance data.\n'
        reportContent += 'Note: Detailed player statistics would be generated here.\n'
        break
      case 'match':
        reportContent += 'Match Statistics Report\n'
        reportContent += 'This report contains match statistics and results.\n'
        reportContent += 'Note: Detailed match data would be generated here.\n'
        break
      case 'training':
        reportContent += 'Training Attendance Report\n'
        reportContent += 'This report contains training session attendance data.\n'
        reportContent += 'Note: Detailed attendance records would be generated here.\n'
        break
      case 'financial':
        reportContent += 'Financial Report\n'
        reportContent += 'This report contains financial transactions and summaries.\n'
        reportContent += 'Note: Detailed financial data would be generated here.\n'
        break
      case 'summary':
        reportContent += 'Summary Report\n'
        reportContent += 'This report contains overall club summary data.\n'
        reportContent += 'Note: Detailed summary statistics would be generated here.\n'
        break
      default:
        reportContent += 'General Report\n'
    }
    
    reportContent += `\n${'='.repeat(50)}\n`
    reportContent += `\nReport ID: ${report.id}\n`
    reportContent += `Status: ${report.status}\n`

    // Return as downloadable file
    return new NextResponse(reportContent, {
      headers: {
        'Content-Type': 'text/plain',
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

