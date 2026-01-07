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

  async getTotalTrainingSessions() {
    const supabase = createClient()
    const { count, error } = await supabase
      .from('training_sessions')
      .select('*', { count: 'exact', head: true })
    
    if (error) throw error
    return count || 0
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

  async getPlayerTrainingSessionsAttended(playerId: string) {
    const supabase = createClient()
    
    // Count training sessions where player was marked as present ('P')
    const { count, error } = await supabase
      .from('training_attendance')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', playerId)
      .eq('attendance_status', 'P')
    
    if (error) throw error
    return count || 0
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

  async getTotalMatches() {
    const supabase = createClient()
    const { count, error } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
    
    if (error) throw error
    return count || 0
  },

  async getUpcomingMatches() {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    
    // Get all matches with date >= today
    const { data: allMatches, error } = await supabase
      .from('matches')
      .select('id, match_date')
      .gte('match_date', today)
      .order('match_date', { ascending: true })
    
    if (error) throw error
    if (!allMatches || allMatches.length === 0) return []
    
    // Get match IDs that have stats entered (already played)
    const matchIds = allMatches.map(m => m.id)
    const { data: matchesWithStats } = await supabase
      .from('match_stats')
      .select('match_id')
      .in('match_id', matchIds)
    
    const playedMatchIds = new Set(matchesWithStats?.map((s: any) => s.match_id) || [])
    
    // Filter out matches that have been played (date passed OR stats exist)
    const upcomingMatches = allMatches.filter((match: any) => {
      const matchDate = new Date(match.match_date)
      const todayDate = new Date(today)
      const isDatePassed = matchDate < todayDate
      const hasStats = playedMatchIds.has(match.id)
      return !isDatePassed && !hasStats
    })
    
    // Get full match details for upcoming matches
    if (upcomingMatches.length === 0) return []
    
    const upcomingMatchIds = upcomingMatches.map(m => m.id)
    const { data: fullMatches, error: fullError } = await supabase
      .from('matches')
      .select('*')
      .in('id', upcomingMatchIds)
      .order('match_date', { ascending: true })
    
    if (fullError) throw fullError
    return fullMatches || []
  },

  async getAvailablePlayers() {
    const supabase = createClient()
    
    // Get all active players
    const { data: players, error: playersError } = await supabase
      .from('user_profiles')
      .select(`
        user_id,
        name,
        email,
        status,
        players:players!players_user_id_fkey(
          position,
          category,
          jersey_number
        )
      `)
      .eq('role', 'player')
      .eq('status', 'active')
    
    if (playersError) throw playersError
    
    // Get players with active injuries
    const { data: activeInjuries, error: injuriesError } = await supabase
      .from('injuries')
      .select('player_id')
      .eq('status', 'active')
    
    if (injuriesError) throw injuriesError
    
    const injuredPlayerIds = new Set((activeInjuries || []).map((i: any) => i.player_id))
    
    // Filter out injured players
    const availablePlayers = (players || []).filter((p: any) => !injuredPlayerIds.has(p.user_id))
    
    return availablePlayers
  },

  async getFixtureTeamSelection(matchId: string) {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('fixture_team_selections')
      .select('*')
      .eq('match_id', matchId)
      .order('is_starting', { ascending: false })
      .order('jersey_number', { ascending: true, nullsFirst: false })
    
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

  // Notification Operations
  async createNotification(notificationData: {
    user_id: string
    title: string
    message: string
    type?: 'info' | 'success' | 'warning' | 'error'
    action_url?: string // URL to navigate to when notification is clicked
    reference_id?: string // ID of the related item (e.g., message ID, task ID)
    reference_type?: string // Type of the related item (e.g., 'message', 'task', 'fixture')
  }) {
    // Use API route to create notification (server-side can access service role key)
    try {
      const response = await fetch('/api/notifications/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          singleNotification: notificationData,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Error creating notification via API:', errorData)
        throw new Error(errorData.error || 'Failed to create notification')
      }

      const result = await response.json()
      console.log('Successfully created notification via API:', result.notifications?.[0])
      return result.notifications?.[0] || null
    } catch (error) {
      console.error('Error in createNotification:', error)
      throw error
    }
  },

  async createNotificationForUsers(userIds: string[], notificationData: {
    title: string
    message: string
    type?: 'info' | 'success' | 'warning' | 'error'
    action_url?: string // URL to navigate to when notification is clicked
    reference_id?: string // ID of the related item (e.g., message ID, task ID)
    reference_type?: string // Type of the related item (e.g., 'message', 'task', 'fixture')
  }) {
    // Use API route to create notifications (server-side can access service role key)
    try {
      const response = await fetch('/api/notifications/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIds,
          notificationData,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Error creating notifications via API:', errorData)
        throw new Error(errorData.error || 'Failed to create notifications')
      }

      const result = await response.json()
      console.log(`Successfully created ${result.count || 0} notifications via API`)
      return result.notifications || []
    } catch (error) {
      console.error('Error in createNotificationForUsers:', error)
      throw error
    }
  },

  async createNotificationForRole(role: string, notificationData: {
    title: string
    message: string
    type?: 'info' | 'success' | 'warning' | 'error'
    action_url?: string // URL to navigate to when notification is clicked
    reference_id?: string // ID of the related item (e.g., message ID, task ID)
    reference_type?: string // Type of the related item (e.g., 'message', 'task', 'fixture')
  }) {
    const supabase = createClient()
    
    // Get all users with the specified role
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('role', role)
    
    if (usersError) throw usersError
    
    if (!users || users.length === 0) {
      return []
    }
    
    const notifications = users.map((user) => ({
      user_id: user.user_id,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type || 'info',
      action_url: notificationData.action_url || null,
    }))
    
    // Check if current user is admin/finance_admin/data_admin
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (authUser) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', authUser.id)
        .single()
      
      // If user is admin/finance_admin/data_admin, they can create notifications
      if (profile && ['admin', 'finance_admin', 'data_admin'].includes(profile.role)) {
        const { data, error } = await supabase
          .from('notifications')
          .insert(notifications)
          .select()
        
        if (error) throw error
        return data
      }
    }
    
    // For other cases, use service role (if available)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseUrl && supabaseServiceKey) {
      const { createClient: createServiceClient } = await import('@supabase/supabase-js')
      const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
      
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert(notifications)
        .select()
      
      if (error) throw error
      return data
    }
    
    // Fallback: try regular insert
    const { data, error } = await supabase
      .from('notifications')
      .insert(notifications)
      .select()
    
    if (error) throw error
    return data
  },

  // Budget Operations
  async getBudgets(userId: string, userRole: string) {
    const supabase = createClient()
    
    let query = supabase
      .from('budgets')
      .select('*')
      .order('created_at', { ascending: false })
    
    // Finance admins can see all budgets, others only their own
    if (userRole !== 'admin' && userRole !== 'finance_admin') {
      query = query.eq('created_by', userId)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async getPendingBudgets() {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async approveBudget(budgetId: string, approvedBy: string) {
    const supabase = createClient()
    
    // Get budget to find creator
    const { data: budget } = await supabase
      .from('budgets')
      .select('created_by, event_name')
      .eq('id', budgetId)
      .single()
    
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
    
    // Create notification for budget creator
    if (budget && budget.created_by) {
      await this.createNotification({
        user_id: budget.created_by,
        title: 'Budget Approved',
        message: `Your budget "${budget.event_name}" has been approved.`,
        type: 'success',
      })
    }
    
    return data
  },

  async rejectBudget(budgetId: string, rejectedBy: string, reason: string) {
    const supabase = createClient()
    
    // Get budget to find creator
    const { data: budget } = await supabase
      .from('budgets')
      .select('created_by, event_name')
      .eq('id', budgetId)
      .single()
    
    const { data, error } = await supabase
      .from('budgets')
      .update({
        status: 'rejected',
        rejection_reason: reason,
      })
      .eq('id', budgetId)
      .select()
      .single()
    
    if (error) throw error
    
    // Create notification for budget creator
    if (budget && budget.created_by) {
      await this.createNotification({
        user_id: budget.created_by,
        title: 'Budget Rejected',
        message: `Your budget "${budget.event_name}" has been rejected. Reason: ${reason}`,
        type: 'warning',
        action_url: `/finance?budget=${budgetId}`,
      })
    }
    
    return data
  },

  // Injury Operations
  async getActiveInjuries() {
    const supabase = createClient()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    // Use service role client to bypass RLS for reliable data fetching
    let supabaseClient = supabase
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const { createClient: createServiceClient } = await import('@supabase/supabase-js')
        supabaseClient = createServiceClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })
      } catch (serviceError) {
        console.error('Error creating service client, using regular client:', serviceError)
      }
    }
    
    // Fetch active injuries
    const { data: injuriesData, error: injuriesError } = await supabaseClient
      .from('injuries')
      .select('*')
      .eq('status', 'active')
      .order('injury_date', { ascending: false })
    
    if (injuriesError) {
      console.error('Error fetching injuries:', injuriesError)
      throw injuriesError
    }
    
    if (!injuriesData || injuriesData.length === 0) {
      return []
    }
    
    // Get all unique player IDs
    const playerIds = [...new Set(injuriesData.map((injury: any) => injury.player_id).filter(Boolean))]
    
    // Fetch player names using the same client (service role if available)
    let playerNamesMap: Record<string, string> = {}
    
    if (playerIds.length > 0) {
      const { data: playersData, error: playersError } = await supabaseClient
        .from('user_profiles')
        .select('user_id, name')
        .in('user_id', playerIds)
      
      if (playersError) {
        console.error('Error fetching player names:', playersError)
      } else if (playersData && playersData.length > 0) {
        playersData.forEach((player: any) => {
          playerNamesMap[player.user_id] = player.name
        })
        console.log('Successfully fetched player names for injuries:', playerNamesMap)
      } else {
        console.warn('No player data returned for player IDs:', playerIds)
      }
    }
    
    // Map injuries with player names
    return injuriesData.map((injury: any) => {
      const playerName = playerNamesMap[injury.player_id] || null
      if (!playerName) {
        console.warn('Player name not found for player_id:', injury.player_id, {
          availablePlayerIds: Object.keys(playerNamesMap),
          requestedPlayerId: injury.player_id,
          allPlayerIds: playerIds
        })
      }
      return {
        ...injury,
        player: {
          name: playerName || 'Unknown Player',
          user_id: injury.player_id,
        },
        player_name: playerName || 'Unknown Player',
        player_id: injury.player_id,
      }
    })
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
    const supabase = createClient()
    
    // Calculate current week (Monday to Sunday)
    const now = new Date()
    const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Convert Sunday (0) to 6 days back
    
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - daysToMonday)
    weekStart.setHours(0, 0, 0, 0)
    
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    
    const weekStartISO = weekStart.toISOString()
    const weekEndISO = weekEnd.toISOString()
    
    // Get players with gym stats updated within the current week
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select(`
        user_id,
        gym_stats,
        gym_stats_updated_at,
        player_profile:user_profiles!players_user_id_fkey(name)
      `)
      .not('gym_stats', 'is', null)
      .neq('gym_stats', '{}')
      .gte('gym_stats_updated_at', weekStartISO)
      .lte('gym_stats_updated_at', weekEndISO)
    
    if (playersError) throw playersError
    
    if (!players || players.length === 0) {
      return {
        weekStart: weekStartISO,
        weekEnd: weekEndISO,
        benchPress: null,
        squat: null,
        deadlift: null,
        pullUp: null,
      }
    }
    
    // Find best metrics across players updated this week
    let bestBenchPress = { value: 0, player: '', playerName: '' }
    let bestSquat = { value: 0, player: '', playerName: '' }
    let bestDeadlift = { value: 0, player: '', playerName: '' }
    let bestPullUp = { value: 0, player: '', playerName: '' }
    
    players.forEach((player: any) => {
      const gymStats = player.gym_stats || {}
      const playerName = player.player_profile?.name || 'Unknown'
      
      const benchPress = parseFloat(gymStats.bench_press_pb || gymStats.benchPressPB || '0')
      const squat = parseFloat(gymStats.squat_pb || gymStats.squatPB || '0')
      const deadlift = parseFloat(gymStats.deadlift_pb || gymStats.deadliftPB || '0')
      const pullUp = parseFloat(gymStats.pull_up_pb || gymStats.pullUpPB || '0')
      
      if (benchPress > bestBenchPress.value) {
        bestBenchPress = { value: benchPress, player: player.user_id, playerName }
      }
      if (squat > bestSquat.value) {
        bestSquat = { value: squat, player: player.user_id, playerName }
      }
      if (deadlift > bestDeadlift.value) {
        bestDeadlift = { value: deadlift, player: player.user_id, playerName }
      }
      if (pullUp > bestPullUp.value) {
        bestPullUp = { value: pullUp, player: player.user_id, playerName }
      }
    })
    
    return {
      weekStart: weekStartISO,
      weekEnd: weekEndISO,
      benchPress: bestBenchPress.value > 0 ? bestBenchPress : null,
      squat: bestSquat.value > 0 ? bestSquat : null,
      deadlift: bestDeadlift.value > 0 ? bestDeadlift : null,
      pullUp: bestPullUp.value > 0 ? bestPullUp : null,
    }
  },

  async getPlayerGymStats(playerId: string) {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('players')
      .select('gym_stats')
      .eq('user_id', playerId)
      .single()
    
    if (error) throw error
    
    const gymStats = data?.gym_stats || {}
    
    return {
      benchPressPB: gymStats.bench_press_pb || gymStats.benchPressPB || null,
      squatPB: gymStats.squat_pb || gymStats.squatPB || null,
      deadliftPB: gymStats.deadlift_pb || gymStats.deadliftPB || null,
      pullUpPB: gymStats.pull_up_pb || gymStats.pullUpPB || null,
    }
  },

  async updatePlayer(playerId: string, data: any) {
    const supabase = createClient()
    
    // Update user profile
    const profileData: any = {}
    if (data.name) profileData.name = data.name
    if (data.email) profileData.email = data.email
    if (data.phone !== undefined) profileData.phone = data.phone
    if (data.status !== undefined) profileData.status = data.status // Include status update (even if empty string)
    
    if (Object.keys(profileData).length > 0) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update(profileData)
        .eq('user_id', playerId)
      
      if (profileError) throw profileError
    }
    
    // Update player details
    const playerData: any = {}
    if (data.position) playerData.position = data.position
    if (data.category) playerData.category = data.category
    if (data.jersey_number !== undefined) playerData.jersey_number = data.jersey_number
    
    if (Object.keys(playerData).length > 0) {
      const { error: playerError } = await supabase
        .from('players')
        .update(playerData)
        .eq('user_id', playerId)
      
      if (playerError) throw playerError
    }
    
    return { success: true }
  },

  async updatePlayerGymStats(playerId: string, stats: {
    benchPressPB?: number | null
    squatPB?: number | null
    deadliftPB?: number | null
    pullUpPB?: number | null
  }) {
    const supabase = createClient()
    
    // Get current gym stats
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select('gym_stats')
      .eq('user_id', playerId)
      .single()
    
    if (fetchError) throw fetchError
    
    const currentStats = player?.gym_stats || {}
    
    // Update gym stats
    const updatedStats = {
      ...currentStats,
      bench_press_pb: stats.benchPressPB !== undefined ? stats.benchPressPB : currentStats.bench_press_pb || currentStats.benchPressPB,
      squat_pb: stats.squatPB !== undefined ? stats.squatPB : currentStats.squat_pb || currentStats.squatPB,
      deadlift_pb: stats.deadliftPB !== undefined ? stats.deadliftPB : currentStats.deadlift_pb || currentStats.deadliftPB,
      pull_up_pb: stats.pullUpPB !== undefined ? stats.pullUpPB : currentStats.pull_up_pb || currentStats.pullUpPB,
    }
    
    const { data, error } = await supabase
      .from('players')
      .update({ gym_stats: updatedStats })
      .eq('user_id', playerId)
      .select()
    
    if (error) throw error
    
    // Return the first (and should be only) updated record
    if (data && data.length > 0) {
      return data[0]
    }
    
    // If no data returned, fetch it to return
    const { data: fetchedData, error: refetchError } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', playerId)
      .single()
    
    if (refetchError) throw refetchError
    return fetchedData
  },

  async saveFixtureTeamSelection(matchId: string, selections: any[]) {
    // Use the API route to save team selection
    const response = await fetch('/api/fixtures/team-selection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        matchId,
        selections,
      }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to save team selection')
    }
    
    return await response.json()
  },

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
    
    // Count training sessions where team manager recorded attendance
    const { count, error } = await supabase
      .from('training_attendance')
      .select('*', { count: 'exact', head: true })
      .eq('recorded_by', teamManagerId)
    
    if (error) throw error
    return count || 0
  },

  async getInjuryReports() {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('injuries')
      .select(`
        *,
        player:user_profiles!injuries_player_id_fkey(name, user_id)
      `)
      .order('injury_date', { ascending: false })
    
    if (error) throw error
    
    return (data || []).map((injury: any) => ({
      ...injury,
      player_name: injury.player?.name || 'Unknown Player',
      player_id: injury.player?.user_id || injury.player_id,
    }))
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

  async getClubFinancialPerformance() {
    const supabase = createClient()
    
    // Get all financial transactions
    const { data: transactions, error } = await supabase
      .from('financial_transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
    
    if (error) throw error
    
    // Get budget statistics
    const { data: budgets, error: budgetsError } = await supabase
      .from('budgets')
      .select('status')
    
    if (budgetsError) throw budgetsError
    
    const budgetStats = {
      pending: (budgets || []).filter((b: any) => b.status === 'pending').length,
      approved: (budgets || []).filter((b: any) => b.status === 'approved').length,
      rejected: (budgets || []).filter((b: any) => b.status === 'rejected').length,
      total: (budgets || []).length,
    }
    
    if (!transactions || transactions.length === 0) {
      return {
        totalRevenue: 0,
        totalExpenses: 0,
        netIncome: 0,
        netBalance: 0, // Alias for netIncome for UI compatibility
        transactionCount: 0,
        budgetStats,
        recentTransactions: [],
      }
    }
    
    const totalRevenue = transactions
      .filter(t => t.type === 'revenue')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
    
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
    
    const netIncome = Math.round((totalRevenue - totalExpenses) * 100) / 100
    
    // Get recent transactions (last 10)
    const recentTransactions = (transactions || []).slice(0, 10)
    
    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netIncome,
      netBalance: netIncome, // Alias for UI compatibility
      transactionCount: transactions.length,
      budgetStats,
      recentTransactions,
    }
  },

  async getClubPerformance() {
    const supabase = createClient()
    
    // Get team performance stats
    const teamStats = await this.getTeamPerformanceStats()
    
    // Get players performance summary
    const playersPerf = await this.getPlayersPerformanceSummary()
    
    // Get total matches
    const totalMatches = await this.getTotalMatches()
    
    // Get total training sessions
    const totalTrainingSessions = await this.getTotalTrainingSessions()
    
    // Get total players count
    const { count: totalPlayersCount } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'player')
    
    // Get active players count
    const { count: activePlayersCount } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'player')
      .eq('status', 'active')
    
    // Get active injuries count
    const { count: activeInjuriesCount } = await supabase
      .from('injuries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
    
    // Get financial performance
    const financial = await this.getClubFinancialPerformance()
    
    // Get match results for win rate
    const { data: matches } = await supabase
      .from('matches')
      .select('result')
    
    const wins = matches?.filter(m => m.result === 'win').length || 0
    const losses = matches?.filter(m => m.result === 'loss').length || 0
    const draws = matches?.filter(m => m.result === 'draw').length || 0
    const totalPlayed = matches?.filter(m => m.result).length || 0
    const winRate = totalPlayed > 0 ? Math.round((wins / totalPlayed) * 100) : 0
    
    return {
      teamStats,
      teamPerformance: teamStats, // Alias for compatibility with performance page
      playersPerf: playersPerf || [],
      playersSummary: playersPerf || [], // Alias for compatibility with performance page
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
    }
  },
}
