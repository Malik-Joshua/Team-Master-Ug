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

    if (!profile || !['admin', 'data_admin', 'physio'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin/Data Admin/Physio access required' },
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

    // Get all inventory items first
    const { data: allItems, error: fetchError } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .order('item_name', { ascending: true })
    
    if (fetchError) {
      console.error('Error fetching inventory from Supabase:', fetchError)
      console.error('Error details:', JSON.stringify(fetchError, null, 2))
      return NextResponse.json(
        { 
          error: `Failed to fetch inventory items: ${fetchError.message}`,
          details: process.env.NODE_ENV === 'development' ? fetchError : undefined,
          code: fetchError.code,
          hint: fetchError.hint
        },
        { status: 500 }
      )
    }
    
    // Filter items based on role
    let items = allItems
    
    // For physio, only show medical/medical kit items
    if (profile.role === 'physio') {
      const medicalKeywords = [
        'strap', 'straps', 'scissors', 'bandage', 'bandages', 'tape', 'gauze', 'ice', 
        'medical', 'first aid', 'first-aid', 'splint', 'splints', 'brace', 'braces', 
        'wrap', 'wraps', 'tensor', 'elastic', 'adhesive', 'plaster', 'plasters',
        'cotton', 'alcohol', 'antiseptic', 'disinfectant', 'gloves', 'syringe',
        'needle', 'needles', 'thermometer', 'stethoscope', 'sphygmomanometer',
        'crutches', 'crutch', 'sling', 'slings', 'compression', 'cold pack',
        'heat pack', 'ibuprofen', 'paracetamol', 'aspirin', 'antihistamine'
      ]
      
      items = allItems?.filter((item: any) => {
        const itemName = (item.item_name || '').toLowerCase()
        const category = (item.category || '').toLowerCase()
        const description = (item.description || '').toLowerCase()
        
        // Check if item matches medical keywords
        return medicalKeywords.some(keyword => 
          itemName.includes(keyword) || 
          category.includes(keyword) || 
          description.includes(keyword) ||
          category === 'medical' ||
          category === 'medical_kit' ||
          category === 'first_aid' ||
          category === 'medical supplies' ||
          category === 'medical equipment'
        )
      }) || []
    }

    console.log(`Fetched ${items?.length || 0} inventory items from database (${profile.role === 'physio' ? 'filtered for medical items' : 'all items'})`)
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

