import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Strictly development-only. NODE_ENV is always 'production' on Vercel, so this
  // backdoor can never be used on the live site, regardless of other env vars.
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    )
  }

  try {
    const { role } = await request.json()

    if (!role) {
      return NextResponse.json(
        { error: 'Role is required' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server is missing Supabase service credentials' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Find any user profile with this role
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, email, name, role')
      .eq('role', role)
      .limit(10)

    // A real Supabase/network error (e.g. DNS/connection failure) is a very
    // different problem than "no such role exists yet" — surface it as such
    // instead of the generic 404, so a connectivity blip doesn't look like a
    // missing account.
    if (profileError) {
      console.error('[dev-bypass-login] Supabase query failed:', profileError)
      return NextResponse.json(
        { error: `Could not reach the database: ${profileError.message}. This is usually a temporary connectivity issue — try again in a moment.` },
        { status: 503 }
      )
    }
    if (!profiles || profiles.length === 0) {
      return NextResponse.json(
        { error: `No active user profile found with role "${role}" in the database.` },
        { status: 404 }
      )
    }

    // Use the first user profile
    const targetProfile = profiles[0]

    // Set password to a standard development bypass password
    const devPassword = 'password123'
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetProfile.user_id,
      { password: devPassword, email_confirm: true }
    )

    if (updateError) {
      console.error('Error updating user password for dev bypass:', updateError)
      return NextResponse.json(
        { error: `Failed to prepare dev bypass login: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      email: targetProfile.email,
      password: devPassword,
      name: targetProfile.name,
      role: targetProfile.role
    })

  } catch (error: any) {
    console.error('Dev bypass API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Strictly development-only — never expose account roles/emails on production.
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  // Get all available roles that have profiles in development
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ roles: [] })
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey)
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('role, name, email')

    if (!profiles) return NextResponse.json({ roles: [] })

    // Group profiles by role
    const rolesMap = profiles.reduce((acc: any, curr: any) => {
      if (!acc[curr.role]) {
        acc[curr.role] = []
      }
      acc[curr.role].push({ name: curr.name, email: curr.email })
      return acc;
    }, {})

    return NextResponse.json({ success: true, roles: rolesMap })
  } catch (err) {
    return NextResponse.json({ roles: [] })
  }
}
