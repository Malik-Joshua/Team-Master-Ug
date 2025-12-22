import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Force dynamic rendering
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

    // Get user profile to verify role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can view performance summaries' },
        { status: 403 }
      )
    }

    // Use service role key to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Service role key is missing' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get all users by role
    const { data: allUsers } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, name, role, status')
      .in('role', ['coach', 'physio', 'data_admin', 'finance_admin', 'player'])
      .eq('status', 'active')

    if (!allUsers) {
      return NextResponse.json({
        success: true,
        coaches: [],
        physios: [],
        teamManagers: [],
        financeAdmins: [],
        players: [],
      })
    }

    // Separate users by role
    const coaches = allUsers.filter(u => u.role === 'coach')
    const physios = allUsers.filter(u => u.role === 'physio')
    const teamManagers = allUsers.filter(u => u.role === 'data_admin')
    const financeAdmins = allUsers.filter(u => u.role === 'finance_admin')
    const players = allUsers.filter(u => u.role === 'player')

    // Get coach performance
    const coachPerformance = await Promise.all(
      coaches.map(async (coach) => {
        const { data: sessions } = await supabaseAdmin
          .from('training_sessions')
          .select('id')
          .eq('coach_id', coach.user_id)

        const { data: teamSelections } = await supabaseAdmin
          .from('fixture_team_selections')
          .select('id')
          .eq('selected_by', coach.user_id)

        return {
          user_id: coach.user_id,
          name: coach.name,
          trainingSessionsConducted: sessions?.length || 0,
          teamSelectionsMade: teamSelections?.length || 0,
        }
      })
    )

    // Get physio performance
    const physioPerformance = await Promise.all(
      physios.map(async (physio) => {
        const { data: injuries } = await supabaseAdmin
          .from('injuries')
          .select('id')
          .eq('physio_id', physio.user_id)

        const activeInjuries = injuries?.filter((i: any) => i.status === 'active').length || 0
        const resolvedInjuries = injuries?.filter((i: any) => i.status === 'resolved').length || 0

        return {
          user_id: physio.user_id,
          name: physio.name,
          totalInjuriesHandled: injuries?.length || 0,
          activeInjuries,
          resolvedInjuries,
        }
      })
    )

    // Get team manager performance
    const teamManagerPerformance = await Promise.all(
      teamManagers.map(async (tm) => {
        const { data: matches } = await supabaseAdmin
          .from('matches')
          .select('id')
          .eq('created_by', tm.user_id)

        const { data: fixtures } = await supabaseAdmin
          .from('matches')
          .select('id')
          .eq('created_by', tm.user_id)
          .gte('match_date', new Date().toISOString().split('T')[0])

        const { data: attendance } = await supabaseAdmin
          .from('training_attendance')
          .select('id')
          .eq('recorded_by', tm.user_id)

        return {
          user_id: tm.user_id,
          name: tm.name,
          matchesLogged: matches?.length || 0,
          upcomingFixturesCreated: fixtures?.length || 0,
          attendanceRecords: attendance?.length || 0,
        }
      })
    )

    // Get finance admin performance
    const financeAdminPerformance = await Promise.all(
      financeAdmins.map(async (finance) => {
        const { data: transactions } = await supabaseAdmin
          .from('financial_transactions')
          .select('amount, type')
          .eq('created_by', finance.user_id)

        const { data: budgets } = await supabaseAdmin
          .from('budgets')
          .select('total_amount, status')
          .eq('created_by', finance.user_id)

        const totalRevenue = transactions?.filter(t => t.type === 'revenue')
          .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0
        const totalExpenses = transactions?.filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0
        const pendingBudgets = budgets?.filter(b => b.status === 'pending').length || 0
        const approvedBudgets = budgets?.filter(b => b.status === 'approved').length || 0

        return {
          user_id: finance.user_id,
          name: finance.name,
          transactionsProcessed: transactions?.length || 0,
          totalRevenue,
          totalExpenses,
          budgetsCreated: budgets?.length || 0,
          pendingBudgets,
          approvedBudgets,
        }
      })
    )

    // Get player performance summary
    const { data: matchStats } = await supabaseAdmin
      .from('match_stats')
      .select('player_id, tries_scored, tackles_made, minutes_played')

    const { data: attendance } = await supabaseAdmin
      .from('training_attendance')
      .select('player_id, attendance_status')

    const playerPerformance = players.map((player) => {
      const playerStats = matchStats?.filter(s => s.player_id === player.user_id) || []
      const playerAttendance = attendance?.filter(a => a.player_id === player.user_id) || []
      
      const totalMatches = new Set(playerStats.map(s => s.player_id)).size
      const totalTries = playerStats.reduce((sum, s) => sum + (s.tries_scored || 0), 0)
      const totalTackles = playerStats.reduce((sum, s) => sum + (s.tackles_made || 0), 0)
      const totalMinutes = playerStats.reduce((sum, s) => sum + (s.minutes_played || 0), 0)
      const avgMinutes = totalMatches > 0 ? Math.round(totalMinutes / totalMatches) : 0
      
      const presentCount = playerAttendance.filter(a => a.attendance_status === 'P').length
      const attendanceRate = playerAttendance.length > 0 
        ? Math.round((presentCount / playerAttendance.length) * 100) 
        : 0

      return {
        user_id: player.user_id,
        name: player.name,
        totalMatches,
        totalTries,
        totalTackles,
        avgMinutes,
        attendanceRate,
        trainingSessionsAttended: playerAttendance.length,
      }
    })

    return NextResponse.json({
      success: true,
      coaches: coachPerformance,
      physios: physioPerformance,
      teamManagers: teamManagerPerformance,
      financeAdmins: financeAdminPerformance,
      players: playerPerformance,
    })
  } catch (error: any) {
    console.error('Performance summary API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

