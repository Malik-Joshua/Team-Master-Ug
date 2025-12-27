import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

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
    const { userIds, notificationData } = body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'User IDs array is required' },
        { status: 400 }
      )
    }

    if (!notificationData || !notificationData.title || !notificationData.message) {
      return NextResponse.json(
        { error: 'Notification data with title and message is required' },
        { status: 400 }
      )
    }

    // Use service role to bypass RLS for creating notifications
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables for service role client in /api/notifications/create')
      return NextResponse.json(
        { error: 'Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Create notifications for all user IDs
    const notifications = userIds.map((userId: string) => ({
      user_id: userId,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type || 'info',
      action_url: notificationData.action_url || null,
    }))

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert(notifications)
      .select()

    if (error) {
      console.error('Error creating notifications via API:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { error: `Failed to create notifications: ${error.message}` },
        { status: 500 }
      )
    }

    console.log(`Successfully created ${data?.length || 0} notifications for ${userIds.length} users via API`)
    console.log('Created notifications:', JSON.stringify(data, null, 2))

    return NextResponse.json({
      success: true,
      notifications: data || [],
      count: data?.length || 0
    })
  } catch (error: any) {
    console.error('Create notifications API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

