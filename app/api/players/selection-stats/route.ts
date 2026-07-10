import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Per-player stats used to help a coach judge selection fitness for a fixture.
 * Aggregates real data from training attendance and match stats. Returns a map
 * keyed by player user_id. When a club has little/no data yet, values come back
 * as 0 / null and the UI shows a graceful "no data yet" state.
 *
 * Response shape:
 *   { stats: { [userId]: { attendanceRate: number|null, sessions: number,
 *                          present: number, caps: number } } }
 */
export async function GET(_request: NextRequest) {
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

    if (!profile || !['admin', 'coach', 'data_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Coach/Admin access required' },
        { status: 403 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const stats: Record<string, { attendanceRate: number | null; sessions: number; present: number; caps: number }> = {}
    const ensure = (id: string) => {
      if (!stats[id]) stats[id] = { attendanceRate: null, sessions: 0, present: 0, caps: 0 }
      return stats[id]
    }

    // --- Training attendance → attendance rate ---
    // Counts 'P' (present) against total records where a status was recorded.
    const { data: attendance } = await supabaseAdmin
      .from('training_attendance')
      .select('player_id, attendance_status')

    for (const row of attendance || []) {
      if (!row.player_id) continue
      const s = ensure(row.player_id)
      s.sessions += 1
      if (String(row.attendance_status).toUpperCase() === 'P') s.present += 1
    }
    for (const id of Object.keys(stats)) {
      const s = stats[id]
      s.attendanceRate = s.sessions > 0 ? Math.round((s.present / s.sessions) * 100) : null
    }

    // --- Match stats → caps (distinct matches a player has stats for) ---
    const { data: matchStats } = await supabaseAdmin
      .from('match_stats')
      .select('player_id, match_id')

    const capsSets: Record<string, Set<string>> = {}
    for (const row of matchStats || []) {
      if (!row.player_id) continue
      if (!capsSets[row.player_id]) capsSets[row.player_id] = new Set()
      if (row.match_id) capsSets[row.player_id].add(row.match_id)
    }
    for (const [id, set] of Object.entries(capsSets)) {
      ensure(id).caps = set.size
    }

    return NextResponse.json({ stats })
  } catch (error: any) {
    console.error('selection-stats error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
