import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Update user's own profile
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, phone, emergency_contact, emergency_phone, birth_date } = body

    // Use service role to bypass RLS for profile updates
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

    // Try using the stored procedure first (bypasses schema cache)
    // This function handles birth_date updates even if schema cache hasn't refreshed
    // Pass null for fields that shouldn't be updated, actual values (including empty string) for fields to update
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('update_user_profile', {
      p_user_id: authUser.id,
      p_name: name !== undefined ? name : null,
      p_phone: phone !== undefined ? phone : null,
      p_emergency_contact: emergency_contact !== undefined ? emergency_contact : null,
      p_emergency_phone: emergency_phone !== undefined ? emergency_phone : null,
      p_birth_date: birth_date !== undefined ? (birth_date || null) : null,
    })

    // If RPC works, use that result
    if (!rpcError && rpcResult && rpcResult.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Profile updated successfully',
        data: rpcResult[0]
      })
    }

    // Fallback to direct update if RPC doesn't exist or fails
    // Build update data object (only include provided fields)
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone || null
    if (emergency_contact !== undefined) updateData.emergency_contact = emergency_contact || null
    if (emergency_phone !== undefined) updateData.emergency_phone = emergency_phone || null
    if (birth_date !== undefined) updateData.birth_date = birth_date || null

    // Update user profile
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update(updateData)
      .eq('user_id', authUser.id)
      .select()
      .single()

    if (updateError) {
      // If we get a schema cache error, provide helpful message
      if (updateError.message?.includes('birth_date') && updateError.message?.includes('schema cache')) {
        return NextResponse.json(
          { 
            error: 'Schema cache error. Please run migration 032_ensure_birth_date_column.sql and 033_create_update_profile_function.sql in Supabase SQL Editor, then try again.',
            details: updateError.message
          },
          { status: 500 }
        )
      }
      
      console.error('Error updating profile:', updateError)
      return NextResponse.json(
        { error: `Failed to update profile: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedProfile
    })
  } catch (error: any) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
