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

    // Use service role to bypass RLS for fetching notifications
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

    // Fetch notifications for this user (including action_url field)
    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching notifications:', error)
      return NextResponse.json(
        { error: `Failed to fetch notifications: ${error.message}` },
        { status: 500 }
      )
    }

    console.log(`Fetched ${notifications?.length || 0} notifications for user ${authUser.id}`)
    if (notifications && notifications.length > 0) {
      console.log('Fetched notification user_ids:', notifications.map((n: any) => ({ id: n.id, user_id: n.user_id, title: n.title, action_url: n.action_url })))
    } else {
      console.log('No notifications found. Checking if any exist in database...')
      // Debug: Check if there are ANY notifications for this user
      const { count } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUser.id)
      console.log(`Total notifications count for user ${authUser.id}: ${count}`)
    }
    
    return NextResponse.json({
      notifications: notifications || [],
      count: notifications?.length || 0
    })
  } catch (error: any) {
    console.error('Notifications API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Parse optional body — if `id` is provided, delete that one; otherwise delete all
    let notificationId: string | null = null
    try {
      const body = await request.json()
      notificationId = body?.id || null
    } catch {
      // no body — clear all
    }

    if (notificationId) {
      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', authUser.id) // ensure user can only delete their own

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, deleted: 'one' })
    } else {
      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('user_id', authUser.id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, deleted: 'all' })
    }
  } catch (error: any) {
    console.error('Notifications DELETE error:', error)
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 })
  }
}

