import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

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

    // Get user profile to verify admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const hasUrl = !!supabaseUrl
    const hasKey = !!supabaseServiceKey
    const keyLength = supabaseServiceKey?.length || 0
    const keyPrefix = supabaseServiceKey?.substring(0, 10) || 'N/A'

    // Try to create service client
    let serviceClientError = null
    let testQueryError = null
    let testQuerySuccess = false

    if (hasUrl && hasKey) {
      try {
        const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })

        // Try a simple query
        const { data, error } = await supabaseAdmin
          .from('user_profiles')
          .select('count')
          .limit(1)

        if (error) {
          testQueryError = {
            message: error.message,
            code: error.code,
            hint: error.hint
          }
        } else {
          testQuerySuccess = true
        }
      } catch (err: any) {
        serviceClientError = {
          message: err.message,
          type: err.constructor?.name
        }
      }
    }

    return NextResponse.json({
      environment: {
        hasSupabaseUrl: hasUrl,
        hasServiceRoleKey: hasKey,
        serviceRoleKeyLength: keyLength,
        serviceRoleKeyPrefix: keyPrefix,
        nodeEnv: process.env.NODE_ENV
      },
      serviceClient: {
        created: hasUrl && hasKey && !serviceClientError,
        error: serviceClientError
      },
      testQuery: {
        success: testQuerySuccess,
        error: testQueryError
      },
      message: hasKey 
        ? 'Environment variable is set. Check testQuery results for database connectivity.'
        : 'SUPABASE_SERVICE_ROLE_KEY is NOT SET. Please add it to Vercel environment variables.'
    })
  } catch (error: any) {
    console.error('Error in test-env route:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to test environment',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : undefined
      },
      { status: 500 }
    )
  }
}

