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
    const { userIds, notificationData, singleNotification } = body

    // Support both single notification and multiple notifications
    let notificationsToCreate: any[]
    
    if (singleNotification) {
      // Single notification creation
      if (!singleNotification.user_id || !singleNotification.title || !singleNotification.message) {
        return NextResponse.json(
          { error: 'Single notification requires user_id, title, and message' },
          { status: 400 }
        )
      }
      notificationsToCreate = [{
        user_id: singleNotification.user_id,
        title: singleNotification.title,
        message: singleNotification.message,
        type: singleNotification.type || 'info',
        action_url: singleNotification.action_url || null,
      }]
    } else if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      // Multiple notifications creation
      if (!notificationData || !notificationData.title || !notificationData.message) {
        return NextResponse.json(
          { error: 'Notification data with title and message is required' },
          { status: 400 }
        )
      }
      notificationsToCreate = userIds.map((userId: string) => ({
        user_id: userId,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type || 'info',
        action_url: notificationData.action_url || null,
      }))
    } else {
      return NextResponse.json(
        { error: 'Either userIds array or singleNotification object is required' },
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

    // Insert notifications
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert(notificationsToCreate)
      .select()

    if (error) {
      console.error('Error creating notifications via API:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { error: `Failed to create notifications: ${error.message}` },
        { status: 500 }
      )
    }

    const count = singleNotification ? 1 : notificationsToCreate.length
    console.log(`Successfully created ${data?.length || 0} notifications for ${count} user(s) via API`)
    console.log('Created notifications with user_ids:', data?.map((n: any) => ({ id: n.id, user_id: n.user_id, title: n.title })))
    console.log('Full created notifications:', JSON.stringify(data, null, 2))

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

