import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { checkRoleLimit, getRoleLimitErrorMessage, ROLE_LIMITS } from '@/lib/role-limits'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, user_id } = body

    // Validate required fields
    if (!name || !email || !user_id) {
      return NextResponse.json(
        { error: 'Name, email, and user_id are required' },
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

    // Check if user already has a profile
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('user_id', user_id)
      .single()

    if (existingProfile) {
      return NextResponse.json(
        { error: 'User profile already exists' },
        { status: 400 }
      )
    }

    // Check player limit (only players can sign up)
    const { count: currentPlayerCount, error: countError } = await supabaseAdmin
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

    // Generate unique_id for player
    const uniqueId = `PLR${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Create user profile as player
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id,
        unique_id: uniqueId,
        name,
        email,
        phone: phone || null,
        role: 'player',
        status: 'active', // Players can be active immediately after signup
      })
      .select()
      .single()

    if (profileError) {
      console.error('Error creating profile:', profileError)
      return NextResponse.json(
        { error: `Failed to create profile: ${profileError.message}` },
        { status: 400 }
      )
    }

    // Note: Player record will be created later when they complete their profile
    // or by an admin. We don't require position during signup.

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      data: {
        profile: profileData,
        roleLimit: {
          current: (currentPlayerCount || 0) + 1,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining - 1,
        }
      }
    })
  } catch (error: any) {
    console.error('Signup API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
