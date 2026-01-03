import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
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

    // Get user profile to verify finance_admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || profile.role !== 'finance_admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Finance Admin access required' },
        { status: 403 }
      )
    }

    const sessionId = params.sessionId

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

    // Fetch attendance records with player information
    const { data: attendanceData, error: attendanceError } = await supabaseAdmin
      .from('training_attendance')
      .select(`
        attendance_status,
        player_id,
        session_id,
        notes,
        recorded_by,
        created_at
      `)
      .eq('session_id', sessionId)

    if (attendanceError) {
      console.error('Error fetching attendance:', attendanceError)
      return NextResponse.json(
        { error: `Failed to fetch attendance: ${attendanceError.message}` },
        { status: 500 }
      )
    }

    if (!attendanceData || attendanceData.length === 0) {
      return NextResponse.json({
        present: 0,
        absent: 0,
        justified: 0,
        injured: 0,
        total: 0,
        attendanceRate: 0,
        details: [],
      })
    }

    // Get unique player IDs
    const playerIds = [...new Set(attendanceData.map((a: any) => a.player_id).filter(Boolean))]

    // Fetch player names
    let playerNamesMap: Record<string, string> = {}
    if (playerIds.length > 0) {
      const { data: playersData } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, name')
        .in('user_id', playerIds)

      if (playersData) {
        playersData.forEach((player: any) => {
          playerNamesMap[player.user_id] = player.name
        })
      }
    }

    // Calculate statistics
    const present = attendanceData.filter((a: any) => a.attendance_status === 'P').length
    const absent = attendanceData.filter((a: any) => a.attendance_status === 'X').length
    const justified = attendanceData.filter((a: any) => a.attendance_status === 'A').length
    const injured = attendanceData.filter((a: any) => a.attendance_status === 'I').length
    const total = attendanceData.length
    const attendanceRate = total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0

    // Format details with player names
    const details = attendanceData.map((record: any) => ({
      ...record,
      player: {
        user_id: record.player_id,
        name: playerNamesMap[record.player_id] || 'Unknown Player',
      },
    }))

    return NextResponse.json({
      present,
      absent,
      justified,
      injured,
      total,
      attendanceRate,
      details,
    })
  } catch (error: any) {
    console.error('Error in GET session attendance:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch attendance' },
      { status: 500 }
    )
  }
}
