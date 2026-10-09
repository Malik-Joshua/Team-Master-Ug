import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRoleLimit, getRoleLimitErrorMessage, ROLE_LIMITS } from '@/lib/role-limits'
import { sendWelcomeEmail } from '@/lib/email'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { normalizePosition, normalizeDate, positionCategory, isValidEmail } from '@/lib/import-normalize'

// Who may add players. Previously this endpoint had no check at all, so anyone
// who could reach the URL could create accounts with the service role.
const PLAYER_CREATOR_ROLES = ['admin', 'data_admin', 'coach', 'asst_coach']

// This route requires service role for admin operations
// In production, you should use environment variables for the service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      )
    }

    // Authenticate the caller (session cookie) before touching the service role.
    const sessionClient = await createSessionClient()
    const { data: { user: callerUser } } = await sessionClient.auth.getUser()
    if (!callerUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const { data: callerProfile } = await sessionClient
      .from('user_profiles')
      .select('role')
      .eq('user_id', callerUser.id)
      .single()
    if (!callerProfile || !PLAYER_CREATOR_ROLES.includes(callerProfile.role)) {
      return NextResponse.json({ error: 'You do not have permission to add players' }, { status: 403 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const body = await request.json()
    const { name, phone, category, jersey_number, height_cm, weight_kg, status } = body
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email

    // Validate required fields
    if (!name || !email || !body.position) {
      return NextResponse.json(
        { error: 'Name, email, and position are required' },
        { status: 400 }
      )
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: `"${email}" is not a valid email address` }, { status: 400 })
    }

    // The database only accepts a fixed set of position values, so translate
    // what the club typed ("Fly-half", "No. 10") and reject what we can't place
    // with a message that says what to fix — rather than a raw constraint error.
    const position = normalizePosition(body.position)
    if (!position) {
      return NextResponse.json(
        { error: `Position "${body.position}" is not recognised. Use e.g. Hooker, Lock, Fly Half, Scrum Half, Full Back.` },
        { status: 400 }
      )
    }
    // A bad/unreadable date of birth shouldn't block the player being created.
    const date_of_birth = normalizeDate(body.date_of_birth)

    // Check role limit for players
    const { count: currentPlayerCount, error: countError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'player')

    if (countError) {
      console.error('Error counting players:', countError)
      return NextResponse.json(
        { error: 'Failed to check player limit' },
        { status: 500 }
      )
    }

    const limitCheck = checkRoleLimit(currentPlayerCount || 0, 'player')
    if (!limitCheck.canAdd) {
      return NextResponse.json(
        { 
          error: getRoleLimitErrorMessage('player', currentPlayerCount || 0),
          limit: limitCheck.limit,
          current: currentPlayerCount || 0,
          remaining: limitCheck.remaining
        },
        { status: 403 }
      )
    }

    // Generate unique_id
    const uniqueId = `PLR${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Generate a temporary password
    const tempPassword = `TempPassword${Math.random().toString(36).slice(-8)}`

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      // Forces the "create your own password" step on first sign-in.
      user_metadata: { must_set_password: true },
    })

    if (authError) {
      const exists = /already|registered|exists/i.test(authError.message || '')
      return NextResponse.json(
        { error: exists ? `An account with ${email} already exists` : `Failed to create user: ${authError.message}` },
        { status: exists ? 409 : 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Create user profile
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: authData.user.id,
        unique_id: uniqueId,
        name,
        email,
        phone: phone || null,
        role: 'player',
        status: status || 'active',
        // The club is already set up by whoever invited them — never send an
        // invited player to the Club Setup wizard.
        onboarding_completed: true,
      })
      .select()
      .single()

    if (profileError) {
      // Clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `Failed to create profile: ${profileError.message}` },
        { status: 400 }
      )
    }

    // Create player record
    const { data: playerRecord, error: playerError } = await supabase
      .from('players')
      .insert({
        user_id: authData.user.id,
        position,
        category: category || positionCategory(position),
        jersey_number: jersey_number && !isNaN(parseInt(jersey_number)) ? parseInt(jersey_number) : null,
        date_of_birth: date_of_birth || null,
        height_cm: height_cm ? parseInt(height_cm) : null,
        weight_kg: weight_kg ? parseFloat(weight_kg) : null,
      })
      .select()
      .single()

    if (playerError) {
      // Clean up if player record creation fails
      await supabase.from('user_profiles').delete().eq('user_id', authData.user.id)
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `Failed to create player record: ${playerError.message}` },
        { status: 400 }
      )
    }

    // Email the new player their login details. Skip placeholder addresses
    // generated by the onboarding CSV importer (roster.local) — there's no
    // real inbox behind those, so sending would just bounce. Never let an
    // email failure fail the request: the account is already created and
    // the tempPassword is still returned in the response as a fallback the
    // manager can hand over manually.
    let emailSent = false
    let emailError: string | undefined
    if (!email.toLowerCase().endsWith('@roster.local')) {
      const { data: club } = await supabase
        .from('club_settings')
        .select('club_nickname')
        .limit(1)
        .maybeSingle()
      const result = await sendWelcomeEmail({
        to: email,
        name,
        role: 'player',
        tempPassword,
        clubName: club?.club_nickname,
      })
      emailSent = result.sent
      emailError = result.error
    }

    return NextResponse.json({
      success: true,
      message: 'Player created successfully',
      data: {
        profile: profileData,
        player: playerRecord,
        tempPassword, // Still returned as a fallback in case the email didn't send
        emailSent,
        emailError,
        roleLimit: {
          current: (currentPlayerCount || 0) + 1,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining - 1,
        }
      }
    })
  } catch (error: any) {
    console.error('Error creating player:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}






