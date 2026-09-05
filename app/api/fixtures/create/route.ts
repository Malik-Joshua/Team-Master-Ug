import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { match_date, opponent, tournament_type, squad_size, venue, notes, physio_id, team_manager_id, coach_id, asst_coach_id } = body

    // Validate required fields
    if (!match_date || !opponent) {
      return NextResponse.json(
        { error: 'Match date and opponent are required' },
        { status: 400 }
      )
    }
    if (!tournament_type || !String(tournament_type).trim()) {
      return NextResponse.json(
        { error: 'Tournament type is required' },
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

    if (!profile || !['data_admin', 'admin', 'coach', 'asst_coach'].includes(profile.role)) {
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

    const insertPayload: Record<string, any> = {
      match_date,
      opponent,
      tournament_type: String(tournament_type).trim(),
      squad_size: squad_size != null ? parseInt(String(squad_size), 10) : null,
      venue: venue || null,
      notes: notes || null,
      physio_id: physio_id || null,
      team_manager_id: team_manager_id || null,
      coach_id: coach_id || null,
      asst_coach_id: asst_coach_id || null,
      created_by: authUser.id,
    }

    // Create match/fixture record using service role (bypasses RLS)
    let match: any
    let matchError: any
    ;({ data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .insert(insertPayload)
      .select('id, match_date, opponent, venue, tournament_type, squad_size, physio_id, team_manager_id, coach_id, asst_coach_id')
      .single())

    // squad_size is a newer column (migration 042). If it hasn't been applied
    // yet, retry without it so fixture creation still works — the coach's
    // selection screen will just fall back to the standard 15s format.
    if (matchError?.message?.includes('squad_size')) {
      const { squad_size: _omit, ...withoutSquadSize } = insertPayload
      const retry = await supabaseAdmin
        .from('matches')
        .insert(withoutSquadSize)
        .select('id, match_date, opponent, venue, tournament_type, physio_id, team_manager_id, coach_id, asst_coach_id')
        .single()
      match = retry.data
      matchError = retry.error
    }

    if (matchError) {
      console.error('Error creating fixture:', matchError)
      // A custom (free-text) tournament type will fail here if migration 042
      // hasn't widened the tournament_type constraint yet — surface that clearly.
      if (matchError.message?.includes('matches_tournament_type_check')) {
        return NextResponse.json(
          { error: 'Custom tournament types aren\'t enabled yet — ask your admin to apply the latest database update, or pick one of the standard tournament types for now.' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: `Failed to create fixture: ${matchError.message}` },
        { status: 500 }
      )
    }

    // Create notifications for coaches and assistant coaches about the new fixture
    try {
      // Get all coaches and assistant coaches
      const { data: coaches, error: coachesError } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id')
        .in('role', ['coach', 'asst_coach'])
      
      if (!coachesError && coaches && coaches.length > 0) {
        const matchDate = new Date(match_date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
        
        const notifications = coaches.map((coach) => ({
          user_id: coach.user_id,
          title: 'New Fixture Created',
          message: `A new fixture has been created: vs ${opponent} on ${matchDate}. Please select the team for this match.`,
          type: 'info' as const,
          action_url: '/fixtures',
          reference_id: match.id,
          reference_type: 'fixture',
        }))
        
        const { error: notifError } = await supabaseAdmin
          .from('notifications')
          .insert(notifications)
        
        if (notifError) {
          console.error('Error creating notifications for coaches:', notifError)
          // Don't fail the fixture creation if notification fails
        } else {
          console.log(`Created ${notifications.length} notifications for coaches about new fixture`)
        }
      }
    } catch (notifErr) {
      console.error('Error in notification creation:', notifErr)
      // Don't fail the fixture creation if notification fails
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

