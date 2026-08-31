'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { applyClubTheme } from '@/themeEngine'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import AIAssistant from './AIAssistant'
import ModalScrollLock from './ModalScrollLock'

interface LayoutProps {
  children: React.ReactNode
  pageTitle: string
}

function LayoutContent({ children, pageTitle }: LayoutProps) {
  const { collapsed } = useSidebar()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [clubSettings, setClubSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          router.push('/login')
          return
        }

        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (authUser) {
          console.log('[Layout] Authenticated user ID:', authUser.id);
          // User is authenticated - get their profile
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', authUser.id)
            .single()

          if (profileError) {
            console.error('[Layout] Error fetching user profile:', profileError);
          }

          if (profile) {
            setUser(profile)
            console.log('[ThemeEngine] Loaded user profile:', profile)

            // Load and apply club theme
            // Single-club app: the most recently updated club_settings row is
            // the source of truth (so the admin's latest colour choice wins).
            const { data: settings, error: settingsError } = await supabase
              .from('club_settings')
              .select('primary_color, secondary_color, club_nickname, badge_url, league')
              .order('updated_at', { ascending: false, nullsFirst: false })
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (settingsError) {
              console.error('[ThemeEngine] Error loading club settings:', settingsError)
            }

            if (settings) {
              console.log('[ThemeEngine] Fetched club settings from database:', settings)
              setClubSettings(settings)
              if (settings.primary_color) {
                console.log('[ThemeEngine] Applying club theme colors:', {
                  primary: settings.primary_color,
                  secondary: settings.secondary_color,
                  clubName: settings.club_nickname
                })
                applyClubTheme({
                  primary: settings.primary_color,
                  secondary: settings.secondary_color,
                  clubName: settings.club_nickname || undefined,
                })
              } else {
                console.warn('[ThemeEngine] Primary color is missing in settings, applying default theme')
                applyClubTheme({
                  primary: '#1A5276', // Default Navy
                  secondary: '#5BA3D9', // Default Sky Blue
                  clubName: 'Team Master',
                })
              }
            } else {
              console.warn('[ThemeEngine] No club settings found in database, applying default theme!')
              const defaultSettings = {
                primary_color: '#1A5276',
                secondary_color: '#5BA3D9',
                club_nickname: 'Team Master',
              }
              setClubSettings(defaultSettings)
              applyClubTheme({
                primary: defaultSettings.primary_color,
                secondary: defaultSettings.secondary_color,
                clubName: defaultSettings.club_nickname,
              })
            }

            setLoading(false)
            return
          } else {
            // User authenticated but no profile - sign out and redirect
            console.warn('[Layout] User authenticated, but no profile was returned. Signing out to login...');
            await supabase.auth.signOut()
            router.push('/login')
            return
          }
        }

        // No user found - redirect to login
        router.push('/login')
      } catch (error) {
        console.error('Error loading user:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [router])

  const handleLogout = async () => {
    // Sign out from Supabase
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }

    // Redirect to login page
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="tm-app min-h-screen flex items-center justify-center bg-tm-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tm-secondary mx-auto mb-4"></div>
          <p className="text-tm-text-3">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div
      className="tm-app h-screen flex overflow-hidden"
      style={{
        backgroundColor: 'var(--tm-bg, #F5F7FA)'
      }}
    >
      <Sidebar userRole={user.role} onLogout={handleLogout} clubSettings={clubSettings} userName={user.name} userAvatar={user.profile_picture_url} />
      {/*
        The margin here MUST match the sidebar's actual rendered width
        (Sidebar.tsx: w-56 expanded / w-16 collapsed) exactly — the sidebar
        itself is `fixed`, so it doesn't push this content over on its own.
        This previously used ml-64 (256px) against a 224px-wide (w-56)
        sidebar, leaving a permanent 32px gap of bare background between
        the sidebar and the header/content. Now: ml-56 (224px) = w-56.

        h-screen + overflow-hidden + flex-col here (rather than the whole
        page scrolling) is what makes the header "still" — TopBar stays
        flex-shrink-0 and pinned, while only the <main> region beneath it
        scrolls independently.
      */}
      <div
        className={`flex-1 min-w-0 h-screen flex flex-col overflow-hidden transition-all duration-300 ${
          collapsed ? 'ml-0 lg:ml-16' : 'ml-0 lg:ml-56'
        }`}
      >
        <TopBar
          title={pageTitle}
          userName={user.name}
          userRole={user.role}
          userAvatar={user.profile_picture_url}
        />
        <main data-tm-scroll-root className="flex-1 overflow-y-auto">
          <div className="max-w-container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8">
            {children}
          </div>
        </main>
        <AIAssistant />
      </div>
      {/* Keeps the page behind a modal from scrolling on touch devices */}
      <ModalScrollLock />
    </div>
  )
}

export default function Layout({ children, pageTitle }: LayoutProps) {
  return (
    <SidebarProvider>
      <LayoutContent pageTitle={pageTitle}>{children}</LayoutContent>
    </SidebarProvider>
  )
}

