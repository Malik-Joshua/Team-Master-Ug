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

    // Get user profile to verify admin/coach role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || !['admin', 'coach', 'data_admin', 'physio'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin/Coach/Physio access required' },
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

    // Fetch active injuries
    const { data: injuriesData, error: injuriesError } = await supabaseAdmin
      .from('injuries')
      .select('*')
      .eq('status', 'active')
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

    // Fetch player names
    let playerNamesMap: Record<string, string> = {}

    if (playerIds.length > 0) {
      const { data: playersData, error: playersError } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, name')
        .in('user_id', playerIds)

      if (playersError) {
        console.error('Error fetching player names:', playersError)
      } else if (playersData && playersData.length > 0) {
        playersData.forEach((player: any) => {
          playerNamesMap[player.user_id] = player.name
        })
        console.log('Successfully fetched player names for injuries:', playerNamesMap)
      } else {
        console.warn('No player data returned for player IDs:', playerIds)
      }
    }

    // Map injuries with player names
    const injuriesWithPlayerNames = injuriesData.map((injury: any) => {
      const playerName = playerNamesMap[injury.player_id] || null
      if (!playerName) {
        console.warn('Player name not found for player_id:', injury.player_id, {
          availablePlayerIds: Object.keys(playerNamesMap),
          requestedPlayerId: injury.player_id,
          allPlayerIds: playerIds
        })
      }
      return {
        ...injury,
        player: {
          name: playerName || 'Unknown Player',
          user_id: injury.player_id,
        },
        player_name: playerName || 'Unknown Player',
        player_id: injury.player_id,
      }
    })

    return NextResponse.json({ injuries: injuriesWithPlayerNames })
  } catch (error: any) {
    console.error('Error in GET active injuries:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch active injuries' },
      { status: 500 }
    )
  }
}

