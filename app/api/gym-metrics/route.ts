import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// GET — return gym metrics for every player (coaches / managers / admins only)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || !['admin', 'coach', 'asst_coach', 'data_admin', 'finance_admin', 'data_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Join players + user_profiles to get name alongside gym_stats
    const { data: players, error } = await supabaseAdmin
      .from('players')
      .select('user_id, gym_stats, gym_stats_updated_at, position, jersey_number, user_profiles!inner(name)')
      .order('gym_stats_updated_at', { ascending: false, nullsFirst: false })

    if (error) {
      console.error('Error fetching squad gym metrics:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const metrics = (players ?? []).map((p: any) => {
      const gs = p.gym_stats || {}
      return {
        user_id:            p.user_id,
        name:               p.user_profiles?.name ?? 'Unknown',
        position:           p.position ?? null,
        jersey_number:      p.jersey_number ?? null,
        pull_up_pb:         gs.pull_up_pb    ?? gs.pullUpPB    ?? null,
        bench_press_pb:     gs.bench_press_pb ?? gs.benchPressPB ?? null,
        deadlift_pb:        gs.deadlift_pb   ?? gs.deadliftPB  ?? null,
        squat_pb:           gs.squat_pb      ?? gs.squatPB     ?? null,
        gym_stats_updated_at: p.gym_stats_updated_at ?? null,
      }
    })

    return NextResponse.json({ metrics })
  } catch (error: any) {
    console.error('Error in GET gym-metrics:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch gym metrics' }, { status: 500 })
  }
}
