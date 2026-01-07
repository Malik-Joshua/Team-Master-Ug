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

    // Get user profile to verify admin role
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

    // Import db helpers
    const { db } = await import('@/lib/db-helpers')

    // Get all performance data
    const [
      teamStats,
      playersPerf,
      totalMatches,
      totalTrainingSessions,
      { count: totalPlayersCount },
      { count: activePlayersCount },
      { count: activeInjuriesCount },
      { data: transactions },
      { data: budgets },
      { data: matches },
    ] = await Promise.all([
      db.getTeamPerformanceStats(),
      db.getPlayersPerformanceSummary(),
      db.getTotalMatches(),
      db.getTotalTrainingSessions(),
      supabaseAdmin.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'player'),
      supabaseAdmin.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'player').eq('status', 'active'),
      supabaseAdmin.from('injuries').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('financial_transactions').select('*').order('transaction_date', { ascending: false }),
      supabaseAdmin.from('budgets').select('status'),
      supabaseAdmin.from('matches').select('result'),
    ])

    // Calculate financial performance using service role client (bypasses RLS)
    let financial: any = {
      totalRevenue: 0,
      totalExpenses: 0,
      netBalance: 0,
      budgetStats: { pending: 0, approved: 0, rejected: 0, total: 0 },
      recentTransactions: [],
    }

    if (transactions && transactions.length > 0) {
      const totalRevenue = transactions
        .filter((t: any) => t.type === 'revenue')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0)
      
      const totalExpenses = transactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0)
      
      const netBalance = Math.round((totalRevenue - totalExpenses) * 100) / 100
      
      // Get recent transactions (last 10) with description field
      const recentTransactions = transactions.slice(0, 10).map((t: any) => ({
        id: t.id,
        transaction_date: t.transaction_date,
        type: t.type,
        category: t.category,
        description: t.description || '', // Ensure description is included
        amount: t.amount,
        created_by: t.created_by,
      }))
      
      financial = {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netBalance,
        recentTransactions,
      }
    }

    // Calculate budget stats
    if (budgets) {
      financial.budgetStats = {
        pending: budgets.filter((b: any) => b.status === 'pending').length,
        approved: budgets.filter((b: any) => b.status === 'approved').length,
        rejected: budgets.filter((b: any) => b.status === 'rejected').length,
        total: budgets.length,
      }
    }

    const wins = matches?.filter(m => m.result === 'win').length || 0
    const losses = matches?.filter(m => m.result === 'loss').length || 0
    const draws = matches?.filter(m => m.result === 'draw').length || 0
    const totalPlayed = matches?.filter(m => m.result).length || 0
    const winRate = totalPlayed > 0 ? Math.round((wins / totalPlayed) * 100) : 0

    return NextResponse.json({
      teamStats,
      teamPerformance: teamStats, // Alias for compatibility
      playersPerf: playersPerf || [],
      playersSummary: playersPerf || [], // Alias for compatibility
      totalMatches: totalMatches || 0,
      totalTrainingSessions: totalTrainingSessions || 0,
      activePlayers: activePlayersCount || 0,
      activeInjuries: activeInjuriesCount || 0,
      financial: financial || {
        totalRevenue: 0,
        totalExpenses: 0,
        netBalance: 0,
        budgetStats: { pending: 0, approved: 0, rejected: 0, total: 0 },
        recentTransactions: [],
      },
      clubStats: {
        totalPlayers: totalPlayersCount || 0,
        activePlayers: activePlayersCount || 0,
        injuredPlayers: activeInjuriesCount || 0,
        totalMatches: totalMatches || 0,
        wins,
        losses,
        draws,
        winRate,
        totalTrainingSessions: totalTrainingSessions || 0,
      },
    })
  } catch (error: any) {
    console.error('Error fetching admin performance:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch performance data' },
      { status: 500 }
    )
  }
}

