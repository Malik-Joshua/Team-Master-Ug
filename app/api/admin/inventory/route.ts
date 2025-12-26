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
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseServiceKey
      })
      return NextResponse.json(
        { error: 'Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY environment variable' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get all inventory items - use item_name column
    const { data: items, error } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .order('item_name', { ascending: true })

    if (error) {
      console.error('Error fetching inventory from Supabase:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { 
          error: `Failed to fetch inventory items: ${error.message}`,
          details: process.env.NODE_ENV === 'development' ? error : undefined,
          code: error.code,
          hint: error.hint
        },
        { status: 500 }
      )
    }

    console.log(`Fetched ${items?.length || 0} inventory items from database`)
    if (items && items.length > 0) {
      console.log('Sample inventory item:', items[0])
    }

    // Format items - use item_name from database
    const formattedItems = items?.map((item: any) => ({
      id: item.id,
      name: item.item_name || item.name, // Support both column names
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
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch inventory items',
        type: error.constructor?.name,
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : undefined
      },
      { status: 500 }
    )
  }
}

