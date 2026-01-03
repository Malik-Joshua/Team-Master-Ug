import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// GET - Fetch player gym stats
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const playerId = params.id

    // Use service role to bypass RLS and get fresh data
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data, error } = await supabaseAdmin
      .from('players')
      .select('gym_stats')
      .eq('user_id', playerId)
      .single()

    if (error) {
      console.error('Error fetching gym stats:', error)
      return NextResponse.json(
        { error: `Failed to fetch gym stats: ${error.message}` },
        { status: 500 }
      )
    }

    const gymStats = data?.gym_stats || {}

    return NextResponse.json({
      benchPressPB: gymStats.bench_press_pb || gymStats.benchPressPB || null,
      squatPB: gymStats.squat_pb || gymStats.squatPB || null,
      deadliftPB: gymStats.deadlift_pb || gymStats.deadliftPB || null,
      pullUpPB: gymStats.pull_up_pb || gymStats.pullUpPB || null,
    })
  } catch (error: any) {
    console.error('Error in GET gym stats:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch gym stats' },
      { status: 500 }
    )
  }
}

// PATCH - Update player gym stats
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    if (!profile || !['admin', 'coach', 'data_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin/Coach/Data Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const playerId = params.id

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

    // Get current gym stats
    const { data: player, error: fetchError } = await supabaseAdmin
      .from('players')
      .select('gym_stats')
      .eq('user_id', playerId)
      .single()

    if (fetchError) {
      console.error('Error fetching current gym stats:', fetchError)
      return NextResponse.json(
        { error: `Failed to fetch current gym stats: ${fetchError.message}` },
        { status: 500 }
      )
    }

    const currentStats = player?.gym_stats || {}

    // Update gym stats
    const updatedStats = {
      ...currentStats,
      bench_press_pb: body.benchPressPB !== undefined ? body.benchPressPB : currentStats.bench_press_pb || currentStats.benchPressPB,
      squat_pb: body.squatPB !== undefined ? body.squatPB : currentStats.squat_pb || currentStats.squatPB,
      deadlift_pb: body.deadliftPB !== undefined ? body.deadliftPB : currentStats.deadlift_pb || currentStats.deadliftPB,
      pull_up_pb: body.pullUpPB !== undefined ? body.pullUpPB : currentStats.pull_up_pb || currentStats.pullUpPB,
    }

    const { data, error } = await supabaseAdmin
      .from('players')
      .update({ gym_stats: updatedStats })
      .eq('user_id', playerId)
      .select()

    if (error) {
      console.error('Error updating gym stats:', error)
      return NextResponse.json(
        { error: `Failed to update gym stats: ${error.message}` },
        { status: 500 }
      )
    }

    // Return the first (and should be only) updated record
    if (data && data.length > 0) {
      const gymStats = data[0].gym_stats || {}
      return NextResponse.json({
        success: true,
        gymStats: {
          benchPressPB: gymStats.bench_press_pb || gymStats.benchPressPB || null,
          squatPB: gymStats.squat_pb || gymStats.squatPB || null,
          deadliftPB: gymStats.deadlift_pb || gymStats.deadliftPB || null,
          pullUpPB: gymStats.pull_up_pb || gymStats.pullUpPB || null,
        }
      })
    }

    // If no data returned, fetch it to return
    const { data: fetchedData, error: refetchError } = await supabaseAdmin
      .from('players')
      .select('gym_stats')
      .eq('user_id', playerId)
      .single()

    if (refetchError) {
      console.error('Error refetching gym stats:', refetchError)
      return NextResponse.json(
        { error: `Failed to refetch gym stats: ${refetchError.message}` },
        { status: 500 }
      )
    }

    const gymStats = fetchedData?.gym_stats || {}
    return NextResponse.json({
      success: true,
      gymStats: {
        benchPressPB: gymStats.bench_press_pb || gymStats.benchPressPB || null,
        squatPB: gymStats.squat_pb || gymStats.squatPB || null,
        deadliftPB: gymStats.deadlift_pb || gymStats.deadliftPB || null,
        pullUpPB: gymStats.pull_up_pb || gymStats.pullUpPB || null,
      }
    })
  } catch (error: any) {
    console.error('Error updating gym stats:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update gym stats' },
      { status: 500 }
    )
  }
}
