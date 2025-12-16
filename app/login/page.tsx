'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { LogIn, Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Check Supabase configuration on mount
  useEffect(() => {
    // Also check server-side via API route
    fetch('/api/check-env')
      .then(res => res.json())
      .then(data => {
        console.log('Server-side environment check:', data)
        if (!data.hasUrl || !data.hasKey) {
          console.error('❌ Server-side check confirms: Environment variables are missing!')
          console.log('Missing variables:', data.missingVariables || [])
          console.log('Supabase keys found:', data.supabaseKeys || [])
          console.log('Vercel environment:', data.vercelEnv)
          console.log('Message:', data.message)
          
          // Set error message with helpful instructions
          const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
          if (isProduction) {
            setError(
              `❌ Supabase is not configured on Vercel.\n\n` +
              `Missing: ${data.missingVariables?.join(', ') || 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'}\n\n` +
              `To fix:\n` +
              `1. Go to Vercel Dashboard → Settings → Environment Variables\n` +
              `2. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY\n` +
              `3. Redeploy your application (uncheck "Use existing Build Cache")\n\n` +
              `See QUICK_VERCEL_SETUP.md for detailed instructions.`
            )
          }
        } else {
          console.log('✅ Server-side check: Supabase is configured')
        }
      })
      .catch(err => console.error('Failed to check server env:', err))
    
    // #region agent log
    // Only send debug logs in localhost (development)
    if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
      fetch('http://127.0.0.1:7242/ingest/b5c4434c-fcfb-4ec4-a949-8e713967c143', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'app/login/page.tsx:18',
          message: 'Environment check - BEFORE reading env vars',
          data: {
            hostname: window.location.hostname,
            isVercel: window.location.hostname.includes('vercel.app'),
            isLocalhost: window.location.hostname.includes('localhost'),
            allProcessEnvKeys: typeof process !== 'undefined' && process.env ? Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('NEXT_PUBLIC')) : []
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'env-check-1',
          hypothesisId: 'A'
        })
      }).catch(() => {})
    }
    // #endregion
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    // #region agent log
    // Only send debug logs in localhost (development)
    if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
      fetch('http://127.0.0.1:7242/ingest/b5c4434c-fcfb-4ec4-a949-8e713967c143', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'app/login/page.tsx:25',
          message: 'Environment check - AFTER reading env vars',
          data: {
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseKey,
            urlValue: supabaseUrl || 'undefined',
            keyValue: supabaseKey ? `${supabaseKey.substring(0, 10)}...` : 'undefined',
            urlLength: supabaseUrl?.length || 0,
            keyLength: supabaseKey?.length || 0,
            urlStartsWith: supabaseUrl?.substring(0, 8) || 'N/A',
            keyStartsWith: supabaseKey?.substring(0, 10) || 'N/A'
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'env-check-2',
          hypothesisId: 'B'
        })
      }).catch(() => {})
    }
    // #endregion
    
    // Debug logging
    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlLength: supabaseUrl?.length || 0,
      keyLength: supabaseKey?.length || 0,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
      allEnvKeys: typeof process !== 'undefined' && process.env ? Object.keys(process.env).filter(k => k.includes('SUPABASE')) : [],
      urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing',
      keyPreview: supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'missing'
    })
    
    if (!supabaseUrl || !supabaseKey) {
      // #region agent log
      // Only send debug logs in localhost (development)
      if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
        fetch('http://127.0.0.1:7242/ingest/b5c4434c-fcfb-4ec4-a949-8e713967c143', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'app/login/page.tsx:56',
            message: 'Environment variables MISSING',
            data: {
              missingUrl: !supabaseUrl,
              missingKey: !supabaseKey,
              hostname: window.location.hostname,
              isVercel: window.location.hostname.includes('vercel.app'),
              buildTimeIssue: 'NEXT_PUBLIC_ vars must be set BEFORE build'
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'env-check-3',
            hypothesisId: 'C'
          })
        }).catch(() => {})
      }
      // #endregion
      
      console.warn('Supabase environment variables not found', {
        url: supabaseUrl,
        key: supabaseKey ? 'present' : 'missing'
      })
      const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      setError(
        isProduction
          ? 'Supabase is not configured. NEXT_PUBLIC_* variables are embedded at BUILD TIME. Make sure variables are set in Vercel BEFORE building, then force a fresh rebuild (uncheck "Use existing Build Cache" when redeploying). See VERCEL_ENV_TROUBLESHOOTING.md for details.'
          : 'Supabase is not configured. Please check your .env.local file and restart the dev server.'
      )
    } else {
      // #region agent log
      // Only send debug logs in localhost (development)
      if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
        fetch('http://127.0.0.1:7242/ingest/b5c4434c-fcfb-4ec4-a949-8e713967c143', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'app/login/page.tsx:70',
            message: 'Environment variables FOUND',
            data: {
              urlLength: supabaseUrl.length,
              keyLength: supabaseKey.length,
              urlValid: supabaseUrl.startsWith('https://'),
              keyValid: supabaseKey.startsWith('eyJ')
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'env-check-4',
            hypothesisId: 'D'
          })
        }).catch(() => {})
      }
      // #endregion
      
      console.log('Supabase configured:', { url: supabaseUrl, hasKey: !!supabaseKey })
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted')
    setError(null)
    setLoading(true)

    try {
      console.log('Step 1: Checking environment variables...')
      // Check if Supabase is configured
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      console.log('Environment check:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing',
        key: supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'missing'
      })
      
      if (!supabaseUrl || !supabaseKey) {
        // #region agent log
        // Only send debug logs in localhost (development)
        if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
          fetch('http://127.0.0.1:7242/ingest/b5c4434c-fcfb-4ec4-a949-8e713967c143', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'app/login/page.tsx:handleLogin',
              message: 'Login attempt with missing env vars',
              data: {
                missingUrl: !supabaseUrl,
                missingKey: !supabaseKey,
                hostname: window.location.hostname,
                isVercel: window.location.hostname.includes('vercel.app')
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'login-env-check',
              hypothesisId: 'E'
            })
          }).catch(() => {})
        }
        // #endregion
        
        const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
        const errorMsg = isProduction
          ? 'Supabase is not configured. NEXT_PUBLIC_* variables are embedded at BUILD TIME. Make sure variables are set in Vercel BEFORE building, then force a fresh rebuild (uncheck "Use existing Build Cache" when redeploying). See VERCEL_ENV_TROUBLESHOOTING.md for details.'
          : 'Supabase is not configured. Please check your .env.local file and restart the dev server.'
        setError(errorMsg)
        setLoading(false)
        console.error('Missing Supabase environment variables:', { supabaseUrl, supabaseKey })
        return
      }

      console.log('Step 2: Clearing dev mode data...')
      // Clear any dev mode data
      if (typeof window !== 'undefined') {
        localStorage.removeItem('dev_role')
        localStorage.removeItem('dev_user')
      }

      console.log('Step 3: Creating Supabase client...')
      console.log('Attempting to sign in with email:', email)
      
      let supabase
      try {
        supabase = createClient()
        console.log('Supabase client created successfully')
      } catch (clientError: any) {
        console.error('Error creating Supabase client:', clientError)
        setError(`Failed to initialize Supabase: ${clientError.message}`)
        setLoading(false)
        return
      }
      
      console.log('Step 4: Attempting authentication...')
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      console.log('Sign in response:', {
        hasData: !!data,
        hasUser: !!data?.user,
        hasError: !!signInError,
        errorMessage: signInError?.message
      })

      if (signInError) {
        console.error('Sign in error details:', {
          message: signInError.message,
          status: signInError.status,
          name: signInError.name
        })
        setError(signInError.message || 'Invalid email or password')
        setLoading(false)
        return
      }

      if (!data.user) {
        console.error('No user in auth response')
        setError('Authentication failed. Please try again.')
        setLoading(false)
        return
      }

      console.log('Step 5: User authenticated, fetching profile...')
      console.log('User ID:', data.user.id)

      // Verify user has a profile
      console.log('Querying user_profiles table...')
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', data.user.id)
        .single()

      console.log('Profile query result:', {
        hasProfile: !!profile,
        hasError: !!profileError,
        errorMessage: profileError?.message,
        errorCode: profileError?.code,
        errorDetails: profileError?.details
      })

      if (profileError) {
        console.error('Profile error details:', {
          message: profileError.message,
          code: profileError.code,
          details: profileError.details,
          hint: profileError.hint
        })
        setError(`Profile error: ${profileError.message || 'User profile not found. Please contact an administrator.'}`)
        setLoading(false)
        // Sign out if profile doesn't exist
        await supabase.auth.signOut()
        return
      }

      if (!profile) {
        setError('User profile not found. Please contact an administrator.')
        setLoading(false)
        await supabase.auth.signOut()
        return
      }

      console.log('Profile found:', profile)

      // Check if user is active
      if (profile.status !== 'active') {
        setError(`Your account status is "${profile.status}". Please contact an administrator to activate your account.`)
        setLoading(false)
        await supabase.auth.signOut()
        return
      }

      console.log('Login successful, redirecting...')
      
      // Success - redirect to original destination or dashboard
      const redirectTo = searchParams.get('redirect') || '/dashboard'
      router.push(redirectTo)
      router.refresh()
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'An unexpected error occurred. Please check the console for details.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-club-gradient flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-card shadow-large p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-club-gradient mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-neutral-text mb-2">Welcome Back</h1>
            <p className="text-neutral-medium">Sign in to access your dashboard</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-text mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-neutral-medium" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-neutral-text placeholder-neutral-medium"
                  placeholder="Enter your email"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-text mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-neutral-medium" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block w-full pl-10 pr-10 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-neutral-text placeholder-neutral-medium"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-medium hover:text-neutral-text"
                  disabled={loading}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              onClick={(e) => {
                console.log('Button clicked', { email, password: '***', loading })
              }}
              className="w-full bg-club-gradient text-white py-3 px-4 rounded-button font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 space-y-3 text-center">
            <Link
              href="/dev-login"
              className="inline-flex items-center text-sm text-neutral-medium hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Use Development Mode Instead
            </Link>
            <div className="text-sm text-neutral-medium">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-primary hover:underline font-medium">
                Contact Administrator
              </Link>
            </div>
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-white hover:text-blue-100 text-sm underline inline-flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

// Wrap in Suspense to handle useSearchParams during static generation
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-club-gradient flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-card shadow-large p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-neutral-medium">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
// Force rebuild Tue Dec 16 18:48:45 EAT 2025
