/**
 * Notification Helper Functions
 * Centralized functions for creating and managing notifications
 */

import { createClient } from './supabase/client'
import { createClient as createServerClient } from './supabase/server'

export interface NotificationData {
  user_id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
}

/**
 * Create a notification for a user
 */
export async function createNotification(notification: NotificationData) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: notification.user_id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      read: false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating notification:', error)
    throw error
  }

  return data
}

/**
 * Create notifications for multiple users
 */
export async function createNotificationsForUsers(
  userIds: string[],
  title: string,
  message: string,
  type: NotificationData['type'] = 'info'
) {
  const notifications = userIds.map((userId) => ({
    user_id: userId,
    title,
    message,
    type,
    read: false,
  }))

  const supabase = createClient()
  const { data, error } = await supabase
    .from('notifications')
    .insert(notifications)
    .select()

  if (error) {
    console.error('Error creating notifications:', error)
    throw error
  }

  return data
}

/**
 * Create notification for a role (all users with that role)
 */
export async function createNotificationForRole(
  role: string,
  title: string,
  message: string,
  type: NotificationData['type'] = 'info'
) {
  const supabase = createClient()
  
  // Get all users with the specified role
  const { data: users, error: usersError } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('role', role)

  if (usersError) {
    console.error('Error fetching users for role:', usersError)
    throw usersError
  }

  if (!users || users.length === 0) {
    return []
  }

  const userIds = users.map((u) => u.user_id)
  return createNotificationsForUsers(userIds, title, message, type)
}

/**
 * Notification creators for specific activities
 */
export const notifications = {
  // Message notifications
  async newMessage(recipientId: string, senderName: string, subject: string) {
    return createNotification({
      user_id: recipientId,
      title: 'New Message',
      message: `You have a new message from ${senderName}: ${subject}`,
      type: 'info',
    })
  },

  // Match notifications
  async matchCreated(matchId: string, opponent: string, matchDate: string) {
    // Notify all players
    await createNotificationForRole(
      'player',
      'New Match Scheduled',
      `A new match against ${opponent} has been scheduled for ${new Date(matchDate).toLocaleDateString()}`,
      'info'
    )
  },

  async matchStatsUpdated(playerId: string, matchDate: string) {
    return createNotification({
      user_id: playerId,
      title: 'Match Stats Updated',
      message: `Your match statistics for ${new Date(matchDate).toLocaleDateString()} have been updated`,
      type: 'success',
    })
  },

  // Training notifications
  async trainingSessionCreated(sessionDate: string, location?: string) {
    await createNotificationForRole(
      'player',
      'New Training Session',
      `A new training session has been scheduled for ${new Date(sessionDate).toLocaleDateString()}${location ? ` at ${location}` : ''}`,
      'info'
    )
  },

  async trainingSessionUpdated(sessionDate: string) {
    await createNotificationForRole(
      'player',
      'Training Session Updated',
      `A training session scheduled for ${new Date(sessionDate).toLocaleDateString()} has been updated`,
      'warning',
    )
  },

  // Injury notifications
  async injuryReported(playerId: string, injuryType: string) {
    // Notify player
    await createNotification({
      user_id: playerId,
      title: 'Injury Report Created',
      message: `An injury report has been created for you: ${injuryType}`,
      type: 'warning',
    })

    // Notify coaches
    await createNotificationForRole(
      'coach',
      'New Injury Report',
      `A new injury report has been created for a player`,
      'warning',
    )
  },

  async injuryCleared(playerId: string) {
    return createNotification({
      user_id: playerId,
      title: 'Injury Cleared',
      message: 'Your injury has been cleared. You can return to training.',
      type: 'success',
    })
  },

  // Budget notifications
  async budgetSubmitted(budgetId: string, eventName: string, submittedBy: string) {
    // Notify admins
    await createNotificationForRole(
      'admin',
      'Budget Submitted for Approval',
      `${submittedBy} has submitted a budget for "${eventName}"`,
      'info',
    )
  },

  async budgetApproved(budgetId: string, eventName: string, submittedBy: string) {
    // Get the user who submitted the budget
    const supabase = createClient()
    const { data: budget } = await supabase
      .from('budgets')
      .select('created_by')
      .eq('id', budgetId)
      .single()

    if (budget?.created_by) {
      return createNotification({
        user_id: budget.created_by,
        title: 'Budget Approved',
        message: `Your budget for "${eventName}" has been approved`,
        type: 'success',
      })
    }
  },

  async budgetRejected(budgetId: string, eventName: string, reason?: string) {
    const supabase = createClient()
    const { data: budget } = await supabase
      .from('budgets')
      .select('created_by')
      .eq('id', budgetId)
      .single()

    if (budget?.created_by) {
      return createNotification({
        user_id: budget.created_by,
        title: 'Budget Rejected',
        message: `Your budget for "${eventName}" has been rejected${reason ? `: ${reason}` : ''}`,
        type: 'error',
      })
    }
  },

  // Report notifications
  async reportReady(reportId: string, reportTitle: string, generatedBy: string) {
    return createNotification({
      user_id: generatedBy,
      title: 'Report Ready',
      message: `Your report "${reportTitle}" is ready for download`,
      type: 'success',
    })
  },

  // Inventory notifications
  async inventoryLowStock(itemName: string, quantity: number) {
    // Notify data admins and admins
    const supabase = createClient()
    const { data: admins } = await supabase
      .from('user_profiles')
      .select('user_id')
      .in('role', ['admin', 'data_admin'])

    if (admins && admins.length > 0) {
      const userIds = admins.map((a) => a.user_id)
      await createNotificationsForUsers(
        userIds,
        'Low Stock Alert',
        `${itemName} is running low (${quantity} remaining)`,
        'warning',
      )
    }
  },

  async inventoryItemAdded(itemName: string, addedBy: string) {
    // Notify data admins and admins
    const supabase = createClient()
    const { data: admins } = await supabase
      .from('user_profiles')
      .select('user_id')
      .in('role', ['admin', 'data_admin'])

    if (admins && admins.length > 0) {
      const userIds = admins.map((a) => a.user_id)
      await createNotificationsForUsers(
        userIds,
        'New Inventory Item',
        `${itemName} has been added to inventory`,
        'info',
      )
    }
  },

  // Player registration notifications
  async playerRegistered(playerName: string, playerId: string) {
    // Notify coaches and admins
    const supabase = createClient()
    const { data: staff } = await supabase
      .from('user_profiles')
      .select('user_id')
      .in('role', ['admin', 'coach', 'data_admin'])

    if (staff && staff.length > 0) {
      const userIds = staff.map((s) => s.user_id)
      await createNotificationsForUsers(
        userIds,
        'New Player Registered',
        `${playerName} has registered as a new player`,
        'success',
      )
    }
  },
}

