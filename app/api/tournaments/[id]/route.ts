import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['admin', 'data_admin']

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server configuration error: Supabase service credentials missing')
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function authorize(supabase: any) {
  const { data: { user: authUser }, error } = await supabase.auth.getUser()
  if (error || !authUser) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('user_id', authUser.id).single()
  if (!profile || !MANAGER_ROLES.includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Only the team manager or an admin can manage tournaments' }, { status: 403 }) }
  }
  return { authUser }
}

/**
 * PATCH /api/tournaments/[id]
 * Updates tournament-level fields: status, group_outcome, final_placement.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const auth = await authorize(supabase)
    if ('error' in auth) return auth.error

    const body = await request.json()
    const patch: Record<string, any> = { updated_at: new Date().toISOString() }
    if (body.status !== undefined) patch.status = body.status
    if (body.group_outcome !== undefined) patch.group_outcome = body.group_outcome
    if (body.final_placement !== undefined) patch.final_placement = body.final_placement

    const admin = adminClient()
    const { data, error } = await admin
      .from('tournaments')
      .update(patch)
      .eq('id', params.id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ tournament: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update tournament' }, { status: 500 })
  }
}

/**
 * DELETE /api/tournaments/[id]
 * Removes a tournament. Its games (matches), stats, and squad rows cascade
 * away via the ON DELETE CASCADE foreign keys.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const auth = await authorize(supabase)
    if ('error' in auth) return auth.error

    const admin = adminClient()
    const { error } = await admin.from('tournaments').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete tournament' }, { status: 500 })
  }
}
