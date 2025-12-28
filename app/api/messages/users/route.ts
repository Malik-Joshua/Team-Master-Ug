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

    // Only allow admin, coach, data_admin (team manager), and finance_admin to fetch users
    if (!['admin', 'coach', 'data_admin', 'finance_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin/Coach/Team Manager/Finance Admin access required' },
        { status: 403 }
      )
    }

    // Use service role to bypass RLS for fetching all users
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

    // Fetch all users except the current user
    const { data: users, error } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, name, role, email')
      .neq('user_id', authUser.id)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json(
        { error: `Failed to fetch users: ${error.message}` },
        { status: 500 }
      )
    }

    // Group users by role for easier client-side handling
    const usersByRole: Record<string, typeof users> = {}
    if (users) {
      users.forEach((user) => {
        if (!usersByRole[user.role]) {
          usersByRole[user.role] = []
        }
        usersByRole[user.role].push(user)
      })
    }

    return NextResponse.json({
      users: users || [],
      usersByRole,
      count: users?.length || 0
    })
  } catch (error: any) {
    console.error('Users API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

