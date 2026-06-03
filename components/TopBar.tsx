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
  const { notifications, unreadCount, markAsRead, markAllAsRead, refreshNotifications } = useNotifications()
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
    console.log('Notification clicked:', notification)
    
    if (!notification.read) {
      markAsRead(notification.id)
    }
    
    // Navigate to relevant page based on notification action_url or content
    const link = getNotificationLink(notification)
    console.log('Notification link:', link, 'action_url:', notification.action_url)
    
    if (link) {
      setNotificationsOpen(false)
      router.push(link)
    } else {
      console.log('No link found for notification')
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

  return (
    <header className="h-[60px] flex items-center pl-16 pr-4 sm:px-6 gap-3 sm:gap-4 flex-shrink-0" style={{ background: 'var(--tm-surface)', borderBottom: '1px solid var(--tm-border)' }}>
      {/* Greeting */}
      <div className="flex-1">
        <h1 className="text-[15px] font-medium mb-[1px]" style={{ color: 'var(--tm-text-1)' }}>{getGreeting()}, {userName} 👋</h1>
        <p className="text-[12px]" style={{ color: 'var(--tm-text-3)' }}>{formatDate()} · Season 2026</p>
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
                  <div className="absolute right-0 mt-2 w-[90vw] max-w-sm sm:w-80 bg-tm-surface rounded-card shadow-large border border-tm-border z-20 max-h-96 overflow-y-auto">
                    <div className="p-4 border-b border-tm-border flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-tm-text-1">Notifications</h3>
                        {unreadCount > 0 && (
                          <span className="bg-primary text-tm-on-secondary text-xs font-bold rounded-full px-2 py-0.5">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="p-1 hover:bg-tm-surface-hover rounded text-xs text-primary"
                            title="Mark all as read"
                          >
                            <CheckCheck className="w-4 h-4" />
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
                    <div className="divide-y divide-tm-border max-h-96 overflow-y-auto">
                      {notifications.filter((n) => !n.read).length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell className="w-12 h-12 text-tm-text-3 mx-auto mb-2 opacity-50" />
                          <p className="text-sm text-tm-text-3">No unread notifications</p>
                        </div>
                      ) : (
                        notifications
                          .filter((notification) => 
                            notification && 
                            typeof notification === 'object' && 
                            notification.id &&
                            !notification.read // Only show unread notifications
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
                                onClick={() => handleNotificationClick(notification)}
                          className={cn(
                            'p-4 hover:bg-tm-surface-hover transition-colors cursor-pointer',
                                  !read && 'bg-tm-surface-hover'
                          )}
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
                            <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="text-sm font-semibold text-tm-text-1">
                                        {title}
                                      </p>
                                      {getNotificationLink(notification) && (
                                        <span className="text-xs text-primary font-medium">→ Click to view</span>
                                      )}
                                    </div>
                                    <p className="text-sm text-tm-text-1">{message}</p>
                              <p className="text-xs text-tm-text-3 mt-1">
                                      {formatDistanceToNow(new Date(created_at), { addSuffix: true })}
                              </p>
                            </div>
                                  {!read && (
                              <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                            )}
                          </div>
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

