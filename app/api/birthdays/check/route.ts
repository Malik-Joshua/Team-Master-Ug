import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Use service role to bypass RLS for fetching all profiles
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get today's date
    const today = new Date()
    const todayMonth = today.getMonth() + 1 // JavaScript months are 0-indexed
    const todayDay = today.getDate()

    // Fetch all players with birth dates (birthday notifications are for players)
    const { data: profiles, error } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, name, birth_date, role')
      .not('birth_date', 'is', null)
      .eq('role', 'player')

    if (error) {
      console.error('Error fetching profiles:', error)
      return NextResponse.json(
        { error: `Failed to fetch profiles: ${error.message}` },
        { status: 500 }
      )
    }

    // Find users whose birthday is today
    const birthdaysToday = (profiles || []).filter((profile: any) => {
      if (!profile.birth_date) return false
      
      const birthDate = new Date(profile.birth_date)
      const birthMonth = birthDate.getMonth() + 1
      const birthDay = birthDate.getDate()
      
      return birthMonth === todayMonth && birthDay === todayDay
    })

    // Check if current user has a birthday today
    const currentUserProfile = profiles?.find((p: any) => p.user_id === authUser.id)
    const isUserBirthday = currentUserProfile && birthdaysToday.some((b: any) => b.user_id === authUser.id)

    return NextResponse.json({
      birthdaysToday: birthdaysToday.map((b: any) => ({
        user_id: b.user_id,
        name: b.name,
      })),
      isUserBirthday: !!isUserBirthday,
      currentUserBirthDate: currentUserProfile?.birth_date || null,
    })
  } catch (error: any) {
    console.error('Birthday check API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

