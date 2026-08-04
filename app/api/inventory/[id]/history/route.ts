import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const VIEWER_ROLES = ['admin', 'data_admin', 'finance_admin', 'coach', 'physio']

/**
 * GET /api/inventory/[id]/history
 *
 * Returns the batches and the full transaction log for one item, with each
 * transaction's performer name resolved — this is the audit trail view
 * ("who changed what, from what to what, and why").
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const itemId = params.id
    if (!itemId) return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('user_id', authUser.id).single()
    if (!profile || !VIEWER_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'You do not have permission to view inventory history' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const [{ data: item }, { data: batches }, { data: transactions }] = await Promise.all([
      supabaseAdmin.from('inventory').select('*').eq('id', itemId).single(),
      supabaseAdmin.from('inventory_batches').select('*').eq('item_id', itemId).order('date_received', { ascending: false }),
      supabaseAdmin.from('inventory_transactions').select('*').eq('item_id', itemId).order('created_at', { ascending: false }),
    ])

    const performerIds = Array.from(new Set((transactions || []).map((t: any) => t.performed_by).filter(Boolean)))
    let namesById: Record<string, string> = {}
    if (performerIds.length > 0) {
      const { data: performers } = await supabaseAdmin.from('user_profiles').select('user_id, name').in('user_id', performerIds)
      namesById = Object.fromEntries((performers || []).map((p: any) => [p.user_id, p.name]))
    }

    const transactionsWithNames = (transactions || []).map((t: any) => ({
      ...t,
      performed_by_name: namesById[t.performed_by] || 'Unknown',
    }))

    return NextResponse.json({ item, batches: batches || [], transactions: transactionsWithNames })
  } catch (error: any) {
    console.error('[inventory/history] error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load history' }, { status: 500 })
  }
}
