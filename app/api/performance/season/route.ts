import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getSeasonWindow, getCurrentSeasonYear, listSeasonYears } from '@/lib/season'

export const dynamic = 'force-dynamic'

const ALLOWED = ['admin', 'coach', 'asst_coach', 'data_admin', 'physio', 'club_captain']

/**
 * Season-scoped team + player performance. Everything here covers ONE season
 * (a 12-month window from club_settings.season_start_month). `?year=` picks a
 * past season; omitted means the current one. The response also lists every
 * season that has data so the UI can offer a back-in-time selector — the same
 * windowing that will slot legacy seasons in once that data is imported.
 */
export async function GET(request: NextRequest) {
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
    if (!profile || !ALLOWED.includes(profile.role)) {
      return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    const admin = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: club } = await admin
      .from('club_settings')
      .select('season_start_month')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    const startMonth = club?.season_start_month ?? null

    const [{ data: matches }, { data: sessions }] = await Promise.all([
      admin.from('matches').select('id, match_date'),
      admin.from('training_sessions').select('id, session_date'),
    ])

    // Which seasons to offer, newest first — from the earliest match or session.
    const allDates = [
      ...(matches || []).map((m: any) => m.match_date),
      ...(sessions || []).map((s: any) => s.session_date),
    ]
    const seasonYears = listSeasonYears(startMonth, allDates)

    const current = getCurrentSeasonYear(startMonth)
    const requested = parseInt(request.nextUrl.searchParams.get('year') || '', 10)
    const year = Number.isFinite(requested) ? requested : current
    const win = getSeasonWindow(startMonth, year)

    const inWindow = (d: string | null | undefined) => !!d && d >= win.start && d < win.end
    const seasonMatchIds = new Set((matches || []).filter((m: any) => inWindow(m.match_date)).map((m: any) => m.id))
    const seasonSessionIds = new Set((sessions || []).filter((s: any) => inWindow(s.session_date)).map((s: any) => s.id))

    const [{ data: allStats }, { data: allAttendance }, { data: players }] = await Promise.all([
      admin.from('match_stats').select('match_id, player_id, tries_scored, tackles_made, tackles_missed, ball_carries, ball_handling_errors, minutes_played'),
      admin.from('training_attendance').select('session_id, player_id, attendance_status'),
      admin.from('user_profiles').select('user_id, name, status').eq('role', 'player'),
    ])

    const stats = (allStats || []).filter((s: any) => seasonMatchIds.has(s.match_id))
    const attendance = (allAttendance || []).filter((a: any) => seasonSessionIds.has(a.session_id))

    // Team overview (matches db.getTeamPerformanceStats shape)
    const sum = (k: string) => stats.reduce((t: number, s: any) => t + (s[k] || 0), 0)
    const totalTries = sum('tries_scored')
    const totalTackles = sum('tackles_made')
    const totalTacklesMissed = sum('tackles_missed')
    const matchCount = new Set(stats.map((s: any) => s.match_id)).size
    const attempts = totalTackles + totalTacklesMissed
    const r1 = (n: number) => Math.round(n * 10) / 10
    const teamStats = {
      totalTries,
      totalTackles,
      totalTacklesMissed,
      totalBallCarries: sum('ball_carries'),
      totalBallHandlingErrors: sum('ball_handling_errors'),
      totalMinutes: sum('minutes_played'),
      matchCount,
      avgTriesPerMatch: matchCount > 0 ? r1(totalTries / matchCount) : 0,
      avgTacklesPerMatch: matchCount > 0 ? r1(totalTackles / matchCount) : 0,
      tackleSuccessRate: attempts > 0 ? r1((totalTackles / attempts) * 100) : 0,
    }

    // Per-player summary (matches db.getPlayersPerformanceSummary shape)
    const playersSummary = (players || []).map((p: any) => {
      const ps = stats.filter((s: any) => s.player_id === p.user_id)
      const pa = attendance.filter((a: any) => a.player_id === p.user_id)
      const totalMatches = new Set(ps.map((s: any) => s.match_id)).size
      const totalMinutes = ps.reduce((t: number, s: any) => t + (s.minutes_played || 0), 0)
      const present = pa.filter((a: any) => a.attendance_status === 'P').length
      return {
        playerId: p.user_id,
        name: p.name,
        status: p.status,
        totalMatches,
        totalTries: ps.reduce((t: number, s: any) => t + (s.tries_scored || 0), 0),
        totalTackles: ps.reduce((t: number, s: any) => t + (s.tackles_made || 0), 0),
        totalMinutes,
        avgMinutes: totalMatches > 0 ? Math.round(totalMinutes / totalMatches) : 0,
        attendanceRate: pa.length > 0 ? r1((present / pa.length) * 100) : 0,
        totalSessions: pa.length,
        presentCount: present,
      }
    })

    return NextResponse.json({
      year,
      label: win.label,
      isCurrent: year === current,
      seasonYears,
      teamStats,
      players: playersSummary,
    })
  } catch (error: any) {
    console.error('Season performance API error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load season performance' }, { status: 500 })
  }
}
