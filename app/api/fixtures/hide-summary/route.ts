import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Per-user soft-hide for Match Summaries. See migration 049.
 *
 *   POST   /api/fixtures/hide-summary  { matchId }  → hide from current user
 *   DELETE /api/fixtures/hide-summary  { matchId }  → un-hide
 *   GET    /api/fixtures/hide-summary               → list of hidden match ids
 *
 * The match itself, its stats and its squad are untouched — this is purely a
 * viewer preference, so other users' summary screens are unaffected.
 */

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials missing')
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  return { user }
}

// Detect the "table doesn't exist yet" case so the API can respond usefully
// before migration 049 is applied.
function isMissingTable(err: any) {
  const m = String(err?.message || '')
  return /hidden_match_summaries/.test(m) && /does not exist|schema cache/i.test(m)
}

export async function GET() {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const admin = adminClient()
  const { data, error } = await admin
    .from('hidden_match_summaries')
    .select('match_id')
    .eq('user_id', auth.user.id)
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ hidden: [], needsMigration: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ hidden: (data || []).map((r: any) => r.match_id) })
}

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { matchId } = await request.json()
  if (!matchId) return NextResponse.json({ error: 'matchId is required' }, { status: 400 })
  const admin = adminClient()
  const { error } = await admin
    .from('hidden_match_summaries')
    .upsert({ user_id: auth.user.id, match_id: matchId }, { onConflict: 'user_id,match_id' })
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: 'Please run migration 049 in Supabase to enable hiding summaries.', needsMigration: true }, { status: 501 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { matchId } = await request.json()
  if (!matchId) return NextResponse.json({ error: 'matchId is required' }, { status: 400 })
  const admin = adminClient()
  const { error } = await admin
    .from('hidden_match_summaries')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('match_id', matchId)
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: 'Please run migration 049 in Supabase to enable hiding summaries.', needsMigration: true }, { status: 501 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
