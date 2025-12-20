import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recipientId, recipientRole, subject, message } = body

    // Validate required fields
    if (!subject || !message) {
      return NextResponse.json(
        { error: 'Subject and message are required' },
        { status: 400 }
      )
    }

    // Must have either recipientId or recipientRole
    if (!recipientId && !recipientRole) {
      return NextResponse.json(
        { error: 'Either recipient ID or recipient role must be provided' },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // If sending to a role, get all users with that role
    if (recipientRole && !recipientId) {
      // Validate role
      const validRoles = ['player', 'coach', 'admin', 'data_admin', 'finance_admin']
      if (!validRoles.includes(recipientRole)) {
        return NextResponse.json(
          { error: 'Invalid recipient role' },
          { status: 400 }
        )
      }

      // Get all users with the specified role
      const { data: recipients, error: recipientsError } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('role', recipientRole)
        .neq('user_id', authUser.id) // Don't send to self

      if (recipientsError) {
        console.error('Error fetching recipients:', recipientsError)
        return NextResponse.json(
          { error: 'Failed to fetch recipients' },
          { status: 500 }
        )
      }

      if (!recipients || recipients.length === 0) {
        return NextResponse.json(
          { error: `No users found with role: ${recipientRole}` },
          { status: 404 }
        )
      }

      // Send message to each recipient
      const messagePromises = recipients.map((recipient) =>
        supabase
          .from('messages')
          .insert({
            sender_id: authUser.id,
            recipient_id: recipient.user_id,
            subject,
            message,
            read: false,
          })
      )

      const results = await Promise.all(messagePromises)
      const errors = results.filter((r) => r.error)

      if (errors.length > 0) {
        console.error('Some messages failed to send:', errors)
        return NextResponse.json(
          {
            success: true,
            message: `Message sent to ${recipients.length - errors.length} of ${recipients.length} recipients`,
            errors: errors.length > 0 ? 'Some messages failed to send' : undefined,
          },
          { status: errors.length === recipients.length ? 500 : 200 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `Message sent successfully to ${recipients.length} ${recipientRole}${recipients.length > 1 ? 's' : ''}`,
        count: recipients.length,
      })
    } else {
      // Send to individual recipient
      if (!recipientId) {
        return NextResponse.json(
          { error: 'Recipient ID is required for individual messages' },
          { status: 400 }
        )
      }

      // Verify recipient exists
      const { data: recipient, error: recipientError } = await supabase
        .from('user_profiles')
        .select('user_id, name')
        .eq('user_id', recipientId)
        .single()

      if (recipientError || !recipient) {
        return NextResponse.json(
          { error: 'Recipient not found' },
          { status: 404 }
        )
      }

      // Don't allow sending to self
      if (recipientId === authUser.id) {
        return NextResponse.json(
          { error: 'Cannot send message to yourself' },
          { status: 400 }
        )
      }

      // Insert message
      const { data: newMessage, error: insertError } = await supabase
        .from('messages')
        .insert({
          sender_id: authUser.id,
          recipient_id: recipientId,
          subject,
          message,
          read: false,
        })
        .select(`
          *,
          sender:user_profiles!messages_sender_id_fkey(name, role),
          recipient:user_profiles!messages_recipient_id_fkey(name, role)
        `)
        .single()

      if (insertError) {
        console.error('Error inserting message:', insertError)
        return NextResponse.json(
          { error: `Failed to send message: ${insertError.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Message sent successfully',
        data: newMessage,
      })
    }
  } catch (error: any) {
    console.error('Message API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

