import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Head Coach and Assistant Coach share the same dashboard and the same
 * permissions (team selection, match-day attendance). To make sure the two
 * never make conflicting entries for the same fixture, whenever ONE of them
 * records something, the OTHER gets notified with a link straight to what
 * was recorded.
 *
 * This is intentionally symmetric — it doesn't matter whether the actor is
 * 'coach' or 'asst_coach', the notification always goes to every OTHER user
 * holding either of those two roles (never back to the actor themselves).
 */

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials missing')
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export type CoachEntryKind = 'team_selection' | 'match_attendance'

export interface NotifyOtherCoachesParams {
  actorUserId: string
  matchId: string
  opponent?: string | null
  matchDate?: string | null
  kind: CoachEntryKind
}

const COACH_ROLES = ['coach', 'asst_coach']

/**
 * Notifies every coach/asst_coach EXCEPT the one who made the entry.
 * Never throws — a notification failure should never fail the save that
 * triggered it.
 */
export async function notifyOtherCoaches(params: NotifyOtherCoachesParams): Promise<{ sent: number }> {
  try {
    const admin = adminClient()

    const { data: coaches } = await admin
      .from('user_profiles')
      .select('user_id, name')
      .in('role', COACH_ROLES)
      .neq('user_id', params.actorUserId)

    if (!coaches || coaches.length === 0) return { sent: 0 }

    const { data: actor } = await admin
      .from('user_profiles')
      .select('name')
      .eq('user_id', params.actorUserId)
      .single()

    const actorName = actor?.name || 'The other coach'
    const opponent = params.opponent || 'the fixture'
    const dateLabel = params.matchDate ? new Date(params.matchDate).toLocaleDateString() : ''
    const when = dateLabel ? ` on ${dateLabel}` : ''

    const copy =
      params.kind === 'team_selection'
        ? {
            title: '📋 Team selection recorded',
            message: `${actorName} just saved the squad for the match vs ${opponent}${when}. Check it before making your own changes so you don't overwrite each other.`,
          }
        : {
            title: '✅ Match-day attendance recorded',
            message: `${actorName} just recorded staff attendance for the match vs ${opponent}${when}.`,
          }

    const rows = coaches.map((c: any) => ({
      user_id: c.user_id,
      title: copy.title,
      message: copy.message,
      type: 'info',
      reference_id: params.matchId,
      reference_type: 'coach_entry',
      action_url: '/fixtures',
    }))

    const { error } = await admin.from('notifications').insert(rows)
    if (error) {
      console.warn('[notify-coaches] insert failed:', error.message)
      return { sent: 0 }
    }
    return { sent: rows.length }
  } catch (err) {
    console.warn('[notify-coaches] unexpected error:', err)
    return { sent: 0 }
  }
}
