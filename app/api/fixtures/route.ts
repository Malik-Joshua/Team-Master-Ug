import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const allMatches = searchParams.get('all') === 'true' // Query parameter to get all matches
    
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

    if (!profile || !['admin', 'coach', 'data_admin', 'physio'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin/Coach/Physio access required' },
        { status: 403 }
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

    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get matches - all matches if requested, otherwise just upcoming
    const today = new Date().toISOString().split('T')[0]
    let query = supabaseAdmin
      .from('matches')
      .select('*')
    
    if (!allMatches) {
      // Only matches with date >= today
      query = query.gte('match_date', today)
    }
    
    query = query.order('match_date', { ascending: true })

    const { data: fixtures, error } = await query

    if (error) {
      console.error('Error fetching fixtures:', error)
      return NextResponse.json(
        { error: `Failed to fetch fixtures: ${error.message}` },
        { status: 500 }
      )
    }

    if (!fixtures || fixtures.length === 0) {
      return NextResponse.json({ 
        fixtures: [],
        count: 0
      })
    }

    // Filter out matches that have been played (date passed OR match stats exist)
    if (!allMatches) {
      // Get match IDs that have stats entered (already played)
      const matchIds = fixtures.map((m: any) => m.id)
      const { data: matchesWithStats } = await supabaseAdmin
        .from('match_stats')
        .select('match_id')
        .in('match_id', matchIds)
      
      const playedMatchIds = new Set(matchesWithStats?.map((s: any) => s.match_id) || [])
      
      // Filter out matches that have been played
      const upcomingFixtures = fixtures.filter((match: any) => {
        const matchDate = new Date(match.match_date)
        const todayDate = new Date(today)
        const isDatePassed = matchDate < todayDate
        const hasStats = playedMatchIds.has(match.id)
        return !isDatePassed && !hasStats
      })
      
      return NextResponse.json({ 
        fixtures: upcomingFixtures,
        count: upcomingFixtures.length
      })
    }

    return NextResponse.json({ 
      fixtures: fixtures || [],
      count: fixtures?.length || 0
    })
  } catch (error: any) {
    console.error('Error in fixtures API route:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch fixtures' },
      { status: 500 }
    )
  }
}

