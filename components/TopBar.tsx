'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, MessageSquare, X, CheckCheck, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/useNotifications'
import { formatDistanceToNow } from 'date-fns'

interface TopBarProps {
  title: string
  userName: string
  userRole: string
  userAvatar?: string
}

export default function TopBar({ title, userName, userRole, userAvatar }: TopBarProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { notifications, unreadCount, markAsRead, markAllAsRead, refreshNotifications, deleteNotification, clearAllNotifications } = useNotifications()
  const router = useRouter()
  
  // Refresh notifications when dropdown opens to ensure latest state
  useEffect(() => {
    if (notificationsOpen) {
      refreshNotifications()
    }
  }, [notificationsOpen, refreshNotifications])

  const getNotificationLink = (notification: any): string | null => {
    // First, check if notification has an action_url (preferred method)
    if (notification.action_url) {
      return notification.action_url
    }
    
    // Fallback: Determine link based on notification title/message content
    const title = notification.title?.toLowerCase() || ''
    const message = notification.message?.toLowerCase() || ''
    
    // Budget-related notifications
    if (title.includes('budget') || message.includes('budget')) {
      return '/finance'
    }
    
    // Message notifications
    if (title.includes('message') || message.includes('message') || message.includes('sent you')) {
      return '/messages'
    }
    
    // Fixture/team selection notifications
    if (title.includes('fixture') || title.includes('team selection') || message.includes('selected') || message.includes('fixture')) {
      return '/fixtures'
    }
    
    // Training schedule notifications
    if (title.includes('training') || message.includes('training schedule')) {
      return '/training'
    }
    
    // Injury notifications
    if (title.includes('injury') || message.includes('injury')) {
      return '/dashboard/physio'
    }
    
    // Report notifications
    if (title.includes('report') || message.includes('report')) {
      return '/reports'
    }
    
    // Player-related notifications
    if (title.includes('player') || message.includes('player')) {
      return '/players'
    }
    
    // Default: no link
    return null
  }

  const handleNotificationClick = (notification: any) => {
    // Auto-dismiss on click — delete from DB and remove from list
    deleteNotification(notification.id)

    const link = getNotificationLink(notification)
    if (link) {
      setNotificationsOpen(false)
      router.push(link)
    }
  }

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  // `sticky top-0` keeps the header pinned while the DOCUMENT scrolls
  // underneath it — deliberately NOT an inner scroll container (see the long
  // note in Layout.tsx), because that approach broke mobile scrolling.
  // z-20 sits above in-page sticky table headers (z-10) but below the sidebar
  // (z-30), mobile drawer (z-40/50) and modals (z-50). The background must
  // stay opaque so content doesn't bleed through as it scrolls beneath.
  return (
    <header className="sticky top-0 z-20 min-h-[60px] flex items-center pl-16 pr-4 sm:pr-6 lg:pl-6 py-2 gap-3 sm:gap-4 flex-shrink-0" style={{ background: 'var(--tm-surface)', borderBottom: '1px solid var(--tm-border)' }}>
      {/* Greeting */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[14px] sm:text-[15px] font-medium mb-[1px] leading-tight line-clamp-2" style={{ color: 'var(--tm-text-1)' }}>{getGreeting()}, {userName} 👋</h1>
        <p className="text-[11px] sm:text-[12px] leading-tight truncate" style={{ color: 'var(--tm-text-3)' }}>
          {formatDate()}<span className="hidden sm:inline"> · Season 2026</span>
        </p>
      </div>

      {/* Search bar */}
      <div className="hidden md:flex items-center gap-2 rounded-[6px] px-3 py-2 w-[200px] transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 group" style={{ background: 'var(--tm-input-bg)', border: '1px solid var(--tm-input-border)' }}>
        <Search className="w-[15px] h-[15px] transition-colors group-focus-within:text-primary" style={{ color: 'var(--tm-text-3)' }} />
        <input
          type="text"
          placeholder="Search players, sessions…"
          className="border-none bg-transparent outline-none text-[13px] w-full placeholder:text-[var(--tm-text-3)]"
          style={{ color: 'var(--tm-text-1)' }}
        />
      </div>

      {/* Icon buttons */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center cursor-pointer text-[17px] transition-all duration-200 hover:border-primary hover:text-primary hover:bg-primary-subtle hover:scale-105"
            style={{ border: '1px solid var(--tm-border)', color: 'var(--tm-text-2)' }}
            aria-label="Notifications"
          >
            <Bell className="w-[17px] h-[17px]" />
            {unreadCount > 0 && (
              <span className="absolute top-[7px] right-[8px] w-[7px] h-[7px] rounded-full bg-secondary border-[1.5px]" style={{ borderColor: 'var(--tm-surface)' }} />
            )}
          </button>

              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  {/* On mobile this is anchored to the viewport (fixed, inset
                      left/right) rather than to the bell button — the button
                      sits ~100px in from the right edge because of the
                      messages icon and avatar, so a button-anchored dropdown
                      wide enough to be readable would spill off the left of
                      the screen. From sm: up there's room to anchor it to the
                      button as a normal dropdown. */}
                  <div className="fixed left-3 right-3 top-[68px] w-auto max-h-[70vh] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-h-96 bg-tm-surface rounded-card shadow-large border border-tm-border z-20 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-tm-border flex items-center justify-between flex-shrink-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-tm-text-1">Notifications</h3>
                        {notifications.filter(n => !n.read).length > 0 && (
                          <span className="bg-primary text-tm-on-secondary text-xs font-bold rounded-full px-2 py-0.5">
                            {notifications.filter(n => !n.read).length}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {notifications.filter(n => !n.read).length > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="p-1 hover:bg-tm-surface-hover rounded text-xs text-primary"
                            title="Mark all as read"
                          >
                            <CheckCheck className="w-4 h-4" />
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button
                            onClick={clearAllNotifications}
                            className="p-1 hover:bg-tm-surface-hover rounded text-xs text-[#E05757]"
                            title="Clear all notifications"
                          >
                            <span className="text-[10px] font-semibold">Clear all</span>
                          </button>
                        )}
                        <button
                          onClick={() => setNotificationsOpen(false)}
                          className="p-1 hover:bg-tm-surface-hover rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-tm-border flex-1 min-h-0 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell className="w-12 h-12 text-tm-text-3 mx-auto mb-2 opacity-50" />
                          <p className="text-sm text-tm-text-3">No notifications</p>
                        </div>
                      ) : (
                        notifications
                          .filter((notification) =>
                            notification &&
                            typeof notification === 'object' &&
                            notification.id
                          )
                          .map((notification) => {
                            // Ensure notification has required fields
                            const title = notification.title || 'Notification'
                            const message = notification.message || ''
                            const created_at = notification.created_at || new Date().toISOString()
                            const type = notification.type || 'info'
                            const read = notification.read || false
                            
                            return (
                        <div
                          key={notification.id}
                          className={cn(
                            'group relative p-4 hover:bg-tm-surface-hover transition-colors cursor-pointer',
                            !read && 'bg-tm-surface-hover'
                          )}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-start space-x-3">
                            <div
                              className={cn(
                                'w-2 h-2 rounded-full mt-2 flex-shrink-0',
                                type === 'info' && 'bg-primary',
                                type === 'success' && 'bg-success',
                                type === 'warning' && 'bg-warning',
                                type === 'error' && 'bg-secondary'
                              )}
                            />
                            <div className="flex-1 min-w-0 pr-6">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-semibold text-tm-text-1">{title}</p>
                                {getNotificationLink(notification) && (
                                  <span className="text-xs text-primary font-medium">→ view</span>
                                )}
                              </div>
                              <p className="text-sm text-tm-text-1">{message}</p>
                              <p className="text-xs text-tm-text-3 mt-1">
                                {formatDistanceToNow(new Date(created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          {/* Per-notification delete button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id) }}
                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-[#E05757]/10 text-tm-text-3 hover:text-[#E05757]"
                            title="Dismiss notification"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                            )
                          })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

        {/* Messages */}
        <button
          onClick={() => router.push('/messages')}
          className="w-[34px] h-[34px] rounded-[6px] flex items-center justify-center cursor-pointer text-[17px] transition-all duration-200 hover:border-primary hover:text-primary hover:bg-primary-subtle hover:scale-105"
          style={{ border: '1px solid var(--tm-border)', color: 'var(--tm-text-2)' }}
          aria-label="Messages"
          title="Messages"
        >
          <MessageSquare className="w-[17px] h-[17px]" />
        </button>

        {/* Divider */}
        <div className="w-[0.5px] h-[20px] mx-1" style={{ background: 'var(--tm-divider)' }} />

        {/* User — links to profile */}
        <button
          onClick={() => router.push('/profile')}
          className="flex items-center gap-2 rounded-[8px] px-1 py-1 cursor-pointer transition-colors hover:bg-tm-surface-hover"
          aria-label="View your profile"
          title="View your profile"
        >
          <div className="text-right hidden sm:block">
            <p className="text-[12px] font-medium" style={{ color: 'var(--tm-text-1)' }}>{userName}</p>
            <p className="text-[11px] capitalize" style={{ color: 'var(--tm-text-3)' }}>{userRole.replace('_', ' ')}</p>
          </div>
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName}
              className="w-[34px] h-[34px] rounded-full flex-shrink-0 transition-transform duration-200 hover:scale-110 object-cover"
            />
          ) : (
            <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[12px] font-medium flex-shrink-0 transition-all duration-200 hover:scale-110" style={{ background: 'var(--tm-primary, #1A3A5C)', color: 'var(--tm-text-on-primary, #ffffff)' }}>
              {getInitials(userName)}
            </div>
          )}
        </button>
      </div>
    </header>
  )
}

