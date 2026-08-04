// Where each role's dashboard actually lives. Player and Coach share the
// generic /dashboard page directly, so they're not listed here — every other
// role has its own dedicated route.
//
// Used by the login page so it can send a user straight to their real
// dashboard instead of always landing on /dashboard first and letting that
// page's own role-check effect redirect a second time. That double hop was
// costing an entire extra mount + data fetch (auth, profile, club theme) on
// every login, which is what made sign-in feel like it had hung.
const ROLE_DASHBOARD_ROUTES: Record<string, string> = {
  data_admin: '/dashboard/data-admin',
  finance_admin: '/dashboard/finance-admin',
  admin: '/dashboard/admin',
  physio: '/dashboard/physio',
  club_captain: '/dashboard/club-captain',
}

/**
 * Returns the dashboard path a user with this role should land on.
 * Falls back to the generic /dashboard for player/coach (and anything
 * unrecognised) — /dashboard/page.tsx still has its own redirect effect as a
 * safety net for edge cases (e.g. a player with a linked club-captain
 * account), so this is safe to use even if a role is missing here.
 */
export function getDashboardPathForRole(role: string | null | undefined): string {
  if (!role) return '/dashboard'
  return ROLE_DASHBOARD_ROUTES[role] || '/dashboard'
}
