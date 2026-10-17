import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Game-day team selection for one match, returned via the service role so a
// finance admin (whose RLS can't read fixture_team_selections joined to
// players) gets accurate starting / substitute counts instead of zeros.
export async function GET(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
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

    // Finance admin is the role that needs the bypass; admins can use it too.
    if (!profile || !['finance_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const admin = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: selections, error } = await admin
      .from('fixture_team_selections')
      .select('is_starting, is_substitute, player_id')
      .eq('match_id', params.matchId)

    if (error) {
      console.error('Error fetching match selection:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = selections || []
    const starting = rows.filter((s: any) => s.is_starting).length
    const substitutes = rows.filter((s: any) => s.is_substitute).length

    return NextResponse.json({
      starting,
      substitutes,
      total: rows.length,
    })
  } catch (error: any) {
    console.error('Error in GET match attendance:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch match selection' }, { status: 500 })
  }
}
