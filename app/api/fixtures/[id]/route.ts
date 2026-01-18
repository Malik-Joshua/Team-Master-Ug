import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params.id
    if (!matchId) {
      return NextResponse.json({ error: 'Match ID is required' }, { status: 400 })
    }

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

    if (!profile || !['data_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: deleted, error: deleteError } = await supabaseAdmin
      .from('matches')
      .delete()
      .eq('id', matchId)
      .select('id')
      .single()

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, match: deleted })
  } catch (error: any) {
    console.error('Error deleting fixture:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete fixture' }, { status: 500 })
  }
}
