import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Delete existing selections for this match
    const { error: deleteError } = await supabase
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

    // Insert new selections
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

    const { data: newSelections, error: insertError } = await supabase
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

