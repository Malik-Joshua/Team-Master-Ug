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

      // Get upcoming matches (not played yet)
      const today = new Date().toISOString().split('T')[0]
      const { data: allMatches } = await supabaseAdmin
        .from('matches')
        .select('id, match_date, opponent, venue, tournament_type')
        .gte('match_date', today)
        .order('match_date', { ascending: true })

      if (!allMatches || allMatches.length === 0) {
        return NextResponse.json({
          isSelected: false,
          message: 'No upcoming matches found'
        })
      }

      // Filter out matches that have been played (date passed OR match stats exist)
      const matchIds = allMatches.map((m: any) => m.id)
      const { data: matchesWithStats } = await supabaseAdmin
        .from('match_stats')
        .select('match_id')
        .in('match_id', matchIds)
      
      const playedMatchIds = new Set(matchesWithStats?.map((s: any) => s.match_id) || [])
      
      const upcomingMatches = allMatches.filter((match: any) => {
        const matchDate = new Date(match.match_date)
        const todayDate = new Date(today)
        const isDatePassed = matchDate < todayDate
        const hasStats = playedMatchIds.has(match.id)
        return !isDatePassed && !hasStats
      })

      if (upcomingMatches.length === 0) {
        return NextResponse.json({
          isSelected: false,
          message: 'No upcoming matches found'
        })
      }

      const nextMatch = upcomingMatches[0]

      // Helper function to get captain and assistant captain info
      const getCaptainInfo = async (matchId: string) => {
        const { data: allTeamSelections } = await supabaseAdmin
          .from('fixture_team_selections')
          .select('player_id, is_captain, is_assistant_captain')
          .eq('match_id', matchId)
          .or('is_captain.eq.true,is_assistant_captain.eq.true')

        let captainInfo: any = null
        let assistantCaptainInfo: any = null

        if (allTeamSelections && allTeamSelections.length > 0) {
          const captainSelection = allTeamSelections.find((s: any) => s.is_captain)
          const assistantCaptainSelection = allTeamSelections.find((s: any) => s.is_assistant_captain)

          if (captainSelection) {
            const { data: captainProfile } = await supabaseAdmin
              .from('user_profiles')
              .select('user_id, name')
              .eq('user_id', captainSelection.player_id)
              .single()
            
            if (captainProfile) {
              captainInfo = {
                player_id: captainProfile.user_id,
                name: captainProfile.name,
              }
            }
          }

          if (assistantCaptainSelection) {
            const { data: assistantCaptainProfile } = await supabaseAdmin
              .from('user_profiles')
              .select('user_id, name')
              .eq('user_id', assistantCaptainSelection.player_id)
              .single()
            
            if (assistantCaptainProfile) {
              assistantCaptainInfo = {
                player_id: assistantCaptainProfile.user_id,
                name: assistantCaptainProfile.name,
              }
            }
          }
        }

        return { captainInfo, assistantCaptainInfo }
      }

      // Check if player is selected for this match
      const { data: selection } = await supabaseAdmin
        .from('fixture_team_selections')
        .select('*')
        .eq('match_id', nextMatch.id)
        .eq('player_id', playerId)
        .single()

      if (selection) {
        // Get all teammates for this match
        const { data: allSelections } = await supabaseAdmin
          .from('fixture_team_selections')
          .select('player_id, is_starting, is_substitute, position, jersey_number, is_captain, is_assistant_captain')
          .eq('match_id', nextMatch.id)
          .neq('player_id', playerId) // Exclude the current player

        // Get teammate names
        let teammates: any[] = []
        if (allSelections && allSelections.length > 0) {
          const teammateIds = allSelections.map((s: any) => s.player_id)
          const { data: teammateProfiles } = await supabaseAdmin
            .from('user_profiles')
            .select('user_id, name')
            .in('user_id', teammateIds)

          if (teammateProfiles) {
            const profilesMap = new Map(teammateProfiles.map((p: any) => [p.user_id, p.name]))
            teammates = allSelections.map((s: any) => ({
              ...s,
              name: profilesMap.get(s.player_id) || 'Unknown',
            }))
          }
        }

        // Get captain and assistant captain info for the match
        const { captainInfo, assistantCaptainInfo } = await getCaptainInfo(nextMatch.id)

        return NextResponse.json({
          isSelected: true,
          selection: {
            is_starting: selection.is_starting,
            is_substitute: selection.is_substitute,
            jersey_number: selection.jersey_number,
            position: selection.position,
            is_captain: selection.is_captain || false,
            is_assistant_captain: selection.is_assistant_captain || false,
          },
          match: nextMatch,
          teammates: teammates || [],
          captain: captainInfo,
          assistantCaptain: assistantCaptainInfo,
        })
      } else {
        // Player not selected, but still get captain info
        const { captainInfo, assistantCaptainInfo } = await getCaptainInfo(nextMatch.id)

        return NextResponse.json({
          isSelected: false,
          match: nextMatch,
          captain: captainInfo,
          assistantCaptain: assistantCaptainInfo,
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
    let { data: selections, error } = await supabaseAdmin
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

    // TOURNAMENT SQUAD PROPAGATION (defensive self-heal)
    //
    // A sevens tournament has one shared squad across all its games. If this
    // match belongs to a tournament AND has no selections, we look for a
    // sibling game in the same tournament that DOES have selections and copy
    // them across. This repairs the case where an older coach save only
    // wrote to game 1 before the "save-to-all" fix landed, so any staff
    // hitting "View Team" on games 2 / 3 / etc. now sees the correct squad.
    //
    // We also persist the copy so the game is truly "fixed" for next time.
    if (!selections || selections.length === 0) {
      const { data: thisMatch } = await supabaseAdmin
        .from('matches')
        .select('tournament_id')
        .eq('id', matchId)
        .maybeSingle()

      if (thisMatch?.tournament_id) {
        const { data: siblings } = await supabaseAdmin
          .from('matches')
          .select('id')
          .eq('tournament_id', thisMatch.tournament_id)
          .neq('id', matchId)

        const siblingIds = (siblings || []).map((s: any) => s.id)
        if (siblingIds.length > 0) {
          const { data: siblingSel } = await supabaseAdmin
            .from('fixture_team_selections')
            .select('*')
            .in('match_id', siblingIds)

          // Pick the sibling that has the largest saved squad (defensively
          // avoids picking a half-populated game if one exists).
          const byMatch: Record<string, any[]> = {}
          for (const s of siblingSel || []) (byMatch[s.match_id] ||= []).push(s)
          const bestMatchId = Object.keys(byMatch).sort((a, b) => byMatch[b].length - byMatch[a].length)[0]

          if (bestMatchId && byMatch[bestMatchId].length > 0) {
            const source = byMatch[bestMatchId]
            const rowsToInsert = source.map((s: any) => ({
              match_id: matchId,
              player_id: s.player_id,
              position: s.position ?? null,
              jersey_number: s.jersey_number ?? null,
              is_starting: s.is_starting ?? true,
              is_substitute: s.is_substitute ?? false,
              is_captain: s.is_captain ?? false,
              is_assistant_captain: s.is_assistant_captain ?? false,
              notes: s.notes ?? null,
              selected_by: s.selected_by ?? authUser.id,
            }))
            const { error: healErr } = await supabaseAdmin
              .from('fixture_team_selections')
              .insert(rowsToInsert)
            if (healErr) {
              console.warn('[team-selection GET] auto-propagate failed:', healErr.message)
            }
            // Re-read so we return the same shape as the primary path.
            const { data: refreshed } = await supabaseAdmin
              .from('fixture_team_selections')
              .select('*')
              .eq('match_id', matchId)
              .order('is_starting', { ascending: false })
              .order('jersey_number', { ascending: true })
            selections = refreshed || rowsToInsert as any
          }
        }
      }
    }

    // Fetch player names using service role to bypass RLS
    if (selections && selections.length > 0) {
      const playerIds = selections.map((s: any) => s.player_id)
      const { data: playersData, error: playersError } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, name, profile_picture_url')
        .in('user_id', playerIds)

      if (playersError) {
        console.error('Error fetching player names:', playersError)
      } else {
        // Map player names + photos to selections
        const playersMap = new Map((playersData || []).map((p: any) => [p.user_id, p]))
        selections.forEach((selection: any) => {
          const prof: any = playersMap.get(selection.player_id)
          selection.player_name = prof?.name || 'Unknown'
          selection.profile_picture_url = prof?.profile_picture_url || null
          selection.player = { name: prof?.name || 'Unknown' }
        })
      }
    }

    // Get match details including staff assignments
    let { data: matchDetails } = await supabaseAdmin
      .from('matches')
      .select('id, match_date, opponent, venue, tournament_type, notes, physio_id, team_manager_id, coach_id, tournament_id')
      .eq('id', matchId)
      .single()

    // TOURNAMENT STAFF SELF-HEAL
    //
    // One physio / manager / coach covers a whole sevens tournament, but
    // legacy games may have their staff columns empty because they were
    // created before this rule existed (or before a tournament sibling had
    // staff assigned). If any staff role is missing AND a sibling in the
    // same tournament has one set, copy it in and persist so subsequent
    // reads (physio dashboard, coach dashboard, PDF exports, etc.) all
    // see it. Roles that are already set are left alone.
    if (matchDetails?.tournament_id && (!matchDetails.physio_id || !matchDetails.team_manager_id || !matchDetails.coach_id)) {
      const { data: siblings } = await supabaseAdmin
        .from('matches')
        .select('id, physio_id, team_manager_id, coach_id')
        .eq('tournament_id', matchDetails.tournament_id)
        .neq('id', matchId)
      const fillIn: Record<string, string> = {}
      for (const s of siblings || []) {
        if (!matchDetails.physio_id && s.physio_id && !fillIn.physio_id) fillIn.physio_id = s.physio_id
        if (!matchDetails.team_manager_id && s.team_manager_id && !fillIn.team_manager_id) fillIn.team_manager_id = s.team_manager_id
        if (!matchDetails.coach_id && s.coach_id && !fillIn.coach_id) fillIn.coach_id = s.coach_id
      }
      if (Object.keys(fillIn).length > 0) {
        await supabaseAdmin.from('matches').update(fillIn).eq('id', matchId)
        matchDetails = { ...matchDetails, ...fillIn }
        console.log(`[team-selection GET] auto-healed staff for tournament game ${matchId}:`, Object.keys(fillIn))
      }
    }

    // Fetch staff names if assigned
    let responseMatchDetails: any = matchDetails
    if (matchDetails) {
      const staffIds: string[] = []
      if (matchDetails.physio_id) staffIds.push(matchDetails.physio_id)
      if (matchDetails.team_manager_id) staffIds.push(matchDetails.team_manager_id)
      if (matchDetails.coach_id) staffIds.push(matchDetails.coach_id)

      if (staffIds.length > 0) {
        const { data: staffProfiles } = await supabaseAdmin
          .from('user_profiles')
          .select('user_id, name')
          .in('user_id', staffIds)

        if (staffProfiles) {
          const staffMap = new Map(staffProfiles.map((p: any) => [p.user_id, p.name]))
          responseMatchDetails = {
            ...matchDetails,
            physio: matchDetails.physio_id ? { name: staffMap.get(matchDetails.physio_id) || 'Unknown' } : null,
            team_manager: matchDetails.team_manager_id ? { name: staffMap.get(matchDetails.team_manager_id) || 'Unknown' } : null,
            coach: matchDetails.coach_id ? { name: staffMap.get(matchDetails.coach_id) || 'Unknown' } : null
          }
        }
      }
    }

    // Format selections into starting and substitutes
    const starting = selections?.filter((s: any) => s.is_starting && !s.is_substitute) || []
    const substitutes = selections?.filter((s: any) => s.is_substitute) || []

    return NextResponse.json({
      selections: selections || [],
      count: selections?.length || 0,
      match: responseMatchDetails,
      starting: starting,
      substitutes: substitutes,
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

    if (!profile || (profile.role !== 'coach' && profile.role !== 'admin' && profile.role !== 'data_admin')) {
      return NextResponse.json(
        { error: 'Only coaches, admins, and data managers can select teams' },
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
        is_captain: selection.is_captain !== undefined ? Boolean(selection.is_captain) : false,
        is_assistant_captain: selection.is_assistant_captain !== undefined ? Boolean(selection.is_assistant_captain) : false,
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

    // TOURNAMENT SQUAD PROPAGATION (server-side safety net)
    //
    // If this match is part of a sevens tournament, mirror the same squad
    // to every sibling game in that tournament. This makes the "one squad
    // for the whole tournament" rule an invariant regardless of which
    // client path (coach page, manager page, admin page) issued the save,
    // so we can't get back into the state where game 1 has a full squad
    // and games 2/3 are empty.
    if (!insertError) {
      try {
        const { data: parentMatch } = await supabaseAdmin
          .from('matches')
          .select('tournament_id')
          .eq('id', matchId)
          .maybeSingle()
        if (parentMatch?.tournament_id) {
          const { data: siblings } = await supabaseAdmin
            .from('matches')
            .select('id')
            .eq('tournament_id', parentMatch.tournament_id)
            .neq('id', matchId)
          const siblingIds = (siblings || []).map((s: any) => s.id)
          if (siblingIds.length > 0) {
            // Wipe & repopulate each sibling's selections in one round trip.
            await supabaseAdmin.from('fixture_team_selections').delete().in('match_id', siblingIds)
            const mirrored: any[] = []
            for (const sid of siblingIds) {
              for (const r of records) mirrored.push({ ...r, match_id: sid })
            }
            if (mirrored.length > 0) {
              const { error: mirrErr } = await supabaseAdmin
                .from('fixture_team_selections')
                .insert(mirrored)
              if (mirrErr) console.warn('[team-selection POST] tournament propagate failed:', mirrErr.message)
              else console.log(`[team-selection POST] mirrored squad to ${siblingIds.length} sibling tournament game(s)`)
            }
          }
        }
      } catch (propErr) {
        console.warn('[team-selection POST] tournament propagate errored:', propErr)
        // Non-fatal — the primary save already succeeded.
      }
    }

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

    // Get match details for notification
    const { data: matchDetails } = await supabaseAdmin
      .from('matches')
      .select('match_date, opponent, venue, tournament_type')
      .eq('id', matchId)
      .single()

    // Send notifications to all selected players
    if (newSelections && newSelections.length > 0 && matchDetails) {
      try {
        const { db } = await import('@/lib/db-helpers')
        const selectedPlayerIds = newSelections.map((s: any) => s.player_id)
        
        const matchDate = new Date(matchDetails.match_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        
        await db.createNotificationForUsers(selectedPlayerIds, {
          title: 'Team Selection',
          message: `You have been selected for the match vs ${matchDetails.opponent} on ${matchDate}`,
          type: 'info',
          action_url: '/dashboard',
          reference_id: matchId,
          reference_type: 'fixture_team_selection',
        })
        
        console.log(`Sent notifications to ${selectedPlayerIds.length} selected players`)
      } catch (notifError) {
        console.error('Error sending notifications:', notifError)
        // Don't fail the request if notifications fail
      }
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

/**
 * Delete the entire team selection for a match (without deleting the fixture).
 * Lets a coach clear a saved squad and start over.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const matchId = searchParams.get('matchId')
    if (!matchId) {
      return NextResponse.json({ error: 'Match ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || !['coach', 'admin', 'data_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only coaches, admins, and data managers can clear a squad' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { error: deleteError } = await supabaseAdmin
      .from('fixture_team_selections')
      .delete()
      .eq('match_id', matchId)

    if (deleteError) {
      return NextResponse.json({ error: `Failed to clear squad: ${deleteError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Team selection DELETE error:', error)
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 })
  }
}

