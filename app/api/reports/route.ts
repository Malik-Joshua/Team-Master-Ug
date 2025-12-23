import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// GET: Fetch all reports
export async function GET(request: NextRequest) {
  try {
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

    // Get reports - users can see their own reports, admins can see all
    let query = supabaseAdmin
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (profile.role !== 'admin' && profile.role !== 'data_admin' && profile.role !== 'finance_admin') {
      // Non-admins can only see their own reports
      query = query.eq('generated_by', authUser.id)
    }

    const { data: reports, error } = await query

    if (error) {
      console.error('Error fetching reports:', error)
      return NextResponse.json(
        { error: `Failed to fetch reports: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      reports: reports || [],
      count: reports?.length || 0,
    })
  } catch (error: any) {
    console.error('Reports API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST: Generate a new report
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { report_type, title, date_from, date_to } = body

    if (!report_type) {
      return NextResponse.json(
        { error: 'Report type is required' },
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
      .select('role, name')
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

    // Generate report title if not provided
    const reportTitle = title || `${report_type.charAt(0).toUpperCase() + report_type.slice(1)} Report - ${new Date().toLocaleDateString()}`

    // Create report record
    const { data: newReport, error: insertError } = await supabaseAdmin
      .from('reports')
      .insert({
        title: reportTitle,
        report_type: report_type,
        date_from: date_from || null,
        date_to: date_to || null,
        generated_by: authUser.id,
        status: 'generating',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating report:', insertError)
      return NextResponse.json(
        { error: `Failed to create report: ${insertError.message}` },
        { status: 500 }
      )
    }

    // In a real implementation, you would trigger a background job here to generate the actual report
    // For now, we'll simulate it by updating the status after a delay
    // In production, you'd use a queue system or background worker

    // Simulate report generation completion (update status to ready after a short delay)
    setTimeout(async () => {
      try {
        await supabaseAdmin
          .from('reports')
          .update({ status: 'ready' })
          .eq('id', newReport.id)
      } catch (error) {
        console.error('Error updating report status:', error)
      }
    }, 2000)

    return NextResponse.json({
      success: true,
      report: newReport,
      message: 'Report generation started',
    })
  } catch (error: any) {
    console.error('Reports API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

