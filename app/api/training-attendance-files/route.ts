import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['admin', 'coach', 'asst_coach', 'data_admin', 'finance_admin']

async function getAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET — return all training attendance file records (shared across accounts)
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('user_id', authUser.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const supabaseAdmin = await getAdminClient()

    // Fetch files + linked session title/date
    const { data: files, error } = await supabaseAdmin
      .from('training_attendance_files')
      .select('*, session:training_sessions(description, session_date)')
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('training_attendance_files fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch uploader names separately (uploaded_by → user_profiles.user_id)
    const uploaderIds = [...new Set(
      (files ?? []).map((f: any) => f.uploaded_by).filter(Boolean)
    )] as string[]

    let uploaderMap: Record<string, string> = {}
    if (uploaderIds.length > 0) {
      const { data: uploaders } = await supabaseAdmin
        .from('user_profiles').select('user_id, name').in('user_id', uploaderIds)
      uploaders?.forEach((u: any) => { uploaderMap[u.user_id] = u.name })
    }

    // Legacy records (uploaded before content storage existed) have no `rows`.
    // Rebuild a viewable table from the attendance actually saved for that
    // session so the archive is never a dead end.
    const legacySessionIds = [...new Set(
      (files ?? [])
        .filter((f: any) => f.session_id && !(Array.isArray(f.rows) && f.rows.length))
        .map((f: any) => f.session_id)
    )] as string[]

    const rebuiltRows: Record<string, string[][]> = {}
    if (legacySessionIds.length > 0) {
      const { data: attendance } = await supabaseAdmin
        .from('training_attendance')
        .select('session_id, player_id, attendance_status, notes')
        .in('session_id', legacySessionIds)

      const playerIds = [...new Set((attendance ?? []).map((a: any) => a.player_id))] as string[]
      const nameMap: Record<string, string> = {}
      if (playerIds.length > 0) {
        const { data: players } = await supabaseAdmin
          .from('user_profiles').select('user_id, name').in('user_id', playerIds)
        players?.forEach((p: any) => { nameMap[p.user_id] = p.name })
      }

      const statusLabel: Record<string, string> = {
        P: 'P — Present', A: 'A — Justified Absence', X: 'X — Unjustified Absence', I: 'I — Injured',
      }
      for (const a of attendance ?? []) {
        if (!rebuiltRows[a.session_id]) rebuiltRows[a.session_id] = [['Player', 'Status', 'Notes']]
        rebuiltRows[a.session_id].push([
          nameMap[a.player_id] ?? 'Unknown player',
          statusLabel[a.attendance_status] ?? a.attendance_status,
          a.notes ?? '',
        ])
      }
      // Sort players alphabetically beneath the header row
      for (const id of Object.keys(rebuiltRows)) {
        const [header, ...body] = rebuiltRows[id]
        body.sort((x, y) => x[0].localeCompare(y[0]))
        rebuiltRows[id] = [header, ...body]
      }
    }

    const enriched = (files ?? []).map((f: any) => {
      const hasStoredRows = Array.isArray(f.rows) && f.rows.length > 0
      const rebuilt = !hasStoredRows && f.session_id ? rebuiltRows[f.session_id] : undefined
      return {
        ...f,
        rows: hasStoredRows ? f.rows : (rebuilt ?? null),
        rows_rebuilt: !hasStoredRows && !!rebuilt,
        uploader_name: f.uploaded_by ? (uploaderMap[f.uploaded_by] ?? null) : null,
        // Normalise session shape so the UI can use f.session?.title / f.session?.date
        session: f.session
          ? { title: f.session.description, date: f.session.session_date }
          : null,
      }
    })

    return NextResponse.json({ files: enriched })
  } catch (error: any) {
    console.error('GET training-attendance-files error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch' }, { status: 500 })
  }
}

// POST — record a file upload after attendance is saved
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('user_id', authUser.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await request.json()
    const { session_id, file_name, rows } = body

    if (!session_id) return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
    if (!file_name) return NextResponse.json({ error: 'file_name is required' }, { status: 400 })
    if (rows !== undefined && (!Array.isArray(rows) || rows.length > 300)) {
      return NextResponse.json({ error: 'rows must be an array containing at most 300 rows' }, { status: 400 })
    }

    const supabaseAdmin = await getAdminClient()

    // One shared archive record per session. Retrying users may update their own
    // record, but another account cannot replace the original uploader.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('training_attendance_files')
      .select('*')
      .eq('session_id', session_id)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (existing && existing.uploaded_by !== authUser.id) {
      return NextResponse.json(
        { error: 'A file has already been recorded for this session', file: existing },
        { status: 409 }
      )
    }

    const baseFileValues = {
      session_id,
      file_name,
      uploaded_by: authUser.id,
      uploaded_at: new Date().toISOString(),
    }
    const fileValues = {
      ...baseFileValues,
      rows: Array.isArray(rows) ? rows.slice(0, 300) : null,
    }

    const saveFileRecord = async (values: typeof fileValues | typeof baseFileValues) => {
      const query = existing
        ? supabaseAdmin.from('training_attendance_files').update(values).eq('id', existing.id)
        : supabaseAdmin.from('training_attendance_files').insert(values)
      return query.select().single()
    }

    let result = await saveFileRecord(fileValues)

    // Migration 056 adds `rows`. Keep attendance uploads functional while that
    // migration is pending or while Supabase is refreshing its schema cache.
    if (
      result.error &&
      (result.error.code === 'PGRST204' || result.error.message.includes("'rows' column"))
    ) {
      console.warn('training_attendance_files.rows is unavailable; saving metadata only')
      result = await saveFileRecord(baseFileValues)
    }

    if (result.error) {
      console.error('training_attendance_files save error:', result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, file: result.data })
  } catch (error: any) {
    console.error('POST training-attendance-files error:', error)
    return NextResponse.json({ error: error.message || 'Failed to save' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('user_id', authUser.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.role))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const supabaseAdmin = await getAdminClient()

    const { data: existing } = await supabaseAdmin
      .from('training_attendance_files')
      .select('uploaded_by')
      .eq('id', id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    if (existing.uploaded_by !== authUser.id && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Only the uploader or an admin can delete this file' }, { status: 403 })
    }

    const { error: deleteError } = await supabaseAdmin
      .from('training_attendance_files')
      .delete()
      .eq('id', id)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE training-attendance-files error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete' }, { status: 500 })
  }
}
