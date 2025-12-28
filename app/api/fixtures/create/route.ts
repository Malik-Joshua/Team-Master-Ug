import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { match_date, opponent, tournament_type, venue, notes } = body

    // Validate required fields
    if (!match_date || !opponent) {
      return NextResponse.json(
        { error: 'Match date and opponent are required' },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = await createClient()

    // Get authenticated user
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

    if (!profile || (profile.role !== 'data_admin' && profile.role !== 'admin' && profile.role !== 'coach')) {
      return NextResponse.json(
        { error: 'Only data admins, coaches, and admins can create fixtures' },
        { status: 403 }
      )
    }

    // Use service role key to bypass RLS for matches table
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Service role key is missing' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Create match/fixture record using service role (bypasses RLS)
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .insert({
        match_date,
        opponent,
        tournament_type: tournament_type || 'friendly',
        venue: venue || null,
        notes: notes || null,
        created_by: authUser.id,
      })
      .select('id, match_date, opponent, venue, tournament_type')
      .single()

    if (matchError) {
      console.error('Error creating fixture:', matchError)
      return NextResponse.json(
        { error: `Failed to create fixture: ${matchError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Fixture created successfully',
      data: match
    })
  } catch (error: any) {
    console.error('Fixture creation API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

