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
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let channel: any = null

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
            setNotifications(result.notifications || [])
            setUnreadCount((result.notifications || []).filter((n: Notification) => !n.read).length)
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
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              console.log('New notification received via real-time:', payload.new)
              const newNotification = payload.new as Notification
              setNotifications((prev) => {
                // Check if notification already exists to avoid duplicates
                const exists = prev.some(n => n.id === newNotification.id)
                if (exists) return prev
                return [newNotification, ...prev]
              })
              setUnreadCount((prev) => prev + 1)
              
              // Show browser notification if permission granted
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(newNotification.title, {
                  body: newNotification.message,
                  icon: '/favicon.ico',
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
      if (channel) {
        const supabase = createClient()
        supabase.removeChannel(channel)
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

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
  }
}
