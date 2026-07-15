import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/club/update-name
 *
 * Lets the club admin rename the club from their profile page. Updates the
 * active (latest-updated) club_settings row — the single source of truth the
 * whole app reads — so the new name shows up everywhere immediately. Same
 * convention as the slogan/badge routes; crucially it UPDATES that row by id
 * rather than upserting a per-admin row, which would otherwise create a
 * duplicate that shadows the real branding (colours + badge).
 *
 * Request body: { name: string }
 * Response: { club_nickname: string }
 */
export async function POST(request: NextRequest) {
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
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Only the club admin can rename the club' }, { status: 403 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Club name is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const admin = createServiceClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Find the active club row (latest-updated = source of truth), same
    // heuristic used by the slogan/badge routes, so we rename the row the
    // rest of the app actually reads instead of spawning a new one.
    const { data: rows } = await admin
      .from('club_settings')
      .select('id')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)

    if (!rows || !rows[0]) {
      return NextResponse.json(
        { error: 'No club settings found. Complete club onboarding first.' },
        { status: 404 }
      )
    }

    const { error: updateError } = await admin
      .from('club_settings')
      .update({ club_nickname: name, updated_at: new Date().toISOString() })
      .eq('id', rows[0].id)

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update club name: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ club_nickname: name })
  } catch (error: any) {
    console.error('[update-name] error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
