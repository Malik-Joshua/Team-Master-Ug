import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// How long an item can go without a reconciliation before it's flagged as
// overdue. Kept as a constant for now — a per-item override could be added
// later if some items need checking more/less often than others.
const RECONCILIATION_OVERDUE_DAYS = 30
// Don't re-nudge more than once a week even if they keep visiting the page
// with overdue items still unresolved.
const RECONCILIATION_NUDGE_COOLDOWN_DAYS = 7

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

    const allowedRoles = ['admin', 'data_admin', 'physio', 'finance_admin', 'coach']
    if (!profile || !allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Inventory access required' },
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

    // Format items — quantity_in_store/in_use/spoilt/lost are cached totals
    // kept in sync with inventory_batches by a DB trigger (see migration
    // 046); status/low-stock is now based on quantity_in_store vs the item's
    // own threshold, not a flat "< 10" on the old single quantity number.
    const now = Date.now()
    const overdueMs = RECONCILIATION_OVERDUE_DAYS * 24 * 60 * 60 * 1000
    const formattedItems = items?.map((item: any) => {
      const inStore = item.quantity_in_store ?? item.quantity ?? 0
      const inUse = item.quantity_in_use ?? 0
      const spoilt = item.quantity_spoilt ?? 0
      const lost = item.quantity_lost ?? 0
      const threshold = item.low_stock_threshold ?? 10
      const status = inStore === 0 && inUse === 0 ? 'out_of_stock' : inStore < threshold ? 'low_stock' : 'in_stock'
      const lastReconciledAt = item.last_reconciled_at || null
      const reconciliationOverdue = !lastReconciledAt || (now - new Date(lastReconciledAt).getTime()) > overdueMs

      return {
        id: item.id,
        name: item.item_name || item.name,
        category: item.category || 'Equipment',
        unit: item.unit || 'pieces',
        location: item.location || '',
        description: item.description || '',
        quantityInStore: inStore,
        quantityInUse: inUse,
        quantitySpoilt: spoilt,
        quantityLost: lost,
        quantity: inStore + inUse, // usable stock on hand — kept for back-compat with anything reading `.quantity`
        lowStockThreshold: threshold,
        status,
        lastUpdated: item.updated_at || item.created_at || new Date().toISOString(),
        lastReconciledAt,
        reconciliationOverdue,
      }
    }) || []

    // Reconciliation nudge — only for roles that own the alert (finance
    // admin, admin), only for items genuinely overdue, and never more than
    // once a week per item so revisiting the page doesn't spam.
    if ((profile.role === 'finance_admin' || profile.role === 'admin') && items) {
      const dueForNudge = items.filter((item: any) => {
        const lastReconciledAt = item.last_reconciled_at
        const isOverdue = !lastReconciledAt || (now - new Date(lastReconciledAt).getTime()) > overdueMs
        if (!isOverdue) return false
        const lastNudge = item.reconciliation_nudged_at
        const cooldownMs = RECONCILIATION_NUDGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
        return !lastNudge || (now - new Date(lastNudge).getTime()) > cooldownMs
      })

      if (dueForNudge.length > 0) {
        try {
          const { db } = await import('@/lib/db-helpers')
          const names = dueForNudge.slice(0, 5).map((i: any) => i.item_name).join(', ')
          const extra = dueForNudge.length > 5 ? ` and ${dueForNudge.length - 5} more` : ''
          await db.createNotificationForRole('finance_admin', {
            title: 'Inventory reconciliation due',
            message: `${dueForNudge.length} item${dueForNudge.length === 1 ? '' : 's'} haven't been reconciled in over ${RECONCILIATION_OVERDUE_DAYS} days: ${names}${extra}. Please confirm current counts.`,
            type: 'info',
            action_url: '/inventory',
          })
          await supabaseAdmin
            .from('inventory')
            .update({ reconciliation_nudged_at: new Date().toISOString() })
            .in('id', dueForNudge.map((i: any) => i.id))
        } catch (nudgeErr) {
          console.error('Error sending reconciliation nudge:', nudgeErr)
        }
      }
    }

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
