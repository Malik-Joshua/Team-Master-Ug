import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Uploads a club badge to the public `club-assets` bucket using the service
// role (bypasses storage RLS) and returns the public URL.
export async function POST(request: NextRequest) {
  try {
    // Must be an authenticated user
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Basic validation
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const admin = createServiceClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `badges/${authUser.id}-${Date.now()}.${ext}`
    const bytes = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from('club-assets')
      .upload(path, bytes, { upsert: true, contentType: file.type })

    if (uploadError) {
      console.error('[upload-badge] upload error:', uploadError)
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from('club-assets').getPublicUrl(path)
    const publicUrl = urlData.publicUrl

    // Optionally persist the logo to the club immediately (admin only).
    // Onboarding does its own club_settings write, so it omits `persist`.
    const persist = formData.get('persist') === 'true'
    if (persist) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', authUser.id)
        .single()
      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Only admins can change the club logo' }, { status: 403 })
      }
      // Update the active (latest-updated) club row so the new logo shows app-wide.
      const { data: rows } = await admin
        .from('club_settings')
        .select('id')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
      if (rows && rows[0]) {
        await admin
          .from('club_settings')
          .update({ badge_url: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', rows[0].id)
      } else {
        await admin
          .from('club_settings')
          .upsert({ admin_user_id: authUser.id, badge_url: publicUrl, updated_at: new Date().toISOString() }, { onConflict: 'admin_user_id' })
      }
    }

    return NextResponse.json({ url: publicUrl })
  } catch (error: any) {
    console.error('[upload-badge] error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
