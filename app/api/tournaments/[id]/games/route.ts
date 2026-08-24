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

const VALID_STAGE = ['group', 'quarter', 'semi', 'final', 'placement']
const VALID_BRACKET = ['cup', 'challenger', 'placement']

/**
 * POST /api/tournaments/[id]/games
 * Creates the next knockout / placement game slot for a tournament (Day 2),
 * and copies the shared tournament squad into its fixture_team_selections so
 * the stats screen restricts to the squad, like the group games.
 *
 * body: { stage, bracket, day_number?, game_order, opponent? }
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const auth = await authorize(supabase)
    if ('error' in auth) return auth.error

    const body = await request.json()
    const { stage, bracket, opponent } = body
    const day_number = body.day_number ?? 2
    const game_order = body.game_order

    if (!VALID_STAGE.includes(stage)) {
      return NextResponse.json({ error: `Invalid stage "${stage}"` }, { status: 400 })
    }
    if (bracket && !VALID_BRACKET.includes(bracket)) {
      return NextResponse.json({ error: `Invalid bracket "${bracket}"` }, { status: 400 })
    }
    if (!game_order) {
      return NextResponse.json({ error: 'game_order is required' }, { status: 400 })
    }

    const admin = adminClient()

    // Load the tournament (for dates/venue) and its squad
    const { data: tournament, error: tErr } = await admin
      .from('tournaments')
      .select('*')
      .eq('id', params.id)
      .single()
    if (tErr || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Guard against duplicate slots for the same order (e.g. double-clicks)
    const { data: existing } = await admin
      .from('matches')
      .select('id')
      .eq('tournament_id', params.id)
      .eq('game_order', game_order)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ game: existing, alreadyExisted: true })
    }

    const stageLabel: Record<string, string> = {
      quarter: 'Quarter-final',
      semi: 'Semi-final',
      final: 'Final',
      placement: 'Placement playoff',
      group: 'Group Game',
    }

    const { data: game, error: gErr } = await admin
      .from('matches')
      .insert({
        match_date: day_number === 1 ? tournament.day1_date : (tournament.day2_date || tournament.day1_date),
        opponent: opponent || stageLabel[stage] || 'TBD',
        tournament_type: 'sevens',
        venue: tournament.venue || null,
        squad_size: 12,
        status: 'scheduled',
        tournament_id: params.id,
        stage,
        bracket: bracket || null,
        day_number,
        game_order,
        created_by: auth.authUser.id,
      })
      .select('id, match_date, opponent, venue, tournament_type, status, result, score_our_team, score_opponent, tournament_id, stage, bracket, day_number, game_order')
      .single()

    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })

    // Copy the shared squad into this game's selections
    const { data: squad } = await admin
      .from('tournament_squad')
      .select('player_id')
      .eq('tournament_id', params.id)
    if (squad && squad.length > 0) {
      await admin.from('fixture_team_selections').insert(
        squad.map((s: any) => ({ match_id: game.id, player_id: s.player_id, selected_by: auth.authUser.id }))
      )
    }

    // Nudge the tournament into "in_progress" if it was still "upcoming"
    if (tournament.status === 'upcoming') {
      await admin.from('tournaments').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', params.id)
    }

    return NextResponse.json({ game }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create game' }, { status: 500 })
  }
}
