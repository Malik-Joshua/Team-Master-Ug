import { NextRequest, NextResponse } from 'next/server'
import { notifyOtherCoaches, type CoachEntryKind } from '@/lib/notify-coaches'
import { adminClient, requireCoachStaff, isMissingCollabTable } from '@/lib/collaboration'

export const dynamic = 'force-dynamic'

/**
 * Coach ↔ Assistant Coach collaboration feed.
 *
 *   GET  /api/collaboration        → recent activities + comments + reactions
 *   POST /api/collaboration        → record a new activity (used by the
 *                                    training page when a session is created;
 *                                    team selection and match-day attendance
 *                                    record theirs from their own routes)
 *
 * Comments and reactions live at /api/collaboration/comments and
 * /api/collaboration/reactions.
 */

export async function GET() {
  try {
    const auth = await requireCoachStaff()
    if ('error' in auth) return auth.error
    const admin = adminClient()

    const { data: activities, error } = await admin
      .from('coach_activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      if (isMissingCollabTable(error)) {
        return NextResponse.json({ activities: [], needsMigration: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const ids = (activities || []).map((a: any) => a.id)
    let comments: any[] = []
    let reactions: any[] = []
    if (ids.length > 0) {
      const [c, r] = await Promise.all([
        admin.from('activity_comments').select('*').in('activity_id', ids).order('created_at', { ascending: true }),
        admin.from('activity_reactions').select('*').in('activity_id', ids),
      ])
      comments = c.data || []
      reactions = r.data || []
    }

    // Resolve display names for actors and comment authors in one lookup.
    const people = Array.from(new Set([
      ...(activities || []).map((a: any) => a.actor_id),
      ...comments.map((c: any) => c.author_id),
      ...reactions.map((r: any) => r.user_id),
    ].filter(Boolean)))
    const nameById: Record<string, { name: string; role: string }> = {}
    if (people.length > 0) {
      const { data: profiles } = await admin
        .from('user_profiles')
        .select('user_id, name, role')
        .in('user_id', people)
      for (const p of profiles || []) nameById[p.user_id] = { name: p.name, role: p.role }
    }

    return NextResponse.json({
      activities: (activities || []).map((a: any) => ({
        ...a,
        actor: nameById[a.actor_id] || null,
        comments: comments
          .filter((c: any) => c.activity_id === a.id)
          .map((c: any) => ({ ...c, author: nameById[c.author_id] || null })),
        reactions: reactions
          .filter((r: any) => r.activity_id === a.id)
          .map((r: any) => ({ ...r, user: nameById[r.user_id] || null })),
      })),
      viewerId: auth.userId,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load collaboration feed' }, { status: 500 })
  }
}

/**
 * Records a coaching activity (and notifies the other coaches). Used by
 * client-side flows that create something worth discussing — currently the
 * training page. body: { kind, referenceId, title?, subject?, date? }
 */
export async function POST(request: NextRequest) {
  try {
    // Only the people who actually perform coaching actions can create feed
    // entries — management can read but not post activities.
    const auth = await requireCoachStaff(['coach', 'asst_coach', 'admin'])
    if ('error' in auth) return auth.error

    const body = await request.json()
    const kind = body.kind as CoachEntryKind
    const referenceId = String(body.referenceId || '')
    if (!referenceId || !['team_selection', 'match_attendance', 'training_session'].includes(kind)) {
      return NextResponse.json({ error: 'A valid kind and referenceId are required' }, { status: 400 })
    }

    const result = await notifyOtherCoaches({
      actorUserId: auth.userId,
      matchId: referenceId,
      opponent: body.subject ?? null,
      matchDate: body.date ?? null,
      kind,
      title: body.title,
    })

    return NextResponse.json({ success: true, notified: result.sent })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to record activity' }, { status: 500 })
  }
}
