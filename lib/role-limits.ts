// Role limits configuration for the club
export const ROLE_LIMITS = {
  admin: 3,
  finance_admin: 2,
  data_admin: 2,
  player: 100,
  coach: 3,
  physio: 3,
  club_captain: 2, // Typically 1, but allow 2 for flexibility
} as const

export type Role = keyof typeof ROLE_LIMITS

/**
 * Get the maximum allowed users for a specific role
 */
export function getRoleLimit(role: Role): number {
  return ROLE_LIMITS[role]
}

/**
 * Check if a role can accept more users
 * @param currentCount - Current number of users with this role
 * @param role - The role to check
 * @returns Object with canAdd (boolean) and remaining (number)
 */
export function checkRoleLimit(currentCount: number, role: Role): {
  canAdd: boolean
  remaining: number
  limit: number
} {
  const limit = getRoleLimit(role)
  const remaining = Math.max(0, limit - currentCount)
  const canAdd = remaining > 0

  return {
    canAdd,
    remaining,
    limit,
  }
}

/**
 * Get a user-friendly error message for role limit exceeded
 */
export function getRoleLimitErrorMessage(role: Role, currentCount: number): string {
  const limit = getRoleLimit(role)
  const roleName = role === 'data_admin' ? 'Team Manager' : role === 'finance_admin' ? 'Finance Admin' : role === 'club_captain' ? 'Club Captain' : role.charAt(0).toUpperCase() + role.slice(1)
  
  return `Cannot add more ${roleName}s. The limit is ${limit} and you currently have ${currentCount}. Please remove an existing ${roleName} or contact the system administrator.`
}
