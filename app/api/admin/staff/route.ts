import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/** Staff roles (non-player) */
const STAFF_ROLES = ['admin', 'coach', 'data_admin', 'finance_admin', 'physio', 'club_captain']

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

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

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

    const { data: staff, error } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, name, email, role, status')
      .in('role', STAFF_ROLES)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching staff:', error)
      return NextResponse.json(
        { error: `Failed to fetch staff: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      staff: staff || [],
      count: staff?.length || 0
    })
  } catch (error: any) {
    console.error('Staff API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
