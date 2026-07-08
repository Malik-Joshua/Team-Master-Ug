import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/** Staff roles (non-player) */
const STAFF_ROLES = ['admin', 'coach', 'data_admin', 'finance_admin', 'physio', 'club_captain']

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data: staff, error } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, name, email, role, status')
      .in('role', STAFF_ROLES)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching staff:', error)
      return NextResponse.json(
        { error: `Failed to fetch staff: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      staff: staff || [],
      count: staff?.length || 0
    })
  } catch (error: any) {
    console.error('Staff API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { userId, action } = body

    if (!userId || !['suspend', 'fire', 'reinstate'].includes(action)) {
      return NextResponse.json({ error: 'Invalid userId or action' }, { status: 400 })
    }

    if (userId === authUser.id) {
      return NextResponse.json({ error: 'You cannot perform this action on your own account' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // DB check constraint only allows 'active' and 'inactive'
    const newDbStatus = action === 'reinstate' ? 'active' : 'inactive'

    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ status: newDbStatus })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Status update error:', updateError)
      return NextResponse.json({ error: `Failed to update status: ${updateError.message}` }, { status: 500 })
    }

    // Notify the staff member (best-effort, non-fatal)
    const notifTitles: Record<string, string> = {
      suspend: 'Account Suspended',
      fire: 'Account Terminated',
      reinstate: 'Account Reinstated',
    }
    const notifMessages: Record<string, string> = {
      suspend: 'Your account has been suspended by the admin.',
      fire: 'Your account has been terminated. You no longer have access to the system.',
      reinstate: 'Your account has been reinstated. You can now log in again.',
    }
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        title: notifTitles[action],
        message: notifMessages[action],
        type: action === 'reinstate' ? 'success' : 'warning',
      })
    } catch (notifErr) {
      console.error('Notification insert error (non-fatal):', notifErr)
    }

    // Return display status so the UI can show Suspended/Fired/Active
    const displayStatus = action === 'suspend' ? 'suspended' : action === 'fire' ? 'fired' : 'active'
    return NextResponse.json({ success: true, status: displayStatus })
  } catch (error: any) {
    console.error('Staff PATCH error:', error)
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 })
  }
}
