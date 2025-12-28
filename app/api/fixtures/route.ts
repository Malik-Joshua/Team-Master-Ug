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

    if (!profile || !['admin', 'coach', 'data_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin/Coach access required' },
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
    let query = supabaseAdmin
      .from('matches')
      .select('*')
    
    if (!allMatches) {
      // Only upcoming matches
      query = query.gte('match_date', new Date().toISOString().split('T')[0])
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

