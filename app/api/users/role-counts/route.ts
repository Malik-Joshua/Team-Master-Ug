import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ROLE_LIMITS, checkRoleLimit, type Role } from '@/lib/role-limits'

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

    // Only admins can view role counts
    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can view role counts' },
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

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get counts for all roles
    const roleCounts: Record<string, {
      current: number
      limit: number
      remaining: number
      canAdd: boolean
    }> = {}

    for (const role of Object.keys(ROLE_LIMITS) as Role[]) {
      const { count, error: countError } = await supabaseAdmin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', role)

      if (countError) {
        console.error(`Error counting ${role}:`, countError)
        roleCounts[role] = {
          current: 0,
          limit: ROLE_LIMITS[role],
          remaining: ROLE_LIMITS[role],
          canAdd: true,
        }
      } else {
        const limitCheck = checkRoleLimit(count || 0, role)
        roleCounts[role] = {
          current: count || 0,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining,
          canAdd: limitCheck.canAdd,
        }
      }
    }

    return NextResponse.json({
      success: true,
      roleCounts,
    })
  } catch (error: any) {
    console.error('Error fetching role counts:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
