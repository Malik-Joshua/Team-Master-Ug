import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ROLE_LIMITS, type Role } from '@/lib/role-limits'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, role, position, user_id, birth_date } = body

    // Validate required fields
    if (!name || !email || !user_id || !role) {
      return NextResponse.json(
        { error: 'Name, email, role, and user_id are required' },
        { status: 400 }
      )
    }

    // Map wizard role values to internal roles
    const roleMap: Record<string, string> = {
      owner: 'admin',
      team_manager: 'data_admin',
      head_coach: 'coach',
    }
    const mappedRole = roleMap[role] || role

    // Validate role
    if (!Object.keys(ROLE_LIMITS).includes(mappedRole)) {
      return NextResponse.json(
        { error: `Invalid role. Allowed roles: ${Object.keys(ROLE_LIMITS).join(', ')}` },
        { status: 400 }
      )
    }

    // Validate position for players only
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

    // IMPORTANT: For client-side signups, we ALWAYS use pending_signups approach
    // This avoids foreign key constraint violations because the user might not exist in auth.users yet
    // The profile will be created when the user logs in after email confirmation via /api/auth/complete-signup
    
    // Check if pending signup already exists
    const { data: existingPending } = await supabaseAdmin
      .from('pending_signups')
      .select('id')
      .eq('user_id', user_id)
      .maybeSingle()

    if (existingPending) {
      // Update existing pending signup
      const { error: updateError } = await supabaseAdmin
        .from('pending_signups')
        .update({
          name,
          email,
          phone: phone || null,
          role: mappedRole as Role,
          position: mappedRole === 'player' ? position : null,
          birth_date: birth_date || null,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        })
        .eq('id', existingPending.id)

      if (updateError) {
        console.error('Error updating pending signup:', updateError)
        return NextResponse.json(
          { error: `Failed to save signup data: ${updateError.message || 'Unknown error'}` },
          { status: 500 }
        )
      }
    } else {
      // Create new pending signup
      // NOTE: This table has NO foreign key constraint to auth.users to avoid errors
      const { error: pendingError } = await supabaseAdmin
        .from('pending_signups')
        .insert({
          user_id,
          name,
          email,
          phone: phone || null,
          role: mappedRole as Role,
          position: mappedRole === 'player' ? position : null,
          birth_date: birth_date || null,
        })

      if (pendingError) {
        console.error('Error creating pending signup:', pendingError)
        
        // If table doesn't exist, provide helpful error
        if (pendingError.code === '42P01' || pendingError.message?.includes('does not exist')) {
          return NextResponse.json(
            { 
              error: 'Database migration required. Please run migration 028_pending_signups_table.sql in your Supabase SQL Editor.',
              migrationRequired: true
            },
            { status: 500 }
          )
        }
        
        // If foreign key error (shouldn't happen if migration is correct), provide helpful message
        if (pendingError.code === '23503') {
          return NextResponse.json(
            { 
              error: 'Database configuration issue. Please ensure migration 028_pending_signups_table.sql has been run and the foreign key constraint on pending_signups.user_id has been removed.',
              migrationRequired: true
            },
            { status: 500 }
          )
        }
        
        return NextResponse.json(
          { error: `Failed to save signup data: ${pendingError.message || 'Unknown error'}` },
          { status: 500 }
        )
      }
    }

    // SUCCESS: Return immediately - profile will be created on login after email confirmation
    // IMPORTANT: We NEVER create a profile here to avoid foreign key errors
    console.log('Signup successful - data saved to pending_signups, profile will be created on login')
    return NextResponse.json({
      success: true,
      message: 'Signup data saved. Please check your email and confirm your account to complete registration.',
      requiresEmailConfirmation: true,
      email: email
    })
    
    // NO CODE BELOW THIS POINT WILL EXECUTE
    // Profile creation is handled by /api/auth/complete-signup when user logs in
    // This endpoint NEVER creates user_profiles to avoid foreign key constraint violations
    
  } catch (error: any) {
    console.error('Signup API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
