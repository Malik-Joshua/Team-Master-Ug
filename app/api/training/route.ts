import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_date, session_time, location, description } = body

    // Validate required fields
    if (!session_date) {
      return NextResponse.json(
        { error: 'Session date is required' },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user profile to verify role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only coaches and admins can create training sessions' },
        { status: 403 }
      )
    }

    // Get the next session number for this coach
    const { data: existingSessions } = await supabase
      .from('training_sessions')
      .select('session_number')
      .eq('coach_id', authUser.id)
      .order('session_number', { ascending: false })
      .limit(1)

    const nextSessionNumber = existingSessions && existingSessions.length > 0 
      ? existingSessions[0].session_number + 1 
      : 1

    // Create the training session
    const { data: newSession, error: insertError } = await supabase
      .from('training_sessions')
      .insert({
        session_number: nextSessionNumber,
        session_date,
        session_time: session_time || null,
        location: location || null,
        description: description || null,
        coach_id: authUser.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating training session:', insertError)
      return NextResponse.json(
        { error: `Failed to create training session: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Training session created successfully',
      data: newSession,
    })
  } catch (error: any) {
    console.error('Training API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}


