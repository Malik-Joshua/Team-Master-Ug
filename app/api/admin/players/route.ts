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
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseServiceKey
      })
      return NextResponse.json(
        { error: 'Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY environment variable' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get player details from players table first (this is the source of truth)
    let playerDetailsMap: Record<string, any> = {}
    let playerUserIds: string[] = []
    
    try {
      const { data: playerDetails, error: detailsError } = await supabaseAdmin
        .from('players')
        .select('*')
      
      if (!detailsError && playerDetails) {
        playerDetails.forEach((detail: any) => {
          playerDetailsMap[detail.user_id] = detail
          playerUserIds.push(detail.user_id)
        })
        console.log(`Found ${playerDetails.length} players in players table`)
      } else if (detailsError) {
        console.error('Error fetching from players table:', detailsError)
        // If players table doesn't exist or has an error, we'll fall back to user_profiles
      }
    } catch (err) {
      // players table might not exist, that's okay
      console.log('Note: players table not found or error accessing it:', err)
    }

    // Get user profiles for players that exist in the players table
    // If no players in players table, get all players from user_profiles (for backward compatibility)
    let query = supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('role', 'player')
    
    // Only include players that exist in players table if we have any
    if (playerUserIds.length > 0) {
      query = query.in('user_id', playerUserIds)
    }
    
    const { data: players, error: playersError } = await query.order('name', { ascending: true })

    if (playersError) {
      console.error('Error fetching players from Supabase:', playersError)
      console.error('Error details:', JSON.stringify(playersError, null, 2))
      return NextResponse.json(
        { 
          error: `Failed to fetch players: ${playersError.message}`,
          details: process.env.NODE_ENV === 'development' ? playersError : undefined,
          code: playersError.code,
          hint: playersError.hint
        },
        { status: 500 }
      )
    }

    // Filter to only include players that exist in players table (if we have any)
    const validPlayers = playerUserIds.length > 0
      ? players?.filter((p: any) => playerUserIds.includes(p.user_id)) || []
      : players || []

    console.log(`Fetched ${validPlayers.length} valid players (${playerUserIds.length} in players table, ${players?.length || 0} in user_profiles)`)
    if (validPlayers && validPlayers.length > 0) {
      console.log('Sample player:', validPlayers[0])
    }

    // Format players data (using validPlayers instead of players)
    const formattedPlayers = validPlayers.map((player: any) => {
      const details = playerDetailsMap[player.user_id] || {}
      return {
        id: player.user_id || player.id,
        user_id: player.user_id,
        name: player.name,
        email: player.email,
        phone: player.phone,
        position: details.position || player.position || '',
        category: details.category || '',
        jersey_number: details.jersey_number || null,
        date_of_birth: details.date_of_birth || '',
        height_cm: details.height_cm || null,
        weight_kg: details.weight_kg || null,
        status: player.status || 'active',
        games_played: 0, // Can be calculated from match_stats if needed
        tries: 0, // Can be calculated from match_stats if needed
        tackles: 0, // Can be calculated from match_stats if needed
      }
    }) || []

    console.log(`Fetched ${formattedPlayers.length} players from database`)

    return NextResponse.json({ 
      players: formattedPlayers,
      count: formattedPlayers.length 
    })
  } catch (error: any) {
    console.error('Error fetching players:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch players',
        type: error.constructor?.name,
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : undefined
      },
      { status: 500 }
    )
  }
}

