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
}
