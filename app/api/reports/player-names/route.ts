import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { playerIds } = body

    console.log('API: player-names called with playerIds:', playerIds, 'Count:', playerIds?.length)

    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      console.error('API: Invalid playerIds:', playerIds)
      return NextResponse.json(
        { error: 'Player IDs array is required' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    console.log('API: Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceKey,
      urlLength: supabaseUrl?.length || 0,
      keyLength: supabaseServiceKey?.length || 0
    })

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('API: Missing environment variables')
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

    console.log('API: Querying user_profiles for playerIds:', playerIds, 'at', new Date().toISOString())

    // Fetch player names from user_profiles with timeout
    // Note: match_stats.player_id references players.user_id, which equals user_profiles.user_id
    const queryStart = Date.now()
    const { data: playerProfiles, error: profilesError } = await Promise.race([
      supabaseAdmin
        .from('user_profiles')
        .select('user_id, name')
        .in('user_id', playerIds),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 10s')), 10000)
      )
    ]) as any

    const queryTime = Date.now() - queryStart
    console.log('API: user_profiles query completed in', queryTime, 'ms:', {
      found: playerProfiles?.length || 0,
      requested: playerIds.length,
      profiles: playerProfiles?.slice(0, 5).map((p: any) => ({ user_id: p.user_id, name: p.name })),
      error: profilesError
    })

    if (profilesError) {
      console.error('API: Error fetching player profiles:', profilesError)
      return NextResponse.json(
        { error: 'Failed to fetch player profiles', details: profilesError.message },
        { status: 500 }
      )
    }

    // Also try fetching through players table as a fallback
    let playerProfilesFromPlayers: any[] = []
    try {
      console.log('API: Querying players table for playerIds:', playerIds)
      const { data: playersData, error: playersError } = await supabaseAdmin
        .from('players')
        .select('user_id, user_profiles!players_user_id_fkey(user_id, name)')
        .in('user_id', playerIds)

      console.log('API: players table query result:', {
        found: playersData?.length || 0,
        error: playersError
      })

      if (playersData) {
        playersData.forEach((player: any) => {
          if (player.user_profiles) {
            playerProfilesFromPlayers.push({
              user_id: player.user_id,
              name: player.user_profiles.name
            })
          }
        })
        console.log('API: Processed players data:', playerProfilesFromPlayers.length)
      }
    } catch (playersError) {
      console.error('API: Error fetching through players table:', playersError)
    }

    // Merge both sources and create unique map
    const allProfiles = [...(playerProfiles || []), ...playerProfilesFromPlayers]
    const uniqueProfiles = Array.from(
      new Map(allProfiles.map((p: any) => [p.user_id, p])).values()
    )

    console.log('API: Merged profiles:', {
      fromUserProfiles: playerProfiles?.length || 0,
      fromPlayers: playerProfilesFromPlayers.length,
      unique: uniqueProfiles.length
    })

    // Create a map for quick lookup
    const playerNameMap: Record<string, string> = {}
    uniqueProfiles.forEach((profile: any) => {
      if (profile.user_id && profile.name) {
        playerNameMap[profile.user_id] = profile.name
      }
    })

    const totalTime = Date.now() - startTime
    console.log('API: Final playerNameMap:', {
      mapSize: Object.keys(playerNameMap).length,
      entries: Object.entries(playerNameMap),
      totalTime: totalTime + 'ms'
    })

    return NextResponse.json({
      success: true,
      playerNames: playerNameMap,
      profilesFound: uniqueProfiles.length,
      requested: playerIds.length,
      responseTime: totalTime
    })
  } catch (error: any) {
    const totalTime = Date.now() - startTime
    console.error('Error in player-names API after', totalTime, 'ms:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    })
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

