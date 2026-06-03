'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Mail, Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'
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
  const [showPassword, setShowPassword] = useState(false)
  const [pendingSignup, setPendingSignup] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [redirectToOnboarding, setRedirectToOnboarding] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    // Check URL params on client side
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('onboarding') === '1') {
        setRedirectToOnboarding(true)
      }
      if (params.get('signup') === 'success') {
        setSignupSuccess(true)
      } else if (params.get('signup') === 'pending') {
        setPendingSignup(true)
        setPendingEmail(params.get('email'))
      }
    }
  }, [])

  const handleDevBypass = async (role: string) => {
    setError(null)
    setLoading(true)
    try {
      const response = await fetch('/api/auth/dev-bypass-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger bypass login')
      }

      console.log(`[DevBypass] Logging in as ${role}:`, data)
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      })

      if (authError) {
        throw authError
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      console.error('[DevBypass] Error:', err)
      setError(err.message || 'Dev bypass login failed.')
      setLoading(false)
    }
  }

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
              // Brand new profile just created — send to onboarding wizard
              if (typeof window !== 'undefined') {
                localStorage.removeItem('dev_role')
                localStorage.removeItem('dev_user')
              }
              router.push('/onboarding')
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

        // Existing profile — check onboarding_completed flag, fall back to dashboard
        const onboardingDone = profile?.onboarding_completed ?? true
        router.push(onboardingDone ? '/dashboard' : '/onboarding')
        router.refresh()
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1b2e] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Top-left brand */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4">
        <span className="inline-block border border-sky-400/40 text-sky-300 text-xs tracking-widest uppercase px-4 py-1.5 rounded-full">
          Team Master
        </span>
      </div>

      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      {/* Floating sport balls */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        {/* Soccer ball — top left */}
        <svg viewBox="0 0 64 64" className="absolute" width="72" height="72"
          style={{ top: '12%', left: '6%', opacity: 0.1, animation: 'float-slow 7s ease-in-out infinite', animationDelay: '0s' }}>
          <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
          <polygon points="32,10 38,20 26,20" stroke="white" strokeWidth="1.5" fill="none"/>
          <polygon points="10,38 18,32 18,44" stroke="white" strokeWidth="1.5" fill="none"/>
          <polygon points="54,38 46,32 46,44" stroke="white" strokeWidth="1.5" fill="none"/>
          <polygon points="22,54 26,44 38,44 42,54" stroke="white" strokeWidth="1.5" fill="none"/>
        </svg>

        {/* Basketball — top right */}
        <svg viewBox="0 0 64 64" className="absolute" width="90" height="90"
          style={{ top: '8%', right: '8%', opacity: 0.09, animation: 'float-mid 8s ease-in-out infinite', animationDelay: '1.5s' }}>
          <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M32 4 Q48 18 48 32 Q48 46 32 60" stroke="white" strokeWidth="1.5" fill="none"/>
          <path d="M32 4 Q16 18 16 32 Q16 46 32 60" stroke="white" strokeWidth="1.5" fill="none"/>
          <line x1="4" y1="32" x2="60" y2="32" stroke="white" strokeWidth="1.5"/>
        </svg>

        {/* Rugby ball — mid left */}
        <svg viewBox="0 0 80 50" className="absolute" width="100" height="64"
          style={{ top: '42%', left: '3%', opacity: 0.08, animation: 'float-fast 6s ease-in-out infinite', animationDelay: '3s' }}>
          <ellipse cx="40" cy="25" rx="36" ry="20" stroke="white" strokeWidth="2" fill="none"/>
          <line x1="4" y1="25" x2="76" y2="25" stroke="white" strokeWidth="1.5"/>
          <path d="M28 10 Q40 25 28 40" stroke="white" strokeWidth="1.5" fill="none"/>
          <path d="M52 10 Q40 25 52 40" stroke="white" strokeWidth="1.5" fill="none"/>
        </svg>

        {/* Tennis ball — bottom left */}
        <svg viewBox="0 0 64 64" className="absolute" width="60" height="60"
          style={{ bottom: '18%', left: '12%', opacity: 0.1, animation: 'float-mid 9s ease-in-out infinite', animationDelay: '0.8s' }}>
          <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M10 20 Q22 32 10 44" stroke="white" strokeWidth="1.5" fill="none"/>
          <path d="M54 20 Q42 32 54 44" stroke="white" strokeWidth="1.5" fill="none"/>
        </svg>

        {/* Volleyball — mid right */}
        <svg viewBox="0 0 64 64" className="absolute" width="78" height="78"
          style={{ top: '38%', right: '5%', opacity: 0.08, animation: 'float-slow 10s ease-in-out infinite', animationDelay: '2.2s' }}>
          <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M8 22 Q32 14 56 22" stroke="white" strokeWidth="1.5" fill="none"/>
          <path d="M8 42 Q32 50 56 42" stroke="white" strokeWidth="1.5" fill="none"/>
          <line x1="32" y1="4" x2="32" y2="60" stroke="white" strokeWidth="1.5"/>
        </svg>

        {/* Cricket ball — bottom right */}
        <svg viewBox="0 0 64 64" className="absolute" width="56" height="56"
          style={{ bottom: '22%', right: '10%', opacity: 0.09, animation: 'float-fast 7.5s ease-in-out infinite', animationDelay: '4s' }}>
          <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M20 10 Q32 32 20 54" stroke="white" strokeWidth="1.5" fill="none"/>
          <path d="M44 10 Q32 32 44 54" stroke="white" strokeWidth="1.5" fill="none"/>
          <line x1="4" y1="32" x2="60" y2="32" stroke="white" strokeWidth="1"/>
        </svg>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md bg-[#141e2d] border border-white/10 rounded-2xl p-8 shadow-2xl transition-all duration-300 hover:shadow-[0_0_40px_rgba(56,189,248,0.12)] hover:border-sky-400/20 hover:-translate-y-1">

        {/* TM Lettermark */}
        <div className="flex justify-center mb-6">
          <div className="w-[88px] h-[88px] rounded-2xl bg-[#0d1520] border border-white/10 flex flex-col items-center justify-center shadow-lg">
            <span className="text-3xl font-bold text-sky-400 tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>TM</span>
            <div className="w-10 h-[1.5px] bg-gray-600 my-1" />
            <span className="text-[10px] tracking-[0.2em] text-gray-400 font-medium">MASTER</span>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-white mb-1">Sign in to your account</h1>
        </div>

        {/* Notices */}
        {signupSuccess && (
          <div className="mb-5 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-lg flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-medium text-emerald-300">Account created successfully!</p>
              <p className="text-[12px] text-emerald-400/70 mt-0.5">Please check your email to verify your account, then sign in.</p>
            </div>
          </div>
        )}

        {pendingSignup && (
          <div className="mb-5 p-3 bg-[#1a3148] border border-[#1e4b6e] rounded-lg flex items-start gap-2.5">
            <Mail className="w-4 h-4 text-blue-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-medium text-blue-200">Email confirmation required</p>
              <p className="text-[12px] text-blue-300/70 mt-0.5">
                {pendingEmail
                  ? <>Confirmation sent to <strong className="text-blue-200">{pendingEmail}</strong>. Click the link then sign in.</>
                  : <>Click the confirmation link in your email, then sign in.</>}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3 bg-red-500/10 border border-red-500/25 rounded-lg flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-300">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-[13px] font-medium text-white mb-1.5 block">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#0d1520] border border-[#2a3a4a] rounded-lg pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-sky-400/60 transition-colors"
                placeholder="your.email@example.com"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="text-[13px] font-medium text-white mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#0d1520] border border-[#2a3a4a] rounded-lg pl-9 pr-10 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-sky-400/60 transition-colors"
                placeholder="Enter your password"
                disabled={loading}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 text-white py-3 px-6 rounded-lg font-semibold text-sm transition-all duration-200 hover:bg-sky-400 hover:shadow-[0_0_18px_rgba(56,189,248,0.4)] hover:scale-[1.02] active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Local Development Auto-Bypass (Localhost only) */}
        {isMounted && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
          <div className="mt-6 pt-5 border-t border-white/5">
            <div className="text-center mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400/80 bg-sky-500/10 px-2.5 py-1 rounded-full">
                🛠️ Dev Auto-Login Bypass
              </span>
            </div>
            <p className="text-[10px] text-gray-500 text-center mb-3">
              One-click login for any existing account by role (Local Dev only)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Admin', role: 'admin' },
                { label: 'Coach', role: 'coach' },
                { label: 'Player', role: 'player' },
                { label: 'Physio', role: 'physio' },
                { label: 'Club Captain', role: 'club_captain' },
                { label: 'Finance Admin', role: 'finance_admin' },
                { label: 'Team Manager', role: 'data_admin' },
              ].map((btn) => (
                <button
                  key={btn.role}
                  type="button"
                  disabled={loading}
                  onClick={() => handleDevBypass(btn.role)}
                  className="px-2.5 py-1.5 text-[11px] font-medium bg-[#1c2a3e] hover:bg-[#253752] text-gray-300 rounded-[6px] border border-white/5 transition-all duration-150 active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-[13px] text-gray-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-sky-400 hover:text-sky-300 font-medium transition-colors">
              Sign up
            </Link>
          </p>
          <Link href="/" className="text-[12px] text-gray-600 hover:text-gray-400 transition-colors block">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}

