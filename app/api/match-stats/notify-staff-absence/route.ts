import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/match-stats/notify-staff-absence
 *
 * Called by the match-stats save flow after the staff attendance rows
 * are written. Fires notifications when a staff member (coach, physio,
 * team manager, …) was recorded ABSENT on match day. Recipients:
 *
 *   • the absent staff member themselves — first-person "you" copy
 *   • all finance admins  (payroll & discipline)
 *   • all owners / admins (governance)
 *   • all team managers   (fixture coverage)
 *
 * body: {
 *   matchId: string,
 *   absent:  Array<{ staff_id: string }>
 * }
 *
 * Copy is tailored per role so each dashboard reads naturally, not a
 * generic dump. Non-blocking: the caller shouldn't fail if the alerts
 * don't send.
 */

// Staff attendance is only relevant to management-side roles. finance_admin
// is included because absent staff usually has payroll / bonus implications;
// admin is the owner; data_admin is the team manager who covers scheduling.
const RECIPIENT_ROLES = ['admin', 'data_admin', 'finance_admin'] as const
const CALLER_ROLES = ['admin', 'data_admin', 'coach', 'asst_coach'] as const

type AbsenceRow = { staff_id: string }

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: caller } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()
    if (!caller || !CALLER_ROLES.includes(caller.role as any)) {
      return NextResponse.json({ error: 'Only staff can send absence alerts' }, { status: 403 })
    }

    const body = await request.json()
    const matchId = String(body.matchId || '')
    const absent: AbsenceRow[] = Array.isArray(body.absent) ? body.absent : []
    if (!matchId || absent.length === 0) {
      return NextResponse.json({ error: 'matchId and absent[] are required' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'Service credentials missing' }, { status: 500 })
    const admin = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

    // Load match copy fields, recipient staff, and the absentees' names
    // in parallel to keep the round-trip cost down.
    const [{ data: match }, { data: recipients }, { data: absentProfiles }] = await Promise.all([
      admin.from('matches').select('id, opponent, match_date').eq('id', matchId).single(),
      admin.from('user_profiles').select('user_id, role, name').in('role', RECIPIENT_ROLES as unknown as string[]),
      admin.from('user_profiles').select('user_id, name, role').in('user_id', absent.map((a) => a.staff_id)),
    ])

    const opponent = match?.opponent || 'the opponent'
    const dateLabel = match?.match_date ? new Date(match.match_date).toLocaleDateString() : ''

    const roleLabel = (r?: string) =>
      r === 'coach' ? 'Coach'
      : r === 'asst_coach' ? 'Assistant Coach'
      : r === 'physio' ? 'Physio'
      : r === 'data_admin' ? 'Team Manager'
      : r === 'admin' ? 'Owner'
      : r === 'finance_admin' ? 'Finance'
      : r === 'club_captain' ? 'Club Captain'
      : 'Staff'

    const rows: any[] = []
    for (const row of absent) {
      const victim = (absentProfiles || []).find((p: any) => p.user_id === row.staff_id) as any
      if (!victim) continue
      const victimLabel = `${victim.name || 'A staff member'} (${roleLabel(victim.role)})`

      // ── 1. Alert to the absent staff themselves (first-person)
      rows.push({
        user_id: victim.user_id,
        title: '🚫 Absence recorded',
        message: `You were marked absent for the match vs ${opponent}${dateLabel ? ` on ${dateLabel}` : ''}. If this is a mistake, contact the team manager.`,
        type: 'warning',
        reference_id: matchId,
        reference_type: 'match_absence',
        action_url: '/fixtures',
      })

      // ── 2. Alerts to every recipient staff — copy per role
      for (const rec of recipients || []) {
        // Don't notify the victim twice if they're also in a recipient role.
        if (rec.user_id === victim.user_id) continue
        let title: string
        let message: string
        let type: 'info' | 'warning' | 'error' = 'warning'
        switch (rec.role) {
          case 'admin':
            title = `🚫 Staff absence — ${victim.name || 'staff member'}`
            message = `${victimLabel} was marked absent on match day vs ${opponent}${dateLabel ? ` on ${dateLabel}` : ''}. Worth a follow-up with the manager.`
            break
          case 'data_admin':
            title = `🚫 ${victim.name || 'A staff member'} was absent`
            message = `${victimLabel} did not attend the match vs ${opponent}${dateLabel ? ` on ${dateLabel}` : ''}. Update the fixture coverage if needed.`
            break
          case 'finance_admin':
            title = `🚫 Match-day absence: ${victim.name || 'staff'}`
            message = `${victimLabel} was recorded absent for the match vs ${opponent}${dateLabel ? ` on ${dateLabel}` : ''}. Review any per-match compensation.`
            break
          default:
            title = `🚫 Staff absence recorded`
            message = `${victimLabel} was absent for the match vs ${opponent}${dateLabel ? ` on ${dateLabel}` : ''}.`
        }
        rows.push({
          user_id: rec.user_id,
          title,
          message,
          type,
          reference_id: matchId,
          reference_type: 'match_absence',
          action_url: '/fixtures',
        })
      }
    }

    if (rows.length === 0) return NextResponse.json({ success: true, sent: 0 })
    const { error: insErr } = await admin.from('notifications').insert(rows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    return NextResponse.json({ success: true, sent: rows.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to send absence notifications' }, { status: 500 })
  }
}
