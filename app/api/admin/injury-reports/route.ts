import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

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

    // Get user profile to verify admin/coach/data_admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || !['admin', 'coach', 'asst_coach', 'data_admin', 'physio'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin/Coach/Data Admin/Physio access required' },
        { status: 403 }
      )
    }

    // Use service role to bypass RLS for admin queries
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

    // Fetch all injuries (not just active ones for reports)
    const { data: injuriesData, error: injuriesError } = await supabaseAdmin
      .from('injuries')
      .select('*')
      .order('injury_date', { ascending: false })

    if (injuriesError) {
      console.error('Error fetching injuries:', injuriesError)
      return NextResponse.json(
        { error: `Failed to fetch injuries: ${injuriesError.message}` },
        { status: 500 }
      )
    }

    if (!injuriesData || injuriesData.length === 0) {
      return NextResponse.json({ injuries: [] })
    }

    // Get all unique player IDs
    const playerIds = [...new Set(injuriesData.map((injury: any) => injury.player_id).filter(Boolean))]

    // Fetch player names and details
    let playerNamesMap: Record<string, { name: string; email?: string; position?: string; status?: string }> = {}

    if (playerIds.length > 0) {
      // Fetch player profiles with position from players table
      const { data: playersData, error: playersError } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, name, email, status')
        .in('user_id', playerIds)

      if (playersError) {
        console.error('Error fetching player profiles:', playersError)
      } else if (playersData && playersData.length > 0) {
        // Fetch positions from players table
        const { data: playersDetails, error: detailsError } = await supabaseAdmin
          .from('players')
          .select('user_id, position')
          .in('user_id', playerIds)

        const positionMap: Record<string, string> = {}
        if (playersDetails) {
          playersDetails.forEach((p: any) => {
            positionMap[p.user_id] = p.position
          })
        }

        playersData.forEach((player: any) => {
          playerNamesMap[player.user_id] = {
            name: player.name,
            email: player.email,
            position: positionMap[player.user_id],
            status: player.status,
          }
        })
        console.log('Successfully fetched player details for injuries:', playerNamesMap)
      } else {
        console.warn('No player data returned for player IDs:', playerIds)
      }
    }

    // Map injuries with player information
    // For injury reports, we want to show players who have active injuries
    const injuryReports = injuriesData
      .filter((injury: any) => injury.status === 'active') // Only show active injuries in reports
      .map((injury: any) => {
        const playerInfo = playerNamesMap[injury.player_id]
        return {
          id: injury.id,
          user_id: injury.player_id,
          name: playerInfo?.name || 'Unknown Player',
          email: playerInfo?.email || '',
          position: playerInfo?.position || '',
          status: playerInfo?.status || 'injured',
          injury_date: injury.injury_date,
          cause: injury.cause,
          diagnosis: injury.diagnosis,
          return_to_play_date: injury.return_to_play_date,
          return_to_training_date: injury.return_to_training_date,
        }
      })

    return NextResponse.json({ injuries: injuryReports })
  } catch (error: any) {
    console.error('Error in GET injury reports:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch injury reports' },
      { status: 500 }
    )
  }
}

