'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import { MessageSquare, Send, User, Mail, Clock, X, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  sender_id: string
  sender_name: string
  sender_role: string
  recipient_id: string
  recipient_name?: string
  recipient_role?: string
  subject: string
  message: string
  read: boolean
  created_at: string
  is_sent?: boolean // true if current user is the sender
}

interface UserProfile {
  user_id: string
  name: string
  role: string
  email: string
}

export default function MessagesPage() {
  const [user, setUser] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [showCompose, setShowCompose] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [players, setPlayers] = useState<UserProfile[]>([])
  const [admins, setAdmins] = useState<UserProfile[]>([])
  const [coaches, setCoaches] = useState<UserProfile[]>([])
  const [physios, setPhysios] = useState<UserProfile[]>([])
  const [teamManagers, setTeamManagers] = useState<UserProfile[]>([])
  const [financeAdmins, setFinanceAdmins] = useState<UserProfile[]>([])
  const [allUsers, setAllUsers] = useState<UserProfile[]>([])
  const [composeData, setComposeData] = useState({
    recipientType: 'role', // 'role' or 'individual'
    recipient: '',
    recipientId: '',
    selectedRoles: [] as string[], // For multi-select when sending to roles
    subject: '',
    message: '',
  })

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        setLoading(false)
        return
      }

      if (authUser) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (profile) {
          setUser(profile)
          
          // Fetch messages via API route to bypass RLS and get proper sender info
          try {
            const response = await fetch('/api/messages', {
              cache: 'no-store',
            })
            
            if (response.ok) {
              const data = await response.json()
              setMessages(data.messages || [])
            } else {
              console.error('Error fetching messages from API:', response.status)
              // Fallback to direct query
              const { data: fetchedMessages } = await supabase
                .from('messages')
                .select('*')
                .or(`sender_id.eq.${authUser.id},recipient_id.eq.${authUser.id},recipient_role.eq.${profile.role}`)
                .order('created_at', { ascending: false })
              
              if (fetchedMessages) {
                // Try to get sender info even with RLS limitations
                const senderIds = [...new Set(fetchedMessages.map((msg: any) => msg.sender_id).filter(Boolean))]
                let userProfilesMap: Record<string, any> = {}
                
                if (senderIds.length > 0) {
                  const { data: profiles } = await supabase
                    .from('user_profiles')
                    .select('user_id, name, role')
                    .in('user_id', senderIds)
                  
                  if (profiles) {
                    profiles.forEach((profile: any) => {
                      userProfilesMap[profile.user_id] = profile
                    })
                  }
                }
                
                // Get recipient IDs for recipient info
                const recipientIds = [...new Set(fetchedMessages.map((msg: any) => msg.recipient_id).filter(Boolean))]
                if (recipientIds.length > 0) {
                  const { data: recipientProfiles } = await supabase
                    .from('user_profiles')
                    .select('user_id, name, role')
                    .in('user_id', recipientIds)
                  
                  if (recipientProfiles) {
                    recipientProfiles.forEach((profile: any) => {
                      userProfilesMap[profile.user_id] = profile
                    })
                  }
                }
                
                const formattedMessages: Message[] = fetchedMessages.map((msg: any) => {
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
                setMessages(formattedMessages)
              } else {
                setMessages([])
              }
            }
          } catch (error) {
            console.error('Error fetching messages:', error)
            setMessages([])
          }

          // If user is a coach, fetch players and admins for messaging
          if (profile.role === 'coach') {
            // Fetch all players
            const { data: playersData } = await supabase
              .from('user_profiles')
              .select('user_id, name, role, email')
              .eq('role', 'player')
              .order('name', { ascending: true })

            if (playersData) {
              setPlayers(playersData as UserProfile[])
            }

            // Fetch all admins
            const { data: adminsData } = await supabase
              .from('user_profiles')
              .select('user_id, name, role, email')
              .in('role', ['admin', 'data_admin', 'finance_admin'])
              .order('name', { ascending: true })

            if (adminsData) {
              setAdmins(adminsData as UserProfile[])
            }
          }

          // If user is an admin, fetch all users for messaging
          if (profile.role === 'admin') {
            // Fetch all users grouped by role
            const { data: allUsersData } = await supabase
              .from('user_profiles')
              .select('user_id, name, role, email')
              .neq('user_id', authUser.id) // Exclude self
              .order('name', { ascending: true })

            if (allUsersData) {
              setAllUsers(allUsersData as UserProfile[])
              setPlayers(allUsersData.filter((u: UserProfile) => u.role === 'player'))
              setCoaches(allUsersData.filter((u: UserProfile) => u.role === 'coach'))
              setPhysios(allUsersData.filter((u: UserProfile) => u.role === 'physio'))
              setTeamManagers(allUsersData.filter((u: UserProfile) => u.role === 'data_admin'))
              setFinanceAdmins(allUsersData.filter((u: UserProfile) => u.role === 'finance_admin'))
              setAdmins(allUsersData.filter((u: UserProfile) => u.role === 'admin'))
            }
          }
        }
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const markMessageAsRead = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Error marking message as read:', errorData.error || response.statusText)
        return
      }

      const result = await response.json()
      
      if (result.success) {
        // Update local state
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, read: true } : msg
          )
        )
        console.log('Message marked as read successfully:', messageId)
      }
    } catch (error) {
      console.error('Error marking message as read:', error)
    }
  }

  const deleteMessage = async (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent opening the message modal
    
    if (!confirm('Are you sure you want to delete this message?')) {
      return
    }

    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Error deleting message:', errorData.error || response.statusText)
        alert(`Error deleting message: ${errorData.error || response.statusText}`)
        return
      }

      const result = await response.json()
      
      if (result.success) {
        // Remove from local state
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
        
        // Close modal if the deleted message was selected
        if (selectedMessage?.id === messageId) {
          setSelectedMessage(null)
        }
        
        console.log('Message deleted successfully:', messageId)
      }
    } catch (error) {
      console.error('Error deleting message:', error)
      alert('Error deleting message. Please try again.')
    }
  }

  const handleSendMessage = async () => {
    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        alert('Please log in to send messages')
        return
      }

      if (!composeData.subject || !composeData.message) {
        alert('Please fill in subject and message')
        return
      }

      // Handle admin messaging
      if (user?.role === 'admin') {
        if (composeData.recipientType === 'role') {
          // Send to selected roles (can be multiple)
          const rolesToSend = composeData.selectedRoles.length > 0 
            ? composeData.selectedRoles 
            : (composeData.recipient ? [composeData.recipient] : [])

          if (rolesToSend.length === 0) {
            alert('Please select at least one recipient role')
            return
          }

          // Get all users with selected roles
          const { data: recipients } = await supabase
            .from('user_profiles')
            .select('user_id')
            .in('role', rolesToSend)
            .neq('user_id', authUser.id) // Exclude self

          if (recipients && recipients.length > 0) {
            // Send message to each recipient
            const messagePromises = recipients.map((recipient) =>
              supabase
                .from('messages')
                .insert({
                  sender_id: authUser.id,
                  recipient_id: recipient.user_id,
                  subject: composeData.subject,
                  message: composeData.message,
                })
            )

            await Promise.all(messagePromises)
            
            // Create notifications for recipients
            try {
              const { db } = await import('@/lib/db-helpers')
              await db.createNotificationForUsers(
                recipients.map(r => r.user_id),
                {
                  title: 'New Message',
                  message: `${user.name} sent you a message: ${composeData.subject || 'No subject'}`,
                  type: 'info',
                }
              )
              console.log(`Notifications created for ${recipients.length} recipient(s)`)
            } catch (notifError) {
              console.error('Error creating notifications:', notifError)
              // Don't fail the message send if notification creation fails
            }
            
            const roleNames = rolesToSend.map(r => r === 'data_admin' ? 'team managers' : r.replace('_', ' ')).join(', ')
            alert(`Message sent successfully to ${recipients.length} recipient(s) (${roleNames})!`)
          } else {
            alert('No recipients found for selected roles')
            return
          }
        } else {
          // Send to individual recipient
          if (!composeData.recipientId) {
            alert('Please select a recipient')
            return
          }

          const { data: newMessage, error } = await supabase
            .from('messages')
            .insert({
              sender_id: authUser.id,
              recipient_id: composeData.recipientId,
              subject: composeData.subject,
              message: composeData.message,
            })
            .select(`
              *,
              sender:user_profiles!messages_sender_id_fkey(name, role)
            `)
            .single()

          if (error) throw error

          // Create notification for recipient
          try {
            const { db } = await import('@/lib/db-helpers')
            await db.createNotification({
              user_id: composeData.recipientId,
              title: 'New Message',
              message: `${user.name} sent you a message: ${composeData.subject || 'No subject'}`,
              type: 'info',
            })
            console.log('Notification created for recipient:', composeData.recipientId)
          } catch (notifError) {
            console.error('Error creating notification:', notifError)
            // Don't fail the message send if notification creation fails
          }

          // Get recipient info for the sent message
          let recipientName = 'Unknown'
          let recipientRole = 'unknown'
          if (composeData.recipientId) {
            const { data: recipientProfile } = await supabase
              .from('user_profiles')
              .select('name, role')
              .eq('user_id', composeData.recipientId)
              .single()
            
            if (recipientProfile) {
              recipientName = recipientProfile.name
              recipientRole = recipientProfile.role
            }
          }
          
          // Add to local state (as a sent message)
          const formattedMessage: Message = {
            id: newMessage.id,
            sender_id: authUser.id,
            sender_name: user.name,
            sender_role: user.role,
            recipient_id: composeData.recipientId || '',
            recipient_name: recipientName,
            recipient_role: recipientRole,
            subject: newMessage.subject || '',
            message: newMessage.message,
            read: false,
            created_at: newMessage.created_at,
            is_sent: true,
          }

          setMessages([formattedMessage, ...messages])
          alert('Message sent successfully!')
        }
      } else if (user?.role === 'coach') {
        // Coach can send to players or admins
        let recipientId: string | null = null
        let recipientRole: string | null = null

        if (composeData.recipientType === 'role') {
          // Send to all players or all admins
          if (composeData.recipient === 'all_players') {
            recipientRole = 'player'
          } else if (composeData.recipient === 'all_admins') {
            recipientRole = 'admin'
          }
        } else {
          // Send to individual player or admin
          recipientId = composeData.recipientId
        }

        // If sending to a role (all players or all admins), we need to send individual messages
        if (recipientRole && (recipientRole === 'player' || recipientRole === 'admin')) {
          // Get all users with that role
          const roleToQuery = recipientRole === 'player' ? 'player' : recipientRole
          const { data: recipients } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('role', roleToQuery)

          if (recipients && recipients.length > 0) {
            // Send message to each recipient
            const messagePromises = recipients.map((recipient) =>
              supabase
                .from('messages')
                .insert({
                  sender_id: authUser.id,
                  recipient_id: recipient.user_id,
                  subject: composeData.subject,
                  message: composeData.message,
                })
            )

            await Promise.all(messagePromises)
            
            // Create notifications for recipients
            try {
              const { db } = await import('@/lib/db-helpers')
              await db.createNotificationForUsers(
                recipients.map(r => r.user_id),
                {
                  title: 'New Message',
                  message: `${user.name} sent you a message: ${composeData.subject || 'No subject'}`,
                  type: 'info',
                }
              )
              console.log(`Notifications created for ${recipients.length} recipient(s)`)
            } catch (notifError) {
              console.error('Error creating notifications:', notifError)
              // Don't fail the message send if notification creation fails
            }
            
            alert(`Message sent successfully to ${recipients.length} ${recipientRole === 'player' ? 'players' : 'admins'}!`)
          } else {
            alert(`No ${recipientRole === 'player' ? 'players' : 'admins'} found`)
            return
          }
        } else {
          // Send to individual recipient
          // Get recipient role for the message
          let recipientRoleForMessage: string | null = null
          if (recipientId) {
            const { data: recipientProfile } = await supabase
              .from('user_profiles')
              .select('role')
              .eq('user_id', recipientId)
              .single()
            
            if (recipientProfile) {
              recipientRoleForMessage = recipientProfile.role
            }
          }
          
          const { data: newMessage, error } = await supabase
            .from('messages')
            .insert({
              sender_id: authUser.id,
              recipient_id: recipientId,
              recipient_role: recipientRoleForMessage,
              subject: composeData.subject,
              message: composeData.message,
            })
            .select(`
              *,
              sender:user_profiles!messages_sender_id_fkey(name, role)
            `)
            .single()

          if (error) throw error

          // Create notification for recipient
          if (recipientId) {
            const { db } = await import('@/lib/db-helpers')
            try {
              await db.createNotification({
                user_id: recipientId,
                title: 'New Message',
                message: `${user.name} sent you a message: ${composeData.subject || 'No subject'}`,
                type: 'info',
              })
              console.log('Notification created for recipient:', recipientId)
            } catch (notifError) {
              console.error('Error creating notification:', notifError)
              // Don't fail the message send if notification creation fails
            }
          }

          // Get recipient info for the sent message
          let recipientName = 'Unknown'
          let recipientRole = 'unknown'
          if (recipientId) {
            const { data: recipientProfile } = await supabase
              .from('user_profiles')
              .select('name, role')
              .eq('user_id', recipientId)
              .single()
            
            if (recipientProfile) {
              recipientName = recipientProfile.name
              recipientRole = recipientProfile.role
            }
          }
          
          // Add to local state (as a sent message)
          const formattedMessage: Message = {
            id: newMessage.id,
            sender_id: authUser.id,
            sender_name: user.name,
            sender_role: user.role,
            recipient_id: recipientId || '',
            recipient_name: recipientName,
            recipient_role: recipientRole,
            subject: newMessage.subject || '',
            message: newMessage.message,
            read: false,
            created_at: newMessage.created_at,
            is_sent: true,
          }

          setMessages([formattedMessage, ...messages])
          alert('Message sent successfully!')
        }
      } else {
        // For other roles (players, etc.)
        let recipientId: string | null = null
        let recipientRole: string | null = null

        // Priority: If recipientId is set, use it (specific recipient)
        if (composeData.recipientId) {
          recipientId = composeData.recipientId
        } else if (composeData.recipientType === 'role') {
          // Role-based messaging - need to send to all users with that role
          if (composeData.recipient === 'admin' || composeData.recipient === 'coach') {
            recipientRole = composeData.recipient
            
            // Use API route to bypass RLS and get recipients
            try {
              const response = await fetch(`/api/messages/recipients?role=${recipientRole}`)
              if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to fetch recipients')
              }
              
              const data = await response.json()
              const recipients = data.recipients || []

              if (recipients && recipients.length > 0) {
              // Send message to each recipient
              const messagePromises = recipients.map((recipient: { user_id: string }) =>
                supabase
                  .from('messages')
                  .insert({
                    sender_id: authUser.id,
                    recipient_id: recipient.user_id, // Always set recipient_id
                    recipient_role: recipientRole,
                    subject: composeData.subject,
                    message: composeData.message,
                  })
              )

              await Promise.all(messagePromises)
              
              // Create notifications for recipients
              try {
                const { db } = await import('@/lib/db-helpers')
                const recipientIds = recipients.map((r: { user_id: string }) => r.user_id)
                console.log(`Creating notifications for ${recipientIds.length} recipients:`, recipientIds)
                const result = await db.createNotificationForUsers(
                  recipientIds,
                  {
                    title: 'New Message',
                    message: `${user.name} sent you a message: ${composeData.subject || 'No subject'}`,
                    type: 'info',
                  }
                )
                console.log(`Notifications created successfully:`, result)
              } catch (notifError) {
                console.error('Error creating notifications:', notifError)
                console.error('Notification error details:', JSON.stringify(notifError, null, 2))
                // Don't fail the message send if notification creation fails
              }
              
              alert(`Message sent successfully to ${recipients.length} recipient(s)!`)
              setComposeData({ recipientType: 'role', recipient: '', recipientId: '', selectedRoles: [], subject: '', message: '' })
              setShowCompose(false)
              return
            } else {
              alert('No recipients found for selected role')
              return
            }
            } catch (fetchError: any) {
              console.error('Error fetching recipients:', fetchError)
              alert(`Error fetching recipients: ${fetchError.message || 'Unknown error'}`)
              return
            }
          } else {
            alert('Please select a valid recipient')
            return
          }
        } else {
          alert('Please select a recipient')
          return
        }

        // If we have a specific recipientId, send to that person
        if (recipientId) {
          // Get recipient role for the message
          let recipientRoleForMessage: string | null = null
          const { data: recipientProfile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('user_id', recipientId)
            .single()
          
          if (recipientProfile) {
            recipientRoleForMessage = recipientProfile.role
          }
          
          const { data: newMessage, error } = await supabase
            .from('messages')
            .insert({
              sender_id: authUser.id,
              recipient_id: recipientId, // Always set recipient_id for specific recipients
              recipient_role: recipientRoleForMessage,
              subject: composeData.subject,
              message: composeData.message,
            })
            .select(`
              *,
              sender:user_profiles!messages_sender_id_fkey(name, role)
            `)
            .single()

          if (error) throw error

          // Create notification for recipient
          try {
            const { db } = await import('@/lib/db-helpers')
            await db.createNotification({
              user_id: recipientId,
              title: 'New Message',
              message: `${user.name} sent you a message: ${composeData.subject || 'No subject'}`,
              type: 'info',
            })
            console.log('Notification created for recipient:', recipientId)
          } catch (notifError) {
            console.error('Error creating notification:', notifError)
            // Don't fail the message send if notification creation fails
          }

          // Get recipient info for the sent message
          let recipientName = 'Unknown'
          let recipientRole = 'unknown'
          if (recipientId) {
            const { data: recipientProfile } = await supabase
              .from('user_profiles')
              .select('name, role')
              .eq('user_id', recipientId)
              .single()
            
            if (recipientProfile) {
              recipientName = recipientProfile.name
              recipientRole = recipientProfile.role
            }
          }
          
          // Add to local state (as a sent message)
          const formattedMessage: Message = {
            id: newMessage.id,
            sender_id: authUser.id,
            sender_name: user.name,
            sender_role: user.role,
            recipient_id: recipientId || '',
            recipient_name: recipientName,
            recipient_role: recipientRole,
            subject: newMessage.subject || '',
            message: newMessage.message,
            read: false,
            created_at: newMessage.created_at,
            is_sent: true,
          }

          setMessages([formattedMessage, ...messages])
          alert('Message sent successfully!')
        }
      }

      setComposeData({ recipientType: 'role', recipient: '', recipientId: '', selectedRoles: [], subject: '', message: '' })
      setShowCompose(false)
    } catch (error: any) {
      console.error('Error sending message:', error)
      alert(`Error sending message: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <Layout pageTitle="Messages">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!user) return null

  // Calculate unread count (only for received messages, not sent)
  const unreadCount = messages.filter((m) => !m.is_sent && !m.read).length

  return (
    <Layout pageTitle="Messages">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="mb-2">
            <h1 className="text-4xl font-extrabold text-club-gradient mb-2">Messages</h1>
            <p className="text-lg text-neutral-medium font-medium">
              {user?.role === 'admin'
                ? 'Send messages to all team members and staff'
                : user?.role === 'coach' 
                ? 'Communicate with players and administrators' 
                : 'Communicate with coaches and administrators'}
            </p>
          </div>
          <button
            onClick={() => setShowCompose(!showCompose)}
            className="bg-club-gradient text-white px-6 py-3 rounded-button font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
          >
            <Send className="w-5 h-5 mr-2" />
            New Message
          </button>
        </div>

        {/* Compose Message */}
        {showCompose && (
          <div className="bg-white rounded-card shadow-soft border border-neutral-light p-6">
            <h2 className="text-xl font-semibold text-neutral-text mb-4">Compose Message</h2>
            <div className="space-y-4">
              {user?.role === 'admin' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-2">
                      Send To
                    </label>
                    <select
                      value={composeData.recipientType}
                      onChange={(e) => setComposeData({ ...composeData, recipientType: e.target.value, recipient: '', recipientId: '', selectedRoles: [] })}
                      className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    >
                      <option value="role">By Role (General/Broadcast)</option>
                      <option value="individual">Individual User</option>
                    </select>
                  </div>
                  {composeData.recipientType === 'role' ? (
                    <div>
                      <label className="block text-sm font-medium text-neutral-medium mb-2">
                        Select Recipient Role(s) - You can select multiple
                      </label>
                      <div className="space-y-2">
                        {[
                          { value: 'player', label: 'All Players' },
                          { value: 'coach', label: 'All Coaches' },
                          { value: 'physio', label: 'All Physiotherapists' },
                          { value: 'data_admin', label: 'All Team Managers' },
                          { value: 'finance_admin', label: 'All Finance Admins' },
                        ].map((role) => (
                          <label key={role.value} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={composeData.selectedRoles.includes(role.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setComposeData({
                                    ...composeData,
                                    selectedRoles: [...composeData.selectedRoles, role.value],
                                  })
                                } else {
                                  setComposeData({
                                    ...composeData,
                                    selectedRoles: composeData.selectedRoles.filter((r) => r !== role.value),
                                  })
                                }
                              }}
                              className="w-4 h-4 text-primary border-neutral-light rounded focus:ring-primary"
                            />
                            <span className="text-sm text-neutral-text">{role.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-neutral-medium mb-2">
                        Select Individual Recipient
                      </label>
                      <select
                        value={composeData.recipientId}
                        onChange={(e) => setComposeData({ ...composeData, recipientId: e.target.value, recipient: '' })}
                        className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      >
                        <option value="">Select recipient...</option>
                        {players.length > 0 && (
                          <optgroup label="Players">
                            {players.map((player) => (
                              <option key={player.user_id} value={player.user_id}>
                                {player.name} (Player)
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {coaches.length > 0 && (
                          <optgroup label="Coaches">
                            {coaches.map((coach) => (
                              <option key={coach.user_id} value={coach.user_id}>
                                {coach.name} (Coach)
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {physios.length > 0 && (
                          <optgroup label="Physiotherapists">
                            {physios.map((physio) => (
                              <option key={physio.user_id} value={physio.user_id}>
                                {physio.name} (Physio)
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {teamManagers.length > 0 && (
                          <optgroup label="Team Managers">
                            {teamManagers.map((manager) => (
                              <option key={manager.user_id} value={manager.user_id}>
                                {manager.name} (Team Manager)
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {financeAdmins.length > 0 && (
                          <optgroup label="Finance Admins">
                            {financeAdmins.map((finance) => (
                              <option key={finance.user_id} value={finance.user_id}>
                                {finance.name} (Finance Admin)
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {admins.length > 0 && (
                          <optgroup label="Administrators">
                            {admins.map((admin) => (
                              <option key={admin.user_id} value={admin.user_id}>
                                {admin.name} (Admin)
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  )}
                </>
              ) : user?.role === 'coach' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-2">
                      Send To
                    </label>
                    <select
                      value={composeData.recipientType}
                      onChange={(e) => setComposeData({ ...composeData, recipientType: e.target.value, recipient: '', recipientId: '' })}
                      className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    >
                      <option value="role">All Players / All Admins</option>
                      <option value="individual">Individual Player / Admin</option>
                    </select>
                  </div>
                  {composeData.recipientType === 'role' ? (
                    <div>
                      <label className="block text-sm font-medium text-neutral-medium mb-2">
                        Select Recipient Group
                      </label>
                      <select
                        value={composeData.recipient}
                        onChange={(e) => setComposeData({ ...composeData, recipient: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      >
                        <option value="">Select recipient group...</option>
                        <option value="all_players">All Players</option>
                        <option value="all_admins">All Administrators</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-neutral-medium mb-2">
                        Select Individual Recipient
                      </label>
                      <select
                        value={composeData.recipientId}
                        onChange={(e) => setComposeData({ ...composeData, recipientId: e.target.value, recipient: '' })}
                        className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      >
                        <option value="">Select recipient...</option>
                        <optgroup label="Players">
                          {players.map((player) => (
                            <option key={player.user_id} value={player.user_id}>
                              {player.name} (Player)
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Administrators">
                          {admins.map((admin) => (
                            <option key={admin.user_id} value={admin.user_id}>
                              {admin.name} ({admin.role.replace('_', ' ')})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">
                    To (Admin or Coach)
                  </label>
                  <select
                    value={composeData.recipient}
                    onChange={(e) => setComposeData({ ...composeData, recipient: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="">Select recipient...</option>
                    <option value="admin">Administrator</option>
                    <option value="coach">Coach</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-2">Subject</label>
                <input
                  type="text"
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  placeholder="e.g., Availability Update, Injury Report"
                  className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-2">Message</label>
                <textarea
                  value={composeData.message}
                  onChange={(e) => setComposeData({ ...composeData, message: e.target.value })}
                  rows={6}
                  placeholder="Type your message here..."
                  className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSendMessage}
                  className="px-6 py-3 bg-club-gradient text-white rounded-button hover:opacity-90 transition-all duration-300 font-semibold shadow-soft hover:shadow-medium"
                >
                  Send Message
                </button>
                <button
                  onClick={() => {
                    setShowCompose(false)
                    setComposeData({ recipientType: 'role', recipient: '', recipientId: '', selectedRoles: [], subject: '', message: '' })
                  }}
                  className="px-6 py-3 bg-neutral-light text-neutral-text rounded-button hover:bg-neutral-medium transition-all duration-300 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages List */}
        <div className="bg-white rounded-card shadow-soft border border-neutral-light">
          <div className="p-6 border-b border-neutral-light">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-neutral-text">Inbox</h2>
              {unreadCount > 0 && (
                <span className="bg-club-gradient text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-soft">
                  {unreadCount} unread
                </span>
              )}
            </div>
          </div>

          {messages.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-neutral-light rounded-full mb-4">
                <MessageSquare className="w-10 h-10 text-neutral-medium" />
              </div>
              <h3 className="text-xl font-bold text-neutral-text mb-2">No Messages</h3>
              <p className="text-neutral-medium">You don&apos;t have any messages yet</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-light">
              {messages.map((message) => (
                <div
                  key={message.id}
                  onClick={() => {
                    setSelectedMessage(message)
                    // Mark message as read when clicked
                    if (!message.read) {
                      markMessageAsRead(message.id)
                    }
                  }}
                  className={`p-6 cursor-pointer hover:bg-neutral-light transition-all duration-200 ${
                    !message.is_sent && !message.read ? 'bg-blue-50/50 border-l-4 border-primary' : message.is_sent ? 'bg-green-50/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {message.is_sent ? (
                          <>
                            <span className="text-xs font-medium text-neutral-medium">To:</span>
                            <h3 className="font-bold text-neutral-text">{message.recipient_name || 'Unknown'}</h3>
                            <span className="text-xs font-medium text-neutral-medium bg-neutral-light px-2 py-0.5 rounded-full capitalize">
                              {message.recipient_role?.replace('_', ' ') || 'unknown'}
                            </span>
                            <span className="text-xs font-medium text-neutral-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              Sent
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs font-medium text-neutral-medium">From:</span>
                            <h3 className="font-bold text-neutral-text">{message.sender_name}</h3>
                            <span className="text-xs font-medium text-neutral-medium bg-neutral-light px-2 py-0.5 rounded-full capitalize">
                              {message.sender_role.replace('_', ' ')}
                            </span>
                            {!message.read && (
                              <span className="bg-club-gradient text-white text-xs px-2.5 py-1 rounded-full font-semibold shadow-soft">
                                New
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <p className="font-semibold text-neutral-text mb-1">{message.subject}</p>
                      <p className="text-sm text-neutral-medium line-clamp-2">{message.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-neutral-medium">
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(message.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message Detail Modal */}
        {selectedMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-card shadow-large max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-neutral-light">
              <div className="p-6 border-b border-neutral-light">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-2xl font-bold text-neutral-text">{selectedMessage.subject}</h2>
                      {!selectedMessage.read && (
                        <span className="bg-club-gradient text-white text-xs px-2.5 py-1 rounded-full font-semibold shadow-soft">
                          New
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-neutral-medium">
                      {selectedMessage.is_sent ? (
                        <>
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 mr-1" />
                            To: {selectedMessage.recipient_name || 'Unknown'}
                          </div>
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-1" />
                            {selectedMessage.recipient_role?.replace('_', ' ') || 'unknown'}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-1" />
                            From: {selectedMessage.sender_name}
                          </div>
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 mr-1" />
                            {selectedMessage.sender_role.replace('_', ' ')}
                          </div>
                        </>
                      )}
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {new Date(selectedMessage.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="text-neutral-medium hover:text-neutral-text"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="prose max-w-none">
                  <p className="text-neutral-text whitespace-pre-wrap">{selectedMessage.message}</p>
                </div>
              </div>
              <div className="p-6 border-t border-neutral-light flex justify-between items-center">
                <button
                  onClick={() => {
                    if (selectedMessage && confirm('Are you sure you want to delete this message?')) {
                      deleteMessage(selectedMessage.id, new MouseEvent('click') as any)
                    }
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-button transition-all duration-300 font-semibold flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="px-6 py-3 bg-neutral-light text-neutral-text rounded-button hover:bg-neutral-medium transition-all duration-300 font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
