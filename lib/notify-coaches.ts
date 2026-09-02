import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Head Coach and Assistant Coach share the same dashboard and the same
 * permissions (training sessions, team selection, match-day attendance). To
 * stop the two silently overwriting or contradicting each other, every
 * notable coaching action does two things:
 *
 *   1. NOTIFY the other coach(es) — a dashboard/bell alert, so they know
 *      immediately that something changed.
 *   2. RECORD a `coach_activities` feed entry — so the action becomes
 *      something they can actually discuss: like, object to, comment on and
 *      reply to (see migration 051 and /app/collaboration).
 *
 * Both are symmetric: it doesn't matter whether the actor is 'coach' or
 * 'asst_coach', the notification always goes to every OTHER holder of either
 * role (never back to the actor).
 *
 * Nothing here throws — a failure to announce must never fail the save that
 * triggered it.
 */

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials missing')
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export type CoachEntryKind = 'team_selection' | 'match_attendance' | 'training_session'

export interface NotifyOtherCoachesParams {
  actorUserId: string
  /** The match id, or the training session id for 'training_session'. */
  matchId: string
  opponent?: string | null
  matchDate?: string | null
  kind: CoachEntryKind
  /** Optional override for the feed entry's headline (defaults per kind). */
  title?: string
}

const COACH_ROLES = ['coach', 'asst_coach']

export async function notifyOtherCoaches(params: NotifyOtherCoachesParams): Promise<{ sent: number }> {
  try {
    const admin = adminClient()

    const { data: actor } = await admin
      .from('user_profiles')
      .select('name')
      .eq('user_id', params.actorUserId)
      .single()

    const actorName = actor?.name || 'The other coach'
    const subject = params.opponent || (params.kind === 'training_session' ? 'a training session' : 'the fixture')
    const dateLabel = params.matchDate ? new Date(params.matchDate).toLocaleDateString() : ''
    const when = dateLabel ? ` on ${dateLabel}` : ''

    const copy =
      params.kind === 'team_selection'
        ? {
            title: '📋 Team selection recorded',
            message: `${actorName} just saved the squad for the match vs ${subject}${when}. Check it before making your own changes so you don't overwrite each other.`,
            feedTitle: `Squad selected — vs ${subject}`,
          }
        : params.kind === 'match_attendance'
        ? {
            title: '✅ Match-day attendance recorded',
            message: `${actorName} just recorded staff attendance for the match vs ${subject}${when}.`,
            feedTitle: `Match-day attendance — vs ${subject}`,
          }
        : {
            title: '🏃 Training session created',
            message: `${actorName} just scheduled ${subject}${when}. Take a look and flag anything you'd change.`,
            feedTitle: `Training session — ${subject}`,
          }

    // ── 1. Record the activity so it can be discussed. Upsert on
    //       (kind, reference_id) so re-saving the same squad refreshes the
    //       existing feed entry rather than spamming duplicates — and any
    //       comments already attached to it survive.
    try {
      await admin
        .from('coach_activities')
        .upsert(
          {
            actor_id: params.actorUserId,
            kind: params.kind,
            reference_id: params.matchId,
            title: params.title || copy.feedTitle,
            summary: `${actorName}${when ? ` · ${dateLabel}` : ''}`,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'kind,reference_id' }
        )
    } catch (feedErr) {
      // Most likely cause: migration 051 hasn't been applied yet. The
      // notification below still works, so this stays non-fatal.
      console.warn('[notify-coaches] activity feed write skipped:', feedErr)
    }

    // ── 2. Notify every OTHER coach / assistant coach.
    const { data: coaches } = await admin
      .from('user_profiles')
      .select('user_id, name')
      .in('role', COACH_ROLES)
      .neq('user_id', params.actorUserId)

    if (!coaches || coaches.length === 0) return { sent: 0 }

    const rows = coaches.map((c: any) => ({
      user_id: c.user_id,
      title: copy.title,
      message: copy.message,
      type: 'info',
      reference_id: params.matchId,
      reference_type: 'coach_entry',
      action_url: '/collaboration',
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
