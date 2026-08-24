import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['admin', 'data_admin']

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server configuration error: Supabase service credentials missing')
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function authorize(supabase: any) {
  const { data: { user: authUser }, error } = await supabase.auth.getUser()
  if (error || !authUser) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('user_id', authUser.id).single()
  if (!profile || !MANAGER_ROLES.includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Only the team manager or an admin can manage tournaments' }, { status: 403 }) }
  }
  return { authUser }
}

/**
 * GET /api/tournaments
 * Lists all tournaments, newest first, each with its games (from `matches`)
 * and its shared squad player_ids.
 */
export async function GET() {
  try {
    const admin = adminClient()

    const { data: tournaments, error } = await admin
      .from('tournaments')
      .select('*')
      .order('day1_date', { ascending: false })

    if (error) {
      // Most likely cause: migration 048 hasn't been run yet.
      return NextResponse.json(
        { error: error.message, needsMigration: /relation .*tournaments.* does not exist|does not exist/i.test(error.message) },
        { status: 500 }
      )
    }

    const ids = (tournaments || []).map((t: any) => t.id)
    let gamesByTournament: Record<string, any[]> = {}
    let squadByTournament: Record<string, string[]> = {}

    if (ids.length > 0) {
      const { data: games } = await admin
        .from('matches')
        .select('id, match_date, opponent, venue, tournament_type, status, result, score_our_team, score_opponent, tournament_id, stage, bracket, day_number, game_order')
        .in('tournament_id', ids)
        .order('game_order', { ascending: true })
      for (const g of games || []) {
        (gamesByTournament[g.tournament_id] ||= []).push(g)
      }

      const { data: squad } = await admin
        .from('tournament_squad')
        .select('tournament_id, player_id')
        .in('tournament_id', ids)
      for (const s of squad || []) {
        (squadByTournament[s.tournament_id] ||= []).push(s.player_id)
      }
    }

    const result = (tournaments || []).map((t: any) => ({
      ...t,
      games: gamesByTournament[t.id] || [],
      squad: squadByTournament[t.id] || [],
    }))

    return NextResponse.json({ tournaments: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load tournaments' }, { status: 500 })
  }
}

/**
 * POST /api/tournaments
 * Creates a tournament, its 3 Day-1 group game slots, and its shared squad.
 * The squad is also written into fixture_team_selections for each group game
 * so the existing stats / team-selection screens work per game unchanged.
 *
 * body: { name, venue?, day1_date, day2_date?, squad: string[] (player_ids) }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const auth = await authorize(supabase)
    if ('error' in auth) return auth.error

    const body = await request.json()
    const { name, venue, day1_date, day2_date, squad, groupOpponents } = body

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 })
    }
    if (!day1_date) {
      return NextResponse.json({ error: 'Day 1 date is required' }, { status: 400 })
    }

    const admin = adminClient()
    const squadIds: string[] = Array.isArray(squad) ? squad.filter(Boolean) : []
    // The 3 group-stage opponents entered on the Create Fixture form. Missing
    // entries fall back to a generic "Group Game N" placeholder.
    const opponents: string[] = Array.isArray(groupOpponents) ? groupOpponents : []

    // 1. Create the tournament
    const { data: tournament, error: tErr } = await admin
      .from('tournaments')
      .insert({
        name: String(name).trim(),
        venue: venue || null,
        day1_date,
        day2_date: day2_date || null,
        format: 'sevens',
        status: 'upcoming',
        created_by: auth.authUser.id,
      })
      .select('*')
      .single()

    if (tErr) {
      return NextResponse.json(
        { error: tErr.message, needsMigration: /does not exist/i.test(tErr.message) },
        { status: 500 }
      )
    }

    // 2. Create the 3 Day-1 group game slots (opponent filled in when recorded)
    const groupGames = [1, 2, 3].map((n) => ({
      match_date: day1_date,
      opponent: (opponents[n - 1] && String(opponents[n - 1]).trim()) || `Group Game ${n}`,
      tournament_type: 'sevens',
      venue: venue || null,
      squad_size: 12,
      status: 'scheduled',
      tournament_id: tournament.id,
      stage: 'group',
      bracket: null,
      day_number: 1,
      game_order: n,
      created_by: auth.authUser.id,
    }))

    const { data: createdGames, error: gErr } = await admin
      .from('matches')
      .insert(groupGames)
      .select('id')

    if (gErr) {
      // Roll back the tournament so we don't leave an orphan
      await admin.from('tournaments').delete().eq('id', tournament.id)
      return NextResponse.json({ error: `Could not create group games: ${gErr.message}` }, { status: 500 })
    }

    // 3. Save the shared squad + copy it into each group game's selection
    if (squadIds.length > 0) {
      await admin.from('tournament_squad').insert(
        squadIds.map((pid) => ({ tournament_id: tournament.id, player_id: pid }))
      )
      const selections: any[] = []
      for (const game of createdGames || []) {
        for (const pid of squadIds) {
          selections.push({ match_id: game.id, player_id: pid, selected_by: auth.authUser.id })
        }
      }
      if (selections.length > 0) {
        await admin.from('fixture_team_selections').insert(selections)
      }
    }

    return NextResponse.json({ tournament: { ...tournament, squad: squadIds } }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create tournament' }, { status: 500 })
  }
}
