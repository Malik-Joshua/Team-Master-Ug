import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// GET - Fetch gym schedules
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

    const { data: schedules, error } = await supabaseAdmin
      .from('gym_schedules')
      .select(`
        *,
        coach:user_profiles!gym_schedules_created_by_fkey(name)
      `)
      .order('schedule_date', { ascending: true })

    if (error) {
      console.error('Error fetching gym schedules:', error)
      return NextResponse.json(
        { error: `Failed to fetch gym schedules: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      schedules: schedules || [],
      count: schedules?.length || 0
    })
  } catch (error: any) {
    console.error('Gym schedules API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST - Create gym schedule
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
      .select('role, name')
      .eq('user_id', authUser.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Only coaches and admins can create gym schedules
    if (!['coach', 'asst_coach', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only coaches and admins can create gym schedules' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { schedule_date, schedule_time, location, description, exercises } = body

    // Validate required fields
    if (!schedule_date || !description) {
      return NextResponse.json(
        { error: 'Schedule date and description are required' },
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

    // Create the gym schedule
    const { data: newSchedule, error: insertError } = await supabaseAdmin
      .from('gym_schedules')
      .insert({
        schedule_date,
        schedule_time: schedule_time || null,
        location: location || null,
        description,
        exercises: exercises || null,
        created_by: authUser.id,
      })
      .select(`
        *,
        coach:user_profiles!gym_schedules_created_by_fkey(name)
      `)
      .single()

    if (insertError) {
      console.error('Error creating gym schedule:', insertError)
      
      // If table doesn't exist, provide helpful error message
      if (insertError.code === 'PGRST205' || insertError.message.includes('Could not find the table')) {
        return NextResponse.json(
          { 
            error: 'Gym schedules table does not exist. Please run the migration 020_create_gym_schedules.sql in your Supabase SQL Editor.',
            code: 'TABLE_NOT_FOUND',
            migration_file: 'supabase/migrations/020_create_gym_schedules.sql'
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: `Failed to create gym schedule: ${insertError.message}` },
        { status: 500 }
      )
    }

    // Create notifications for players, data managers, and admins about the new gym schedule
    try {
      const { data: allUsers } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id')
        .in('role', ['player', 'data_admin', 'admin'])
        .neq('user_id', authUser.id)

      if (allUsers && allUsers.length > 0) {
        const { db } = await import('@/lib/db-helpers')
        const notificationPromises = allUsers.map((user) =>
          db.createNotification({
            user_id: user.user_id,
            title: 'New Gym Schedule',
            message: `${profile.name} has created a new gym schedule for ${new Date(schedule_date).toLocaleDateString()}`,
            type: 'info',
            action_url: '/training',
            reference_id: newSchedule.id,
            reference_type: 'gym_schedule',
          })
        )

        await Promise.all(notificationPromises)
        console.log(`Notifications created for ${allUsers.length} user(s) about new gym schedule`)
      }
    } catch (notifError) {
      console.error('Error creating notifications for gym schedule:', notifError)
      // Don't fail the request if notification creation fails
    }

    return NextResponse.json({
      success: true,
      schedule: newSchedule
    })
  } catch (error: any) {
    console.error('Create gym schedule API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// PUT - Update gym schedule
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('user_id', authUser.id).single()
    if (!profile || (!['coach', 'asst_coach', 'admin'].includes(profile.role))) {
      return NextResponse.json({ error: 'Only coaches and admins can edit gym schedules' }, { status: 403 })
    }

    const body = await request.json()
    const { id, schedule_date, schedule_time, location, description, exercises } = body
    if (!id || !schedule_date || !description) {
      return NextResponse.json({ error: 'id, schedule_date and description are required' }, { status: 400 })
    }

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseAdmin
      .from('gym_schedules')
      .update({ schedule_date, schedule_time: schedule_time || null, location: location || null, description, exercises: exercises || null })
      .eq('id', id)
      .select('*, coach:user_profiles!gym_schedules_created_by_fkey(name)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, schedule: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 })
  }
}

// DELETE - Delete gym schedule
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('user_id', authUser.id).single()
    if (!profile || (!['coach', 'asst_coach', 'admin'].includes(profile.role))) {
      return NextResponse.json({ error: 'Only coaches and admins can delete gym schedules' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400 })

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await supabaseAdmin.from('gym_schedules').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 })
  }
}
