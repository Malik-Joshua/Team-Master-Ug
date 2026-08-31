'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Mail, Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import BallIcon from '@/components/BallIcon'
import { getDashboardPathForRole } from '@/lib/roleRoutes'

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

  // Mouse parallax for the floating background balls — deeper balls drift
  // further, giving the login screen the same subtle depth as the hero.
  const pageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const page = pageRef.current
    if (!page) return
    const balls = Array.from(page.querySelectorAll<HTMLElement>('.tm-ball-wrap'))
    const onMove = (e: MouseEvent) => {
      const rect = page.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      balls.forEach((el) => {
        const depth = parseFloat(el.dataset.depth || '0.5')
        el.style.transform = `translate(${x * depth * 60}px, ${y * depth * 42}px)`
      })
    }
    const onLeave = () => balls.forEach((el) => { el.style.transform = 'translate(0px, 0px)' })
    page.addEventListener('mousemove', onMove)
    page.addEventListener('mouseleave', onLeave)
    return () => {
      page.removeEventListener('mousemove', onMove)
      page.removeEventListener('mouseleave', onLeave)
    }
  }, [])

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

      // Go straight to this role's real dashboard — the bypass response
      // already tells us the role, so there's no need to land on the
      // generic /dashboard first and let it redirect a second time.
      router.push(getDashboardPathForRole(data.role))
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

        // Existing profile — check onboarding_completed flag. Once onboarded,
        // go straight to this role's real dashboard (skipping the generic
        // /dashboard hop, same as the dev-bypass path above) so sign-in
        // doesn't cost an extra full page mount + data fetch.
        const onboardingDone = profile?.onboarding_completed ?? true
        router.push(onboardingDone ? getDashboardPathForRole(profile?.role) : '/onboarding')
        router.refresh()
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div ref={pageRef} className="min-h-screen bg-[#0d1b2e] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Top-left brand */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4">
        <span className="inline-block cursor-pointer border border-sky-400/40 text-sky-300 text-xs tracking-widest uppercase px-4 py-1.5 rounded-full transition-all duration-200 hover:border-sky-400/80 hover:text-sky-200 hover:bg-sky-400/10 hover:scale-105 hover:shadow-[0_0_18px_rgba(56,189,248,0.4)] active:scale-100">
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

      {/* Floating sport balls — realistic shaded spheres that float, spin, and
          drift with the cursor (same BallIcon component as the landing hero).
          The opaque sign-in card masks the centre, so these read as background
          decoration framing the form. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        {/* Soccer — top left */}
        <div className="tm-ball-wrap" data-depth="0.9" style={{ top: '12%', left: '5%', opacity: 0.7 }}>
          <div className="tm-ball-float" style={{ animation: 'float-slow 7s ease-in-out infinite' }}>
            <BallIcon type="soccer" size={78} spin spinDir="cw" spinDuration={26} />
          </div>
        </div>

        {/* Basketball — top right */}
        <div className="tm-ball-wrap" data-depth="1.1" style={{ top: '8%', right: '6%', opacity: 0.7 }}>
          <div className="tm-ball-float" style={{ animation: 'float-mid 8s ease-in-out infinite', animationDelay: '1.2s' }}>
            <BallIcon type="basketball" size={84} spin spinDir="ccw" spinDuration={30} />
          </div>
        </div>

        {/* Rugby — mid left (oval, no spin) */}
        <div className="tm-ball-wrap" data-depth="0.6" style={{ top: '46%', left: '4%', opacity: 0.68 }}>
          <div className="tm-ball-float" style={{ animation: 'float-fast 6.5s ease-in-out infinite', animationDelay: '2.4s' }}>
            <BallIcon type="rugby" size={96} />
          </div>
        </div>

        {/* Volleyball — mid right */}
        <div className="tm-ball-wrap" data-depth="1.2" style={{ top: '42%', right: '5%', opacity: 0.7 }}>
          <div className="tm-ball-float" style={{ animation: 'float-slow 9s ease-in-out infinite', animationDelay: '0.6s' }}>
            <BallIcon type="volleyball" size={76} spin spinDir="cw" spinDuration={34} />
          </div>
        </div>

        {/* Tennis — bottom left */}
        <div className="tm-ball-wrap" data-depth="0.7" style={{ bottom: '14%', left: '9%', opacity: 0.7 }}>
          <div className="tm-ball-float" style={{ animation: 'float-mid 9s ease-in-out infinite', animationDelay: '3.2s' }}>
            <BallIcon type="tennis" size={54} spin spinDir="ccw" spinDuration={20} />
          </div>
        </div>

        {/* Cricket — bottom right */}
        <div className="tm-ball-wrap" data-depth="1.0" style={{ bottom: '16%', right: '8%', opacity: 0.66 }}>
          <div className="tm-ball-float" style={{ animation: 'float-fast 7.5s ease-in-out infinite', animationDelay: '1.8s' }}>
            <BallIcon type="cricket" size={50} spin spinDir="cw" spinDuration={22} />
          </div>
        </div>
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
                { label: 'Asst. Coach', role: 'asst_coach' },
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

