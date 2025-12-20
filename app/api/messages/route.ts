import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

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

    // Create Supabase client for authentication
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

      // Use service role key to query user_profiles (bypasses RLS)
      // This is necessary because RLS policies might block coaches from viewing all players
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json(
          { error: 'Server configuration error: Service role key is missing' },
          { status: 500 }
        )
      }

      const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })

      // Get all users with the specified role using service role (bypasses RLS)
      const { data: recipients, error: recipientsError } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id')
        .eq('role', recipientRole)
        .neq('user_id', authUser.id) // Don't send to self
        .eq('status', 'active') // Only send to active users

      if (recipientsError) {
        console.error('Error fetching recipients:', recipientsError)
        return NextResponse.json(
          { error: `Failed to fetch recipients: ${recipientsError.message}` },
          { status: 500 }
        )
      }

      if (!recipients || recipients.length === 0) {
        return NextResponse.json(
          { error: `No active users found with role: ${recipientRole}` },
          { status: 404 }
        )
      }

      // Send message to each recipient using the authenticated client (respects RLS for message insertion)
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
        const firstError = errors[0]?.error
        const errorMessage = firstError?.message || 'Some messages failed to send'
        
        // If all messages failed, return error
        if (errors.length === recipients.length) {
          return NextResponse.json(
            {
              error: `Failed to send messages: ${errorMessage}`,
              details: `All ${recipients.length} messages failed to send`,
            },
            { status: 500 }
          )
        }
        
        // If some succeeded, return partial success
        return NextResponse.json(
          {
            success: true,
            message: `Message sent to ${recipients.length - errors.length} of ${recipients.length} recipients`,
            warning: `${errors.length} message(s) failed to send`,
            count: recipients.length - errors.length,
          },
          { status: 200 }
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

      // Verify recipient exists - use service role to bypass RLS if needed
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      let recipient
      let recipientError
      
      if (supabaseUrl && supabaseServiceKey) {
        // Try with service role first (bypasses RLS)
        const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })
        const result = await supabaseAdmin
          .from('user_profiles')
          .select('user_id, name')
          .eq('user_id', recipientId)
          .single()
        recipient = result.data
        recipientError = result.error
      } else {
        // Fallback to regular client
        const result = await supabase
          .from('user_profiles')
          .select('user_id, name')
          .eq('user_id', recipientId)
          .single()
        recipient = result.data
        recipientError = result.error
      }

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

