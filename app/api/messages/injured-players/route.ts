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

    // Get user profile to verify role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Only allow physio to fetch injured players
    if (profile.role !== 'physio') {
      return NextResponse.json(
        { error: 'Unauthorized: Physio access required' },
        { status: 403 }
      )
    }

    // Use service role to bypass RLS for fetching injuries
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

    // Fetch all injuries to get player IDs
    const { data: injuries, error: injuriesError } = await supabaseAdmin
      .from('injuries')
      .select('player_id')
      .order('injury_date', { ascending: false })

    if (injuriesError) {
      console.error('Error fetching injuries:', injuriesError)
      return NextResponse.json(
        { error: `Failed to fetch injuries: ${injuriesError.message}` },
        { status: 500 }
      )
    }

    // Get unique player IDs from injuries
    const injuredPlayerIds = [...new Set(
      (injuries || [])
        .map((injury: any) => injury.player_id)
        .filter(Boolean)
    )]

    // Fetch player profiles for injured players
    let injuredPlayers: any[] = []
    if (injuredPlayerIds.length > 0) {
      const { data: players, error: playersError } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, name, role, email')
        .in('user_id', injuredPlayerIds)
        .eq('role', 'player')
        .order('name', { ascending: true })

      if (playersError) {
        console.error('Error fetching injured players:', playersError)
        return NextResponse.json(
          { error: `Failed to fetch injured players: ${playersError.message}` },
          { status: 500 }
        )
      }

      injuredPlayers = players || []
    }

    return NextResponse.json({
      injuredPlayerIds,
      injuredPlayers,
      count: injuredPlayers.length
    })
  } catch (error: any) {
    console.error('Injured players API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
