'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react'
import Link from 'next/link'

// Make this page dynamic to avoid prerendering issues
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [pendingSignup, setPendingSignup] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  useEffect(() => {
    // Check URL params on client side
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('signup') === 'success') {
        setSignupSuccess(true)
      } else if (params.get('signup') === 'pending') {
        setPendingSignup(true)
        setPendingEmail(params.get('email'))
      }
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message || 'Failed to sign in. Please check your credentials.')
        setLoading(false)
        return
      }

      if (data.user) {
        // Check if user has a profile
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', data.user.id)
          .single()

        if (profileError || !profile) {
          // Profile doesn't exist - check if there's a pending signup
          try {
            const completeSignupResponse = await fetch('/api/auth/complete-signup', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            })

            const completeSignupResult = await completeSignupResponse.json()

            if (completeSignupResponse.ok && completeSignupResult.success) {
              // Profile created successfully, redirect to dashboard
              if (typeof window !== 'undefined') {
                localStorage.removeItem('dev_role')
                localStorage.removeItem('dev_user')
              }
              router.push('/dashboard')
              router.refresh()
              return
            } else if (completeSignupResult.needsSignup) {
              // No pending signup found - user needs to complete signup
              setError('Please complete the signup process first. If you just confirmed your email, please try logging in again.')
              await supabase.auth.signOut()
              setLoading(false)
              return
            } else {
              // Error creating profile from pending signup
              setError(completeSignupResult.error || 'Failed to complete signup. Please contact an administrator.')
              await supabase.auth.signOut()
              setLoading(false)
              return
            }
          } catch (completeSignupError: any) {
            console.error('Error completing signup:', completeSignupError)
            setError('User profile not found and could not complete signup. Please contact an administrator.')
          await supabase.auth.signOut()
          setLoading(false)
          return
          }
        }

        // Profile exists - proceed normally
        // Clear any dev mode data
        if (typeof window !== 'undefined') {
          localStorage.removeItem('dev_role')
          localStorage.removeItem('dev_user')
        }

        // Redirect to dashboard
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-club-gradient flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-card shadow-soft p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-neutral-text mb-2">Team Master</h1>
          <p className="text-neutral-medium">Sign in to your account</p>
        </div>

        {signupSuccess && (
          <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-success mb-1">Account created successfully!</p>
              <p className="text-sm text-success/80">
                Please check your email to verify your account, then sign in below.
              </p>
            </div>
          </div>
        )}

        {pendingSignup && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
            <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 mb-1">Email Confirmation Required</p>
              <p className="text-sm text-blue-800">
                {pendingEmail ? (
                  <>We&apos;ve sent a confirmation email to <strong>{pendingEmail}</strong>. Please check your inbox and click the confirmation link, then sign in below to complete your registration.</>
                ) : (
                  <>Please check your email and click the confirmation link, then sign in below to complete your registration.</>
                )}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-secondary/10 border border-secondary/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-secondary">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-text mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-medium" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="your.email@example.com"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-text mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-medium" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 px-6 rounded-button font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-medium">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary hover:text-primary-dark font-medium">
              Sign Up
            </Link>
          </p>
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-sm text-neutral-medium hover:text-neutral-text transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

