import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Roles that actually turn up to training and whose attendance is worth
// recording. Deliberately excludes 'player' (tracked in training_attendance),
// 'admin'/'finance_admin' (office roles, not on the pitch) and 'club_captain'
// (a flag-only shadow profile — the person is already listed as a player).
const TRAINING_STAFF_ROLES = ['coach', 'asst_coach', 'physio', 'data_admin']

const VIEW_ROLES = ['admin', 'coach', 'asst_coach', 'data_admin', 'physio']
const WRITE_ROLES = ['admin', 'coach', 'asst_coach', 'data_admin']

// Postgres/PostgREST codes meaning "training_staff_attendance doesn't exist
// yet" — i.e. migration 060 hasn't been run. Surfaced to the client as
// tableMissing so the UI degrades instead of erroring.
const MISSING_TABLE_CODES = ['PGRST205', '42P01']

function isMissingTable(error: any) {
  return !!error && (MISSING_TABLE_CODES.includes(error.code) || /training_staff_attendance/.test(error.message || ''))
}

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createServiceClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function resolveProfile(allowedRoles: string[]) {
  const supabase = await createClient()
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', authUser.id)
    .single()

  if (!profile || !allowedRoles.includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  }

  return { authUser, profile }
}

export async function GET(request: NextRequest) {
  try {
    const { error: authFailure, authUser } = await resolveProfile(VIEW_ROLES) as any
    if (authFailure) return authFailure

    const sessionId = request.nextUrl.searchParams.get('sessionId')

    const supabaseAdmin = getServiceClient()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { data: staff, error: staffError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, name, role')
      .in('role', TRAINING_STAFF_ROLES)
      .order('name', { ascending: true })

    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 500 })
    }

    // No session picked yet: caller just wants the roster to render checkboxes.
    if (!sessionId) {
      return NextResponse.json({ staff: staff || [], attendance: {} })
    }

    const { data: rows, error: attendanceError } = await supabaseAdmin
      .from('training_staff_attendance')
      .select('staff_id, attendance_status')
      .eq('session_id', sessionId)

    if (attendanceError) {
      if (isMissingTable(attendanceError)) {
        return NextResponse.json({ staff: staff || [], attendance: {}, tableMissing: true })
      }
      return NextResponse.json({ error: attendanceError.message }, { status: 500 })
    }

    const attendance: Record<string, string> = {}
    rows?.forEach((row: any) => {
      attendance[row.staff_id] = row.attendance_status
    })

    return NextResponse.json({ staff: staff || [], attendance })
  } catch (error: any) {
    console.error('Error in GET training staff attendance:', error)
    return NextResponse.json({ error: error.message || 'Failed to load staff attendance' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authFailure, authUser } = await resolveProfile(WRITE_ROLES) as any
    if (authFailure) return authFailure

    const body = await request.json()
    const { sessionId, records } = body as {
      sessionId?: string
      records?: { staff_id: string; attendance_status: string }[]
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const validRecords = (records || []).filter(
      (r) => r && r.staff_id && (r.attendance_status === 'P' || r.attendance_status === 'A')
    )

    if (validRecords.length === 0) {
      return NextResponse.json({ success: true, count: 0 })
    }

    const supabaseAdmin = getServiceClient()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const payload = validRecords.map((r) => ({
      session_id: sessionId,
      staff_id: r.staff_id,
      attendance_status: r.attendance_status,
      recorded_by: authUser.id,
      updated_at: new Date().toISOString(),
    }))

    const { error: upsertError } = await supabaseAdmin
      .from('training_staff_attendance')
      .upsert(payload, { onConflict: 'session_id,staff_id' })

    if (upsertError) {
      if (isMissingTable(upsertError)) {
        return NextResponse.json({ error: 'Staff attendance table not set up yet', tableMissing: true }, { status: 503 })
      }
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: payload.length })
  } catch (error: any) {
    console.error('Error in POST training staff attendance:', error)
    return NextResponse.json({ error: error.message || 'Failed to save staff attendance' }, { status: 500 })
  }
}
