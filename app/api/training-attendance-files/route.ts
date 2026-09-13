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

    const enriched = (files ?? []).map((f: any) => ({
      ...f,
      uploader_name: f.uploaded_by ? (uploaderMap[f.uploaded_by] ?? null) : null,
      // Normalise session shape so the UI can use f.session?.title / f.session?.date
      session: f.session
        ? { title: f.session.description, date: f.session.session_date }
        : null,
    }))

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
    const { session_id, file_name } = body

    if (!file_name) return NextResponse.json({ error: 'file_name is required' }, { status: 400 })

    const supabaseAdmin = await getAdminClient()

    const { data, error } = await supabaseAdmin
      .from('training_attendance_files')
      .insert({
        session_id: session_id || null,
        file_name,
        uploaded_by: authUser.id,
      })
      .select()
      .single()

    if (error) {
      console.error('training_attendance_files insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, file: data })
  } catch (error: any) {
    console.error('POST training-attendance-files error:', error)
    return NextResponse.json({ error: error.message || 'Failed to save' }, { status: 500 })
  }
}
