import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
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

    if (!profile || (profile.role !== 'coach' && profile.role !== 'data_admin')) {
      return NextResponse.json(
        { error: 'Only coaches and data admins can record attendance' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { attendanceRecords } = body

    if (!attendanceRecords || !Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      return NextResponse.json(
        { error: 'Attendance records are required' },
        { status: 400 }
      )
    }

    // Use service role to bypass RLS
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

    // Validate attendance records - strict validation
    const validStatuses = ['P', 'A', 'X', 'I']
    
    // Log all records for debugging
    console.log('Received attendance records:', JSON.stringify(attendanceRecords, null, 2))
    
    // Filter and validate each record strictly
    const validatedRecords = attendanceRecords
      .map((r: any) => {
        // Check if all required fields exist
        if (!r.session_id || !r.player_id || !r.recorded_by) {
          console.error('Missing required fields:', r)
          return null
        }
        
        // Strictly check attendance_status - must be exactly one of the valid values
        const status = r.attendance_status
        if (!status || typeof status !== 'string' || status.trim() === '' || !validStatuses.includes(status)) {
          console.error('Invalid attendance_status:', status, 'in record:', r)
          return null
        }
        
        // Return validated record with only the fields we need
        return {
          session_id: String(r.session_id),
          player_id: String(r.player_id),
          attendance_status: status as 'P' | 'A' | 'X' | 'I',
          recorded_by: String(r.recorded_by),
        }
      })
      .filter((r: any): r is {
        session_id: string
        player_id: string
        attendance_status: 'P' | 'A' | 'X' | 'I'
        recorded_by: string
      } => r !== null)

    if (validatedRecords.length === 0) {
      console.error('No valid attendance records after validation')
      return NextResponse.json(
        { error: 'No valid attendance records. Each record must have session_id, player_id, recorded_by, and attendance_status must be one of: P, A, X, I' },
        { status: 400 }
      )
    }

    if (validatedRecords.length !== attendanceRecords.length) {
      console.warn(`Filtered out ${attendanceRecords.length - validatedRecords.length} invalid records`)
    }

    // Validate all player_ids exist
    const playerIds = [...new Set(validatedRecords.map((r) => r.player_id))]
    const { data: existingPlayers, error: playersError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id')
      .in('user_id', playerIds)
      .eq('role', 'player')

    if (playersError) {
      console.error('Error validating players:', playersError)
      return NextResponse.json(
        { error: `Failed to validate players: ${playersError.message}` },
        { status: 500 }
      )
    }

    if (existingPlayers && existingPlayers.length !== playerIds.length) {
      return NextResponse.json(
        { error: 'Some player IDs are invalid or do not exist' },
        { status: 400 }
      )
    }

    // Get session_id from first record
    const sessionId = validatedRecords[0]?.session_id
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Delete existing attendance for this session
    const { error: deleteError } = await supabaseAdmin
      .from('training_attendance')
      .delete()
      .eq('session_id', sessionId)

    if (deleteError) {
      console.error('Error deleting existing attendance:', deleteError)
      return NextResponse.json(
        { error: `Failed to clear existing attendance: ${deleteError.message}` },
        { status: 500 }
      )
    }

    // Insert new attendance records (using validated records)
    console.log('Inserting validated records:', JSON.stringify(validatedRecords, null, 2))
    const { data: insertedRecords, error: insertError } = await supabaseAdmin
      .from('training_attendance')
      .insert(validatedRecords)
      .select()

    if (insertError) {
      console.error('Error inserting attendance:', insertError)
      return NextResponse.json(
        { error: `Failed to save attendance: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: insertedRecords?.length || 0,
      records: insertedRecords || [],
    })
  } catch (error: any) {
    console.error('Save attendance API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

