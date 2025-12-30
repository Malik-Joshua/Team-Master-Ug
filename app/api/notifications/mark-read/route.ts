import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Mark notifications as read by reference_id and reference_type
 * This is called when a user views a message, task, fixture, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { reference_id, reference_type, action_url } = body

    // Use service role to bypass RLS
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

    // Build query to find notifications
    let query = supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('read', false)

    // If reference_id and reference_type are provided, use them (most accurate)
    if (reference_id && reference_type) {
      query = query
        .eq('reference_id', reference_id)
        .eq('reference_type', reference_type)
    } else if (action_url) {
      // Fallback: find by action_url (for older notifications without reference fields)
      query = query.or(`action_url.eq.${action_url},action_url.ilike.%${action_url}%`)
    } else {
      return NextResponse.json(
        { error: 'Either reference_id/reference_type or action_url is required' },
        { status: 400 }
      )
    }

    const { data: notifications, error: fetchError } = await query

    if (fetchError) {
      console.error('Error fetching notifications:', fetchError)
      return NextResponse.json(
        { error: `Failed to fetch notifications: ${fetchError.message}` },
        { status: 500 }
      )
    }

    if (!notifications || notifications.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unread notifications found',
        count: 0
      })
    }

    // Mark all matching notifications as read
    const notificationIds = notifications.map((n: any) => n.id)
    const { error: updateError } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .in('id', notificationIds)

    if (updateError) {
      console.error('Error marking notifications as read:', updateError)
      return NextResponse.json(
        { error: `Failed to mark notifications as read: ${updateError.message}` },
        { status: 500 }
      )
    }

    console.log(`Marked ${notifications.length} notification(s) as read for ${reference_type || 'action_url'}: ${reference_id || action_url}`)

    return NextResponse.json({
      success: true,
      message: `Marked ${notifications.length} notification(s) as read`,
      count: notifications.length
    })
  } catch (error: any) {
    console.error('Mark notification as read API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

