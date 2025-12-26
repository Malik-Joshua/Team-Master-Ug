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

    if (!profile || !['admin', 'coach', 'data_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin/Coach access required' },
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

    // Get all players with their details
    const { data: players, error } = await supabaseAdmin
      .from('user_profiles')
      .select(`
        *,
        player_details (
          position,
          category,
          jersey_number,
          date_of_birth,
          height_cm,
          weight_kg
        )
      `)
      .eq('role', 'player')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching players:', error)
      return NextResponse.json(
        { error: 'Failed to fetch players' },
        { status: 500 }
      )
    }

    // Format players data
    const formattedPlayers = players?.map((player: any) => ({
      id: player.user_id || player.id,
      user_id: player.user_id,
      name: player.name,
      email: player.email,
      phone: player.phone,
      position: player.player_details?.[0]?.position || '',
      category: player.player_details?.[0]?.category || '',
      jersey_number: player.player_details?.[0]?.jersey_number || null,
      date_of_birth: player.player_details?.[0]?.date_of_birth || '',
      height_cm: player.player_details?.[0]?.height_cm || null,
      weight_kg: player.player_details?.[0]?.weight_kg || null,
      status: player.status || 'active',
      games_played: 0, // Can be calculated from match_stats if needed
      tries: 0, // Can be calculated from match_stats if needed
      tackles: 0, // Can be calculated from match_stats if needed
    })) || []

    return NextResponse.json({ players: formattedPlayers })
  } catch (error: any) {
    console.error('Error fetching players:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch players' },
      { status: 500 }
    )
  }
}

