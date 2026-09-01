import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Lists past fixtures that already have a saved squad, so a coach can copy a
 * previous selection as the starting point for a new fixture.
 *
 * Response: { squads: [{ match_id, match_date, opponent, playerCount }] }
 * (most recent first)
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

    if (!profile || !['admin', 'coach', 'asst_coach', 'data_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Unauthorized: Coach/Admin access required' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Count players selected per match.
    const { data: selections } = await supabaseAdmin
      .from('fixture_team_selections')
      .select('match_id')

    const counts: Record<string, number> = {}
    for (const row of selections || []) {
      if (!row.match_id) continue
      counts[row.match_id] = (counts[row.match_id] || 0) + 1
    }
    const matchIds = Object.keys(counts)
    if (matchIds.length === 0) {
      return NextResponse.json({ squads: [] })
    }

    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select('id, match_date, opponent')
      .in('id', matchIds)

    const squads = (matches || [])
      .map((m: any) => ({
        match_id: m.id,
        match_date: m.match_date,
        opponent: m.opponent,
        playerCount: counts[m.id] || 0,
      }))
      .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())

    return NextResponse.json({ squads })
  } catch (error: any) {
    console.error('previous-squads error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
