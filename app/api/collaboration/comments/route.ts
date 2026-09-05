import { NextRequest, NextResponse } from 'next/server'
import { adminClient, requireCoachStaff } from '@/lib/collaboration'

export const dynamic = 'force-dynamic'

const AUTHOR_ROLES = ['coach', 'asst_coach']

/**
 * Comments (and threaded replies) on a coaching activity.
 *
 *   POST   { activityId, body, stance?, parentId? }  → add a comment/reply
 *   PATCH  { id, body, stance? }                     → edit your own comment
 *   DELETE ?id=…                                     → delete your own comment
 *
 * `stance` is what makes this more than a chat box: 'object' lets a coach
 * formally flag disagreement with a squad/session so the UI can surface it,
 * rather than the objection getting lost in prose.
 */

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCoachStaff(AUTHOR_ROLES)
    if ('error' in auth) return auth.error

    const { activityId, body, stance, parentId } = await request.json()
    if (!activityId || !String(body || '').trim()) {
      return NextResponse.json({ error: 'activityId and a non-empty body are required' }, { status: 400 })
    }
    if (stance && !['comment', 'support', 'object'].includes(stance)) {
      return NextResponse.json({ error: 'Invalid stance' }, { status: 400 })
    }

    const admin = adminClient()
    const { data: comment, error } = await admin
      .from('activity_comments')
      .insert({
        activity_id: activityId,
        author_id: auth.userId,
        parent_id: parentId || null,
        body: String(body).trim(),
        stance: stance || 'comment',
      })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Tell everyone else already involved in this thread — the activity's
    // author plus anyone who has commented on it — but never the person who
    // just wrote it.
    try {
      const [{ data: activity }, { data: participants }] = await Promise.all([
        admin.from('coach_activities').select('actor_id, title').eq('id', activityId).single(),
        admin.from('activity_comments').select('author_id').eq('activity_id', activityId),
      ])
      const ids = new Set<string>()
      if (activity?.actor_id) ids.add(activity.actor_id)
      for (const p of participants || []) ids.add(p.author_id)
      ids.delete(auth.userId)

      if (ids.size > 0) {
        const verb = (stance === 'object') ? 'objected to' : (stance === 'support') ? 'backed' : parentId ? 'replied on' : 'commented on'
        const emoji = (stance === 'object') ? '🚩' : (stance === 'support') ? '👍' : '💬'
        await admin.from('notifications').insert(
          Array.from(ids).map((uid) => ({
            user_id: uid,
            title: `${emoji} ${auth.name} ${verb} your work`,
            message: `${auth.name} ${verb} "${activity?.title || 'a coaching activity'}": ${String(body).trim().slice(0, 120)}`,
            type: stance === 'object' ? 'warning' : 'info',
            reference_id: activityId,
            reference_type: 'coach_entry',
            action_url: '/collaboration',
          }))
        )
      }
    } catch (notifyErr) {
      console.warn('[collaboration/comments] notify skipped:', notifyErr)
    }

    return NextResponse.json({ comment }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to add comment' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireCoachStaff(AUTHOR_ROLES)
    if ('error' in auth) return auth.error
    const { id, body, stance } = await request.json()
    if (!id || !String(body || '').trim()) {
      return NextResponse.json({ error: 'id and a non-empty body are required' }, { status: 400 })
    }

    const admin = adminClient()
    // .eq('author_id') is the authorisation check: you can only edit your own.
    const { data, error } = await admin
      .from('activity_comments')
      .update({
        body: String(body).trim(),
        ...(stance ? { stance } : {}),
        edited_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('author_id', auth.userId)
      .select('*')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Comment not found, or not yours to edit' }, { status: 404 })
    return NextResponse.json({ comment: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to edit comment' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireCoachStaff(AUTHOR_ROLES)
    if ('error' in auth) return auth.error
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const admin = adminClient()
    const { data, error } = await admin
      .from('activity_comments')
      .delete()
      .eq('id', id)
      .eq('author_id', auth.userId)
      .select('id')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Comment not found, or not yours to delete' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete comment' }, { status: 500 })
  }
}
