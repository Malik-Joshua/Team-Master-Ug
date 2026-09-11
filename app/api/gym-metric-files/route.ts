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

    const { data: files, error } = await supabaseAdmin
      .from('gym_metric_files')
      .select('*, session:gym_schedules(description, schedule_date), uploader:user_profiles!gym_metric_files_uploaded_by_fkey(name)')
      .order('uploaded_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Generate signed URLs for each file (valid 1 hour)
    const filesWithUrls = await Promise.all(
      (files ?? []).map(async (f: any) => {
        const { data: urlData } = await supabaseAdmin.storage
          .from('gym-metric-files')
          .createSignedUrl(f.storage_path, 3600)
        return { ...f, download_url: urlData?.signedUrl ?? null }
      })
    )

    return NextResponse.json({ files: filesWithUrls })
  } catch (error: any) {
    console.error('Error fetching gym metric files:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch metric files' },
      { status: 500 }
    )
  }
}
