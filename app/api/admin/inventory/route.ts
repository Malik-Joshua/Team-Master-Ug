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

    // Get user profile to verify admin/data_admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || !['admin', 'data_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin/Data Admin access required' },
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

    // Get all inventory items
    const { data: items, error } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching inventory:', error)
      return NextResponse.json(
        { error: 'Failed to fetch inventory items' },
        { status: 500 }
      )
    }

    // Format items
    const formattedItems = items?.map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category || 'Equipment',
      quantity: item.quantity || 0,
      unit: item.unit || 'pieces',
      location: item.location || '',
      status: item.quantity === 0 ? 'out_of_stock' : item.quantity < 10 ? 'low_stock' : 'in_stock',
      lastUpdated: item.updated_at || item.created_at || new Date().toISOString(),
      description: item.description || '',
    })) || []

    return NextResponse.json({ items: formattedItems })
  } catch (error: any) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inventory items' },
      { status: 500 }
    )
  }
}

