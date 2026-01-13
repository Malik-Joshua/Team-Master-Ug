import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// PUT - Update a performance resource
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (Next.js 15 compatibility)
    const resolvedParams = params instanceof Promise ? await params : params
    const resourceId = resolvedParams.id

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

    if (!profile || (profile.role !== 'admin' && profile.role !== 'coach' && profile.role !== 'club_captain')) {
      return NextResponse.json(
        { error: 'Only admins, coaches, and club captains can update performance resources' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, description, resource_type, content, attachment_url, links, is_active } = body

    // Validate resource_type if provided
    if (resource_type && !['diet_plan', 'gym_programme', 'play_info', 'position_info'].includes(resource_type)) {
      return NextResponse.json(
        { error: 'Invalid resource type' },
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

    // Build update object
    const updateData: any = {}
    
    // Process links: use links array if provided, otherwise convert attachment_url to links format
    if (links !== undefined) {
      if (Array.isArray(links) && links.length > 0) {
        // Filter out empty links
        const processedLinks = links.filter((link: any) => link.url && link.url.trim() !== '')
        updateData.links = processedLinks
      } else if (attachment_url && attachment_url.trim() !== '') {
        // Backward compatibility: convert single attachment_url to links array
        updateData.links = [{ url: attachment_url, label: 'Attachment' }]
      } else {
        updateData.links = []
      }
    }
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (resource_type !== undefined) updateData.resource_type = resource_type
    if (content !== undefined) updateData.content = content
    if (attachment_url !== undefined) updateData.attachment_url = attachment_url
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: updatedResource, error: updateError } = await supabaseAdmin
      .from('performance_resources')
      .update(updateData)
      .eq('id', resourceId)
      .select('*, created_by_profile:user_profiles!created_by(name, role)')
      .single()

    if (updateError) {
      console.error('Error updating performance resource:', updateError)
      return NextResponse.json(
        { error: `Failed to update resource: ${updateError.message}` },
        { status: 500 }
      )
    }

    if (!updatedResource) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      resource: updatedResource,
    })
  } catch (error: any) {
    console.error('Update performance resource API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a performance resource
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (Next.js 15 compatibility)
    const resolvedParams = params instanceof Promise ? await params : params
    const resourceId = resolvedParams.id

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

    if (!profile || (profile.role !== 'admin' && profile.role !== 'coach' && profile.role !== 'club_captain')) {
      return NextResponse.json(
        { error: 'Only admins, coaches, and club captains can delete performance resources' },
        { status: 403 }
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

    const { error: deleteError } = await supabaseAdmin
      .from('performance_resources')
      .delete()
      .eq('id', resourceId)

    if (deleteError) {
      console.error('Error deleting performance resource:', deleteError)
      return NextResponse.json(
        { error: `Failed to delete resource: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Resource deleted successfully',
    })
  } catch (error: any) {
    console.error('Delete performance resource API error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

