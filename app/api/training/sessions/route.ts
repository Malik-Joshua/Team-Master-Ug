import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
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

    if (!profile || !['coach', 'asst_coach', 'data_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only coaches, assistant coaches, and team managers can create training sessions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { session_date, session_time, location, description } = body

    if (!session_date || !/^\d{4}-\d{2}-\d{2}$/.test(session_date)) {
      return NextResponse.json({ error: 'A valid training date is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: latestSession, error: numberError } = await supabaseAdmin
      .from('training_sessions')
      .select('session_number')
      .order('session_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (numberError) {
      return NextResponse.json(
        { error: `Failed to determine the next session number: ${numberError.message}` },
        { status: 500 }
      )
    }

    const { data: newSession, error: insertError } = await supabaseAdmin
      .from('training_sessions')
      .insert({
        session_number: (latestSession?.session_number || 0) + 1,
        session_date,
        session_time: session_time || null,
        location: location?.trim() || null,
        description: description?.trim() || null,
        coach_id: authUser.id,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to create training session: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, session: newSession }, { status: 201 })
  } catch (error: any) {
    console.error('Create training session error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    if (!profile || !['admin', 'coach', 'asst_coach'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only admins and coaches can delete training sessions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
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

    const { data: session, error: fetchError } = await supabaseAdmin
      .from('training_sessions')
      .select('id, coach_id')
      .eq('id', sessionId)
      .single()

    if (fetchError || !session) {
      return NextResponse.json(
        { error: 'Training session not found' },
        { status: 404 }
      )
    }

    // Same ownership rule for both — an assistant coach can only delete
    // their own sessions, not the Head Coach's (and vice versa). Only
    // admins can delete any session regardless of who created it.
    if ((profile.role === 'coach' || profile.role === 'asst_coach') && session.coach_id !== authUser.id) {
      return NextResponse.json(
        { error: 'Coaches can only delete their own training sessions' },
        { status: 403 }
      )
    }

    await supabaseAdmin
      .from('training_attendance')
      .delete()
      .eq('session_id', sessionId)

    const { error: deleteError } = await supabaseAdmin
      .from('training_sessions')
      .delete()
      .eq('id', sessionId)

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to delete training session: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete training session error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
