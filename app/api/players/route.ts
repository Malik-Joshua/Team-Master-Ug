import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRoleLimit, getRoleLimitErrorMessage, ROLE_LIMITS } from '@/lib/role-limits'

// This route requires service role for admin operations
// In production, you should use environment variables for the service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const body = await request.json()
    const { name, email, phone, position, category, jersey_number, date_of_birth, height_cm, weight_kg, status } = body

    // Validate required fields
    if (!name || !email || !position) {
      return NextResponse.json(
        { error: 'Name, email, and position are required' },
        { status: 400 }
      )
    }

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
    })

    if (authError) {
      return NextResponse.json(
        { error: `Failed to create user: ${authError.message}` },
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
      await supabase.from('user_profiles').delete().eq('user_id', authData.user.id)
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `Failed to create player record: ${playerError.message}` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Player created successfully',
      data: {
        profile: profileData,
        player: playerRecord,
        tempPassword, // In production, send this via email instead
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






