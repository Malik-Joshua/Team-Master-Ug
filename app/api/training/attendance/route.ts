import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { isActivityPast } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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

    if (!profile || !['admin', 'coach', 'data_admin', 'club_captain'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin, Coach, Data Admin, or Club Captain access required' },
        { status: 403 }
      )
    }

    // Get session_id from query params
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id is required' },
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

    // Fetch attendance for the session
    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from('training_attendance')
      .select('attendance_status')
      .eq('session_id', sessionId)

    if (attendanceError) {
      console.error('Error fetching attendance:', attendanceError)
      return NextResponse.json(
        { error: `Failed to fetch attendance: ${attendanceError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      attendance: attendance || [],
      count: attendance?.length || 0,
    })
  } catch (error: any) {
    console.error('Get attendance API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

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
        // Trim whitespace and convert to uppercase to handle any case variations
        const status = typeof r.attendance_status === 'string' 
          ? r.attendance_status.trim().toUpperCase() 
          : null
        
        // Validate the trimmed status
        if (!status || status === '' || !validStatuses.includes(status)) {
          console.error('Invalid attendance_status:', r.attendance_status, '(trimmed:', status, ') in record:', r)
          return null
        }
        
        // Ensure status is exactly one of the valid values (TypeScript type assertion)
        const validStatus: 'P' | 'A' | 'X' | 'I' = status as 'P' | 'A' | 'X' | 'I'
        
        // Return validated record with only the fields we need
        return {
          session_id: String(r.session_id),
          player_id: String(r.player_id),
          attendance_status: validStatus,
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

    // Validate all player_ids exist in the players table (not just user_profiles)
    const playerIds = [...new Set(validatedRecords.map((r) => r.player_id))]
    
    // First check if they exist in user_profiles with role 'player'
    const { data: existingUserProfiles, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id')
      .in('user_id', playerIds)
      .eq('role', 'player')

    if (profilesError) {
      console.error('Error validating user profiles:', profilesError)
      return NextResponse.json(
        { error: `Failed to validate user profiles: ${profilesError.message}` },
        { status: 500 }
      )
    }

    // Then check if they exist in the players table (required for foreign key)
    const { data: existingPlayers, error: playersError } = await supabaseAdmin
      .from('players')
      .select('user_id')
      .in('user_id', playerIds)

    if (playersError) {
      console.error('Error validating players:', playersError)
      return NextResponse.json(
        { error: `Failed to validate players: ${playersError.message}` },
        { status: 500 }
      )
    }

    const existingPlayerIds = new Set(existingPlayers?.map(p => p.user_id) || [])
    const missingPlayerIds = playerIds.filter(id => !existingPlayerIds.has(id))

    if (missingPlayerIds.length > 0) {
      console.error('Some player IDs do not exist in players table:', missingPlayerIds)
      return NextResponse.json(
        { 
          error: `Some players are not registered in the players table. Missing player IDs: ${missingPlayerIds.join(', ')}`,
          missingPlayerIds 
        },
        { status: 400 }
      )
    }

    // Also check if user_profiles match
    const existingProfileIds = new Set(existingUserProfiles?.map(p => p.user_id) || [])
    const missingProfileIds = playerIds.filter(id => !existingProfileIds.has(id))

    if (missingProfileIds.length > 0) {
      console.warn('Some player IDs do not have user_profiles with role player:', missingProfileIds)
      // This is a warning, not an error, as the foreign key is on players table
    }

    // Get session_id from first record
    const sessionId = validatedRecords[0]?.session_id
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Validate that the training session hasn't passed its scheduled time
    const { data: trainingSession, error: sessionError } = await supabaseAdmin
      .from('training_sessions')
      .select('session_date, session_time, status')
      .eq('id', sessionId)
      .single()

    if (sessionError) {
      console.error('Error fetching training session:', sessionError)
      return NextResponse.json(
        { error: `Failed to fetch training session: ${sessionError.message}` },
        { status: 500 }
      )
    }

    if (!trainingSession) {
      return NextResponse.json(
        { error: 'Training session not found' },
        { status: 404 }
      )
    }

    // Check if the session time has passed
    if (isActivityPast(trainingSession.session_date, trainingSession.session_time || null)) {
      // If session is already marked as completed, allow attendance entry (for historical records)
      if (trainingSession.status === 'completed') {
        // Allow attendance entry for completed sessions (historical data entry)
        // But warn the user
        console.log('Recording attendance for past training session:', sessionId)
      } else {
        // If session time has passed but not marked as completed, mark it first
        await supabaseAdmin
          .from('training_sessions')
          .update({ status: 'completed' })
          .eq('id', sessionId)
      }
    } else {
      // Session hasn't occurred yet - prevent attendance entry
      return NextResponse.json(
        { 
          error: 'Cannot record attendance for a training session that has not yet occurred. The session is scheduled for a future date/time.',
          session_date: trainingSession.session_date,
          session_time: trainingSession.session_time
        },
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

    // Final validation pass - ensure every record has valid attendance_status
    const finalValidatedRecords = validatedRecords
      .map((r) => {
        // Double-check the status is valid
        if (!r.attendance_status || typeof r.attendance_status !== 'string') {
          console.error('Final validation failed - invalid status type:', r)
          return null
        }
        
        // Trim and normalize - remove all whitespace including non-breaking spaces
        const rawStatus = r.attendance_status
        const status = rawStatus.replace(/[\s\u00A0\u2000-\u200B\u2028\u2029]/g, '').toUpperCase()
        
        // Log the raw and normalized values for debugging
        console.log('Status validation:', {
          raw: JSON.stringify(rawStatus),
          rawLength: rawStatus.length,
          normalized: JSON.stringify(status),
          normalizedLength: status.length,
          isValid: validStatuses.includes(status)
        })
        
        if (!status || status === '' || !validStatuses.includes(status)) {
          console.error('Final validation failed - invalid status value:', {
            raw: JSON.stringify(rawStatus),
            normalized: JSON.stringify(status),
            validStatuses,
            record: r
          })
          return null
        }
        
        // Ensure all required fields are present and valid
        if (!r.session_id || !r.player_id || !r.recorded_by) {
          console.error('Final validation failed - missing required fields:', r)
          return null
        }
        
        // Use explicit string matching to ensure exact value - use string literals
        let finalStatus: 'P' | 'A' | 'X' | 'I'
        if (status === 'P') finalStatus = 'P' as const
        else if (status === 'A') finalStatus = 'A' as const
        else if (status === 'X') finalStatus = 'X' as const
        else if (status === 'I') finalStatus = 'I' as const
        else {
          console.error('Status mapping failed:', status, 'char codes:', Array.from(status).map(c => c.charCodeAt(0)))
          return null
        }
        
        // Create record with explicit string values
        const record = {
          session_id: String(r.session_id),
          player_id: String(r.player_id),
          attendance_status: finalStatus,
          recorded_by: String(r.recorded_by),
        }
        
        // Final sanity check - ensure attendance_status is exactly one of the valid values
        if (record.attendance_status !== 'P' && record.attendance_status !== 'A' && 
            record.attendance_status !== 'X' && record.attendance_status !== 'I') {
          console.error('Final sanity check failed - invalid status in record:', record)
          return null
        }
        
        return record
      })
      .filter((r): r is {
        session_id: string
        player_id: string
        attendance_status: 'P' | 'A' | 'X' | 'I'
        recorded_by: string
      } => r !== null)

    if (finalValidatedRecords.length === 0) {
      console.error('No valid records after final validation')
      return NextResponse.json(
        { error: 'No valid attendance records after final validation' },
        { status: 400 }
      )
    }

    // Insert new attendance records (using final validated records)
    console.log('Inserting final validated records:', JSON.stringify(finalValidatedRecords, null, 2))
    
    // Log each record's attendance_status with character codes for debugging
    finalValidatedRecords.forEach((r, idx) => {
      const statusChars = Array.from(r.attendance_status).map(c => `${c} (${c.charCodeAt(0)})`).join(', ')
      console.log(`Record ${idx}: attendance_status = "${r.attendance_status}" (chars: ${statusChars}, length: ${r.attendance_status.length})`)
    })
    
    // Try inserting records one by one to identify which one fails
    const insertedRecords: any[] = []
    const errors: any[] = []
    
    for (let i = 0; i < finalValidatedRecords.length; i++) {
      const record = finalValidatedRecords[i]
      console.log(`Inserting record ${i + 1}/${finalValidatedRecords.length}:`, JSON.stringify(record))
      
      // Double-check the status one more time
      if (record.attendance_status !== 'P' && record.attendance_status !== 'A' && 
          record.attendance_status !== 'X' && record.attendance_status !== 'I') {
        console.error(`Record ${i} has invalid status:`, record.attendance_status)
        errors.push({ index: i, record, error: 'Invalid attendance_status' })
        continue
      }
      
      const { data, error } = await supabaseAdmin
        .from('training_attendance')
        .insert([record])
        .select()
      
      if (error) {
        console.error(`Error inserting record ${i}:`, error)
        errors.push({ index: i, record, error })
      } else if (data && data.length > 0) {
        insertedRecords.push(...data)
        console.log(`Successfully inserted record ${i}`)
      }
    }
    
    if (errors.length > 0) {
      console.error('Errors during batch insert:', errors)
      return NextResponse.json(
        { 
          error: `Failed to save some attendance records. ${errors.length} record(s) failed.`,
          details: errors.map(e => ({
            index: e.index,
            error: e.error.message || e.error,
            record: e.record
          }))
        },
        { status: 500 }
      )
    }
    
    const insertError = errors.length > 0 ? errors[0].error : null

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

