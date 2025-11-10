'use client'

import { useState } from 'react'
import { Bell, MessageSquare, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  message: string
  timestamp: string
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
  const [notifications] = useState<Notification[]>([
    {
      id: '1',
      message: 'New training session scheduled for tomorrow',
      timestamp: '2 hours ago',
      read: false,
      type: 'info',
    },
    {
      id: '2',
      message: 'Match stats updated successfully',
      timestamp: '5 hours ago',
      read: false,
      type: 'success',
    },
    {
      id: '3',
      message: 'Payment received: UGX 500,000',
      timestamp: '1 day ago',
      read: true,
      type: 'success',
    },
  ])

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
                      <h3 className="font-bold text-neutral-text">Notifications</h3>
                      <button
                        onClick={() => setNotificationsOpen(false)}
                        className="p-1 hover:bg-neutral-light rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="divide-y divide-neutral-light">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
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
                              <p className="text-sm text-neutral-text">{notification.message}</p>
                              <p className="text-xs text-neutral-medium mt-1">
                                {notification.timestamp}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                            )}
                          </div>
                        </div>
                      ))}
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

