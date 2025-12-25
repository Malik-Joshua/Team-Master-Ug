'use client'

import { useState, useEffect } from 'react'
import { Bell, MessageSquare, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  title: string
  message: string
  created_at: string
  read: boolean
  type: 'info' | 'success' | 'warning' | 'error'
}

interface TopBarProps {
  title: string
  userName: string
  userRole: string
  userAvatar?: string
}

export default function TopBar({ title, userName, userRole, userAvatar }: TopBarProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadNotifications = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      // Fetch notifications
      const { data: notificationsData, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error fetching notifications:', error)
        setLoading(false)
        return
      }

      if (notificationsData) {
        setNotifications(notificationsData as Notification[])
      }

      setLoading(false)

      // Set up real-time subscription for new notifications
      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification
            setNotifications((prev) => [newNotification, ...prev])
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
            const updatedNotification = payload.new as Notification
            setNotifications((prev) =>
              prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
            )
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }

    loadNotifications()
  }, [])

  const handleMarkAsRead = async (notificationId: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)

    if (error) {
      console.error('Error marking notification as read:', error)
    } else {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      )
    }
  }

  const handleMarkAllAsRead = async () => {
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
    } else {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    }
  }

  const formatTimestamp = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return 'Recently'
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-neutral-light shadow-sm">
      <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Title */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-neutral-text">{title}</h1>
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 text-neutral-dark hover:text-primary hover:bg-neutral-light rounded-lg transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                )}
                {unreadCount > 0 && unreadCount <= 9 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
                {unreadCount > 9 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    9+
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-card shadow-large border border-neutral-light z-20 max-h-96 overflow-y-auto">
                    <div className="p-4 border-b border-neutral-light flex items-center justify-between">
                      <div className="flex items-center justify-between w-full">
                        <h3 className="font-bold text-neutral-text">Notifications</h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllAsRead}
                            className="text-xs text-primary hover:underline"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setNotificationsOpen(false)}
                        className="p-1 hover:bg-neutral-light rounded ml-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="divide-y divide-neutral-light max-h-96 overflow-y-auto">
                      {loading ? (
                        <div className="p-8 text-center text-neutral-medium">
                          Loading notifications...
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="p-8 text-center text-neutral-medium">
                          No notifications
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                            className={cn(
                              'p-4 hover:bg-neutral-light transition-colors cursor-pointer',
                              !notification.read && 'bg-blue-50/50'
                            )}
                          >
                            <div className="flex items-start space-x-3">
                              <div
                                className={cn(
                                  'w-2 h-2 rounded-full mt-2 flex-shrink-0',
                                  notification.type === 'info' && 'bg-primary',
                                  notification.type === 'success' && 'bg-success',
                                  notification.type === 'warning' && 'bg-warning',
                                  notification.type === 'error' && 'bg-secondary'
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-neutral-text">
                                  {notification.title}
                                </p>
                                <p className="text-sm text-neutral-text mt-1">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-neutral-medium mt-1">
                                  {formatTimestamp(notification.created_at)}
                                </p>
                              </div>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Chat Icon */}
            <button
              className="p-2 text-neutral-dark hover:text-primary hover:bg-neutral-light rounded-lg transition-colors"
              aria-label="Chat"
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            {/* Profile Avatar */}
            <div className="flex items-center space-x-3">
              {userAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userAvatar}
                  alt={userName}
                  className="w-10 h-10 rounded-full border-2 border-primary"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-club-gradient flex items-center justify-center text-white font-bold">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden md:block text-right">
                <p className="text-sm font-semibold text-neutral-text">{userName}</p>
                <p className="text-xs text-neutral-medium capitalize">
                  {userRole.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

