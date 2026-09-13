import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
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

    if (!profile || !['admin', 'coach', 'asst_coach', 'data_admin', 'finance_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Fetch files + linked session info.
    // Do NOT try to join user_profiles via the uploaded_by FK — that FK points
    // to auth.users, not user_profiles, so PostgREST can't traverse it.
    // We fetch uploader names in a separate query below.
    const { data: files, error } = await supabaseAdmin
      .from('gym_metric_files')
      .select('*, session:gym_schedules(description, schedule_date)')
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('gym_metric_files fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch uploader names from user_profiles (uploaded_by = user_profiles.user_id)
    const uploaderIds = [...new Set(
      (files ?? []).map((f: any) => f.uploaded_by).filter(Boolean)
    )] as string[]

    let uploaderMap: Record<string, string> = {}
    if (uploaderIds.length > 0) {
      const { data: uploaders } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, name')
        .in('user_id', uploaderIds)
      uploaders?.forEach((u: any) => { uploaderMap[u.user_id] = u.name })
    }

    // Generate signed download URLs (only when storage_path is set)
    const filesWithUrls = await Promise.all(
      (files ?? []).map(async (f: any) => {
        let download_url: string | null = null
        if (f.storage_path) {
          try {
            const { data: urlData } = await supabaseAdmin.storage
              .from('gym-metric-files')
              .createSignedUrl(f.storage_path, 3600)
            download_url = urlData?.signedUrl ?? null
          } catch {
            // Non-fatal — just skip the download link
          }
        }
        return {
          ...f,
          download_url,
          uploader: f.uploaded_by
            ? { name: uploaderMap[f.uploaded_by] ?? null }
            : null,
        }
      })
    )

    return NextResponse.json({ files: filesWithUrls })
  } catch (error: any) {
    console.error('Error in GET gym-metric-files:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch metric files' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    if (!profile || !['admin', 'coach', 'asst_coach', 'data_admin', 'finance_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Only the uploader or an admin may delete
    const { data: existing } = await supabaseAdmin
      .from('gym_metric_files')
      .select('uploaded_by, storage_path')
      .eq('id', id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    if (existing.uploaded_by !== authUser.id && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Only the uploader or an admin can delete this file' }, { status: 403 })
    }

    // Remove from storage bucket if a path was recorded
    if (existing.storage_path) {
      await supabaseAdmin.storage.from('gym-metric-files').remove([existing.storage_path])
    }

    const { error: deleteError } = await supabaseAdmin
      .from('gym_metric_files')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE gym-metric-files:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete' }, { status: 500 })
  }
}
