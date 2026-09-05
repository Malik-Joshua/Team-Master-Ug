import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Shared helpers for the coach collaboration endpoints.
 *
 * These live here rather than in the route file because a Next.js route
 * module may only export route handlers (GET/POST/…) and a small set of
 * config values — exporting anything else fails the build with "does not
 * match the required types of a Next.js Route".
 */

// Only the head coach and assistant coach use the collaboration feed.
export const COLLAB_VIEW_ROLES = ['coach', 'asst_coach']
export const COLLAB_AUTHOR_ROLES = ['coach', 'asst_coach']

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials missing')
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

type StaffAuth =
  | { error: NextResponse }
  | { error?: undefined; userId: string; role: string; name: string }

/** Shared auth + role guard. Returns the caller's id/role/name, or an error response. */
export async function requireCoachStaff(allowed: string[] = COLLAB_VIEW_ROLES): Promise<StaffAuth> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, name')
    .eq('user_id', user.id)
    .single()
  if (!profile || !allowed.includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Not permitted' }, { status: 403 }) }
  }
  return { userId: user.id, role: profile.role, name: (profile.name as string) || 'A coach' }
}

/**
 * "Missing table" detection so the app degrades cleanly if migration 051
 * hasn't been applied yet, rather than 500-ing the whole page.
 */
export function isMissingCollabTable(err: any) {
  const m = String(err?.message || '')
  return /coach_activities|activity_comments|activity_reactions/.test(m) &&
    /does not exist|schema cache/i.test(m)
}
