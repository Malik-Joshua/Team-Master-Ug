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
        physio_id: physio_id || null,
        team_manager_id: team_manager_id || null,
        coach_id: coach_id || null,
        created_by: authUser.id,
      })
      .select('id, match_date, opponent, venue, tournament_type, physio_id, team_manager_id, coach_id')
      .single()

    if (matchError) {
      console.error('Error creating fixture:', matchError)
      return NextResponse.json(
        { error: `Failed to create fixture: ${matchError.message}` },
        { status: 500 }
      )
    }

    // Create notifications for coaches about the new fixture
    try {
      // Get all coaches
      const { data: coaches, error: coachesError } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id')
        .eq('role', 'coach')
      
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

