import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['admin', 'data_admin', 'finance_admin', 'coach', 'asst_coach']

/**
 * POST /api/inventory/receive
 *
 * Logs newly received stock. Creates the item TYPE if it doesn't exist yet
 * (matched by name, case-insensitive), then always creates a new BATCH for
 * this delivery — everything starts in `in_store`. The item's cached totals
 * (quantity_in_store etc.) are recalculated automatically by a DB trigger,
 * so this route only ever writes to inventory/inventory_batches/
 * inventory_transactions, never touches the cached counts directly.
 *
 * Body: {
 *   item_id?: string          // existing item type, OR:
 *   item_name?: string        // name for a new item type
 *   category?: string
 *   unit?: string
 *   location?: string
 *   description?: string
 *   low_stock_threshold?: number
 *   source?: string           // "donation", "purchase", donor name, etc.
 *   date_received?: string    // ISO date, defaults to today
 *   quantity_received: number
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const quantityReceived = parseInt(body.quantity_received, 10)

    if (!quantityReceived || quantityReceived <= 0) {
      return NextResponse.json({ error: 'Quantity received must be a positive number' }, { status: 400 })
    }
    if (!body.item_id && !body.item_name?.trim()) {
      return NextResponse.json({ error: 'Provide either an existing item_id or an item_name for a new item' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || !MANAGER_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'You do not have permission to manage inventory' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Find or create the item type.
    let itemId: string = body.item_id
    if (!itemId) {
      const { data: existing } = await supabaseAdmin
        .from('inventory')
        .select('id')
        .ilike('item_name', body.item_name.trim())
        .maybeSingle()

      if (existing) {
        itemId = existing.id
      } else {
        const { data: newItem, error: itemError } = await supabaseAdmin
          .from('inventory')
          .insert({
            item_name: body.item_name.trim(),
            category: body.category || 'Other',
            unit: body.unit || 'pieces',
            location: body.location || null,
            description: body.description || null,
            low_stock_threshold: body.low_stock_threshold != null ? parseInt(body.low_stock_threshold, 10) : 10,
            quantity: 0,
            created_by: authUser.id,
          })
          .select('id')
          .single()
        if (itemError) throw itemError
        itemId = newItem.id
      }
    }

    // Create the batch — every unit starts in_store.
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('inventory_batches')
      .insert({
        item_id: itemId,
        source: body.source || null,
        date_received: body.date_received || new Date().toISOString().split('T')[0],
        quantity_received: quantityReceived,
        in_store: quantityReceived,
        notes: body.notes || null,
        created_by: authUser.id,
      })
      .select('id')
      .single()
    if (batchError) throw batchError

    // Log the transaction — the audit trail entry for this receipt.
    const { error: txError } = await supabaseAdmin.from('inventory_transactions').insert({
      item_id: itemId,
      batch_id: batch.id,
      type: 'receive',
      quantity: quantityReceived,
      from_status: null,
      to_status: 'in_store',
      performed_by: authUser.id,
      note: body.notes || null,
    })
    if (txError) throw txError

    const { data: item } = await supabaseAdmin.from('inventory').select('*').eq('id', itemId).single()

    return NextResponse.json({ item, batchId: batch.id }, { status: 201 })
  } catch (error: any) {
    console.error('[inventory/receive] error:', error)
    return NextResponse.json({ error: error.message || 'Failed to log received stock' }, { status: 500 })
  }
}
