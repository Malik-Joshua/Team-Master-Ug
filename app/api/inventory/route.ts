import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// GET: Fetch all inventory items
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

    // Get user profile to check role
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

    // Check if user has permission (admin or data_admin)
    if (profile.role !== 'admin' && profile.role !== 'data_admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Only admins and data admins can view inventory' },
        { status: 403 }
      )
    }

    // Use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Service role key is missing' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data: items, error } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching inventory:', error)
      return NextResponse.json(
        { error: `Failed to fetch inventory: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      items: items || [],
      count: items?.length || 0,
    })
  } catch (error: any) {
    console.error('Inventory API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST: Create a new inventory item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { item_name, category, quantity, unit, location, description } = body

    if (!item_name || !category) {
      return NextResponse.json(
        { error: 'Item name and category are required' },
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

    // Get user profile to check role
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

    // Check if user has permission (admin or data_admin)
    if (profile.role !== 'admin' && profile.role !== 'data_admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Only admins and data admins can add inventory items' },
        { status: 403 }
      )
    }

    // Use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Service role key is missing' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data: newItem, error: insertError } = await supabaseAdmin
      .from('inventory')
      .insert({
        item_name,
        category,
        quantity: parseInt(quantity) || 0,
        unit: unit || 'pieces',
        location: location || null,
        description: description || null,
        created_by: authUser.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating inventory item:', insertError)
      return NextResponse.json(
        { error: `Failed to create inventory item: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      item: newItem,
      message: 'Inventory item created successfully',
    })
  } catch (error: any) {
    console.error('Inventory API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// PUT: Update an inventory item
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, item_name, category, quantity, unit, location, description } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
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

    // Get user profile to check role
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

    // Check if user has permission (admin or data_admin)
    if (profile.role !== 'admin' && profile.role !== 'data_admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Only admins and data admins can update inventory items' },
        { status: 403 }
      )
    }

    // Use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Service role key is missing' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const updateData: any = {}
    if (item_name !== undefined) updateData.item_name = item_name
    if (category !== undefined) updateData.category = category
    if (quantity !== undefined) updateData.quantity = parseInt(quantity) || 0
    if (unit !== undefined) updateData.unit = unit
    if (location !== undefined) updateData.location = location
    if (description !== undefined) updateData.description = description

    const { data: updatedItem, error: updateError } = await supabaseAdmin
      .from('inventory')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating inventory item:', updateError)
      return NextResponse.json(
        { error: `Failed to update inventory item: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      item: updatedItem,
      message: 'Inventory item updated successfully',
    })
  } catch (error: any) {
    console.error('Inventory API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// DELETE: Delete an inventory item
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
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

    // Get user profile to check role
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

    // Check if user has permission (admin or data_admin)
    if (profile.role !== 'admin' && profile.role !== 'data_admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Only admins and data admins can delete inventory items' },
        { status: 403 }
      )
    }

    // Use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Service role key is missing' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { error: deleteError } = await supabaseAdmin
      .from('inventory')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting inventory item:', deleteError)
      return NextResponse.json(
        { error: `Failed to delete inventory item: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Inventory item deleted successfully',
    })
  } catch (error: any) {
    console.error('Inventory API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

