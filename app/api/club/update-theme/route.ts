import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
// @ts-ignore - themeEngine is a JS module
import { PRESETS, getPresetThemeName } from '@/themeEngine'

export const dynamic = 'force-dynamic'

/**
 * POST /api/club/update-theme
 *
 * Lets the club admin change the whole app's theme colour from their
 * profile page WITHOUT re-running onboarding. This is the escape hatch for
 * re-branding an existing club's data for a new client demo (e.g. reusing a
 * test club's players/fixtures/history but re-skinning it for a real
 * prospect) — nothing else about the club (players, fixtures, stats,
 * squads) is touched.
 *
 * Same convention as update-name / update-slogan: updates the active
 * (latest-updated) club_settings row rather than upserting a new one, so
 * the change applies to the row Layout.tsx actually reads on every page
 * load — the whole app re-themes immediately, no redeploy needed.
 *
 * Request body: { primary_color: string }  (hex, e.g. "#0EA5E9" or the
 *   accent of a themeEngine preset like "bw" for Black & White)
 * Response: { primary_color, secondary_color }
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
      return NextResponse.json({ error: 'Only the club admin can change the club theme' }, { status: 403 })
    }

    const body = await request.json()
    const primaryColor = typeof body.primary_color === 'string' ? body.primary_color.trim() : ''
    if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
      return NextResponse.json({ error: 'primary_color must be a hex colour like #0EA5E9' }, { status: 400 })
    }

    // Same derivation onboarding uses: the whole palette (surfaces, text,
    // accents) comes from ONE colour, and we persist the matching preset's
    // accent as secondary_color for the existing schema/back-compat.
    const derivedAccent = (PRESETS as any)[getPresetThemeName(primaryColor)].acc as string

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const admin = createServiceClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Find the active club row (latest-updated = source of truth), same
    // heuristic used by the name/slogan/badge routes.
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
      .update({
        primary_color: primaryColor,
        secondary_color: derivedAccent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rows[0].id)

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update theme: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ primary_color: primaryColor, secondary_color: derivedAccent })
  } catch (error: any) {
    console.error('[update-theme] error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
