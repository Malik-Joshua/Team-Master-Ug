import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/match-stats/notify-cards
 *
 * Called after the manager saves match statistics that include a red or
 * yellow card. Fires a notification to:
 *   - the carded player themselves
 *   - the club owner / admins   (role = 'admin')
 *   - the head coach / coaches  (role = 'coach')
 *   - the team manager(s)       (role = 'data_admin')
 *
 * body: {
 *   matchId: string,
 *   cards: Array<{ player_id: string, yellow_card: boolean, red_card: boolean }>
 * }
 *
 * Only staff roles that already exist in the club receive the alert (empty
 * roles are simply skipped). Duplicate delivery is avoided if the caller
 * happens to also be a staff member and the same person receives it once.
 */

const STAFF_ROLES = ['admin', 'coach', 'data_admin']

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Only staff can trigger these alerts (i.e. the ones actually saving stats).
    const { data: caller } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()
    if (!caller || !STAFF_ROLES.includes(caller.role)) {
      return NextResponse.json({ error: 'Only staff can send card alerts' }, { status: 403 })
    }

    const body = await request.json()
    const matchId = String(body.matchId || '')
    const cards: Array<{ player_id: string; yellow_card: boolean; red_card: boolean }>
      = Array.isArray(body.cards) ? body.cards : []
    if (!matchId || cards.length === 0) {
      return NextResponse.json({ error: 'matchId and cards[] are required' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'Service credentials missing' }, { status: 500 })
    const admin = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

    // Fetch the match (for the notification copy) and all staff to notify.
    const [{ data: match }, { data: staff }, { data: playerRows }] = await Promise.all([
      admin.from('matches')
        .select('id, opponent, match_date')
        .eq('id', matchId)
        .single(),
      admin.from('user_profiles')
        .select('user_id, role')
        .in('role', STAFF_ROLES),
      admin.from('user_profiles')
        .select('user_id, name')
        .in('user_id', cards.map((c) => c.player_id)),
    ])

    const nameById: Record<string, string> = {}
    for (const p of playerRows || []) nameById[p.user_id] = p.name || 'A player'
    const opponent = match?.opponent || 'the opponent'
    const dateLabel = match?.match_date
      ? new Date(match.match_date).toLocaleDateString()
      : ''

    const rows: any[] = []
    for (const c of cards) {
      const which = c.red_card ? 'red' : c.yellow_card ? 'yellow' : null
      if (!which) continue
      const playerName = nameById[c.player_id] || 'A player'
      const emoji = which === 'red' ? '🟥' : '🟨'
      const type = which === 'red' ? 'error' : 'warning'

      // Notification to the player themselves — first-person tone.
      rows.push({
        user_id: c.player_id,
        title: `${emoji} You received a ${which} card`,
        message: `You were shown a ${which} card during the match vs ${opponent}${dateLabel ? ` on ${dateLabel}` : ''}.`,
        type,
        reference_id: matchId,
        reference_type: 'match_card',
        action_url: '/matches',
      })

      // One notification per staff member for this carded player.
      for (const s of staff || []) {
        // Skip the player if they happen to also be a staff member (avoid double-hit)
        if (s.user_id === c.player_id) continue
        rows.push({
          user_id: s.user_id,
          title: `${emoji} ${playerName} — ${which} card`,
          message: `${playerName} was shown a ${which} card in the match vs ${opponent}${dateLabel ? ` on ${dateLabel}` : ''}.`,
          type,
          reference_id: matchId,
          reference_type: 'match_card',
          action_url: '/matches',
        })
      }
    }

    if (rows.length === 0) return NextResponse.json({ success: true, sent: 0 })

    const { error: insErr } = await admin.from('notifications').insert(rows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    return NextResponse.json({ success: true, sent: rows.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to send card notifications' }, { status: 500 })
  }
}
