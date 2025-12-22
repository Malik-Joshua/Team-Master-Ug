import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// GET endpoint to fetch team selection for a match
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let matchId = searchParams.get('matchId')
    const playerId = searchParams.get('playerId') // For players to check their selection

    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, user_id')
      .eq('user_id', authUser.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Use service role to bypass RLS for fetching selections
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

    // If playerId is provided, get that player's selection
    if (playerId) {
      if (profile.user_id !== playerId && profile.role !== 'coach' && profile.role !== 'admin' && profile.role !== 'data_admin' && profile.role !== 'physio') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }

      if (!matchId) {
        // Get latest upcoming fixture for player
        const { data: latestMatches, error: matchError } = await supabaseAdmin
          .from('matches')
          .select('id, match_date, opponent, venue, tournament_type')
          .gte('match_date', new Date().toISOString().split('T')[0])
          .order('match_date', { ascending: true })
          .limit(1)

        if (matchError) {
          console.error('Error fetching latest match:', matchError)
        }

        if (matchError || !latestMatches || latestMatches.length === 0) {
          console.log('No upcoming matches found for player:', playerId)
          return NextResponse.json({
            success: true,
            isSelected: false,
            selection: null,
            match: null,
          })
        }

        matchId = latestMatches[0].id
        console.log('Found latest match for player:', { playerId, matchId, matchDate: latestMatches[0].match_date })
      }

      // Get match info separately to ensure we have it
      const { data: matchInfo, error: matchInfoError } = await supabaseAdmin
        .from('matches')
        .select('id, match_date, opponent, venue, tournament_type')
        .eq('id', matchId)
        .single()

      if (matchInfoError) {
        console.error('Error fetching match info:', matchInfoError)
      }

      if (!matchInfo) {
        console.log('Match not found:', matchId)
        return NextResponse.json({
          success: true,
          isSelected: false,
          selection: null,
          match: null,
        })
      }

      // Query for player selection
      const { data: selection, error: selectionError } = await supabaseAdmin
        .from('fixture_team_selections')
        .select('*')
        .eq('match_id', matchId)
        .eq('player_id', playerId)
        .maybeSingle()

      if (selectionError && selectionError.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error fetching player selection:', selectionError)
        return NextResponse.json(
          { error: 'Failed to fetch selection' },
          { status: 500 }
        )
      }

      console.log('Player selection query result:', {
        playerId,
        matchId,
        found: !!selection,
        selection: selection ? { id: selection.id, is_starting: selection.is_starting, is_substitute: selection.is_substitute } : null
      })

      return NextResponse.json({
        success: true,
        isSelected: !!selection,
        selection: selection || null,
        match: matchInfo || null,
      })
    }

    // Get full team selection for a match (for coaches, admins, team managers, physio)
    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' },
        { status: 400 }
      )
    }

    // Check if user has permission to view team selections
    if (profile.role !== 'coach' && profile.role !== 'admin' && profile.role !== 'data_admin' && profile.role !== 'physio') {
      return NextResponse.json(
        { error: 'Unauthorized to view team selections' },
        { status: 403 }
      )
    }

    // Get match info
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      )
    }

    // Get all selections for this match
    const { data: selections, error: selectionsError } = await supabaseAdmin
      .from('fixture_team_selections')
      .select('*')
      .eq('match_id', matchId)
      .order('is_starting', { ascending: false })
      .order('jersey_number', { ascending: true, nullsFirst: false })

    if (selectionsError) {
      console.error('Error fetching team selections:', selectionsError)
      return NextResponse.json(
        { error: 'Failed to fetch team selections' },
        { status: 500 }
      )
    }

    // Get player information for each selection
    const playerIds = [...new Set((selections || []).map((s: any) => s.player_id))]
    let playersMap = new Map()
    
    if (playerIds.length > 0) {
      const { data: players } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, name, email')
        .in('user_id', playerIds)
      
      if (players) {
        playersMap = new Map(players.map((p: any) => [p.user_id, p]))
      }
    }

    // Enrich selections with player data
    const enrichedSelections = (selections || []).map((selection: any) => ({
      ...selection,
      player: playersMap.get(selection.player_id) || { user_id: selection.player_id, name: 'Unknown', email: '' },
    }))

    return NextResponse.json({
      success: true,
      match,
      selections: enrichedSelections,
      starting: enrichedSelections.filter((s: any) => s.is_starting && !s.is_substitute),
      substitutes: enrichedSelections.filter((s: any) => s.is_substitute),
      count: enrichedSelections.length,
    })
  } catch (error: any) {
    console.error('Team selection GET API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST endpoint (existing - keep it)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { matchId, selections } = body

    // Validate required fields
    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' },
        { status: 400 }
      )
    }

    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return NextResponse.json(
        { error: 'At least one player selection is required' },
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

    if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only coaches and admins can select teams' },
        { status: 403 }
      )
    }

    // Use service role key to bypass RLS for fixture_team_selections
    // We've already validated the user's role above, so this is safe
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

    // Delete existing selections for this match using service role (bypasses RLS)
    const { error: deleteError } = await supabaseAdmin
      .from('fixture_team_selections')
      .delete()
      .eq('match_id', matchId)

    if (deleteError) {
      console.error('Error deleting existing selections:', deleteError)
      
      // Check if the error is because the table doesn't exist
      if (deleteError.message?.includes('Could not find the table') || 
          deleteError.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'The fixture_team_selections table does not exist in the database. Please run the migration SQL in Supabase SQL Editor. See CREATE_FIXTURE_TABLE.md for instructions.',
            details: deleteError.message,
            requiresMigration: true
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: `Failed to clear existing selections: ${deleteError.message}` },
        { status: 500 }
      )
    }

    // Insert new selections using service role (bypasses RLS)
    const records = selections.map((selection: any) => ({
      match_id: matchId,
      player_id: selection.player_id,
      position: selection.position || null,
      jersey_number: selection.jersey_number || null,
      is_starting: selection.is_starting ?? true,
      is_substitute: selection.is_substitute ?? false,
      notes: selection.notes || null,
      selected_by: authUser.id,
    }))

    console.log('Saving team selections:', {
      matchId,
      selectedBy: authUser.id,
      selectionsCount: records.length,
      playerIds: records.map(r => r.player_id),
      records: records.map(r => ({ player_id: r.player_id, is_starting: r.is_starting, is_substitute: r.is_substitute }))
    })

    const { data: newSelections, error: insertError } = await supabaseAdmin
      .from('fixture_team_selections')
      .insert(records)
      .select()

    if (insertError) {
      console.error('Error inserting team selections:', insertError)
      
      // Check if the error is because the table doesn't exist
      if (insertError.message?.includes('Could not find the table') || 
          insertError.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'The fixture_team_selections table does not exist in the database. Please run the migration SQL in Supabase SQL Editor. See CREATE_FIXTURE_TABLE.md for instructions.',
            details: insertError.message,
            requiresMigration: true
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: `Failed to save team selection: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Team selection saved successfully',
      data: newSelections,
      count: newSelections?.length || 0,
    })
  } catch (error: any) {
    console.error('Team selection API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
