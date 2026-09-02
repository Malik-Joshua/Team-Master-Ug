import { NextRequest, NextResponse } from 'next/server'
import { adminClient, requireCoachStaff } from '@/lib/collaboration'

export const dynamic = 'force-dynamic'

/**
 * POST /api/collaboration/reactions   { activityId, kind: 'like' | 'object' }
 *
 * Quick 👍 / 🚩 on a coaching activity, for when a full comment is overkill.
 * Toggling semantics, driven by the UNIQUE(activity_id, user_id) constraint:
 *   - no reaction yet        → adds it
 *   - same reaction again    → removes it (un-react)
 *   - the other reaction     → switches it
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCoachStaff(['coach', 'asst_coach', 'admin'])
    if ('error' in auth) return auth.error

    const { activityId, kind } = await request.json()
    if (!activityId || !['like', 'object'].includes(kind)) {
      return NextResponse.json({ error: "activityId and kind ('like' | 'object') are required" }, { status: 400 })
    }

    const admin = adminClient()
    const { data: existing } = await admin
      .from('activity_reactions')
      .select('id, kind')
      .eq('activity_id', activityId)
      .eq('user_id', auth.userId)
      .maybeSingle()

    let action: 'added' | 'removed' | 'switched'
    if (!existing) {
      const { error } = await admin
        .from('activity_reactions')
        .insert({ activity_id: activityId, user_id: auth.userId, kind })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      action = 'added'
    } else if (existing.kind === kind) {
      const { error } = await admin.from('activity_reactions').delete().eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      action = 'removed'
    } else {
      const { error } = await admin.from('activity_reactions').update({ kind }).eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      action = 'switched'
    }

    // An objection is a real signal the author should see immediately;
    // a plain like doesn't need to interrupt anyone.
    if (kind === 'object' && action !== 'removed') {
      try {
        const { data: activity } = await admin
          .from('coach_activities')
          .select('actor_id, title')
          .eq('id', activityId)
          .single()
        if (activity?.actor_id && activity.actor_id !== auth.userId) {
          await admin.from('notifications').insert({
            user_id: activity.actor_id,
            title: `🚩 ${auth.name} flagged a concern`,
            message: `${auth.name} objected to "${activity.title}". Open the collaboration feed to see why.`,
            type: 'warning',
            reference_id: activityId,
            reference_type: 'coach_entry',
            action_url: '/collaboration',
          })
        }
      } catch (notifyErr) {
        console.warn('[collaboration/reactions] notify skipped:', notifyErr)
      }
    }

    return NextResponse.json({ success: true, action })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to react' }, { status: 500 })
  }
}
