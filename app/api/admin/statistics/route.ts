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

    // Get user profile to verify admin/coach role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    // Check if user has club captain access (either directly or via linked account)
    let hasClubCaptainAccess = false
    if (profile?.role === 'player') {
      // Check if player has a linked club_captain account
      const { data: clubCaptainProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('role', 'club_captain')
        .eq('linked_player_id', authUser.id)
        .single()
      
      hasClubCaptainAccess = !!clubCaptainProfile
    }

    if (!profile || (!['admin', 'coach', 'data_admin', 'club_captain'].includes(profile.role) && !hasClubCaptainAccess)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin/Coach/Data Admin/Club Captain access required' },
        { status: 403 }
      )
    }

    // Use service role to bypass RLS for admin queries
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

    // Get all statistics
    const [
      { count: totalUsersCount },
      { count: totalPlayersCount },
      { count: activePlayersCount },
      { data: transactions },
      { count: inventoryCount },
      { count: totalMatchesCount },
      { count: totalTrainingSessionsCount },
      { data: matchStats },
      { data: matches },
    ] = await Promise.all([
      supabaseAdmin.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'player'),
      supabaseAdmin.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'player').eq('status', 'active'),
      supabaseAdmin.from('financial_transactions').select('amount, type'),
      supabaseAdmin.from('inventory').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('matches').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('training_sessions').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('match_stats').select('tries_scored, tackles_made, minutes_played'),
      supabaseAdmin.from('matches').select('result'),
    ])

    const totalRevenue = transactions?.filter(t => t.type === 'revenue')
      .reduce((sum, t) => sum + parseFloat(t.amount?.toString() || '0'), 0) || 0
    
    const totalExpenses = transactions?.filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount?.toString() || '0'), 0) || 0

    const totalTries = matchStats?.reduce((sum, stat) => sum + (stat.tries_scored || 0), 0) || 0
    const totalTackles = matchStats?.reduce((sum, stat) => sum + (stat.tackles_made || 0), 0) || 0
    const totalMinutes = matchStats?.reduce((sum, stat) => sum + (stat.minutes_played || 0), 0) || 0
    const avgMinutes = totalMatchesCount && totalMatchesCount > 0 ? Math.round(totalMinutes / totalMatchesCount) : 0

    const wins = matches?.filter(m => m.result === 'win').length || 0
    const totalPlayed = matches?.filter(m => m.result).length || 0
    const winRate = totalPlayed > 0 ? Math.round((wins / totalPlayed) * 100) : 0

    // Get top performers with accurate stats (service role, bypass RLS)
    let topPerformers: any[] = []
    try {
      const [{ data: players }, { data: allMatchStats }, { data: attendance }] = await Promise.all([
        supabaseAdmin
          .from('user_profiles')
          .select('user_id, name, status')
          .eq('role', 'player'),
        supabaseAdmin
          .from('match_stats')
          .select('match_id, player_id, tries_scored, tackles_made, minutes_played'),
        supabaseAdmin
          .from('training_attendance')
          .select('player_id, attendance_status'),
      ])

      if (players && players.length > 0) {
        const playerIds = players.map((p) => p.user_id)
        const { data: playerDetails } = await supabaseAdmin
          .from('players')
          .select('user_id, position')
          .in('user_id', playerIds)

        const positionMap: Record<string, string> = {}
        if (playerDetails) {
          playerDetails.forEach((p: any) => {
            positionMap[p.user_id] = p.position
          })
        }

        const performers = players.map((player) => {
          const playerStats = (allMatchStats || []).filter((stat: any) => stat.player_id === player.user_id)
          const playerAttendance = (attendance || []).filter((att: any) => att.player_id === player.user_id)

          const totalMatches = new Set(playerStats.map((stat: any) => stat.match_id)).size
          const totalTries = playerStats.reduce((sum: number, stat: any) => sum + (stat.tries_scored || 0), 0)
          const totalTackles = playerStats.reduce((sum: number, stat: any) => sum + (stat.tackles_made || 0), 0)
          const totalMinutes = playerStats.reduce((sum: number, stat: any) => sum + (stat.minutes_played || 0), 0)

          const presentCount = playerAttendance.filter((att: any) => att.attendance_status === 'P').length
          const totalSessions = playerAttendance.length
          const attendanceRate = totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0

          return {
            playerId: player.user_id,
            name: player.name,
            status: player.status,
            position: positionMap[player.user_id] || null,
            totalMatches,
            totalTries,
            totalTackles,
            totalMinutes,
            avgMinutes: totalMatches > 0 ? Math.round(totalMinutes / totalMatches) : 0,
            attendanceRate: Math.round(attendanceRate * 10) / 10,
            totalSessions,
            presentCount,
            performanceScore: (totalTries * 10) + (totalTackles * 2) + (attendanceRate || 0),
          }
        })

        topPerformers = performers
          .sort((a: any, b: any) => {
            if (b.performanceScore !== a.performanceScore) return b.performanceScore - a.performanceScore
            if (b.totalTries !== a.totalTries) return b.totalTries - a.totalTries
            if (b.totalTackles !== a.totalTackles) return b.totalTackles - a.totalTackles
            return (b.attendanceRate || 0) - (a.attendanceRate || 0)
          })
          .slice(0, 10)
      }
    } catch (perfError) {
      console.error('Error fetching top performers:', perfError)
    }

    return NextResponse.json({
      totalUsers: totalUsersCount || 0,
      totalPlayers: totalPlayersCount || 0,
      activePlayers: activePlayersCount || 0,
      totalRevenue: Math.round(totalRevenue),
      totalExpenses: Math.round(totalExpenses),
      inventoryItems: inventoryCount || 0,
      totalMatches: totalMatchesCount || 0,
      totalTrainingSessions: totalTrainingSessionsCount || 0,
      totalTries,
      totalTackles,
      avgMinutes,
      winRate,
      topPerformers,
    })
  } catch (error: any) {
    console.error('Error fetching admin statistics:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}

