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

  // Injury Operations
  async getActiveInjuries() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('injuries')
      .select(`
        *,
        player:user_profiles!injuries_player_id_fkey(name, jersey_number, position)
      `)
      .eq('status', 'active')
      .order('injury_date', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  // Budget Operations
  async getPendingBudgets() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('budgets')
      .select(`
        *,
        created_by_profile:user_profiles!budgets_created_by_fkey(name, email)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async getBudgets(userId: string, role: string) {
    const supabase = createClient()
    let query = supabase
      .from('budgets')
      .select(`
        *,
        created_by_profile:user_profiles!budgets_created_by_fkey(name, email),
        approved_by_profile:user_profiles!budgets_approved_by_fkey(name, email),
        items:budget_items(*)
      `)
      .order('created_at', { ascending: false })

    // Finance admins can only see their own budgets, admins can see all
    if (role === 'finance_admin') {
      query = query.eq('created_by', userId)
    }

    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async approveBudget(budgetId: string, approvedBy: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('budgets')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq('id', budgetId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async rejectBudget(budgetId: string, rejectedBy: string, reason: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('budgets')
      .update({
        status: 'rejected',
        approved_by: rejectedBy,
        approved_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', budgetId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Player-specific Operations
  async getPlayerTrainingSessionsAttended(playerId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('training_attendance')
      .select('*')
      .eq('player_id', playerId)
      .eq('attendance_status', 'P')
    
    if (error) throw error
    return data?.length || 0
  },

  async getPlayerGymStats(playerId: string) {
    // Gym stats might not be in the database yet, return default structure
    // This can be extended when gym data is added to the database
    return {
      benchPressPB: null as number | null,
      squatPB: null as number | null,
      deadliftPB: null as number | null,
      pullUpPB: null as number | null,
    }
  },

  async getInjuries(playerId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('injuries')
      .select('*')
      .eq('player_id', playerId)
      .order('injury_date', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  // Gym Metrics Operations
  async getBestGymMetricsOfWeek() {
    // Gym metrics might not be in the database yet, return default structure
    // This can be extended when gym data is added to the database
    return {
      bestBenchPress: {
        value: 0,
        playerName: 'N/A',
      },
      bestSquat: {
        value: 0,
        playerName: 'N/A',
      },
      bestDeadlift: {
        value: 0,
        playerName: 'N/A',
      },
      bestPullUps: {
        value: 0,
        playerName: 'N/A',
      },
    }
  },

  async updatePlayerGymStats(playerId: string, stats: {
    benchPressPB?: number | null
    squatPB?: number | null
    deadliftPB?: number | null
    pullUpPB?: number | null
  }) {
    // Gym stats might not be in the database yet
    // This can be extended when gym data table is added to the database
    // For now, just return success
    return { success: true }
  },

  // Statistics Operations
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

  // Match Operations
  async getUpcomingMatches() {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .gte('match_date', today)
      .order('match_date', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  // Player Operations
  async getAvailablePlayers() {
    const supabase = createClient()
    
    // Get all active players with their profile and player details
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        user_id,
        name,
        email,
        status,
        players:players!players_user_id_fkey(position, category, jersey_number)
      `)
      .eq('role', 'player')
      .eq('status', 'active')
      .order('name', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  // Fixture Team Selection Operations
  async getFixtureTeamSelection(matchId: string) {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('fixture_team_selections')
      .select('*')
      .eq('match_id', matchId)
      .order('is_starting', { ascending: false })
      .order('jersey_number', { ascending: true, nullsLast: true })
    
    if (error) throw error
    return data || []
  },

  async saveFixtureTeamSelection(matchId: string, selections: Array<{
    player_id: string
    position?: string | null
    jersey_number?: number | null
    is_starting?: boolean
    is_substitute?: boolean
    notes?: string | null
  }>) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) throw new Error('User not authenticated')

    // Delete existing selections for this match
    const { error: deleteError } = await supabase
      .from('fixture_team_selections')
      .delete()
      .eq('match_id', matchId)

    if (deleteError) throw deleteError

    // Insert new selections
    const records = selections.map((selection) => ({
      match_id: matchId,
      player_id: selection.player_id,
      position: selection.position || null,
      jersey_number: selection.jersey_number || null,
      is_starting: selection.is_starting ?? true,
      is_substitute: selection.is_substitute ?? false,
      notes: selection.notes || null,
      selected_by: user.id,
    }))

    const { data, error: insertError } = await supabase
      .from('fixture_team_selections')
      .insert(records)
      .select()

    if (insertError) throw insertError
    return data
  },
}
