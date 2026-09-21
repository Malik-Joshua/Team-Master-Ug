import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// POST - Bulk upload gym metrics from CSV/Excel
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user profile to verify admin/coach role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || !['coach', 'asst_coach', 'data_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Coach/Data Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { metrics, session_id, file_name, storage_path, rows } = body

    console.log('Bulk upload request received:', { metricsCount: metrics?.length, metrics })

    if (!Array.isArray(metrics) || metrics.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: metrics array is required' },
        { status: 400 }
      )
    }

    // Use service role to bypass RLS for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY environment variable' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    let uploaded = 0
    let errors: string[] = []

    for (const metric of metrics) {
      try {
        // Names live in user_profiles (role = 'player'), not in the players table.
        // Do a case-insensitive partial match so "Allan Karuhanga" finds the record
        // even if the CSV has slight casing differences.
        const { data: profiles, error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .select('user_id')
          .eq('role', 'player')
          .ilike('name', `%${metric.player_name}%`)
          .limit(1)

        const profile = profiles?.[0] ?? null

        if (profileError || !profile) {
          errors.push(`Player not found: ${metric.player_name}`)
          continue
        }

        // Fetch current gym_stats from the players table
        const { data: playerRow } = await supabaseAdmin
          .from('players')
          .select('gym_stats')
          .eq('user_id', profile.user_id)
          .limit(1)
          .single()

        const currentStats = playerRow?.gym_stats || {}

        const updatedStats = {
          ...currentStats,
          pull_up_pb:     metric.pull_up_pb     !== null ? metric.pull_up_pb     : (currentStats.pull_up_pb     ?? currentStats.pullUpPB     ?? null),
          bench_press_pb: metric.bench_press_pb !== null ? metric.bench_press_pb : (currentStats.bench_press_pb ?? currentStats.benchPressPB ?? null),
          deadlift_pb:    metric.deadlift_pb    !== null ? metric.deadlift_pb    : (currentStats.deadlift_pb    ?? currentStats.deadliftPB    ?? null),
          squat_pb:       metric.squat_pb       !== null ? metric.squat_pb       : (currentStats.squat_pb       ?? currentStats.squatPB       ?? null),
        }

        const { error: updateError } = await supabaseAdmin
          .from('players')
          .update({ gym_stats: updatedStats, gym_stats_updated_at: new Date().toISOString() })
          .eq('user_id', profile.user_id)

        if (updateError) {
          errors.push(`Failed to update ${metric.player_name}: ${updateError.message}`)
          continue
        }

        uploaded++
      } catch (error: any) {
        errors.push(`Error processing ${metric.player_name}: ${error.message}`)
      }
    }

    // Always record the file if a name was provided (storage_path may be null
    // if the Storage bucket isn't set up yet — that's fine, the record still
    // lets the UI mark the session as "metrics recorded").
    if (file_name) {
      const baseRecord = {
        session_id: session_id || null,
        file_name,
        storage_path: storage_path || null,
        uploaded_by: authUser.id,
        metrics_captured: uploaded,
        metrics_total: metrics.length,
      }
      // Try with rows first; fall back without it if migration 057 is pending.
      let fileRecordError = (await supabaseAdmin.from('gym_metric_files').insert({
        ...baseRecord,
        rows: Array.isArray(rows) ? rows.slice(0, 300) : null,
      })).error
      if (
        fileRecordError &&
        (fileRecordError.code === 'PGRST204' || fileRecordError.message.includes("'rows' column"))
      ) {
        fileRecordError = (await supabaseAdmin.from('gym_metric_files').insert(baseRecord)).error
      }
      if (fileRecordError) {
        console.warn('Could not record file in gym_metric_files:', fileRecordError.message)
      }
    }

    return NextResponse.json({
      success: true,
      uploaded,
      total: metrics.length,
      session_id: session_id || null,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: any) {
    console.error('Error in bulk upload gym metrics:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to bulk upload gym metrics' },
      { status: 500 }
    )
  }
}
