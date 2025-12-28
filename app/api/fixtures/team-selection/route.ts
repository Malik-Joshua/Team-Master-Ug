import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const matchId = searchParams.get('matchId')
    const playerId = searchParams.get('playerId')

    // If playerId is provided, find the player's selection for upcoming matches
    if (playerId && !matchId) {
      const supabase = await createClient()
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

      if (authError || !authUser || authUser.id !== playerId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
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

      // Get upcoming matches
      const today = new Date().toISOString().split('T')[0]
      const { data: upcomingMatches } = await supabaseAdmin
        .from('matches')
        .select('id, match_date, opponent, venue, tournament_type')
        .gte('match_date', today)
        .order('match_date', { ascending: true })
        .limit(1)

      if (!upcomingMatches || upcomingMatches.length === 0) {
        return NextResponse.json({
          isSelected: false,
          message: 'No upcoming matches found'
        })
      }

      const nextMatch = upcomingMatches[0]

      // Check if player is selected for this match
      const { data: selection } = await supabaseAdmin
        .from('fixture_team_selections')
        .select('*')
        .eq('match_id', nextMatch.id)
        .eq('player_id', playerId)
        .single()

      if (selection) {
        return NextResponse.json({
          isSelected: true,
          selection: {
            is_starting: selection.is_starting,
            is_substitute: selection.is_substitute,
            jersey_number: selection.jersey_number,
            position: selection.position,
          },
          match: nextMatch
        })
      } else {
        return NextResponse.json({
          isSelected: false,
          match: nextMatch
        })
      }
    }

    // Original matchId-based query
    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID or Player ID is required' },
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

    // Use service role key to bypass RLS for fixture_team_selections
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

    // Get team selections for this match with player names
    const { data: selections, error } = await supabaseAdmin
      .from('fixture_team_selections')
      .select('*')
      .eq('match_id', matchId)
      .order('is_starting', { ascending: false })
      .order('jersey_number', { ascending: true })

    if (error) {
      console.error('Error fetching team selections:', error)
      return NextResponse.json(
        { error: `Failed to fetch team selections: ${error.message}` },
        { status: 500 }
      )
    }

    // Fetch player names using service role to bypass RLS
    if (selections && selections.length > 0) {
      const playerIds = selections.map((s: any) => s.player_id)
      const { data: playersData, error: playersError } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, name')
        .in('user_id', playerIds)

      if (playersError) {
        console.error('Error fetching player names:', playersError)
      } else {
        // Map player names to selections
        const playersMap = new Map((playersData || []).map((p: any) => [p.user_id, p.name]))
        selections.forEach((selection: any) => {
          selection.player_name = playersMap.get(selection.player_id) || 'Unknown'
        })
      }
    }

    return NextResponse.json({
      selections: selections || [],
      count: selections?.length || 0
    })
  } catch (error: any) {
    console.error('Team selection GET API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

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

    // Validate that all player_ids exist in user_profiles
    const playerIds = selections.map((s: any) => s.player_id).filter(Boolean)
    if (playerIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid player IDs provided' },
        { status: 400 }
      )
    }

    const { data: existingPlayers, error: checkError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, role')
      .in('user_id', playerIds)

    if (checkError) {
      console.error('Error checking player IDs:', checkError)
      return NextResponse.json(
        { error: `Failed to validate players: ${checkError.message}` },
        { status: 500 }
      )
    }

    const existingPlayerIds = new Set(existingPlayers?.map((p: any) => p.user_id) || [])
    const missingPlayerIds = playerIds.filter((id: string) => !existingPlayerIds.has(id))

    if (missingPlayerIds.length > 0) {
      console.error('Invalid player IDs:', missingPlayerIds)
      return NextResponse.json(
        { 
          error: `The following player IDs do not exist in user_profiles: ${missingPlayerIds.join(', ')}`,
          invalidPlayerIds: missingPlayerIds
        },
        { status: 400 }
      )
    }

    // Insert new selections using service role (bypasses RLS)
    const records = selections.map((selection: any) => {
      // Validate required fields
      if (!selection.player_id) {
        throw new Error(`Invalid selection: player_id is required. Selection: ${JSON.stringify(selection)}`)
      }
      
      return {
        match_id: matchId,
        player_id: selection.player_id,
        position: selection.position || null,
        jersey_number: selection.jersey_number ? parseInt(String(selection.jersey_number)) : null,
        is_starting: selection.is_starting !== undefined ? Boolean(selection.is_starting) : true,
        is_substitute: selection.is_substitute !== undefined ? Boolean(selection.is_substitute) : false,
        notes: selection.notes || null,
        selected_by: authUser.id,
      }
    })
    
    console.log('Inserting team selections:', {
      matchId,
      recordsCount: records.length,
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

