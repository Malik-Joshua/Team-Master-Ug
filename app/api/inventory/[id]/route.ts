import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['admin', 'data_admin', 'finance_admin', 'coach', 'asst_coach']

async function authorizeManager(supabase: any) {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
  if (authError || !authUser) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('user_id', authUser.id).single()
  if (!profile || !MANAGER_ROLES.includes(profile.role)) {
    return { error: NextResponse.json({ error: 'You do not have permission to manage inventory' }, { status: 403 }) }
  }
  return { authUser, profile }
}

function adminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) throw new Error('Server configuration error')
  return createServiceClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

/**
 * PATCH /api/inventory/[id]
 *
 * Edits an item TYPE's metadata only (name, category, unit, location,
 * description, low-stock threshold) — never quantity. Status counts only
 * ever move through /api/inventory/move or /api/inventory/receive, which
 * both go through inventory_batches/inventory_transactions so the log stays
 * the source of truth.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { error } = await authorizeManager(supabase)
    if (error) return error

    const body = await request.json()
    const updates: Record<string, any> = {}
    if (body.item_name !== undefined) updates.item_name = body.item_name
    if (body.category !== undefined) updates.category = body.category
    if (body.unit !== undefined) updates.unit = body.unit
    if (body.location !== undefined) updates.location = body.location
    if (body.description !== undefined) updates.description = body.description
    if (body.low_stock_threshold !== undefined) updates.low_stock_threshold = parseInt(body.low_stock_threshold, 10) || 0

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const supabaseAdmin = adminClient()
    const { data, error: updateError } = await supabaseAdmin
      .from('inventory')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()
    if (updateError) throw updateError

    return NextResponse.json({ item: data })
  } catch (error: any) {
    console.error('[inventory PATCH] error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update item' }, { status: 500 })
  }
}

/**
 * DELETE /api/inventory/[id]
 *
 * Removes an item type entirely, along with its batches and transaction log
 * (ON DELETE CASCADE) — restricted to admin/data_admin since this destroys
 * history, unlike every other inventory action which is append-only.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const { data: profile } = await supabase.from('user_profiles').select('role').eq('user_id', authUser.id).single()
    if (!profile || !['admin', 'data_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only admins and team managers can delete inventory items' }, { status: 403 })
    }

    const supabaseAdmin = adminClient()
    const { error: deleteError } = await supabaseAdmin.from('inventory').delete().eq('id', params.id)
    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[inventory DELETE] error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete item' }, { status: 500 })
  }
}
