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

    // Only allow players to fetch team managers
    if (profile.role !== 'player') {
      return NextResponse.json(
        { error: 'Unauthorized: Player access required' },
        { status: 403 }
      )
    }

    // Use service role to bypass RLS for fetching team managers
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

    // Fetch all team managers (data_admin role)
    const { data: teamManagers, error } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, name, role, email')
      .eq('role', 'data_admin')
      .neq('user_id', authUser.id)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching team managers:', error)
      return NextResponse.json(
        { error: `Failed to fetch team managers: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      teamManagers: teamManagers || [],
      count: teamManagers?.length || 0
    })
  } catch (error: any) {
    console.error('Team managers API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

