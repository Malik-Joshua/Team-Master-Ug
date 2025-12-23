import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Define public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/dev-login',
  '/api/check-env',
  '/api/signup',
]

// Check if a route is public
function isPublicRoute(pathname: string): boolean {
  // Check exact matches
  if (publicRoutes.includes(pathname)) {
    return true
  }
  
  // Check if it's an API route (allow all API routes for now, can be restricted later)
  if (pathname.startsWith('/api/')) {
    return true
  }
  
  // Check if it's a static file
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return true
  }
  
  return false
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Allow public routes without authentication check
  if (isPublicRoute(pathname)) {
    // Still update session for public routes, but don't block access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.next()
    }

    try {
      let response = NextResponse.next()
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          get(name: string) {
            try {
              return request.cookies.get(name)?.value
            } catch {
              return undefined
            }
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              request.cookies.set({ name, value, ...options })
              response = NextResponse.next({ request: { headers: request.headers } })
              response.cookies.set({ name, value, ...options })
            } catch (error) {
              console.error('Error setting cookie:', error)
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              request.cookies.set({ name, value: '', ...options })
              response = NextResponse.next({ request: { headers: request.headers } })
              response.cookies.set({ name, value: '', ...options })
            } catch (error) {
              console.error('Error removing cookie:', error)
            }
          },
        },
      })

      await supabase.auth.getUser()
      return response
    } catch (error) {
      console.error('Error in updateSession for public route:', error)
      return NextResponse.next()
    }
  }

  // For protected routes, check authentication
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // If Supabase is not configured, redirect to dev-login for development
    const url = request.nextUrl.clone()
    url.pathname = '/dev-login'
    return NextResponse.redirect(url)
  }

  // Create initial response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
            try {
          return request.cookies.get(name)?.value
            } catch {
              return undefined
            }
        },
        set(name: string, value: string, options: CookieOptions) {
            try {
            request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
            response.cookies.set({ name, value, ...options })
            } catch (error) {
              console.error('Error setting cookie:', error)
            }
        },
        remove(name: string, options: CookieOptions) {
            try {
            request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
            response.cookies.set({ name, value: '', ...options })
            } catch (error) {
              console.error('Error removing cookie:', error)
            }
        },
      },
    })

    // Check if user is authenticated
    const { data: { user }, error } = await supabase.auth.getUser()

    // If user is not authenticated, redirect to login
    if (!user || error) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      // Preserve the original URL for redirect after login
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    // User is authenticated, allow access
    return response
  } catch (error) {
    console.error('Error in updateSession:', error)
    // On error, redirect to login for safety
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
}



