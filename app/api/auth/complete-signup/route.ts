import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { checkRoleLimit, getRoleLimitErrorMessage, ROLE_LIMITS, type Role } from '@/lib/role-limits'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// This endpoint is called when a user logs in after email confirmation
// It checks for pending signup data and creates the profile
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

    // Check if user already has a profile
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', authUser.id)
      .single()

    if (existingProfile) {
      // Profile already exists, nothing to do
      return NextResponse.json({
        success: true,
        message: 'Profile already exists',
        hasProfile: true
      })
    }

    // Use service role to access pending_signups and create profile
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

    // Get pending signup data
    const { data: pendingSignup, error: pendingError } = await supabaseAdmin
      .from('pending_signups')
      .select('*')
      .eq('user_id', authUser.id)
      .single()

    if (pendingError || !pendingSignup) {
      return NextResponse.json(
        { 
          error: 'No pending signup found. Please complete the signup process.',
          hasProfile: false,
          needsSignup: true
        },
        { status: 404 }
      )
    }

    // Check if signup has expired
    if (new Date(pendingSignup.expires_at) < new Date()) {
      // Clean up expired signup
      await supabaseAdmin
        .from('pending_signups')
        .delete()
        .eq('id', pendingSignup.id)

      return NextResponse.json(
        { 
          error: 'Your signup has expired. Please sign up again.',
          hasProfile: false,
          needsSignup: true
        },
        { status: 400 }
      )
    }

    const { name, email, phone, role, position, linked_player_email, birth_date } = pendingSignup

    // Validate role
    if (!Object.keys(ROLE_LIMITS).includes(role)) {
      return NextResponse.json(
        { error: `Invalid role: ${role}` },
        { status: 400 }
      )
    }

    // Check role limit
    const { count: currentRoleCount, error: countError } = await supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', role)

    if (countError) {
      console.error(`Error counting ${role}:`, countError)
      return NextResponse.json(
        { error: 'Failed to check role limit' },
        { status: 500 }
      )
    }

    const limitCheck = checkRoleLimit(currentRoleCount || 0, role as Role)
    if (!limitCheck.canAdd) {
      // Clean up pending signup
      await supabaseAdmin
        .from('pending_signups')
        .delete()
        .eq('id', pendingSignup.id)

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

    // Handle club_captain linked player
    let linkedPlayerId: string | null = null
    if (role === 'club_captain' && linked_player_email) {
      const { data: linkedPlayerProfile, error: linkedPlayerError } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, role')
        .eq('email', linked_player_email)
        .eq('role', 'player')
        .single()

      if (linkedPlayerError || !linkedPlayerProfile) {
        // Clean up pending signup
        await supabaseAdmin
          .from('pending_signups')
          .delete()
          .eq('id', pendingSignup.id)

        return NextResponse.json(
          { error: `No player account found with email ${linked_player_email}. Please ensure you have a player account first.` },
          { status: 400 }
        )
      }

      linkedPlayerId = linkedPlayerProfile.user_id
    }

    // CRITICAL: Verify user exists in auth.users before creating profile
    // This prevents foreign key constraint violations
    const { data: authUserCheck, error: authCheckError } = await supabaseAdmin.auth.admin.getUserById(authUser.id)
    
    if (authCheckError || !authUserCheck?.user) {
      console.error('User not found in auth.users:', authCheckError)
      return NextResponse.json(
        { 
          error: 'User account not fully activated. Please ensure you have confirmed your email and try logging in again.',
          needsEmailConfirmation: true
        },
        { status: 400 }
      )
    }

    // Verify user is confirmed
    if (!authUserCheck.user.email_confirmed_at) {
      return NextResponse.json(
        { 
          error: 'Please confirm your email address before completing signup. Check your inbox for the confirmation link.',
          needsEmailConfirmation: true
        },
        { status: 400 }
      )
    }

    // Generate unique_id
    const rolePrefixes: Record<string, string> = {
      player: 'PLR',
      coach: 'COA',
      admin: 'ADM',
      data_admin: 'TMA',
      finance_admin: 'FNA',
      physio: 'PHY',
      club_captain: 'CAP',
    }
    const prefix = rolePrefixes[role] || 'USR'
    const uniqueId = `${prefix}${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Create user profile - user is confirmed to exist in auth.users at this point
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id: authUser.id,
        unique_id: uniqueId,
        name,
        email,
        phone: phone || null,
        role: role as Role,
        status: 'active',
        linked_player_id: linkedPlayerId || null,
        birth_date: birth_date || null,
      })
      .select()
      .single()

    if (profileError) {
      console.error('Error creating profile:', profileError)
      
      // Provide helpful error message for foreign key constraint
      if (profileError.code === '23503' || profileError.message?.includes('foreign key')) {
        return NextResponse.json(
          { 
            error: 'User account not fully ready. Please wait a moment and try logging in again. If the issue persists, contact support.',
            needsRetry: true
          },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: `Failed to create profile: ${profileError.message}` },
        { status: 400 }
      )
    }

    // Create player record if role is player
    let playerRecord = null
    if (role === 'player' && position) {
      const category = position.includes('prop') || position.includes('hooker') || position.includes('lock') || position.includes('flanker') || position.includes('8th') ? 'forwards' : 'backs'
      
      const { data: playerData, error: playerError } = await supabaseAdmin
        .from('players')
        .insert({
          user_id: authUser.id,
          position,
          category,
        })
        .select()
        .single()

      if (playerError) {
        console.error('Error creating player record:', playerError)
        // Don't fail - can be created later
      } else {
        playerRecord = playerData
      }
    }

    // Delete pending signup after successful profile creation
    await supabaseAdmin
      .from('pending_signups')
      .delete()
      .eq('id', pendingSignup.id)

    return NextResponse.json({
      success: true,
      message: 'Profile created successfully',
      data: {
        profile: profileData,
        player: playerRecord,
        roleLimit: {
          current: (currentRoleCount || 0) + 1,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining - 1,
        }
      }
    })
  } catch (error: any) {
    console.error('Complete signup API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
