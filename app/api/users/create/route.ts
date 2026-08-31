import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { checkRoleLimit, getRoleLimitErrorMessage, ROLE_LIMITS, type Role } from '@/lib/role-limits'
import { sendWelcomeEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user profile to verify role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Only admins can create users
    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can create users' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { 
      name, 
      email, 
      phone, 
      role, 
      position, 
      category, 
      jersey_number, 
      date_of_birth, 
      height_cm, 
      weight_kg, 
      status 
    } = body

    // Validate required fields
    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Name, email, and role are required' },
        { status: 400 }
      )
    }

    // Validate role
    if (!Object.keys(ROLE_LIMITS).includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Allowed roles: ${Object.keys(ROLE_LIMITS).join(', ')}` },
        { status: 400 }
      )
    }

    // Use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Check role limit
    const { count: currentRoleCount, error: countError } = await supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', role)

    if (countError) {
      console.error('Error counting users for role:', countError)
      return NextResponse.json(
        { error: 'Failed to check role limit' },
        { status: 500 }
      )
    }

    const limitCheck = checkRoleLimit(currentRoleCount || 0, role as Role)
    if (!limitCheck.canAdd) {
      return NextResponse.json(
        { 
          error: getRoleLimitErrorMessage(role as Role, currentRoleCount || 0),
          limit: limitCheck.limit,
          current: currentRoleCount || 0,
          remaining: limitCheck.remaining
        },
        { status: 403 }
      )
    }

    // Generate unique_id based on role
    const rolePrefixes: Record<string, string> = {
      player: 'PLR',
      coach: 'COA',
      asst_coach: 'ACO',
      admin: 'ADM',
      data_admin: 'TMA',
      finance_admin: 'FNA',
      physio: 'PHY',
    }
    const prefix = rolePrefixes[role] || 'USR'
    const uniqueId = `${prefix}${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Generate a temporary password
    const tempPassword = `TempPassword${Math.random().toString(36).slice(-8)}`

    // Create auth user
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })

    if (createUserError) {
      return NextResponse.json(
        { error: `Failed to create user: ${createUserError.message}` },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Create user profile
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id: authData.user.id,
        unique_id: uniqueId,
        name,
        email,
        phone: phone || null,
        role: role as Role,
        status: status || 'active',
      })
      .select()
      .single()

    if (profileError) {
      // Clean up auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `Failed to create profile: ${profileError.message}` },
        { status: 400 }
      )
    }

    // For players, create player record
    let playerRecord = null
    if (role === 'player') {
      if (!position) {
        // Clean up if required fields are missing
        await supabaseAdmin.from('user_profiles').delete().eq('user_id', authData.user.id)
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json(
          { error: 'Position is required for players' },
          { status: 400 }
        )
      }

      const { data: playerData, error: playerError } = await supabaseAdmin
        .from('players')
        .insert({
          user_id: authData.user.id,
          position,
          category: category || (position.includes('prop') || position.includes('hooker') || position.includes('lock') || position.includes('flanker') || position.includes('8th') ? 'forwards' : 'backs'),
          jersey_number: jersey_number ? parseInt(jersey_number) : null,
          date_of_birth: date_of_birth || null,
          height_cm: height_cm ? parseInt(height_cm) : null,
          weight_kg: weight_kg ? parseFloat(weight_kg) : null,
        })
        .select()
        .single()

      if (playerError) {
        // Clean up if player record creation fails
        await supabaseAdmin.from('user_profiles').delete().eq('user_id', authData.user.id)
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json(
          { error: `Failed to create player record: ${playerError.message}` },
          { status: 400 }
        )
      }

      playerRecord = playerData
    }

    // Email the new account holder their login details. Never let an email
    // failure fail account creation — tempPassword still comes back in the
    // response as a fallback the admin can hand over manually.
    let emailSent = false
    let emailError: string | undefined
    if (!email.toLowerCase().endsWith('@roster.local')) {
      const { data: club } = await supabaseAdmin
        .from('club_settings')
        .select('club_nickname')
        .limit(1)
        .maybeSingle()
      const result = await sendWelcomeEmail({
        to: email,
        name,
        role,
        tempPassword,
        clubName: club?.club_nickname,
      })
      emailSent = result.sent
      emailError = result.error
    }

    return NextResponse.json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully`,
      data: {
        profile: profileData,
        player: playerRecord,
        tempPassword, // Still returned as a fallback in case the email didn't send
        emailSent,
        emailError,
        roleLimit: {
          current: (currentRoleCount || 0) + 1,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining - 1,
        }
      }
    })
  } catch (error: any) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
