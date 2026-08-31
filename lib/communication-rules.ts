/**
 * Communication Hierarchy Rules
 * Defines who can communicate with whom in the application
 */

export type UserRole = 'player' | 'coach' | 'asst_coach' | 'data_admin' | 'physio' | 'admin' | 'finance_admin' | 'club_captain'

/**
 * Communication matrix: who can send messages to whom
 * Key: sender role
 * Value: array of recipient roles the sender can message
 */
export const COMMUNICATION_RULES: Record<UserRole, UserRole[]> = {
  // Players can communicate with: club captain, data manager, coach, asst coach, physio
  player: ['club_captain', 'data_admin', 'coach', 'asst_coach', 'physio'],

  // Data manager can communicate with: players, coaches, physio, club captain, admin
  data_admin: ['player', 'coach', 'asst_coach', 'physio', 'club_captain', 'admin'],

  // Physio can communicate with: coaches, players, data manager, club captain
  physio: ['coach', 'asst_coach', 'player', 'data_admin', 'club_captain'],

  // Admin can communicate with: players, data manager, coaches, club captain, finance admin
  admin: ['player', 'data_admin', 'coach', 'asst_coach', 'club_captain', 'finance_admin'],

  // Finance admin can communicate with: admin, data manager
  finance_admin: ['admin', 'data_admin'],

  // Coach can communicate with: other coaches (incl. asst), players, physio, club captain, data manager, admin
  coach: ['coach', 'asst_coach', 'player', 'physio', 'club_captain', 'data_admin', 'admin'],

  // Assistant coach mirrors the Head Coach's communication rules exactly —
  // they share the same dashboard and responsibilities.
  asst_coach: ['coach', 'asst_coach', 'player', 'physio', 'club_captain', 'data_admin', 'admin'],

  // Club captain can communicate with: admin, coaches, players, physio, data manager
  club_captain: ['admin', 'coach', 'asst_coach', 'player', 'physio', 'data_admin'],
}

/**
 * Check if a sender role can message a recipient role
 */
export function canSendMessage(senderRole: UserRole, recipientRole: UserRole): boolean {
  const allowedRecipients = COMMUNICATION_RULES[senderRole]
  if (!allowedRecipients) {
    return false
  }
  return allowedRecipients.includes(recipientRole)
}

/**
 * Get allowed recipient roles for a sender role
 */
export function getAllowedRecipients(senderRole: UserRole): UserRole[] {
  return COMMUNICATION_RULES[senderRole] || []
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    player: 'Player',
    coach: 'Coach',
    asst_coach: 'Assistant Coach',
    data_admin: 'Team Manager',
    physio: 'Physiotherapist',
    admin: 'Administrator',
    finance_admin: 'Finance Admin',
    club_captain: 'Club Captain',
  }
  return roleNames[role] || role
}
