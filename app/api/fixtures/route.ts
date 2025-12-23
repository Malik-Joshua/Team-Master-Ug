import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST endpoint to create a new fixture/match
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { match_date, opponent, tournament_type, venue } = body

    // Validate required fields
    if (!match_date || !opponent) {
      return NextResponse.json(
        { error: 'Match date and opponent are required' },
        { status: 400 }
      )
    }

    // Validate tournament type
    const validTournamentTypes = ['uganda_cup', 'league', 'sevens', 'friendly']
    const tournamentType = tournament_type || 'friendly'
    if (!validTournamentTypes.includes(tournamentType)) {
      return NextResponse.json(
        { error: `Invalid tournament type. Must be one of: ${validTournamentTypes.join(', ')}` },
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

    // Allow data_admin (team manager), admin, and coach to create fixtures
    if (!profile || (profile.role !== 'data_admin' && profile.role !== 'admin' && profile.role !== 'coach')) {
      return NextResponse.json(
        { error: 'Only team managers, admins, and coaches can create fixtures' },
        { status: 403 }
      )
    }

    // Create the match/fixture
    const { data: newMatch, error: insertError } = await supabase
      .from('matches')
      .insert({
        match_date,
        opponent,
        tournament_type: tournamentType,
        venue: venue || null,
        created_by: authUser.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating fixture:', insertError)
      return NextResponse.json(
        { error: `Failed to create fixture: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Fixture created successfully',
      data: newMatch,
    })
  } catch (error: any) {
    console.error('Fixture API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch upcoming fixtures
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get upcoming matches (from today onwards)
    const today = new Date().toISOString().split('T')[0]
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .gte('match_date', today)
      .order('match_date', { ascending: true })

    if (matchesError) {
      console.error('Error fetching fixtures:', matchesError)
      return NextResponse.json(
        { error: 'Failed to fetch fixtures' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      fixtures: matches || [],
      count: matches?.length || 0,
    })
  } catch (error: any) {
    console.error('Fixture GET API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}


