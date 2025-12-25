import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Create initial response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Check if environment variables are set
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables')
    return response
  }

  try {
  const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
    {
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
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
            } catch (error) {
              console.error('Error setting cookie:', error)
            }
        },
        remove(name: string, options: CookieOptions) {
            try {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
            } catch (error) {
              console.error('Error removing cookie:', error)
            }
        },
      },
    }
  )

  await supabase.auth.getUser()
  } catch (error) {
    console.error('Error in updateSession:', error)
    // Return response even if there's an error to prevent blocking requests
  }

  // Ensure we always return a valid response
  return response || NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
}



