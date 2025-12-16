import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name, phone, role, position } = body

    // Validate required fields
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Validate role if provided
    const validRoles = ['player', 'coach', 'data_admin', 'finance_admin', 'admin']
    const userRole = role || 'player' // Default to player
    if (!validRoles.includes(userRole)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = await createClient()

    // Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`,
      },
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      )
    }

    // Generate unique_id
    const uniqueId = `USR${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Create user profile
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: authData.user.id,
        unique_id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        role: userRole,
        status: 'active', // Users can immediately access after signup
      })
      .select()
      .single()

    if (profileError) {
      // If profile creation fails, try to clean up the auth user
      // Note: We can't delete the auth user from client-side, but it will be handled by RLS
      console.error('Profile creation error:', profileError)
      return NextResponse.json(
        { 
          error: `Failed to create profile: ${profileError.message}`,
          details: profileError.code === '23505' ? 'An account with this email already exists' : profileError.message
        },
        { status: 400 }
      )
    }

    // If user is a player and position is provided, create player record
    if (userRole === 'player' && position) {
      const validPositions = [
        'prop', 'hooker', 'lock', 'flanker', '8th_man',
        'scrum_half', 'fly_half', 'inside_center', 'outside_center', 'winger'
      ]
      
      if (validPositions.includes(position)) {
        const category = ['prop', 'hooker', 'lock', 'flanker', '8th_man'].includes(position)
          ? 'forwards'
          : 'backs'

        const { error: playerError } = await supabase
          .from('players')
          .insert({
            user_id: authData.user.id,
            position,
            category,
          })

        if (playerError) {
          // Log error but don't fail signup - player record can be added later
          console.error('Player record creation error:', playerError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully! You can now sign in.',
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
        profile: profileData,
        // Note: Supabase may require email confirmation depending on settings
        requiresEmailConfirmation: !authData.session,
      }
    })
  } catch (error: any) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred during signup' },
      { status: 500 }
    )
  }
}

