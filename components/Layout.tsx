'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import AIAssistant from './AIAssistant'

interface LayoutProps {
  children: React.ReactNode
  pageTitle: string
}

function LayoutContent({ children, pageTitle }: LayoutProps) {
  const { collapsed } = useSidebar()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
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
          // User is authenticated - get their profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', authUser.id)
            .single()

          if (profile) {
            setUser(profile)
            setLoading(false)
            return
          } else {
            // User authenticated but no profile - sign out and redirect
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
      <div className="min-h-screen flex items-center justify-center bg-neutral-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-neutral-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-neutral-bg flex">
      <Sidebar userRole={user.role} onLogout={handleLogout} />
      <div
        className={`flex-1 transition-all duration-300 ${
          collapsed ? 'ml-0 lg:ml-16' : 'ml-0 lg:ml-64'
        }`}
      >
        <TopBar
          title={pageTitle}
          userName={user.name}
          userRole={user.role}
          userAvatar={user.profile_picture_url}
        />
        <main className="max-w-container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </main>
        <AIAssistant />
      </div>
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

