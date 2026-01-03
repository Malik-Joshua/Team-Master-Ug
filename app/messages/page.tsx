'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import { MessageSquare, Send, User, Mail, Clock, X, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RefreshButton from '@/components/RefreshButton'

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
          // For players: only show messages where they are the specific recipient or sender
          // For other roles: can see role-based messages too
          let messagesQuery = supabase
            .from('messages')
            .select('*')
          
          if (profile.role === 'player') {
            messagesQuery = messagesQuery.or(`sender_id.eq.${authUser.id},recipient_id.eq.${authUser.id}`)
          } else {
            messagesQuery = messagesQuery.or(`sender_id.eq.${authUser.id},recipient_id.eq.${authUser.id},recipient_role.eq.${profile.role}`)
          }
          
          const { data: fetchedMessages } = await messagesQuery
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

          // If user is a coach, admin, team manager, finance admin, or physio, fetch users for messaging
          if (['coach', 'admin', 'data_admin', 'finance_admin', 'physio'].includes(profile.role)) {
            // Use API route to fetch all users (bypasses RLS)
            try {
              const usersResponse = await fetch('/api/messages/users')
              if (usersResponse.ok) {
                const usersData = await usersResponse.json()
                if (usersData.users && usersData.users.length > 0) {
                  const allUsersList = usersData.users as UserProfile[]
                  setAllUsers(allUsersList)
                  
                  // For physio, only fetch players who have injuries
                  if (profile.role === 'physio') {
                    // Fetch injured players via API route (bypasses RLS)
                    try {
                      const injuredPlayersResponse = await fetch('/api/messages/injured-players', {
                        cache: 'no-store',
                      })
                      
                      if (injuredPlayersResponse.ok) {
                        const injuredData = await injuredPlayersResponse.json()
                        if (injuredData.injuredPlayers && injuredData.injuredPlayers.length > 0) {
                          setPlayers(injuredData.injuredPlayers as UserProfile[])
                          console.log(`Loaded ${injuredData.injuredPlayers.length} injured player(s) for physio`)
                        } else {
                          setPlayers([])
                          console.log('No injured players found')
                        }
                      } else {
                        console.error('Error fetching injured players via API:', injuredPlayersResponse.status)
                        // Fallback: filter from all users list using player role
                        // This won't filter by injuries but at least shows players
                        const allPlayers = allUsersList.filter((u: UserProfile) => u.role === 'player')
                        setPlayers(allPlayers)
                      }
                    } catch (injuredError) {
                      console.error('Error fetching injured players:', injuredError)
                      // Fallback: show all players (better than nothing)
                      const allPlayers = allUsersList.filter((u: UserProfile) => u.role === 'player')
                      setPlayers(allPlayers)
                    }
                    
                    // Physio can still message admins and coaches
                    const coachesList = allUsersList.filter((u: UserProfile) => u.role === 'coach')
                    const adminsList = allUsersList.filter((u: UserProfile) => ['admin', 'data_admin', 'finance_admin'].includes(u.role))
                    
                    setCoaches(coachesList)
                    setAdmins(adminsList)
                    console.log(`Loaded ${coachesList.length} coach(es) and ${adminsList.length} admin(s) for physio`)
                  } else {
                    // For other roles, fetch all players
                    setPlayers(allUsersList.filter((u: UserProfile) => u.role === 'player'))
                    setCoaches(allUsersList.filter((u: UserProfile) => u.role === 'coach'))
                    setPhysios(allUsersList.filter((u: UserProfile) => u.role === 'physio'))
                    setTeamManagers(allUsersList.filter((u: UserProfile) => u.role === 'data_admin'))
                    setFinanceAdmins(allUsersList.filter((u: UserProfile) => u.role === 'finance_admin'))
                    setAdmins(allUsersList.filter((u: UserProfile) => ['admin', 'data_admin', 'finance_admin'].includes(u.role)))
                  }
                }
              } else {
                console.error('Error fetching users via API:', usersResponse.status)
                // Fallback to direct queries
                await fetchUsersDirectly(supabase, authUser.id, profile.role)
              }
            } catch (usersError) {
              console.error('Error fetching users via API, trying direct queries:', usersError)
              // Fallback to direct queries
              await fetchUsersDirectly(supabase, authUser.id, profile.role)
            }
          } else if (profile.role === 'player') {
            // Players can only message team managers - use API route to bypass RLS
            try {
              const teamManagersResponse = await fetch('/api/messages/team-managers', {
                cache: 'no-store',
              })
              
              if (teamManagersResponse.ok) {
                const teamManagersData = await teamManagersResponse.json()
                if (teamManagersData.teamManagers && teamManagersData.teamManagers.length > 0) {
                  setTeamManagers(teamManagersData.teamManagers as UserProfile[])
                  console.log(`Loaded ${teamManagersData.teamManagers.length} team manager(s) for player`)
                } else {
                  console.log('No team managers found')
                  setTeamManagers([])
                }
              } else {
                const errorData = await teamManagersResponse.json().catch(() => ({ error: teamManagersResponse.statusText }))
                console.error('Error fetching team managers via API:', errorData.error || teamManagersResponse.status)
                // Fallback to direct query (may fail due to RLS)
                try {
                  const { data: teamManagersData } = await supabase
                    .from('user_profiles')
                    .select('user_id, name, role, email')
                    .eq('role', 'data_admin')
                    .neq('user_id', authUser.id)
                    .order('name', { ascending: true })

                  if (teamManagersData) {
                    setTeamManagers(teamManagersData as UserProfile[])
                    console.log(`Loaded ${teamManagersData.length} team manager(s) via direct query`)
                  }
                } catch (fallbackError) {
                  console.error('Fallback query also failed:', fallbackError)
                  setTeamManagers([])
                }
              }
            } catch (error) {
              console.error('Error fetching team managers for player:', error)
              setTeamManagers([])
            }
          }
        }
      }
      setLoading(false)
    }

    loadData()
  }, [])

  // Auto-mark notification as read when message modal opens
  useEffect(() => {
    if (selectedMessage && !selectedMessage.read) {
      // Mark message as read
      markMessageAsRead(selectedMessage.id)
    }
    
    // Always try to mark related notification as read when message is viewed
    if (selectedMessage) {
      // Try by reference_id first (most accurate)
      fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference_id: selectedMessage.id,
          reference_type: 'message',
          action_url: '/messages',
        }),
      }).catch((error) => {
        console.error('Error marking notification as read by reference:', error)
      })
      
      // Also try by action_url for older notifications without reference_id
      fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action_url: '/messages',
        }),
      }).catch((error) => {
        console.error('Error marking notification as read by action_url:', error)
      })
    }
  }, [selectedMessage])

  // Helper function to fetch users directly (fallback)
  const fetchUsersDirectly = async (supabase: any, currentUserId: string, userRole: string) => {
    if (userRole === 'coach') {
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
        .neq('user_id', currentUserId)
        .order('name', { ascending: true })

      if (adminsData) {
        setAdmins(adminsData as UserProfile[])
      }

      // Fetch all physios
      const { data: physiosData } = await supabase
        .from('user_profiles')
        .select('user_id, name, role, email')
        .eq('role', 'physio')
        .order('name', { ascending: true })

      if (physiosData) {
        setPhysios(physiosData as UserProfile[])
      }
    } else if (userRole === 'admin' || userRole === 'data_admin') {
      // Fetch all users grouped by role
      const { data: allUsersData } = await supabase
        .from('user_profiles')
        .select('user_id, name, role, email')
        .neq('user_id', currentUserId)
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
    } else if (userRole === 'finance_admin') {
      // Finance admin can only message general admin
      const { data: adminsData } = await supabase
        .from('user_profiles')
        .select('user_id, name, role, email')
        .eq('role', 'admin')
        .neq('user_id', currentUserId)
        .order('name', { ascending: true })

      if (adminsData) {
        setAdmins(adminsData as UserProfile[])
      }
    } else if (userRole === 'physio') {
      // Physio can only message players with injuries, admins, and coaches
      // Try to fetch injured players via API route first (bypasses RLS)
      try {
        const injuredPlayersResponse = await fetch('/api/messages/injured-players', {
          cache: 'no-store',
        })
        
        if (injuredPlayersResponse.ok) {
          const injuredData = await injuredPlayersResponse.json()
          if (injuredData.injuredPlayers && injuredData.injuredPlayers.length > 0) {
            setPlayers(injuredData.injuredPlayers as UserProfile[])
            console.log(`Fallback: Loaded ${injuredData.injuredPlayers.length} injured player(s) for physio`)
          } else {
            setPlayers([])
            console.log('Fallback: No injured players found')
          }
        } else {
          console.error('Fallback: Error fetching injured players via API:', injuredPlayersResponse.status)
          setPlayers([])
        }
      } catch (apiError) {
        console.error('Fallback: Error fetching injured players via API:', apiError)
        // Try direct query as last resort (may fail due to RLS)
        try {
          const { data: injuriesData } = await supabase
            .from('injuries')
            .select('player_id')
            .order('injury_date', { ascending: false })

          if (injuriesData && injuriesData.length > 0) {
            const injuredPlayerIds = [...new Set(injuriesData.map((injury: any) => injury.player_id).filter(Boolean))]
            
            const { data: playersData } = await supabase
              .from('user_profiles')
              .select('user_id, name, role, email')
              .eq('role', 'player')
              .in('user_id', injuredPlayerIds)
              .order('name', { ascending: true })

            if (playersData) {
              setPlayers(playersData as UserProfile[])
            } else {
              setPlayers([])
            }
          } else {
            setPlayers([])
          }
        } catch (directError) {
          console.error('Fallback: Direct query also failed:', directError)
          setPlayers([])
        }
      }

      // Fetch all admins
      const { data: adminsData } = await supabase
        .from('user_profiles')
        .select('user_id, name, role, email')
        .in('role', ['admin', 'data_admin', 'finance_admin'])
        .neq('user_id', currentUserId)
        .order('name', { ascending: true })

      if (adminsData) {
        setAdmins(adminsData as UserProfile[])
        console.log(`Fallback: Loaded ${adminsData.length} admin(s) for physio`)
      } else {
        setAdmins([])
      }

      // Fetch all coaches
      const { data: coachesData } = await supabase
        .from('user_profiles')
        .select('user_id, name, role, email')
        .eq('role', 'coach')
        .order('name', { ascending: true })

      if (coachesData) {
        setCoaches(coachesData as UserProfile[])
        console.log(`Fallback: Loaded ${coachesData.length} coach(es) for physio`)
      } else {
        setCoaches([])
      }
    }
  }

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
                .select('id, recipient_id')
                .single()
            )

            const messageResults = await Promise.all(messagePromises)
            
            // Create notifications for recipients with message references
            try {
              const { db } = await import('@/lib/db-helpers')
              // Create individual notifications with message IDs
              const notificationPromises = messageResults.map((result: any) => {
                if (result.data && result.data.id) {
                  return db.createNotification({
                    user_id: result.data.recipient_id,
                    title: 'New Message',
                    message: `${user.name} sent you a message: ${composeData.subject || 'No subject'}`,
                    type: 'info',
                    action_url: '/messages',
                    reference_id: result.data.id,
                    reference_type: 'message',
                  })
                }
                return Promise.resolve(null)
              })
              
              await Promise.all(notificationPromises)
              console.log(`Notifications created for ${messageResults.length} recipient(s)`)
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
              action_url: '/messages',
              reference_id: newMessage?.id,
              reference_type: 'message',
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
          // Send to all players, all admins, all coaches, or all physios
          if (composeData.recipient === 'all_players') {
            recipientRole = 'player'
          } else if (composeData.recipient === 'all_admins') {
            recipientRole = 'admin' // This will be handled by API route to get all admin types
          } else if (composeData.recipient === 'all_coaches') {
            recipientRole = 'coach'
          } else if (composeData.recipient === 'all_physios') {
            recipientRole = 'physio'
          }
        } else {
          // Send to individual player, admin, coach, physio, or team manager
          recipientId = composeData.recipientId
        }

        // If sending to a role, use API route to bypass RLS
        if (recipientRole) {
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
                recipient_id: recipient.user_id,
                subject: composeData.subject,
                message: composeData.message,
              })
              .select('id, recipient_id')
              .single()
          )

          const messageResults = await Promise.all(messagePromises)
            
            // Create notifications for recipients with message references
            try {
              const { db } = await import('@/lib/db-helpers')
              // Create individual notifications with message IDs
              const notificationPromises = messageResults.map((result: any) => {
                if (result.data && result.data.id) {
                  return db.createNotification({
                    user_id: result.data.recipient_id,
                    title: 'New Message',
                    message: `${user.name} sent you a message: ${composeData.subject || 'No subject'}`,
                    type: 'info',
                    action_url: '/messages',
                    reference_id: result.data.id,
                    reference_type: 'message',
                  })
                }
                return Promise.resolve(null)
              })
              
              await Promise.all(notificationPromises)
              console.log(`Notifications created for ${recipients.length} recipient(s)`)
            } catch (notifError) {
              console.error('Error creating notifications:', notifError)
              // Don't fail the message send if notification creation fails
            }
            
              const roleName = recipientRole === 'player' ? 'players' : recipientRole === 'physio' ? 'physiotherapists' : 'administrators'
              alert(`Message sent successfully to ${recipients.length} ${roleName}!`)
              setComposeData({ recipientType: 'role', recipient: '', recipientId: '', selectedRoles: [], subject: '', message: '' })
              setShowCompose(false)
              // Reload messages
              const response = await fetch('/api/messages', { cache: 'no-store' })
              if (response.ok) {
                const data = await response.json()
                setMessages(data.messages || [])
              }
              return
        } else {
              const roleName = recipientRole === 'player' ? 'players' : recipientRole === 'physio' ? 'physiotherapists' : 'administrators'
              alert(`No ${roleName} found`)
              return
            }
          } catch (fetchError: any) {
            console.error('Error fetching recipients:', fetchError)
            alert(`Error fetching recipients: ${fetchError.message || 'Unknown error'}`)
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

          // Create notification for recipient with message reference
          if (recipientId && newMessage) {
            const { db } = await import('@/lib/db-helpers')
            try {
              await db.createNotification({
                user_id: recipientId,
                title: 'New Message',
                message: `${user.name} sent you a message: ${composeData.subject || 'No subject'}`,
                type: 'info',
                action_url: '/messages',
                reference_id: newMessage.id,
                reference_type: 'message',
              })
              console.log('Notification created for recipient:', recipientId, 'with message ID:', newMessage.id)
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
          setComposeData({ recipientType: 'role', recipient: '', recipientId: '', selectedRoles: [], subject: '', message: '' })
          setShowCompose(false)
          alert('Message sent successfully!')
          
          // Reload messages to ensure sync
          try {
            const response = await fetch('/api/messages', { cache: 'no-store' })
            if (response.ok) {
              const data = await response.json()
              setMessages(data.messages || [])
            }
          } catch (reloadError) {
            console.error('Error reloading messages:', reloadError)
          }
        }
      } else if (user?.role === 'finance_admin') {
        // Finance admin can only send to general admin
        if (!composeData.recipientId) {
          alert('Please select a general admin recipient')
          return
        }

        // Verify the recipient is in the already-loaded admins list (only general admins)
        const isValidAdmin = admins.some(a => a.user_id === composeData.recipientId && a.role === 'admin')
        
        if (!isValidAdmin) {
          alert('You can only send messages to general administrators. Please select a general admin from the dropdown.')
          return
        }

        // Get recipient info from the list
        const recipientAdmin = admins.find(a => a.user_id === composeData.recipientId)
        const recipientRole = recipientAdmin?.role || 'admin'

        const { data: newMessage, error } = await supabase
          .from('messages')
          .insert({
            sender_id: authUser.id,
            recipient_id: composeData.recipientId,
            recipient_role: recipientRole,
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
        if (composeData.recipientId && newMessage) {
          const { db } = await import('@/lib/db-helpers')
          try {
            await db.createNotification({
              user_id: composeData.recipientId,
              title: 'New Message',
              message: `${user.name} sent you a message: ${composeData.subject || 'No subject'}`,
              type: 'info',
              action_url: '/messages',
              reference_id: newMessage.id,
              reference_type: 'message',
            })
            console.log('Notification created for recipient:', composeData.recipientId)
          } catch (notifError) {
            console.error('Error creating notification:', notifError)
            // Don't fail the message send if notification creation fails
          }
        }

        // Get recipient info from the already-loaded list
        const recipientName = recipientAdmin?.name || 'Unknown'
        
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
        setComposeData({ recipientType: 'role', recipient: '', recipientId: '', selectedRoles: [], subject: '', message: '' })
        setShowCompose(false)
        alert('Message sent successfully!')
        
        // Reload messages to ensure sync
        try {
          const response = await fetch('/api/messages', { cache: 'no-store' })
          if (response.ok) {
            const data = await response.json()
            setMessages(data.messages || [])
          }
        } catch (reloadError) {
          console.error('Error reloading messages:', reloadError)
        }
      } else if (user?.role === 'player') {
        // Players can ONLY send to team managers (data_admin)
        if (!composeData.recipientId) {
          alert('Please select a team manager to send your message')
          return
        }

        // Verify the recipient is in the teamManagers list (already loaded from API)
        // This is safe because the dropdown only shows valid team managers
        const isValidTeamManager = teamManagers.some(tm => tm.user_id === composeData.recipientId)
        
        if (!isValidTeamManager) {
          console.error('Invalid recipient selected:', composeData.recipientId)
          console.log('Available team managers:', teamManagers.map(tm => ({ id: tm.user_id, name: tm.name })))
          alert('Invalid recipient selected. Please select a team manager from the dropdown.')
          return
        }

        // Send message to the team manager
        const { data: newMessage, error } = await supabase
          .from('messages')
          .insert({
            sender_id: authUser.id,
            recipient_id: composeData.recipientId,
            recipient_role: 'data_admin',
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
            action_url: '/messages',
            reference_id: newMessage.id,
            reference_type: 'message',
          })
          console.log('Notification created for team manager:', composeData.recipientId)
        } catch (notifError) {
          console.error('Error creating notification:', notifError)
        }

        // Get recipient info for the sent message
        let recipientName = 'Unknown'
        if (composeData.recipientId) {
          const { data: recipientProfile } = await supabase
            .from('user_profiles')
            .select('name, role')
            .eq('user_id', composeData.recipientId)
            .single()
          
          if (recipientProfile) {
            recipientName = recipientProfile.name
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
          recipient_role: 'data_admin',
          subject: newMessage.subject || '',
          message: newMessage.message,
          read: false,
          created_at: newMessage.created_at,
          is_sent: true,
        }

        setMessages([formattedMessage, ...messages])
        setComposeData({ recipientType: 'role', recipient: '', recipientId: '', selectedRoles: [], subject: '', message: '' })
        setShowCompose(false)
        alert('Message sent successfully to team manager!')
        
        // Reload messages to ensure sync
        try {
          const response = await fetch('/api/messages', { cache: 'no-store' })
          if (response.ok) {
            const data = await response.json()
            setMessages(data.messages || [])
          }
        } catch (reloadError) {
          console.error('Error reloading messages:', reloadError)
        }
        return
      } else if (user?.role === 'physio') {
        // Physio can only send to individual recipients (injured players, admins, coaches)
        // Cannot send to "all players" or role groups
        if (!composeData.recipientId) {
          alert('Please select a recipient. You can only message players with recorded injuries, administrators, or coaches.')
          return
        }

        // Verify the recipient is in the already-loaded lists (avoids RLS issues)
        const isValidPlayer = players.some(p => p.user_id === composeData.recipientId)
        const isValidAdmin = admins.some(a => a.user_id === composeData.recipientId)
        const isValidCoach = coaches.some(c => c.user_id === composeData.recipientId)

        if (!isValidPlayer && !isValidAdmin && !isValidCoach) {
          alert('Invalid recipient selected. Please select a player with injuries, administrator, or coach from the dropdown.')
          return
        }

        // Determine recipient role and name from the already-loaded lists
        let recipientRole = 'unknown'
        let recipientName = 'Unknown'
        
        if (isValidPlayer) {
          const player = players.find(p => p.user_id === composeData.recipientId)
          recipientRole = 'player'
          recipientName = player?.name || 'Unknown'
        } else if (isValidAdmin) {
          const admin = admins.find(a => a.user_id === composeData.recipientId)
          recipientRole = admin?.role || 'admin'
          recipientName = admin?.name || 'Unknown'
        } else if (isValidCoach) {
          const coach = coaches.find(c => c.user_id === composeData.recipientId)
          recipientRole = 'coach'
          recipientName = coach?.name || 'Unknown'
        }

        // Send message to the recipient
        const { data: newMessage, error } = await supabase
          .from('messages')
          .insert({
            sender_id: authUser.id,
            recipient_id: composeData.recipientId,
            recipient_role: recipientRole,
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
            action_url: '/messages',
            reference_id: newMessage.id,
            reference_type: 'message',
          })
          console.log('Notification created for recipient:', composeData.recipientId)
        } catch (notifError) {
          console.error('Error creating notification:', notifError)
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
        setComposeData({ recipientType: 'individual', recipient: '', recipientId: '', selectedRoles: [], subject: '', message: '' })
        setShowCompose(false)
        alert('Message sent successfully!')
        
        // Reload messages to ensure sync
        try {
          const response = await fetch('/api/messages', { cache: 'no-store' })
          if (response.ok) {
            const data = await response.json()
            setMessages(data.messages || [])
          }
        } catch (reloadError) {
          console.error('Error reloading messages:', reloadError)
        }
        return
      } else {
        // For other roles (not admin, coach, finance_admin, player, or physio)
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
              // Send message to each recipient and capture message IDs
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
                  .select('id, recipient_id')
                  .single()
              )

              const messageResults = await Promise.all(messagePromises)
              
              // Create notifications for recipients with message references
              try {
                const { db } = await import('@/lib/db-helpers')
                // Create individual notifications with message IDs
                const notificationPromises = messageResults.map((result: any) => {
                  if (result.data && result.data.id) {
                    return db.createNotification({
                      user_id: result.data.recipient_id,
                      title: 'New Message',
                      message: `${user.name} sent you a message: ${composeData.subject || 'No subject'}`,
                      type: 'info',
                      action_url: '/messages',
                      reference_id: result.data.id,
                      reference_type: 'message',
                    })
                  }
                  return Promise.resolve(null)
                })
                
                await Promise.all(notificationPromises)
                console.log(`Notifications created successfully for ${messageResults.length} messages`)
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
            const notificationResult = await db.createNotification({
              user_id: recipientId,
              title: 'New Message',
              message: `${user.name} sent you a message: ${composeData.subject || 'No subject'}`,
              type: 'info',
              action_url: '/messages',
            })
            console.log('Notification created for recipient:', recipientId, notificationResult)
          } catch (notifError) {
            console.error('Error creating notification:', notifError)
            console.error('Notification error details:', JSON.stringify(notifError, null, 2))
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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-extrabold text-club-gradient mb-2">Messages</h1>
            <p className="text-lg text-neutral-medium font-medium">
              {user?.role === 'admin'
                ? 'Send messages to all team members and staff'
                : user?.role === 'coach' 
                ? 'Communicate with players and administrators'
                : user?.role === 'physio'
                ? 'Communicate with injured players, administrators, and coaches'
                : 'Communicate with coaches and administrators'}
            </p>
          </div>
          <RefreshButton onRefresh={loadData} />
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
                      <option value="role">Send to Role Group</option>
                      <option value="individual">Send to Individual</option>
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
                        <option value="all_coaches">All Coaches</option>
                        <option value="all_physios">All Physiotherapists</option>
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
                        {players.length > 0 && (
                        <optgroup label="Players">
                          {players.map((player) => (
                            <option key={player.user_id} value={player.user_id}>
                              {player.name} (Player)
                            </option>
                          ))}
                        </optgroup>
                        )}
                        {admins.length > 0 && (
                        <optgroup label="Administrators">
                          {admins.map((admin) => (
                            <option key={admin.user_id} value={admin.user_id}>
                              {admin.name} ({admin.role.replace('_', ' ')})
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
                        {coaches.length > 0 && (
                          <optgroup label="Coaches">
                            {coaches.map((coach) => (
                              <option key={coach.user_id} value={coach.user_id}>
                                {coach.name} (Coach)
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
                      </select>
                    </div>
                  )}
                </>
              ) : user?.role === 'physio' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-2">
                      Select Recipient
                    </label>
                    <p className="text-xs text-neutral-medium mb-2">
                      You can only message players with recorded injuries, administrators, and coaches
                    </p>
                    <select
                      value={composeData.recipientId}
                      onChange={(e) => setComposeData({ ...composeData, recipientId: e.target.value, recipientType: 'individual', recipient: '' })}
                      className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    >
                      <option value="">Select recipient...</option>
                      {players.length > 0 && (
                        <optgroup label="Players with Injuries">
                          {players.map((player) => (
                            <option key={player.user_id} value={player.user_id}>
                              {player.name} (Player)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {players.length === 0 && (
                        <option value="" disabled>No players with injuries found</option>
                      )}
                      {admins.length > 0 && (
                        <optgroup label="Administrators">
                          {admins.map((admin) => (
                            <option key={admin.user_id} value={admin.user_id}>
                              {admin.name} ({admin.role.replace('_', ' ')})
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
                    </select>
                    {players.length > 0 && (
                      <p className="text-xs text-neutral-medium mt-1">
                        Only players with recorded injuries are shown
                      </p>
                    )}
                  </div>
                </>
              ) : user?.role === 'data_admin' ? (
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
                      <option value="role">Send to Role Group</option>
                      <option value="individual">Send to Individual</option>
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
                        <option value="all_coaches">All Coaches</option>
                        <option value="all_physios">All Physiotherapists</option>
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
                        {admins.length > 0 && (
                          <optgroup label="Administrators">
                            {admins.map((admin) => (
                              <option key={admin.user_id} value={admin.user_id}>
                                {admin.name} ({admin.role === 'admin' ? 'Admin' : admin.role === 'data_admin' ? 'Team Manager' : 'Finance Admin'})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  )}
                </>
              ) : user?.role === 'finance_admin' ? (
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">
                    To (General Admin)
                  </label>
                  <select
                    value={composeData.recipientId}
                    onChange={(e) => setComposeData({ ...composeData, recipientId: e.target.value, recipient: '' })}
                    className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="">Select general admin...</option>
                    {admins.length > 0 && (
                      <optgroup label="General Administrators">
                        {admins.map((admin) => (
                          <option key={admin.user_id} value={admin.user_id}>
                            {admin.name} (Admin)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              ) : user?.role === 'player' ? (
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">
                    To (Team Manager Only)
                  </label>
                  <select
                    value={composeData.recipientId}
                    onChange={(e) => setComposeData({ ...composeData, recipientId: e.target.value, recipient: '', recipientType: 'individual' })}
                    className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="">Select team manager...</option>
                    {teamManagers.length > 0 ? (
                      teamManagers.map((manager) => (
                        <option key={manager.user_id} value={manager.user_id}>
                          {manager.name} (Team Manager)
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>No team managers available</option>
                    )}
                  </select>
                  <p className="text-xs text-neutral-medium mt-1">Players can only send messages to team managers</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">
                    Select Recipient
                  </label>
                  <select
                    value={composeData.recipientId}
                    onChange={(e) => setComposeData({ ...composeData, recipientId: e.target.value, recipient: '' })}
                    className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="">Select recipient...</option>
                    {teamManagers.length > 0 && (
                      <optgroup label="Team Managers">
                        {teamManagers.map((manager) => (
                          <option key={manager.user_id} value={manager.user_id}>
                            {manager.name} (Team Manager)
                          </option>
                        ))}
                      </optgroup>
                    )}
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
                  className={`p-6 cursor-pointer hover:bg-neutral-light transition-all duration-200 relative ${
                    !message.is_sent && !message.read ? 'bg-blue-50/50 border-l-4 border-primary' : message.is_sent ? 'bg-green-50/30' : ''
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteMessage(message.id, e)
                    }}
                    className="absolute top-4 right-4 p-2 text-neutral-medium hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors z-10"
                    title="Delete message"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div
                    onClick={async () => {
                      setSelectedMessage(message)
                      // Mark message as read when clicked
                      if (!message.read) {
                        await markMessageAsRead(message.id)
                      }
                      // Also mark related notification as read
                      try {
                        await fetch('/api/notifications/mark-read', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            reference_id: message.id,
                            reference_type: 'message',
                            action_url: '/messages',
                          }),
                        })
                      } catch (error) {
                        console.error('Error marking notification as read:', error)
                      }
                    }}
                    className="flex items-start justify-between"
                  >
                    <div className="flex-1 pr-12">
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
