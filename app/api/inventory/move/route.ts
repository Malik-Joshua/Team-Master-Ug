import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['admin', 'data_admin', 'finance_admin', 'coach']
const STATUSES = ['in_store', 'in_use', 'spoilt', 'lost']
const TX_TYPES = ['issue', 'return', 'damage', 'loss', 'reconcile']

/**
 * POST /api/inventory/move
 *
 * The one primitive every status change goes through — issuing gear,
 * returning it, marking it damaged/lost, and reconciliation adjustments are
 * all "move N units from one status bucket to another", logged as a
 * transaction. This is what keeps inventory.quantity_in_store/in_use/etc
 * always equal to what the log says happened — nothing updates those cached
 * totals directly.
 *
 * Body: {
 *   item_id: string
 *   from_status: 'in_store' | 'in_use' | null   // null = materialising found
 *                                                 stock during reconciliation
 *   to_status: 'in_store' | 'in_use' | 'spoilt' | 'lost'
 *   quantity: number
 *   type: 'issue' | 'return' | 'damage' | 'loss' | 'reconcile'
 *   note?: string
 *   linked_to?: string   // e.g. "U18 vs Kobs, 20 Jul"
 * }
 *
 * FIFO: when moving units out of a status, the oldest batch with available
 * units in that bucket is drained first, then the next, until the requested
 * quantity is satisfied — a finance admin never has to pick a batch by hand.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { item_id, note, linked_to } = body
    const from_status: string | null = body.from_status ?? null
    const quantity = parseInt(body.quantity, 10) || 0
    const type = body.type
    // A reconciliation "yes, this is accurate" confirmation moves nothing —
    // it's still a real logged event (updates last_reconciled_at) but there's
    // no bucket to move to, so to_status is optional for it.
    const isConfirmation = type === 'reconcile' && quantity === 0
    const to_status = isConfirmation ? null : body.to_status

    if (!item_id) return NextResponse.json({ error: 'item_id is required' }, { status: 400 })
    if (!TX_TYPES.includes(type)) return NextResponse.json({ error: `type must be one of ${TX_TYPES.join(', ')}` }, { status: 400 })
    if (!isConfirmation) {
      if (!STATUSES.includes(to_status)) return NextResponse.json({ error: 'Invalid to_status' }, { status: 400 })
      if (from_status !== null && !STATUSES.includes(from_status)) return NextResponse.json({ error: 'Invalid from_status' }, { status: 400 })
      if (!quantity || quantity <= 0) return NextResponse.json({ error: 'Quantity must be a positive number' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('user_id', authUser.id).single()
    if (!profile || !MANAGER_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'You do not have permission to manage inventory' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: itemBefore, error: itemErr } = await supabaseAdmin.from('inventory').select('*').eq('id', item_id).single()
    if (itemErr || !itemBefore) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const txRows: any[] = []

    if (isConfirmation) {
      // Nothing to move — just log that the counts were checked and matched.
      txRows.push({ item_id, batch_id: null, type, quantity: 0, from_status: null, to_status: null, performed_by: authUser.id, note: note || 'Confirmed accurate', linked_to })
    } else if (from_status === null) {
      // Materialising stock that was never logged (reconciliation found extra
      // units, or a manual top-up) — top up the most recent batch so it still
      // has somewhere to live; create one if the item has no batches yet.
      const { data: latestBatch } = await supabaseAdmin
        .from('inventory_batches')
        .select('*')
        .eq('item_id', item_id)
        .order('date_received', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestBatch) {
        const { error: updErr } = await supabaseAdmin
          .from('inventory_batches')
          .update({
            quantity_received: latestBatch.quantity_received + quantity,
            [toColumn(to_status)]: latestBatch[toColumn(to_status)] + quantity,
          })
          .eq('id', latestBatch.id)
        if (updErr) throw updErr
        txRows.push({ item_id, batch_id: latestBatch.id, type, quantity, from_status: null, to_status, performed_by: authUser.id, note, linked_to })
      } else {
        const { data: newBatch, error: newBatchErr } = await supabaseAdmin
          .from('inventory_batches')
          .insert({
            item_id,
            source: 'Reconciliation — found stock',
            quantity_received: quantity,
            [toColumn(to_status)]: quantity,
            created_by: authUser.id,
          })
          .select('id')
          .single()
        if (newBatchErr) throw newBatchErr
        txRows.push({ item_id, batch_id: newBatch.id, type, quantity, from_status: null, to_status, performed_by: authUser.id, note, linked_to })
      }
    } else {
      // Draining an existing bucket — FIFO across batches (oldest first).
      const { data: batches, error: batchesErr } = await supabaseAdmin
        .from('inventory_batches')
        .select('*')
        .eq('item_id', item_id)
        .gt(from_status, 0)
        .order('date_received', { ascending: true })
      if (batchesErr) throw batchesErr

      const available = (batches || []).reduce((sum, b) => sum + b[from_status], 0)
      if (available < quantity) {
        return NextResponse.json(
          { error: `Not enough stock in ${humanStatus(from_status)} — only ${available} available, tried to move ${quantity}.` },
          { status: 400 }
        )
      }

      let remaining = quantity
      for (const batch of batches || []) {
        if (remaining <= 0) break
        const take = Math.min(batch[from_status], remaining)
        if (take <= 0) continue
        const { error: updErr } = await supabaseAdmin
          .from('inventory_batches')
          .update({
            [from_status]: batch[from_status] - take,
            [to_status]: batch[to_status] + take,
          })
          .eq('id', batch.id)
        if (updErr) throw updErr
        txRows.push({ item_id, batch_id: batch.id, type, quantity: take, from_status, to_status, performed_by: authUser.id, note, linked_to })
        remaining -= take
      }
    }

    const { error: txError } = await supabaseAdmin.from('inventory_transactions').insert(txRows)
    if (txError) throw txError

    if (type === 'reconcile') {
      await supabaseAdmin.from('inventory').update({ last_reconciled_at: new Date().toISOString() }).eq('id', item_id)
    }

    const { data: itemAfter } = await supabaseAdmin.from('inventory').select('*').eq('id', item_id).single()

    // Low-stock alert — only fire the moment in_store crosses the threshold
    // (was at/above it, now below), so this doesn't spam a notification on
    // every single transaction while stock stays low.
    if (
      itemAfter &&
      itemBefore.quantity_in_store >= itemBefore.low_stock_threshold &&
      itemAfter.quantity_in_store < itemAfter.low_stock_threshold
    ) {
      try {
        const { db } = await import('@/lib/db-helpers')
        await db.createNotificationForRole('finance_admin', {
          title: 'Low Stock Alert',
          message: `${itemAfter.item_name} is running low — only ${itemAfter.quantity_in_store} in store (threshold: ${itemAfter.low_stock_threshold}).`,
          type: 'warning',
          action_url: '/inventory',
        })
      } catch (notifyErr) {
        console.error('[inventory/move] low-stock notification failed:', notifyErr)
      }
    }

    return NextResponse.json({ item: itemAfter, transactions: txRows.length })
  } catch (error: any) {
    console.error('[inventory/move] error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update stock' }, { status: 500 })
  }
}

function toColumn(status: string) {
  return status // status names already match column names
}

function humanStatus(status: string) {
  return { in_store: 'in store', in_use: 'in use', spoilt: 'spoilt', lost: 'lost' }[status] || status
}
