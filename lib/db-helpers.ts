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
    subject: string
    message: string
  }) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) throw new Error('User not authenticated')
    
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        ...messageData,
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async getMessages(userId: string) {
    const supabase = createClient()
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single()
    
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:user_profiles!messages_sender_id_fkey(name, role),
        recipient:user_profiles!messages_recipient_id_fkey(name, role)
      `)
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId},recipient_role.eq.${profile?.role}`)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async markMessageAsRead(messageId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('id', messageId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Inventory Operations
  async getInventoryItems() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('item_name', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  async createInventoryItem(itemData: {
    item_name: string
    category: string
    quantity: number
    unit: string
    location: string
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

  // Financial Transactions Operations
  async getFinancialTransactions(filters?: {
    type?: 'revenue' | 'expense'
    dateFrom?: string
    dateTo?: string
  }) {
    const supabase = createClient()
    let query = supabase
      .from('financial_transactions')
      .select('*, created_by_user:user_profiles!financial_transactions_created_by_fkey(name)')
      .order('transaction_date', { ascending: false })
    
    if (filters?.type) {
      query = query.eq('type', filters.type)
    }
    if (filters?.dateFrom) {
      query = query.gte('transaction_date', filters.dateFrom)
    }
    if (filters?.dateTo) {
      query = query.lte('transaction_date', filters.dateTo)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data || []
  },

  async createFinancialTransaction(transactionData: {
    transaction_date: string
    type: 'revenue' | 'expense'
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

  // Match Stats Operations
  async saveMatchStats(matchId: string, stats: Array<{
    player_id: string
    tackles_made: number
    tackles_missed: number
    ball_carries: number
    tries_scored: number
    minutes_played: number
  }>) {
    const supabase = createClient()
    
    // Delete existing stats for this match
    await supabase
      .from('match_stats')
      .delete()
      .eq('match_id', matchId)
    
    // Insert new stats
    const records = stats.map(stat => ({
      match_id: matchId,
      ...stat,
    }))
    
    const { data, error } = await supabase
      .from('match_stats')
      .insert(records)
      .select()
    
    if (error) throw error
    return data
  },

  async createMatch(matchData: {
    match_date: string
    opponent: string
    tournament_type: string
    venue?: string
    result?: string
    score_our_team?: number
    score_opponent?: number
    notes?: string
  }) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data, error } = await supabase
      .from('matches')
      .insert({
        ...matchData,
        created_by: user?.id,
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Reports Operations
  async createReport(reportData: {
    title: string
    report_type: string
    date_from?: string
    date_to?: string
  }) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data, error } = await supabase
      .from('reports')
      .insert({
        ...reportData,
        generated_by: user?.id,
        status: 'generating',
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async getReports() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async updateReportStatus(reportId: string, status: 'generating' | 'ready' | 'error', fileUrl?: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('reports')
      .update({ status, file_url: fileUrl })
      .eq('id', reportId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },
}

