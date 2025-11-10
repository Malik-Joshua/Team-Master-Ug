'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  BarChart3,
  DollarSign,
  Package,
  MessageSquare,
  FileText,
  Calendar,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  Trophy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/contexts/SidebarContext'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
}

const navigationItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Players', href: '/players', icon: Users, roles: ['coach', 'data_admin', 'admin'] },
  { name: 'My Profile', href: '/profile', icon: User, roles: ['player'] },
  { name: 'Performance', href: '/performance', icon: BarChart3 },
  { name: 'Training', href: '/training', icon: Calendar, roles: ['coach', 'data_admin', 'admin'] },
  { name: 'Finance', href: '/finance', icon: DollarSign, roles: ['finance_admin', 'admin'] },
  { name: 'Inventory', href: '/inventory', icon: Package, roles: ['data_admin', 'admin'] },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Reports', href: '/reports', icon: FileText, roles: ['data_admin', 'finance_admin', 'admin'] },
]

interface SidebarProps {
  userRole: string
  onLogout: () => void
}

export default function Sidebar({ userRole, onLogout }: SidebarProps) {
  const { collapsed, setCollapsed } = useSidebar()
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const filteredNavItems = navigationItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  )

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Logo/Header with Gradient */}
      <div className="bg-club-gradient p-4">
        <div className="flex items-center justify-between">
          {(!collapsed || isMobile) && (
            <div className="flex items-center space-x-2">
              <Trophy className="w-6 h-6 text-white" />
              <span className="text-lg font-bold text-white">MONGERS RFC</span>
            </div>
          )}
          {!isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </button>
          )}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-2 bg-white">
        {filteredNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => isMobile && setMobileOpen(false)}
              className={cn(
                'flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-club-gradient text-white shadow-md'
                  : 'text-neutral-dark hover:bg-neutral-light hover:text-primary'
              )}
              title={collapsed && !isMobile ? item.name : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {(!collapsed || isMobile) && (
                <span className="font-medium text-sm">{item.name}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Settings & Logout */}
      <div className="p-4 border-t border-neutral-light bg-white space-y-2">
        <Link
          href="/settings"
          onClick={() => isMobile && setMobileOpen(false)}
          className={cn(
            'flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200',
            'text-neutral-dark hover:bg-neutral-light hover:text-primary'
          )}
          title={collapsed && !isMobile ? 'Settings' : undefined}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {(!collapsed || isMobile) && <span className="font-medium text-sm">Settings</span>}
        </Link>
        <button
          onClick={() => {
            onLogout()
            if (isMobile) setMobileOpen(false)
          }}
          className={cn(
            'flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 w-full text-left',
            'text-red-600 hover:bg-red-50'
          )}
          title={collapsed && !isMobile ? 'Logout' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {(!collapsed || isMobile) && <span className="font-medium text-sm">Logout</span>}
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-neutral-light"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed left-0 top-0 h-full w-64 bg-white shadow-xl z-50 flex flex-col">
            <SidebarContent isMobile />
          </aside>
        </>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col fixed left-0 top-0 h-full bg-white shadow-md border-r border-neutral-light transition-all duration-300 z-30',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent />
      </aside>
      
      {/* Spacer for mobile */}
      <div className="lg:hidden w-0" />
    </>
  )
}

