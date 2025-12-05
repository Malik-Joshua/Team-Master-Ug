/**
 * Database Helper Functions
 * Centralized functions for database operations
 */

import { createClient } from './supabase/client'

export const db = {
  // User Profile Operations
  async updateProfile(userId: string, data: any) {
    const supabase = createClient()
    const { data: result, error } = await supabase
      .from('user_profiles')
      .update(data)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) throw error
    return result
  },

  // Training Operations
  async getTrainingSessions() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('training_sessions')
      .select('*')
      .order('session_number', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  async getCoachTrainingSessionsCount(coachId: string) {
    const supabase = createClient()
    const { count, error } = await supabase
      .from('training_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', coachId)
    
    if (error) throw error
    return count || 0
  },

  async getCoachTrainingSessions(coachId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('coach_id', coachId)
      .order('session_date', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  async createTrainingSession(sessionData: {
    session_number: number
    session_date: string
    session_time?: string
    location?: string
    description?: string
    coach_id?: string
  }) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data, error } = await supabase
      .from('training_sessions')
      .insert({
        ...sessionData,
        coach_id: user?.id,
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async saveTrainingAttendance(sessionId: string, attendance: Array<{
    player_id: string
    attendance_status: 'P' | 'A' | 'X' | 'I'
  }>) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // Delete existing attendance for this session
    await supabase
      .from('training_attendance')
      .delete()
      .eq('session_id', sessionId)
    
    // Insert new attendance records
    const records = attendance.map(record => ({
      session_id: sessionId,
      player_id: record.player_id,
      attendance_status: record.attendance_status,
      recorded_by: user?.id,
    }))
    
    const { data, error } = await supabase
      .from('training_attendance')
      .insert(records)
      .select()
    
    if (error) throw error
    return data
  },

  async getTrainingAttendance(sessionId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('training_attendance')
      .select('*, players!inner(user_id)')
      .eq('session_id', sessionId)
    
    if (error) throw error
    return data || []
  },

  // Messages Operations
  async sendMessage(messageData: {
    recipient_id?: string
    recipient_role?: string
    subject?: string
    message: string
  }) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) throw new Error('User not authenticated')
    
    const { data, error } = await supabase
      .from('messages')
      .insert({
        ...messageData,
        sender_id: user.id,
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async getMessages() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return []
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  // Inventory Operations
  async getInventoryItems() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async createInventoryItem(itemData: {
    item_name: string
    category?: string
    quantity: number
    unit?: string
    location?: string
    description?: string
  }) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        ...itemData,
        created_by: user?.id,
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async updateInventoryItem(itemId: string, itemData: any) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('inventory')
      .update(itemData)
      .eq('id', itemId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async deleteInventoryItem(itemId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', itemId)
    
    if (error) throw error
  },

  // Financial Operations
  async getFinancialTransactions() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('financial_transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async createFinancialTransaction(transactionData: {
    transaction_date: string
    type: 'expense' | 'revenue'
    category: string
    description: string
    amount: number
  }) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data, error } = await supabase
      .from('financial_transactions')
      .insert({
        ...transactionData,
        created_by: user?.id,
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Coach Performance Operations
  async getCoachMatchesAttended(coachId: string) {
    const supabase = createClient()
    const { count, error } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', coachId)
    
    if (error) throw error
    return count || 0
  },

  async getCoachMatches(coachId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('created_by', coachId)
      .order('match_date', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async getTeamPerformanceStats() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('match_stats')
      .select('*')
    
    if (error) throw error
    
    if (!data || data.length === 0) {
      return {
        totalTries: 0,
        totalTackles: 0,
        totalTacklesMissed: 0,
        totalBallCarries: 0,
        totalBallHandlingErrors: 0,
        totalMinutes: 0,
        avgTriesPerMatch: 0,
        avgTacklesPerMatch: 0,
        tackleSuccessRate: 0,
      }
    }

    const totalTries = data.reduce((sum, stat) => sum + (stat.tries_scored || 0), 0)
    const totalTackles = data.reduce((sum, stat) => sum + (stat.tackles_made || 0), 0)
    const totalTacklesMissed = data.reduce((sum, stat) => sum + (stat.tackles_missed || 0), 0)
    const totalBallCarries = data.reduce((sum, stat) => sum + (stat.ball_carries || 0), 0)
    const totalBallHandlingErrors = data.reduce((sum, stat) => sum + (stat.ball_handling_errors || 0), 0)
    const totalMinutes = data.reduce((sum, stat) => sum + (stat.minutes_played || 0), 0)
    
    // Get unique match count
    const uniqueMatches = new Set(data.map(stat => stat.match_id))
    const matchCount = uniqueMatches.size
    
    const avgTriesPerMatch = matchCount > 0 ? totalTries / matchCount : 0
    const avgTacklesPerMatch = matchCount > 0 ? totalTackles / matchCount : 0
    const totalTackleAttempts = totalTackles + totalTacklesMissed
    const tackleSuccessRate = totalTackleAttempts > 0 ? (totalTackles / totalTackleAttempts) * 100 : 0

    return {
      totalTries,
      totalTackles,
      totalTacklesMissed,
      totalBallCarries,
      totalBallHandlingErrors,
      totalMinutes,
      matchCount,
      avgTriesPerMatch: Math.round(avgTriesPerMatch * 10) / 10,
      avgTacklesPerMatch: Math.round(avgTacklesPerMatch * 10) / 10,
      tackleSuccessRate: Math.round(tackleSuccessRate * 10) / 10,
    }
  },

  async getPlayersPerformanceSummary() {
    const supabase = createClient()
    
    // Get all players with their profiles
    const { data: players, error: playersError } = await supabase
      .from('user_profiles')
      .select('user_id, name, status, role')
      .eq('role', 'player')
    
    if (playersError) throw playersError
    if (!players || players.length === 0) return []

    // Get all match stats
    const { data: matchStats, error: statsError } = await supabase
      .from('match_stats')
      .select('*')
    
    if (statsError) throw statsError

    // Get training attendance
    const { data: attendance, error: attendanceError } = await supabase
      .from('training_attendance')
      .select('player_id, attendance_status')
    
    if (attendanceError) throw attendanceError

    // Calculate stats for each player
    return players.map(player => {
      const playerStats = matchStats?.filter(stat => stat.player_id === player.user_id) || []
      const playerAttendance = attendance?.filter(att => att.player_id === player.user_id) || []
      
      const totalMatches = new Set(playerStats.map(stat => stat.match_id)).size
      const totalTries = playerStats.reduce((sum, stat) => sum + (stat.tries_scored || 0), 0)
      const totalTackles = playerStats.reduce((sum, stat) => sum + (stat.tackles_made || 0), 0)
      const totalMinutes = playerStats.reduce((sum, stat) => sum + (stat.minutes_played || 0), 0)
      
      const presentCount = playerAttendance.filter(att => att.attendance_status === 'P').length
      const totalSessions = playerAttendance.length
      const attendanceRate = totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0

      return {
        playerId: player.user_id,
        name: player.name,
        status: player.status,
        totalMatches,
        totalTries,
        totalTackles,
        totalMinutes,
        avgMinutes: totalMatches > 0 ? Math.round(totalMinutes / totalMatches) : 0,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        totalSessions,
        presentCount,
      }
    })
  },

  // Player Performance Operations
  async getPlayerTrainingSessionsAttended(playerId: string) {
    const supabase = createClient()
    const { count, error } = await supabase
      .from('training_attendance')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', playerId)
      .eq('attendance_status', 'P')
    
    if (error) throw error
    return count || 0
  },

  async getPlayerGymStats(playerId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('user_profiles')
      .select('gym_stats')
      .eq('user_id', playerId)
      .single()
    
    if (error) throw error
    
    // Return gym stats with default values if not set
    const gymStats = data?.gym_stats || {}
    return {
      benchPressPB: gymStats.bench_press_pb || gymStats.benchPressPB || null,
      squatPB: gymStats.squat_pb || gymStats.squatPB || null,
      deadliftPB: gymStats.deadlift_pb || gymStats.deadliftPB || null,
      pullUpPB: gymStats.pull_up_pb || gymStats.pullUpPB || null,
    }
  },

  async updatePlayerGymStats(playerId: string, gymStats: {
    benchPressPB?: number | null
    squatPB?: number | null
    deadliftPB?: number | null
    pullUpPB?: number | null
  }) {
    const supabase = createClient()
    
    // Get current gym stats
    const { data: currentData, error: fetchError } = await supabase
      .from('user_profiles')
      .select('gym_stats')
      .eq('user_id', playerId)
      .single()
    
    if (fetchError) throw fetchError
    
    // Merge with existing stats
    const currentStats = currentData?.gym_stats || {}
    const updatedStats = {
      ...currentStats,
      bench_press_pb: gymStats.benchPressPB !== undefined ? gymStats.benchPressPB : currentStats.bench_press_pb || currentStats.benchPressPB,
      squat_pb: gymStats.squatPB !== undefined ? gymStats.squatPB : currentStats.squat_pb || currentStats.squatPB,
      deadlift_pb: gymStats.deadliftPB !== undefined ? gymStats.deadliftPB : currentStats.deadlift_pb || currentStats.deadliftPB,
      pull_up_pb: gymStats.pullUpPB !== undefined ? gymStats.pullUpPB : currentStats.pull_up_pb || currentStats.pullUpPB,
    }
    
    // Update the gym_stats field
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ gym_stats: updatedStats })
      .eq('user_id', playerId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Player Management Operations
  // Note: addPlayer is handled via API route due to admin requirements

  async updatePlayer(playerId: string, playerData: {
    name?: string
    email?: string
    phone?: string
    position?: string
    category?: 'forwards' | 'backs'
    jersey_number?: number
    date_of_birth?: string
    height_cm?: number
    weight_kg?: number
    status?: string
  }) {
    const supabase = createClient()
    
    // Update user profile
    const profileUpdate: any = {}
    if (playerData.name) profileUpdate.name = playerData.name
    if (playerData.email) profileUpdate.email = playerData.email
    if (playerData.phone !== undefined) profileUpdate.phone = playerData.phone
    if (playerData.status) profileUpdate.status = playerData.status
    
    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update(profileUpdate)
        .eq('user_id', playerId)
      
      if (profileError) throw profileError
    }
    
    // Update player record
    const playerUpdate: any = {}
    if (playerData.position) playerUpdate.position = playerData.position
    if (playerData.category) playerUpdate.category = playerData.category
    if (playerData.jersey_number !== undefined) playerUpdate.jersey_number = playerData.jersey_number
    if (playerData.date_of_birth) playerUpdate.date_of_birth = playerData.date_of_birth
    if (playerData.height_cm !== undefined) playerUpdate.height_cm = playerData.height_cm
    if (playerData.weight_kg !== undefined) playerUpdate.weight_kg = playerData.weight_kg
    
    if (Object.keys(playerUpdate).length > 0) {
      const { error: playerError } = await supabase
        .from('players')
        .update(playerUpdate)
        .eq('user_id', playerId)
      
      if (playerError) throw playerError
    }
    
    return { success: true }
  },

  async getPlayerDetails(playerId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        players (*)
      `)
      .eq('user_id', playerId)
      .single()
    
    if (error) throw error
    return data
  },

  // Team Manager Operations
  async getTeamManagerGameDays(teamManagerId: string) {
    const supabase = createClient()
    const { count, error } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', teamManagerId)
    
    if (error) throw error
    return count || 0
  },

  async getTeamManagerTrainingSessionsAttended(teamManagerId: string) {
    const supabase = createClient()
    // Count distinct training sessions where team manager recorded attendance
    const { data, error } = await supabase
      .from('training_attendance')
      .select('session_id')
      .eq('recorded_by', teamManagerId)
    
    if (error) throw error
    
    // Get unique session IDs
    const uniqueSessions = new Set(data?.map(record => record.session_id) || [])
    return uniqueSessions.size
  },

  async getInjuryReports() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('role', 'player')
      .eq('status', 'injured')
    
    if (error) throw error
    return data || []
  },

  // Injury Management Operations
  async getInjuries(playerId?: string) {
    const supabase = createClient()
    let query = supabase
      .from('injuries')
      .select(`
        *,
        player:user_profiles!injuries_player_id_fkey(name, email)
      `)
      .order('injury_date', { ascending: false })

    if (playerId) {
      query = query.eq('player_id', playerId)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async getActiveInjuries() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('injuries')
      .select(`
        *,
        player:user_profiles!injuries_player_id_fkey(name, email)
      `)
      .eq('status', 'active')
      .order('injury_date', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async createInjury(injuryData: {
    player_id: string
    injury_date: string
    cause: string
    diagnosis: string
    action_taken: string
    further_treatment?: string
    medication?: string
    return_to_training_date?: string
    return_to_play_date?: string
    notes?: string
    created_by: string
  }) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('injuries')
      .insert(injuryData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateInjury(injuryId: string, injuryData: {
    injury_date?: string
    cause?: string
    diagnosis?: string
    action_taken?: string
    further_treatment?: string
    medication?: string
    return_to_training_date?: string
    return_to_play_date?: string
    notes?: string
  }) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('injuries')
      .update(injuryData)
      .eq('id', injuryId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async clearInjury(injuryId: string, clearedBy: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('injuries')
      .update({
        status: 'cleared',
        cleared_at: new Date().toISOString(),
        cleared_by: clearedBy,
      })
      .eq('id', injuryId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getInjuryStats() {
    const supabase = createClient()
    
    // Get active injuries count
    const { count: activeCount } = await supabase
      .from('injuries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Get cleared injuries count
    const { count: clearedCount } = await supabase
      .from('injuries')
      .select('*', { count: 'exact', head: true })
      .in('status', ['cleared', 'healed'])

    // Get average healing time
    const { data: clearedInjuries } = await supabase
      .from('injuries')
      .select('injury_date, return_to_play_date')
      .in('status', ['cleared', 'healed'])
      .not('return_to_play_date', 'is', null)

    let avgHealingTime = 0
    if (clearedInjuries && clearedInjuries.length > 0) {
      const healingTimes = clearedInjuries
        .map(injury => {
          if (injury.return_to_play_date && injury.injury_date) {
            return Math.ceil(
              (new Date(injury.return_to_play_date).getTime() - new Date(injury.injury_date).getTime()) / (1000 * 60 * 60 * 24)
            )
          }
          return null
        })
        .filter((time): time is number => time !== null)

      if (healingTimes.length > 0) {
        avgHealingTime = Math.round(healingTimes.reduce((sum, time) => sum + time, 0) / healingTimes.length)
      }
    }

    return {
      active: activeCount || 0,
      cleared: clearedCount || 0,
      total: (activeCount || 0) + (clearedCount || 0),
      averageHealingTime: avgHealingTime,
    }
  },

  async getTeamManagerMatches(teamManagerId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('created_by', teamManagerId)
      .order('match_date', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  // Budget Operations
  async createBudget(budgetData: {
    event_name: string
    event_type: string
    event_date: string
    description?: string
    total_amount: number
    created_by: string
    items: Array<{
      item_name: string
      category?: string
      quantity: number
      unit_price: number
      total_amount: number
      notes?: string
    }>
  }) {
    const supabase = createClient()
    
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .insert({
        event_name: budgetData.event_name,
        event_type: budgetData.event_type,
        event_date: budgetData.event_date,
        description: budgetData.description || null,
        total_amount: budgetData.total_amount,
        status: 'pending',
        created_by: budgetData.created_by,
      })
      .select('id')
      .single()
    
    if (budgetError) throw budgetError
    
    if (budgetData.items.length > 0) {
      const itemsToInsert = budgetData.items.map(item => ({
        budget_id: budget.id,
        item_name: item.item_name,
        category: item.category || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_amount: item.total_amount,
        notes: item.notes || null,
      }))
      
      const { error: itemsError } = await supabase
        .from('budget_items')
        .insert(itemsToInsert)
      
      if (itemsError) throw itemsError
    }
    
    return budget
  },

  async getBudgets(userId: string, role: string) {
    const supabase = createClient()
    
    let query = supabase
      .from('budgets')
      .select('*, budget_items(*), created_by_profile:user_profiles!budgets_created_by_fkey(name, email)')
      .order('created_at', { ascending: false })
    
    // Finance admins see their own budgets, admins see all
    if (role === 'finance_admin') {
      query = query.eq('created_by', userId)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async approveBudget(budgetId: string, adminId: string) {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('budgets')
      .update({
        status: 'approved',
        approved_by: adminId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', budgetId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async rejectBudget(budgetId: string, adminId: string, rejectionReason: string) {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('budgets')
      .update({
        status: 'rejected',
        approved_by: adminId,
        approved_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      })
      .eq('id', budgetId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async getPendingBudgets() {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('budgets')
      .select('*, budget_items(*), created_by_profile:user_profiles!budgets_created_by_fkey(name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  // Club Performance Operations for Finance Admin
  async getClubFinancialPerformance() {
    const supabase = createClient()
    
    // Get total revenue
    const { data: revenueData, error: revenueError } = await supabase
      .from('financial_transactions')
      .select('amount')
      .eq('type', 'revenue')
    
    if (revenueError) throw revenueError
    
    // Get total expenses
    const { data: expenseData, error: expenseError } = await supabase
      .from('financial_transactions')
      .select('amount')
      .eq('type', 'expense')
    
    if (expenseError) throw expenseError
    
    const totalRevenue = revenueData?.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0
    const totalExpenses = expenseData?.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0
    
    // Get recent transactions
    const { data: recentTransactions, error: transactionsError } = await supabase
      .from('financial_transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .limit(10)
    
    if (transactionsError) throw transactionsError
    
    // Get budget statistics
    const { data: budgetsData, error: budgetsError } = await supabase
      .from('budgets')
      .select('*')
    
    if (budgetsError) throw budgetsError
    
    const pendingBudgets = budgetsData?.filter(b => b.status === 'pending').length || 0
    const approvedBudgets = budgetsData?.filter(b => b.status === 'approved').length || 0
    const totalBudgetAmount = budgetsData?.reduce((sum, b) => sum + parseFloat(b.total_amount.toString()), 0) || 0
    
    return {
      totalRevenue,
      totalExpenses,
      netBalance: totalRevenue - totalExpenses,
      recentTransactions: recentTransactions || [],
      budgetStats: {
        pending: pendingBudgets,
        approved: approvedBudgets,
        totalAmount: totalBudgetAmount,
      },
    }
  },

  // Club Performance Operations for Admin
  async getClubPerformance() {
    const supabase = createClient()
    
    // Get team performance stats
    const teamPerformance = await this.getTeamPerformanceStats()
    
    // Get players performance summary
    const playersPerf = await this.getPlayersPerformanceSummary()
    
    // Get financial performance
    const financialPerf = await this.getClubFinancialPerformance()
    
    // Get total players
    const { data: players, error: playersError } = await supabase
      .from('user_profiles')
      .select('user_id, status')
      .eq('role', 'player')
    
    if (playersError) throw playersError
    
    const totalPlayers = players?.length || 0
    const activePlayers = players?.filter(p => p.status === 'active').length || 0
    const injuredPlayers = players?.filter(p => p.status === 'injured').length || 0
    
    // Get total matches
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*')
    
    if (matchesError) throw matchesError
    
    const totalMatches = matches?.length || 0
    const wins = matches?.filter(m => m.result === 'win').length || 0
    const losses = matches?.filter(m => m.result === 'loss').length || 0
    const draws = matches?.filter(m => m.result === 'draw').length || 0
    const winRate = totalMatches > 0 ? parseFloat(((wins / totalMatches) * 100).toFixed(1)) : 0
    
    // Get training sessions
    const { data: trainingSessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select('*')
    
    if (sessionsError) throw sessionsError
    
    const totalTrainingSessions = trainingSessions?.length || 0
    
    return {
      teamPerformance,
      playersSummary: playersPerf,
      financial: financialPerf,
      clubStats: {
        totalPlayers,
        activePlayers,
        injuredPlayers,
        totalMatches,
        wins,
        losses,
        draws,
        winRate,
        totalTrainingSessions,
      },
    }
  },

  // Best Gym Metrics of the Week
  async getBestGymMetricsOfWeek() {
    const supabase = createClient()
    
    // Get start of current week (Monday)
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Adjust when day is Sunday
    const startOfWeek = new Date(now)
    startOfWeek.setDate(diff)
    startOfWeek.setHours(0, 0, 0, 0)
    
    // Get all players with gym stats
    const { data: players, error: playersError } = await supabase
      .from('user_profiles')
      .select('user_id, name')
      .eq('role', 'player')
      .eq('status', 'active')

    if (playersError) throw playersError
    if (!players || players.length === 0) return null

    const playersWithStats = await Promise.all(
      players.map(async (player) => {
        const gymStats = await this.getPlayerGymStats(player.user_id)
        return {
          ...player,
          gymStats,
        }
      })
    )

    // Filter out players with no gym stats
    const playersWithValidStats = playersWithStats.filter(p => 
      p.gymStats.benchPressPB !== null || 
      p.gymStats.squatPB !== null || 
      p.gymStats.deadliftPB !== null || 
      p.gymStats.pullUpPB !== null
    )

    if (playersWithValidStats.length === 0) return null

    // Find best in each category
    const bestBenchPress = playersWithValidStats.reduce((best, current) => {
      const currentValue = current.gymStats.benchPressPB || 0
      const bestValue = best.gymStats.benchPressPB || 0
      return currentValue > bestValue ? current : best
    }, playersWithValidStats[0])

    const bestSquat = playersWithValidStats.reduce((best, current) => {
      const currentValue = current.gymStats.squatPB || 0
      const bestValue = best.gymStats.squatPB || 0
      return currentValue > bestValue ? current : best
    }, playersWithValidStats[0])

    const bestDeadlift = playersWithValidStats.reduce((best, current) => {
      const currentValue = current.gymStats.deadliftPB || 0
      const bestValue = best.gymStats.deadliftPB || 0
      return currentValue > bestValue ? current : best
    }, playersWithValidStats[0])

    const bestPullUps = playersWithValidStats.reduce((best, current) => {
      const currentValue = current.gymStats.pullUpPB || 0
      const bestValue = best.gymStats.pullUpPB || 0
      return currentValue > bestValue ? current : best
    }, playersWithValidStats[0])

    return {
      weekStart: startOfWeek.toISOString(),
      bestBenchPress: {
        playerName: bestBenchPress.name,
        value: bestBenchPress.gymStats.benchPressPB,
      },
      bestSquat: {
        playerName: bestSquat.name,
        value: bestSquat.gymStats.squatPB,
      },
      bestDeadlift: {
        playerName: bestDeadlift.name,
        value: bestDeadlift.gymStats.deadliftPB,
      },
      bestPullUps: {
        playerName: bestPullUps.name,
        value: bestPullUps.gymStats.pullUpPB,
      },
    }
  },

  // Physio Operations
  async getTotalTrainingSessions() {
    const supabase = createClient()
    const { count, error } = await supabase
      .from('training_sessions')
      .select('*', { count: 'exact', head: true })
    
    if (error) throw error
    return count || 0
  },

  async getTotalMatches() {
    const supabase = createClient()
    const { count, error } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
    
    if (error) throw error
    return count || 0
  },
}
