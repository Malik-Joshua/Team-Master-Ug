import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET endpoint to fetch players (bypasses RLS using service role)
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Service role key is missing' },
        { status: 500 }
      )
    }

    // Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') || 'player'
    const status = searchParams.get('status') || null // null means all statuses
    const includePlayerData = searchParams.get('includePlayerData') === 'true'

    // Build query
    let query = supabase
      .from('user_profiles')
      .select(includePlayerData 
        ? `user_id, name, email, phone, role, status, created_at, players(position, category, jersey_number)`
        : `user_id, name, email, phone, role, status, created_at`
      )

    // Handle role filter - if role is 'admin', include all admin types
    if (role === 'admin') {
      query = query.in('role', ['admin', 'data_admin', 'finance_admin'])
    } else {
      query = query.eq('role', role)
    }

    // Only filter by status if explicitly provided
    if (status) {
      query = query.eq('status', status)
    }

    query = query.order('name', { ascending: true })

    const { data: players, error } = await query

    if (error) {
      console.error('Error fetching players:', error)
      return NextResponse.json(
        { error: `Failed to fetch players: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      players: players || [],
      count: players?.length || 0,
    })
  } catch (error: any) {
    console.error('Players API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST endpoint for creating players (existing - keep it)
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
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
      }
    })
  } catch (error: any) {
    console.error('Error creating player:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
