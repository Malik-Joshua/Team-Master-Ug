import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const messageId = params.id

    // Use service role to bypass RLS for updating messages
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
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

    // First, verify the message exists and the user is the recipient
    const { data: message, error: fetchError } = await supabaseAdmin
      .from('messages')
      .select('id, recipient_id, read')
      .eq('id', messageId)
      .single()

    if (fetchError || !message) {
      console.error('Error fetching message:', fetchError)
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    // Only allow marking as read if user is the recipient
    if (message.recipient_id !== authUser.id) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only mark your own received messages as read' },
        { status: 403 }
      )
    }

    // If already read, return success
    if (message.read) {
      return NextResponse.json({ success: true, message: 'Message already marked as read' })
    }

    // Mark message as read
    const { data: updatedMessage, error: updateError } = await supabaseAdmin
      .from('messages')
      .update({ read: true })
      .eq('id', messageId)
      .eq('recipient_id', authUser.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error marking message as read:', updateError)
      return NextResponse.json(
        { error: `Failed to mark message as read: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Find and mark related notifications as read
    // Notifications for messages typically have "New Message" in the title
    try {
      const { data: notifications } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('user_id', authUser.id)
        .eq('read', false)
        .ilike('title', '%New Message%')
        .order('created_at', { ascending: false })
        .limit(10)

      if (notifications && notifications.length > 0) {
        // Mark the most recent unread message notification as read
        const { error: notifError } = await supabaseAdmin
          .from('notifications')
          .update({ read: true })
          .eq('id', notifications[0].id)

        if (notifError) {
          console.error('Error marking notification as read:', notifError)
        } else {
          console.log('Marked notification as read:', notifications[0].id)
        }
      }
    } catch (notifError) {
      console.error('Error finding related notification:', notifError)
      // Don't fail the request if notification update fails
    }

    return NextResponse.json({ 
      success: true, 
      message: updatedMessage 
    })
  } catch (error: any) {
    console.error('Mark message as read API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

