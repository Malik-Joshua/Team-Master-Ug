import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Create a default response that we'll return if anything fails
  const defaultResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Check if environment variables are set first
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If Supabase is not configured, skip middleware
  if (!supabaseUrl || !supabaseAnonKey) {
    return defaultResponse
  }

  try {
    const response = await updateSession(request)
    // Ensure we always return a valid response
    return response || defaultResponse
  } catch (error) {
    // Log error but don't block the request
    console.error('Middleware error:', error)
    return defaultResponse
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}



