'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { LogIn, Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Check Supabase configuration on mount
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase environment variables not found')
      setError('Supabase is not configured. Please check your .env.local file.')
    } else {
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
        const errorMsg = 'Supabase is not configured. Please check your .env.local file and restart the dev server.'
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

      console.log('Login successful, redirecting to dashboard...')
      
      // Success - redirect to dashboard
      router.push('/dashboard')
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

