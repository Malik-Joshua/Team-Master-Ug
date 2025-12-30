import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  created_at: string
  action_url?: string | null // URL to navigate to when notification is clicked
  reference_id?: string | null // ID of the related item (e.g., message ID, task ID)
  reference_type?: string | null // Type of the related item (e.g., 'message', 'task', 'fixture')
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)

  useEffect(() => {
    let channel: any = null
    let messagesChannel: any = null

    const loadNotifications = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setLoading(false)
          return
        }

        // Fetch initial notifications via API route to bypass RLS
        try {
          const response = await fetch('/api/notifications', {
            cache: 'no-store',
          })
          
          if (response.ok) {
            const result = await response.json()
            console.log(`Loaded ${result.count || 0} notifications for user ${user.id} via API`)
            console.log('Notifications data:', JSON.stringify(result.notifications, null, 2))
            // Ensure action_url and reference fields are included in notifications
            const notificationsWithActionUrl = (result.notifications || []).map((n: any) => ({
              ...n,
              action_url: n.action_url || null,
              reference_id: n.reference_id || null,
              reference_type: n.reference_type || null,
            }))
            console.log(`Processed ${notificationsWithActionUrl.length} notifications with action_url`)
            setNotifications(notificationsWithActionUrl)
            const unreadNotifs = notificationsWithActionUrl.filter((n: Notification) => !n.read).length
            setUnreadCount(unreadNotifs)
            console.log(`Found ${unreadNotifs} unread notifications`)
            
            // Also fetch unread messages count
            try {
              const { count: unreadMessagesCount, error: messagesError } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('recipient_id', user.id)
                .eq('read', false)
              
              if (messagesError) {
                console.error('Error fetching unread messages count:', messagesError)
                setUnreadMessagesCount(0)
              } else {
                setUnreadMessagesCount(unreadMessagesCount || 0)
                console.log(`Found ${unreadMessagesCount || 0} unread messages for user ${user.id}`)
              }
            } catch (messagesError) {
              console.error('Exception fetching unread messages count:', messagesError)
              setUnreadMessagesCount(0)
            }
          } else {
            console.error('Error fetching notifications from API:', response.status)
            // Fallback to direct query
            const { data, error } = await supabase
              .from('notifications')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(50)

            if (error) {
              console.error('Error fetching notifications (fallback):', error)
            } else {
              console.log(`Loaded ${data?.length || 0} notifications for user ${user.id} (fallback)`)
              setNotifications(data || [])
              setUnreadCount((data || []).filter((n) => !n.read).length)
            }
          }
        } catch (fetchError) {
          console.error('Error fetching notifications:', fetchError)
          // Fallback to direct query
          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50)

          if (error) {
            console.error('Error fetching notifications (fallback):', error)
          } else {
            console.log(`Loaded ${data?.length || 0} notifications for user ${user.id} (fallback)`)
            setNotifications(data || [])
            setUnreadCount((data || []).filter((n) => !n.read).length)
          }
        }

        // Set up real-time subscription for new notifications
        channel = supabase
          .channel(`notifications-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              // Handle INSERT events
              if (payload.eventType === 'INSERT') {
                console.log('[useNotifications] New notification received via real-time:', payload.new)
                const newNotification = payload.new as Notification
                // Ensure action_url and reference fields are included
                const notificationWithActionUrl = {
                  ...newNotification,
                  action_url: (payload.new as any).action_url || null,
                  reference_id: (payload.new as any).reference_id || null,
                  reference_type: (payload.new as any).reference_type || null,
                }
                setNotifications((prev) => {
                  // Check if notification already exists to avoid duplicates
                  const exists = prev.some(n => n.id === notificationWithActionUrl.id)
                  if (exists) {
                    console.log('[useNotifications] Notification already exists, skipping duplicate')
                    return prev
                  }
                  console.log('[useNotifications] Adding new notification to list')
                  return [notificationWithActionUrl, ...prev]
                })
                setUnreadCount((prev) => {
                  const newCount = prev + 1
                  console.log(`[useNotifications] Updated unread count: ${prev} -> ${newCount}`)
                  return newCount
                })
                
                // Show browser notification if permission granted
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification(notificationWithActionUrl.title, {
                    body: notificationWithActionUrl.message,
                    icon: '/favicon.ico',
                  })
                }
              }
              // Handle UPDATE events (when notification is marked as read)
              else if (payload.eventType === 'UPDATE') {
                console.log('[useNotifications] Notification updated via real-time:', payload.new)
                const updatedNotification = payload.new as Notification
                setNotifications((prev) =>
                  prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
                )
                setUnreadCount((prev) => {
                  if (updatedNotification.read && !(payload.old as any)?.read) {
                    return Math.max(0, prev - 1)
                  } else if (!updatedNotification.read && (payload.old as any)?.read) {
                    return prev + 1
                  }
                  return prev
                })
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              console.log('Notification updated via real-time:', payload.new)
              const updatedNotification = payload.new as Notification
              setNotifications((prev) =>
                prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
              )
              setUnreadCount((prev) => {
                if (updatedNotification.read && !payload.old.read) {
                  return Math.max(0, prev - 1)
                } else if (!updatedNotification.read && payload.old.read) {
                  return prev + 1
                }
                return prev
              })
            }
          )
          .subscribe((status) => {
            console.log('Notification subscription status:', status)
          })

        // Set up real-time subscription for messages to update unread count
        messagesChannel = supabase
          .channel(`messages-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'messages',
              filter: `recipient_id=eq.${user.id}`,
            },
            (payload) => {
              console.log('Message updated via real-time:', payload.new)
              const updatedMessage = payload.new as any
              // If message was marked as read, decrease unread count
              if (updatedMessage.read && !payload.old.read) {
                setUnreadMessagesCount((prev) => Math.max(0, prev - 1))
              } else if (!updatedMessage.read && payload.old.read) {
                setUnreadMessagesCount((prev) => prev + 1)
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `recipient_id=eq.${user.id}`,
            },
            (payload) => {
              console.log('New message received via real-time:', payload.new)
              const newMessage = payload.new as any
              if (!newMessage.read) {
                setUnreadMessagesCount((prev) => prev + 1)
              }
            }
          )
          .subscribe((status) => {
            console.log('Messages subscription status:', status)
          })

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission()
        }
      } catch (error) {
        console.error('Error loading notifications:', error)
      } finally {
        setLoading(false)
      }
    }

    loadNotifications()

    return () => {
      const supabase = createClient()
      if (channel) {
        supabase.removeChannel(channel)
      }
      if (messagesChannel) {
        supabase.removeChannel(messagesChannel)
      }
    }
  }, [])

  const markAsRead = async (notificationId: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      if (error) {
        console.error('Error marking notification as read:', error)
      } else {
        // Update local state immediately
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)

      if (error) {
        console.error('Error marking all notifications as read:', error)
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const markNotificationByReference = async (referenceId: string, referenceType: string, actionUrl?: string) => {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference_id: referenceId,
          reference_type: referenceType,
          action_url: actionUrl,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        // Refresh notifications to update UI
        await refreshNotifications()
        return result
      } else {
        const errorData = await response.json()
        console.error('Error marking notification by reference:', errorData)
        return null
      }
    } catch (error) {
      console.error('Error marking notification by reference:', error)
      return null
    }
  }

  const refreshNotifications = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return
      
      setLoading(true)
      const response = await fetch('/api/notifications', {
        cache: 'no-store',
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log(`[refreshNotifications] Loaded ${result.count || 0} notifications for user ${user.id}`)
        const notificationsWithActionUrl = (result.notifications || []).map((n: any) => ({
          ...n,
          action_url: n.action_url || null,
          reference_id: n.reference_id || null,
          reference_type: n.reference_type || null,
        }))
        setNotifications(notificationsWithActionUrl)
        const unreadNotifs = notificationsWithActionUrl.filter((n: Notification) => !n.read).length
        setUnreadCount(unreadNotifs)
      }
    } catch (error) {
      console.error('[refreshNotifications] Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return {
    notifications,
    loading,
    unreadCount: unreadCount + unreadMessagesCount, // Include unread messages in count
    markAsRead,
    markAllAsRead,
    markNotificationByReference,
    refreshNotifications,
  }
}
