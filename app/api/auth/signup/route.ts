import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { checkRoleLimit, getRoleLimitErrorMessage, ROLE_LIMITS, type Role } from '@/lib/role-limits'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, role, position, user_id } = body

    // Validate required fields
    if (!name || !email || !user_id || !role) {
      return NextResponse.json(
        { error: 'Name, email, role, and user_id are required' },
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

    // Validate position for players
    if (role === 'player' && !position) {
      return NextResponse.json(
        { error: 'Position is required for players' },
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

    // Check role limit for the selected role
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
      admin: 'ADM',
      data_admin: 'TMA',
      finance_admin: 'FNA',
      physio: 'PHY',
    }
    const prefix = rolePrefixes[role] || 'USR'
    const uniqueId = `${prefix}${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Create user profile
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id,
        unique_id: uniqueId,
        name,
        email,
        phone: phone || null,
        role: role as Role,
        status: 'active', // Users can be active immediately after signup
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

    // Create player record if role is player
    let playerRecord = null
    if (role === 'player' && position) {
      const category = position.includes('prop') || position.includes('hooker') || position.includes('lock') || position.includes('flanker') || position.includes('8th') ? 'forwards' : 'backs'
      
      const { data: playerData, error: playerError } = await supabaseAdmin
        .from('players')
        .insert({
          user_id,
          position,
          category,
        })
        .select()
        .single()

      if (playerError) {
        console.error('Error creating player record:', playerError)
        // Don't fail the signup if player record creation fails - it can be created later
        // But log it for admin attention
      } else {
        playerRecord = playerData
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
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
    console.error('Signup API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
