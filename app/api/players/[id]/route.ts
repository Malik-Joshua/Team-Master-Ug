import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user profile to verify admin/coach role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || !['admin', 'coach', 'asst_coach', 'data_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin/Coach/Data Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const playerId = params.id

    // Use service role to bypass RLS for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY environment variable' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Update user profile (including status)
    const profileData: any = {}
    if (body.name) profileData.name = body.name
    if (body.email) profileData.email = body.email
    if (body.phone !== undefined) profileData.phone = body.phone
    if (body.status !== undefined) profileData.status = body.status

    if (Object.keys(profileData).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .update(profileData)
        .eq('user_id', playerId)
      
      if (profileError) {
        console.error('Error updating user profile:', profileError)
        return NextResponse.json(
          { error: `Failed to update profile: ${profileError.message}` },
          { status: 500 }
        )
      }
    }

    // Update player details
    const playerData: any = {}
    if (body.position) playerData.position = body.position
    if (body.category) playerData.category = body.category
    if (body.jersey_number !== undefined) playerData.jersey_number = body.jersey_number
    if (body.date_of_birth !== undefined) playerData.date_of_birth = body.date_of_birth || null
    if (body.height_cm !== undefined) playerData.height_cm = body.height_cm || null
    if (body.weight_kg !== undefined) playerData.weight_kg = body.weight_kg || null

    if (Object.keys(playerData).length > 0) {
      const { error: playerError } = await supabaseAdmin
        .from('players')
        .update(playerData)
        .eq('user_id', playerId)
      
      if (playerError) {
        console.error('Error updating player details:', playerError)
        return NextResponse.json(
          { error: `Failed to update player details: ${playerError.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating player:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update player' },
      { status: 500 }
    )
  }
}
