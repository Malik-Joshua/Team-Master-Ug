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
  HeartPulse,
  UserCircle,
  Dumbbell,
  ChevronDown,
  MoreVertical,
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
  { name: 'Players', href: '/players', icon: Users, roles: ['coach', 'data_admin', 'admin', 'club_captain'] },
  { name: 'Performance', href: '/performance', icon: BarChart3 },
  { name: 'Training', href: '/training', icon: Calendar, roles: ['player', 'coach', 'data_admin', 'admin', 'club_captain'] },
  { name: 'Fixtures', href: '/fixtures', icon: Trophy, roles: ['coach', 'data_admin', 'admin', 'club_captain'] },
  { name: 'Health & injuries', href: '/dashboard/physio', icon: HeartPulse, roles: ['physio', 'admin', 'coach', 'data_admin', 'club_captain'] },
  { name: 'Gym & fitness', href: '/gym', icon: Dumbbell, roles: ['player', 'coach', 'data_admin', 'admin'] },
  { name: 'Finance', href: '/finance', icon: DollarSign, roles: ['finance_admin', 'admin'] },
  { name: 'Inventory', href: '/inventory', icon: Package, roles: ['data_admin', 'admin', 'physio'] },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Reports', href: '/reports', icon: FileText, roles: ['data_admin', 'finance_admin', 'admin', 'club_captain'] },
  { name: 'Staff', href: '/staff', icon: UserCircle, roles: ['admin'] },
  { name: 'Settings', href: '/settings', icon: Settings },
]

interface ClubSettings {
  primary_color?: string
  secondary_color?: string
  club_nickname?: string
  badge_url?: string
  league?: string
}

interface SidebarProps {
  userRole: string
  onLogout: () => void
  clubSettings?: ClubSettings | null
  userName?: string
  userAvatar?: string | null
}

export default function Sidebar({ userRole, onLogout, clubSettings, userName, userAvatar }: SidebarProps) {
  const clubName = clubSettings?.club_nickname || 'Team Master'
  const clubLeague = clubSettings?.league || 'Rugby · Premiership'
  const badgeUrl = clubSettings?.badge_url || null
  const { collapsed, setCollapsed } = useSidebar()
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const filteredNavItems = navigationItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  )

  // Get initials for avatar
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const clubInitials = getInitials(clubName)

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 p-4 border-b" style={{ borderColor: 'var(--tm-sidebar-border)' }}>
        <div className="w-[34px] h-[34px] flex-shrink-0 rounded-lg flex items-center justify-center font-serif text-sm font-medium" style={{ background: 'var(--tm-secondary)', color: 'var(--tm-text-on-secondary)' }}>
          TM
        </div>
        {(!collapsed || isMobile) && (
          <span className="text-sm font-medium" style={{ color: 'var(--tm-sidebar-text)' }}>Team Master</span>
        )}
      </div>

      {/* Club pill */}
      <div className="mx-3 mt-3 p-2 rounded-md border flex items-center gap-2" style={{ background: 'var(--tm-sidebar-logo-bg)', borderColor: 'var(--tm-sidebar-border)' }}>
        {badgeUrl ? (
          <img src={badgeUrl} alt="Club badge" className="w-[30px] h-[30px] flex-shrink-0 rounded-full object-cover bg-white" />
        ) : (
          <div className="w-[30px] h-[30px] flex-shrink-0 rounded-full flex items-center justify-center text-xs font-medium" style={{ background: 'var(--tm-secondary)', color: 'var(--tm-text-on-secondary)' }}>
            {clubInitials}
          </div>
        )}
        {(!collapsed || isMobile) && (
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate" style={{ color: 'var(--tm-sidebar-text)' }}>{clubName}</div>
            <div className="text-[10px] truncate" style={{ color: 'var(--tm-sidebar-text-muted)' }}>{clubLeague}</div>
          </div>
        )}
        {(!collapsed || isMobile) && (
          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--tm-sidebar-text-muted)' }} />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2.5 overflow-y-auto">
        <div className="px-4 pt-3 pb-1 text-[10px] font-medium tracking-wider uppercase" style={{ color: 'var(--tm-sidebar-text-muted)' }}>Main</div>
        {filteredNavItems.slice(0, 5).map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => isMobile && setMobileOpen(false)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 mx-1 my-0.5 rounded-md text-xs transition-all duration-120',
                isActive
                  ? 'font-medium'
                  : 'hover:text-white/80'
              )}
              title={collapsed && !isMobile ? item.name : undefined}
              style={isActive ? { background: 'var(--tm-sidebar-active-bg)', color: 'var(--tm-sidebar-active-text)' } : { color: 'var(--tm-sidebar-text-muted)' }}
            >
              <Icon className="w-[17px] h-[17px] flex-shrink-0" />
              {(!collapsed || isMobile) && (
                <span>{item.name}</span>
              )}
            </Link>
          )
        })}

        <div className="px-4 pt-3 pb-1 text-[10px] font-medium tracking-wider uppercase" style={{ color: 'var(--tm-sidebar-text-muted)' }}>Club</div>
        {filteredNavItems.slice(5).map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => isMobile && setMobileOpen(false)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 mx-1 my-0.5 rounded-md text-xs transition-all duration-120',
                isActive
                  ? 'font-medium'
                  : 'hover:text-white/80'
              )}
              title={collapsed && !isMobile ? item.name : undefined}
              style={isActive ? { background: 'var(--tm-sidebar-active-bg)', color: 'var(--tm-sidebar-active-text)' } : { color: 'var(--tm-sidebar-text-muted)' }}
            >
              <Icon className="w-[17px] h-[17px] flex-shrink-0" />
              {(!collapsed || isMobile) && (
                <span>{item.name}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User footer — profile link + separate sign-out */}
      <div className="border-t p-3" style={{ borderColor: 'var(--tm-sidebar-border)' }}>
        <div className="flex items-center gap-1">
          <Link
            href="/profile"
            onClick={() => isMobile && setMobileOpen(false)}
            className="flex items-center gap-2 p-2 rounded-md transition-colors flex-1 min-w-0"
            style={{ color: 'var(--tm-sidebar-text)' }}
            title="View your profile"
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tm-sidebar-hover-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {userAvatar ? (
              <img src={userAvatar} alt={userName || 'Profile'} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0" style={{ background: 'var(--tm-secondary)', color: 'var(--tm-text-on-secondary)' }}>
                {getInitials(userName || userRole)}
              </div>
            )}
            {(!collapsed || isMobile) && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: 'var(--tm-sidebar-text)' }}>{userName || 'My profile'}</div>
                <div className="text-[11px] capitalize truncate" style={{ color: 'var(--tm-sidebar-text-muted)' }}>{userRole.replace('_', ' ')}</div>
              </div>
            )}
          </Link>
          {(!collapsed || isMobile) && (
            <button
              onClick={() => {
                onLogout()
                if (isMobile) setMobileOpen(false)
              }}
              title="Sign out"
              aria-label="Sign out"
              className="p-2 rounded-md transition-colors flex-shrink-0"
              style={{ color: 'var(--tm-sidebar-text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tm-sidebar-hover-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 bg-tm-surface text-tm-text-1 rounded-lg shadow-md border border-tm-border"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed left-0 top-0 h-full w-64 sm:w-72 md:w-80 shadow-xl z-50 flex flex-col" style={{ background: 'var(--tm-sidebar-bg)' }}>
            <SidebarContent isMobile />
          </aside>
        </>
      )}

      <aside
        className={cn(
          'hidden lg:flex lg:flex-col fixed left-0 top-0 h-full shadow-md transition-all duration-300 z-30',
          collapsed ? 'w-16' : 'w-56'
        )}
        style={{ background: 'var(--tm-sidebar-bg)' }}
      >
        <SidebarContent />
      </aside>
      
      <div className="lg:hidden w-0" />
    </>
  )
}
