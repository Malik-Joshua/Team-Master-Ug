import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notifyOtherCoaches, type CoachEntryKind } from '@/lib/notify-coaches'

export const dynamic = 'force-dynamic'

/**
 * POST /api/match-stats/notify-coach-entry
 *
 * Thin server-side wrapper around notifyOtherCoaches() for callers that run
 * client-side (the fixtures page's match-day attendance save uses the
 * browser Supabase client, so it can't reach the service-role notify helper
 * directly). Currently only match-day attendance uses this path — team
 * selection notifies inline from within its own API route since that one
 * already runs server-side.
 *
 * body: { matchId: string, kind: 'match_attendance' }
 */
export async function POST(request: NextRequest) {
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
    if (!profile || !['coach', 'asst_coach'].includes(profile.role)) {
      // Non-coach callers (admin/data_admin saving stats) have no "other
      // coach" relationship to notify about — silently succeed.
      return NextResponse.json({ success: true, sent: 0 })
    }

    const body = await request.json()
    const matchId = String(body.matchId || '')
    const kind = body.kind as CoachEntryKind
    if (!matchId || !['team_selection', 'match_attendance'].includes(kind)) {
      return NextResponse.json({ error: 'matchId and a valid kind are required' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'Service credentials missing' }, { status: 500 })
    const admin = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: match } = await admin
      .from('matches')
      .select('opponent, match_date')
      .eq('id', matchId)
      .single()

    const result = await notifyOtherCoaches({
      actorUserId: authUser.id,
      matchId,
      opponent: match?.opponent,
      matchDate: match?.match_date,
      kind,
    })

    return NextResponse.json({ success: true, sent: result.sent })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to notify other coaches' }, { status: 500 })
  }
}
