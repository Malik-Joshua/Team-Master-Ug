import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { checkRoleLimit, getRoleLimitErrorMessage, ROLE_LIMITS } from '@/lib/role-limits'

export const dynamic = 'force-dynamic'

// Promote a player to club captain
export async function POST(
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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const playerId = params.id

    // Use service role to bypass RLS
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

    // Get player profile
    const { data: playerProfile, error: playerError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('user_id', playerId)
      .eq('role', 'player')
      .single()

    if (playerError || !playerProfile) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      )
    }

    // Check if player already has a club captain account
    const { data: existingClubCaptain } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('role', 'club_captain')
      .eq('linked_player_id', playerId)
      .maybeSingle()

    if (existingClubCaptain) {
      return NextResponse.json(
        { error: 'This player is already a club captain' },
        { status: 400 }
      )
    }

    // Check role limit
    const { count: currentClubCaptainCount, error: countError } = await supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'club_captain')

    if (countError) {
      console.error('Error counting club captains:', countError)
      return NextResponse.json(
        { error: 'Failed to check role limit' },
        { status: 500 }
      )
    }

    const limitCheck = checkRoleLimit(currentClubCaptainCount || 0, 'club_captain')
    if (!limitCheck.canAdd) {
      return NextResponse.json(
        { 
          error: getRoleLimitErrorMessage('club_captain', currentClubCaptainCount || 0),
          limit: limitCheck.limit,
          current: currentClubCaptainCount || 0,
          remaining: limitCheck.remaining
        },
        { status: 403 }
      )
    }

    // Create club captain profile linked to player
    // Note: We'll create a system-generated auth user for the club captain profile
    // The player will continue using their player account, but the dashboard will
    // detect the linked club_captain profile and show the club captain dashboard
    
    const rolePrefixes: Record<string, string> = {
      club_captain: 'CAP',
    }
    const prefix = rolePrefixes['club_captain'] || 'USR'
    const uniqueId = `${prefix}${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Clean up any orphaned auth users from previous club captain accounts for this player
    // This handles the case where a player was demoted but the auth user wasn't deleted
    try {
      // Check if there are any orphaned auth users with system emails for this player
      // We'll try to find and delete them by checking user_metadata
      const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers()
      if (allUsers?.users) {
        for (const user of allUsers.users) {
          // Check if this is a system account for this player
          if (
            user.user_metadata?.is_system_account === true &&
            user.user_metadata?.original_player_id === playerId &&
            user.email?.includes('@system.team-master.local')
          ) {
            // Check if profile still exists
            const { data: orphanedProfile } = await supabaseAdmin
              .from('user_profiles')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle()
            
            // If no profile exists, this is an orphaned auth user - delete it
            if (!orphanedProfile) {
              console.log(`Cleaning up orphaned auth user: ${user.id} (${user.email})`)
              await supabaseAdmin.auth.admin.deleteUser(user.id)
            }
          }
        }
      }
    } catch (cleanupError) {
      console.error('Error during cleanup of orphaned auth users:', cleanupError)
      // Continue anyway - this is not critical
    }

    // Generate a unique system email for the club captain profile
    // Include timestamp and random string to ensure uniqueness
    // This auth user won't be used for login - the player logs in with their player account
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase()
    const systemEmail = `club-captain-${playerId.substring(0, 8)}-${timestamp}-${randomStr}@system.team-master.local`
    const systemPassword = `System${timestamp}${Math.random().toString(36).substring(2, 12)}`
    
    // Create auth user for club captain profile (system account, not for login)
    const { data: newAuthUser, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: systemEmail,
      password: systemPassword,
      email_confirm: true, // Auto-confirm
      user_metadata: {
        name: `${playerProfile.name} (Club Captain)`,
        original_player_id: playerId,
        is_system_account: true,
      }
    })

    if (authCreateError || !newAuthUser.user) {
      console.error('Error creating auth user for club captain:', authCreateError)
      return NextResponse.json(
        { error: `Failed to create club captain account: ${authCreateError?.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    // Create club captain profile linked to player
    const { data: clubCaptainProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id: newAuthUser.user.id,
        unique_id: uniqueId,
        name: playerProfile.name, // Use same name as player
        email: playerProfile.email, // Use player's email for display
        phone: playerProfile.phone,
        role: 'club_captain',
        status: 'active',
        linked_player_id: playerId,
      })
      .select()
      .single()

    if (profileError) {
      // Clean up auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id)
      console.error('Error creating club captain profile:', profileError)
      return NextResponse.json(
        { error: `Failed to create club captain profile: ${profileError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Player promoted to club captain successfully',
      data: {
        clubCaptainProfile,
        playerProfile,
      }
    })
  } catch (error: any) {
    console.error('Error promoting player to club captain:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Demote club captain back to player (remove club captain role)
export async function DELETE(
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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const playerId = params.id

    // Use service role to bypass RLS
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

    // Find club captain profile linked to this player
    const { data: clubCaptainProfile, error: findError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('role', 'club_captain')
      .eq('linked_player_id', playerId)
      .single()

    if (findError || !clubCaptainProfile) {
      return NextResponse.json(
        { error: 'Club captain profile not found for this player' },
        { status: 404 }
      )
    }

    // Delete the auth user first (before profile to avoid foreign key issues)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(clubCaptainProfile.user_id)
    
    if (deleteAuthError) {
      console.error('Error deleting club captain auth user:', deleteAuthError)
      // Continue with profile deletion even if auth deletion fails
      // (auth user might already be deleted)
    }

    // Delete the club captain profile
    const { error: deleteProfileError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', clubCaptainProfile.id)

    if (deleteProfileError) {
      console.error('Error deleting club captain profile:', deleteProfileError)
      return NextResponse.json(
        { error: `Failed to remove club captain role: ${deleteProfileError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Club captain role removed successfully',
      data: {
        playerId,
      }
    })
  } catch (error: any) {
    console.error('Error removing club captain role:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Check if player is club captain
export async function GET(
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

    const playerId = params.id

    // Use service role to bypass RLS
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

    // Check if player has a club captain profile
    const { data: clubCaptainProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('role', 'club_captain')
      .eq('linked_player_id', playerId)
      .maybeSingle()

    return NextResponse.json({
      isClubCaptain: !!clubCaptainProfile,
      clubCaptainProfile: clubCaptainProfile || null,
    })
  } catch (error: any) {
    console.error('Error checking club captain status:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
