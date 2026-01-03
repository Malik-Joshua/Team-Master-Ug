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

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Use service role to bypass RLS for fetching messages and user profiles
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

    // Fetch messages for this user
    // For players: only show messages where they are the specific recipient or sender
    // For other roles: can see role-based messages too
    let messagesQuery = supabaseAdmin
      .from('messages')
      .select('*')
    
    if (profile.role === 'player') {
      // Players should only see messages specifically sent to them or sent by them
      messagesQuery = messagesQuery.or(`sender_id.eq.${authUser.id},recipient_id.eq.${authUser.id}`)
    } else {
      // Admins, coaches, etc. can see role-based messages
      messagesQuery = messagesQuery.or(`sender_id.eq.${authUser.id},recipient_id.eq.${authUser.id},recipient_role.eq.${profile.role}`)
    }
    
    const { data: messages, error: messagesError } = await messagesQuery
      .order('created_at', { ascending: false })

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return NextResponse.json(
        { error: `Failed to fetch messages: ${messagesError.message}` },
        { status: 500 }
      )
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ messages: [] })
    }

    // Get all unique sender and recipient IDs
    const senderIds = [...new Set(messages.map((msg: any) => msg.sender_id).filter(Boolean))]
    const recipientIds = [...new Set(messages.map((msg: any) => msg.recipient_id).filter(Boolean))]
    const allUserIds = [...new Set([...senderIds, ...recipientIds])]

    // Fetch user profiles for all senders and recipients
    let userProfilesMap: Record<string, any> = {}
    if (allUserIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, name, role')
        .in('user_id', allUserIds)

      if (profilesError) {
        console.error('Error fetching user profiles:', profilesError)
      } else if (profiles) {
        profiles.forEach((profile: any) => {
          userProfilesMap[profile.user_id] = profile
        })
      }
    }

    // Format messages with sender and recipient info
    // Filter out messages that don't belong to the user (extra safety check)
    const formattedMessages = messages
      .filter((msg: any) => {
        // Only include messages where user is sender or specific recipient
        // Exclude role-based messages for players
        if (profile.role === 'player') {
          return msg.sender_id === authUser.id || msg.recipient_id === authUser.id
        }
        // For other roles, include role-based messages too
        return msg.sender_id === authUser.id || msg.recipient_id === authUser.id || msg.recipient_role === profile.role
      })
      .map((msg: any) => {
        const sender = userProfilesMap[msg.sender_id]
        const recipient = userProfilesMap[msg.recipient_id]
        const isSent = msg.sender_id === authUser.id
        
        return {
          id: msg.id,
          sender_id: msg.sender_id,
          sender_name: sender?.name || 'Unknown',
          sender_role: sender?.role || 'unknown',
          recipient_id: msg.recipient_id,
          recipient_name: recipient?.name || 'Unknown',
          recipient_role: recipient?.role || 'unknown',
          subject: msg.subject || '',
          message: msg.message,
          read: msg.read || false,
          created_at: msg.created_at,
          is_sent: isSent,
        }
      })

    return NextResponse.json({ messages: formattedMessages })
  } catch (error: any) {
    console.error('Messages API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

