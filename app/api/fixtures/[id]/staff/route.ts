import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Update staff assignments for a fixture
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { physio_id, team_manager_id, coach_id, asst_coach_id } = body

    const supabase = await createClient()
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

    if (!profile || (profile.role !== 'data_admin' && profile.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only data managers and admins can update staff assignments' },
        { status: 403 }
      )
    }

    const matchId = params.id

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

    // Build update object
    const updateData: any = {}
    if (physio_id !== undefined) updateData.physio_id = physio_id || null
    if (team_manager_id !== undefined) updateData.team_manager_id = team_manager_id || null
    if (coach_id !== undefined) updateData.coach_id = coach_id || null
    if (asst_coach_id !== undefined) updateData.asst_coach_id = asst_coach_id || null

    // Update match with staff assignments
    const { data: updatedMatch, error: updateError } = await supabaseAdmin
      .from('matches')
      .update(updateData)
      .eq('id', matchId)
      .select('id, match_date, opponent, venue, tournament_type, physio_id, team_manager_id, coach_id, asst_coach_id, tournament_id')
      .single()

    if (updateError) {
      console.error('Error updating staff assignments:', updateError)
      return NextResponse.json(
        { error: `Failed to update staff assignments: ${updateError.message}` },
        { status: 500 }
      )
    }

    if (!updatedMatch) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      )
    }

    // TOURNAMENT STAFF PROPAGATION
    //
    // A sevens tournament runs across 3–6 games with one shared squad AND
    // one shared support crew (physio, team manager, coach). Assigning them
    // to one game should populate every other game in the same tournament,
    // so the physio/manager can see the full weekend on their dashboards
    // without staff having to click into each fixture and re-assign.
    //
    // Only fields explicitly present in this PATCH body are mirrored — that
    // way you can update just one role (e.g. swap the physio) without
    // clobbering another.
    if (updatedMatch.tournament_id) {
      try {
        const { data: siblings } = await supabaseAdmin
          .from('matches')
          .select('id')
          .eq('tournament_id', updatedMatch.tournament_id)
          .neq('id', matchId)
        const siblingIds = (siblings || []).map((s: any) => s.id)
        if (siblingIds.length > 0) {
          const { error: mirrorErr } = await supabaseAdmin
            .from('matches')
            .update(updateData)
            .in('id', siblingIds)
          if (mirrorErr) {
            console.warn('[staff PATCH] tournament propagate failed:', mirrorErr.message)
          } else {
            console.log(`[staff PATCH] mirrored staff to ${siblingIds.length} sibling tournament game(s)`)
          }
        }
      } catch (propErr) {
        console.warn('[staff PATCH] tournament propagate errored:', propErr)
      }
    }

    // Fetch staff names if assigned
    const staffIds: string[] = []
    if (updatedMatch.physio_id) staffIds.push(updatedMatch.physio_id)
    if (updatedMatch.team_manager_id) staffIds.push(updatedMatch.team_manager_id)
    if (updatedMatch.coach_id) staffIds.push(updatedMatch.coach_id)
    if (updatedMatch.asst_coach_id) staffIds.push(updatedMatch.asst_coach_id)

    let responseData: any = { ...updatedMatch }

    if (staffIds.length > 0) {
      const { data: staffProfiles } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, name')
        .in('user_id', staffIds)

      if (staffProfiles) {
        const staffMap = new Map(staffProfiles.map((p: any) => [p.user_id, p.name]))
        // Add staff names to the response object
        responseData = {
          ...updatedMatch,
          physio: updatedMatch.physio_id ? { name: staffMap.get(updatedMatch.physio_id) || 'Unknown' } : null,
          team_manager: updatedMatch.team_manager_id ? { name: staffMap.get(updatedMatch.team_manager_id) || 'Unknown' } : null,
          coach: updatedMatch.coach_id ? { name: staffMap.get(updatedMatch.coach_id) || 'Unknown' } : null,
          asst_coach: updatedMatch.asst_coach_id ? { name: staffMap.get(updatedMatch.asst_coach_id) || 'Unknown' } : null,
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Staff assignments updated successfully',
      data: responseData
    })
  } catch (error: any) {
    console.error('Error updating staff assignments:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
