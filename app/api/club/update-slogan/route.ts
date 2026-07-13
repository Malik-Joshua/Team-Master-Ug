import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Lets the club admin edit the club slogan from their profile page. Updates
// the active (latest-updated) club_settings row, same convention as the
// badge upload route, so the change shows up app-wide immediately.
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
      return NextResponse.json({ error: 'Only the club admin can change the club slogan' }, { status: 403 })
    }

    const body = await request.json()
    const slogan = typeof body.slogan === 'string' ? body.slogan.trim() : ''

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const admin = createServiceClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Find the active club row (latest-updated = source of truth), same
    // heuristic used by the badge upload route.
    const { data: rows } = await admin
      .from('club_settings')
      .select('id')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)

    if (!rows || !rows[0]) {
      return NextResponse.json({ error: 'No club settings found. Complete club onboarding first.' }, { status: 404 })
    }

    const { error: updateError } = await admin
      .from('club_settings')
      .update({ club_slogan: slogan || null, updated_at: new Date().toISOString() })
      .eq('id', rows[0].id)

    if (updateError) {
      // club_slogan is a newer column (migration 043) — surface a clear,
      // actionable message if it hasn't been applied yet.
      if (updateError.message?.includes('club_slogan')) {
        return NextResponse.json(
          { error: 'Club slogan isn\'t enabled yet — ask your admin to apply the latest database update.' },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: `Failed to update slogan: ${updateError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, slogan: slogan || null })
  } catch (error: any) {
    console.error('[update-slogan] error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
