import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const roles = searchParams.get('roles') // Comma-separated list of roles for multi-role support

    // Support both single role and multiple roles
    const rolesToFetch = roles ? roles.split(',').map(r => r.trim()) : (role ? [role] : [])

    if (rolesToFetch.length === 0) {
      return NextResponse.json(
        { error: 'Role or roles parameter is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Use service role to bypass RLS for fetching recipients
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

    // Expand 'admin' role to include all admin types
    const expandedRoles: string[] = []
    rolesToFetch.forEach(r => {
      if (r === 'admin') {
        expandedRoles.push('admin', 'data_admin', 'finance_admin')
      } else {
        expandedRoles.push(r)
      }
    })

    // Remove duplicates
    const uniqueRoles = [...new Set(expandedRoles)]

    // Fetch users with the specified roles, excluding the current user
    const { data: recipients, error } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, role')
      .in('role', uniqueRoles)
      .neq('user_id', authUser.id)
    
    if (error) {
      console.error('Error fetching recipients:', error)
      return NextResponse.json(
        { error: `Failed to fetch recipients: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      recipients: recipients || [],
      count: recipients?.length || 0
    })
  } catch (error: any) {
    console.error('Recipients API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

