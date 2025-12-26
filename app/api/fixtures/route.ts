import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Get upcoming matches
    const { data: fixtures, error } = await supabase
      .from('matches')
      .select('*')
      .gte('match_date', new Date().toISOString().split('T')[0])
      .order('match_date', { ascending: true })

    if (error) {
      console.error('Error fetching fixtures:', error)
      return NextResponse.json(
        { error: `Failed to fetch fixtures: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      fixtures: fixtures || [],
      count: fixtures?.length || 0
    })
  } catch (error: any) {
    console.error('Error in fixtures API route:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch fixtures' },
      { status: 500 }
    )
  }
}

