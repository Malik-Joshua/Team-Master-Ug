'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getDashboardPathForRole } from '@/lib/roleRoutes'
import { CheckCircle, Eye, EyeOff } from 'lucide-react'

/**
 * First-time activation for invited players/staff. The onboarding email links
 * here (NOT to Club Setup — the club already exists by the time anyone is
 * invited). They enter the temporary password from the email, choose their own
 * password, and get a welcome message before landing on their dashboard.
 *
 * A user who instead signs in on /login with the temporary password is sent
 * here too (see login/page.tsx), already authenticated — in that case the
 * temporary-password field is hidden.
 */
function WelcomeContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState(params.get('email') || '')
  const [tempPassword, setTempPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [alreadySignedIn, setAlreadySignedIn] = useState(false)
  const [checking, setChecking] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ name: string; club: string | null; path: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setAlreadySignedIn(true)
        if (user.email) setEmail(user.email)
      }
      setChecking(false)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError('Your password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The two passwords do not match.')
      return
    }
    if (newPassword === tempPassword) {
      setError('Please choose a password different from the temporary one.')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()

      if (!alreadySignedIn) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: tempPassword,
        })
        if (signInError) {
          setError('That email or temporary password is not right. Copy it exactly from your email.')
          setSaving(false)
          return
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_set_password: false },
      })
      if (updateError) {
        setError(updateError.message || 'Could not save your password. Please try again.')
        setSaving(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('name, role')
        .eq('user_id', user?.id || '')
        .single()
      const { data: club } = await supabase
        .from('club_settings')
        .select('club_nickname')
        .limit(1)
        .maybeSingle()

      setDone({
        name: profile?.name || 'there',
        club: club?.club_nickname || null,
        path: getDashboardPathForRole(profile?.role),
      })
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full px-4 py-3 rounded-lg bg-[#0d1b2e] border border-sky-400/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sky-400/50'

  return (
    <div className="min-h-screen bg-[#0d1b2e] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#112239] border border-sky-400/15 rounded-2xl p-8 shadow-2xl">
        {done ? (
          <div className="text-center space-y-4">
            <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto" />
            <h1 className="text-2xl font-bold text-white">
              Welcome{done.club ? ` to ${done.club}` : ''}, {done.name}! 🏉
            </h1>
            <p className="text-white/70 text-sm leading-relaxed">
              Your password is set and your account is ready. We&apos;re glad to have you on the team.
            </p>
            <button
              onClick={() => { router.push(done.path); router.refresh() }}
              className="w-full mt-2 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold transition-colors"
            >
              Go to my dashboard
            </button>
          </div>
        ) : checking ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center mb-2">
              <h1 className="text-2xl font-bold text-white">Create your password</h1>
              <p className="text-white/60 text-sm mt-1">
                Choose a password only you know to activate your account.
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-400/40 bg-red-500/10 text-red-200 text-sm px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm text-white/70 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={alreadySignedIn}
                className={`${inputClass} ${alreadySignedIn ? 'opacity-60' : ''}`}
              />
            </div>

            {!alreadySignedIn && (
              <div>
                <label className="block text-sm text-white/70 mb-1">Temporary password (from your email)</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="off"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-white/70 mb-1">New password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`${inputClass} pr-11`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-white/40 mt-1">At least 8 characters.</p>
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-1">Confirm new password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? 'Activating…' : 'Activate my account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <WelcomeContent />
    </Suspense>
  )
}
