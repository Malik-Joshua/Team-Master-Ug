import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// GET - Fetch performance resources
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

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const resourceType = searchParams.get('type') // Optional filter by type
    const includeInactive = profile.role === 'admin' || profile.role === 'coach'

    // Build query
    let query = supabase
      .from('performance_resources')
      .select('*, created_by_profile:user_profiles!created_by(name, role)')
      .order('created_at', { ascending: false })

    // Apply filters
    if (resourceType) {
      query = query.eq('resource_type', resourceType)
    }

    // Players can only see active resources
    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data: resources, error } = await query

    if (error) {
      console.error('Error fetching performance resources:', error)
      return NextResponse.json(
        { error: 'Failed to fetch performance resources' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      resources: resources || [],
    })
  } catch (error: any) {
    console.error('Performance resources API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST - Create a new performance resource
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

    if (!profile || (profile.role !== 'admin' && profile.role !== 'coach')) {
      return NextResponse.json(
        { error: 'Only admins and coaches can create performance resources' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, description, resource_type, content, attachment_url, is_active } = body

    // Validate required fields
    if (!title || !resource_type || !content) {
      return NextResponse.json(
        { error: 'Title, resource type, and content are required' },
        { status: 400 }
      )
    }

    if (!['diet_plan', 'gym_programme', 'play_info', 'position_info'].includes(resource_type)) {
      return NextResponse.json(
        { error: 'Invalid resource type' },
        { status: 400 }
      )
    }

    // Use service role to bypass RLS for insertion
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

    const { data: newResource, error: insertError } = await supabaseAdmin
      .from('performance_resources')
      .insert({
        title,
        description: description || null,
        resource_type,
        content,
        attachment_url: attachment_url || null,
        created_by: authUser.id,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select('*, created_by_profile:user_profiles!created_by(name, role)')
      .single()

    if (insertError) {
      console.error('Error creating performance resource:', insertError)
      return NextResponse.json(
        { error: `Failed to create resource: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      resource: newResource,
    })
  } catch (error: any) {
    console.error('Create performance resource API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

