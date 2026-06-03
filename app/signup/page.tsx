'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowRight,
  ArrowLeft,
  User,
  ShieldCheck,
  Lock,
  Settings,
  CheckCircle2,
  Info,
  Briefcase,
  Crown,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react'
import Link from 'next/link'

/* ─── Step definitions ─────────────────────────────────────────── */
const STEPS = [
  { label: 'Details', short: 'Details' },
  { label: 'Role', short: 'Role' },
  { label: 'Security', short: 'Security' },
  { label: 'Permissions', short: 'Permissions' },
  { label: 'Done', short: 'Done' },
]

const ROLES = [
  { id: 'admin', name: 'Club administrator', desc: 'Full access to all settings', icon: Settings },
  { id: 'data_admin', name: 'Team manager', desc: 'Manage squad and fixtures', icon: Briefcase },
  { id: 'coach', name: 'Head coach', desc: 'Training and performance', icon: User },
  { id: 'owner', name: 'Club owner / chairman', desc: 'Top-level oversight', icon: Crown },
]

const DEFAULT_PERMISSIONS = [
  { name: 'Manage squad', desc: 'Add, edit, and remove players', on: true },
  { name: 'Manage staff', desc: 'Invite and manage coaches and physios', on: true },
  { name: 'View financial data', desc: 'Access club revenue and expenses', on: true },
  { name: 'Edit club settings', desc: 'Change branding, sport profile, and plan', on: true },
  { name: 'Delete records', desc: 'Permanently remove data from the system', on: false },
  { name: 'Export data', desc: 'Download squad lists and reports', on: true },
]

/* ─── Password strength utility ───────────────────────────────── */
function getPasswordStrength(val: string) {
  let score = 0
  if (val.length >= 8) score++
  if (/[A-Z]/.test(val)) score++
  if (/[0-9!@#$%^&*]/.test(val)) score++
  const labels = ['', 'Weak', 'Good', 'Strong']
  const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#1D9E75']
  return { score, pct: [0, 33, 66, 100][score], label: labels[score], color: colors[score] }
}

/* ─── Component ────────────────────────────────────────────────── */
export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('admin')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS.map((p) => p.on))

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* ─── Navigation ─── */
  function next() {
    setError(null)
    // Validate current step
    if (step === 0) {
      if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
        setError('Please fill in all fields.')
        return
      }
    }
    if (step === 2) {
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
      if (!/[A-Z]/.test(password)) { setError('Password needs at least one uppercase letter.'); return }
      if (!/[0-9!@#$%^&*]/.test(password)) { setError('Password needs at least one number or symbol.'); return }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    }
    if (step < STEPS.length - 1) setStep(step + 1)
  }

  function back() {
    setError(null)
    if (step > 0) setStep(step - 1)
  }

  /* ─── Submit (fires on last step) ─── */
  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/login?onboarding=1` : '/login?onboarding=1'

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { role },
        },
      })

      if (authError) {
        if (authError.message?.toLowerCase().includes('already registered') || authError.message?.toLowerCase().includes('already been registered')) {
          setError('This email is already registered. If you haven\'t confirmed your email yet, check your inbox. Otherwise, sign in instead.')
        } else {
          setError(authError.message || 'Failed to create account.')
        }
        setLoading(false)
        return
      }

      if (!authData.user) {
        setError('Failed to create account. Please try again.')
        setLoading(false)
        return
      }

      // Create profile via API
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${firstName} ${lastName}`,
          email,
          phone: phone || null,
          role,
          position: null,
          birth_date: null,
          user_id: authData.user.id,
        }),
      })

      if (!res.ok) {
        const result = await res.json()
        if (result.requiresEmailConfirmation || result.code === 'AUTH_USER_NOT_FOUND') {
          // Email sent — move to done step
          setStep(4)
          setLoading(false)
          return
        }
        setError(result.error || 'Failed to save account.')
        setLoading(false)
        return
      }

      // Move to done step
      setStep(4)
      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Unexpected error.')
      setLoading(false)
    }
  }

  /* ─── Step content (inline switch, not a sub-component) ─── */
  function renderStep() {
    switch (step) {
      /* ── STEP 1: Details ── */
      case 0:
        return (
          <div>
            <div className="w-11 h-11 rounded-[10px] bg-[#E6F1FB] flex items-center justify-center mb-4">
              <User className="w-5 h-5 text-[#185FA5]" />
            </div>
            <h2 className="text-lg font-medium text-white mb-1">Create your admin account</h2>
            <p className="text-[13px] text-gray-400 mb-6 leading-relaxed">
              This account will have full control over your club on Team Master.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[13px] font-medium text-white mb-1.5 block">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Malik"
                  className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#1D9E75]"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-white mb-1.5 block">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Joshua"
                  className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#1D9E75]"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[13px] font-medium text-white mb-1.5 block">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="malik@heathensrfc.ug"
                className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#1D9E75]"
              />
            </div>

            <div className="mb-4">
              <label className="text-[13px] font-medium text-white mb-1.5 block">
                Phone number <span className="font-normal text-gray-500">(WhatsApp)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+256 7XX XXX XXX"
                className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#1D9E75]"
              />
            </div>

            {/* WhatsApp notice */}
            <div className="flex gap-2 bg-[#1a3148] border border-[#1e4b6e] rounded-lg p-3">
              <Info className="w-4 h-4 text-blue-300 flex-shrink-0 mt-0.5" />
              <span className="text-[13px] text-blue-200 leading-relaxed">
                Your phone number is used for WhatsApp notifications and support. It will not be shared with other clubs.
              </span>
            </div>
          </div>
        )

      /* ── STEP 2: Role ── */
      case 1:
        return (
          <div>
            <div className="w-11 h-11 rounded-[10px] bg-[#E1F5EE] flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5 text-[#0F6E56]" />
            </div>
            <h2 className="text-lg font-medium text-white mb-1">What is your role at the club?</h2>
            <p className="text-[13px] text-gray-400 mb-6 leading-relaxed">
              This helps Team Master show you the right tools and permissions for your position.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {ROLES.map((r) => {
                const Icon = r.icon
                const selected = role === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`flex items-center gap-2.5 border rounded-lg p-3 text-left transition-all ${
                      selected
                        ? 'border-[#1D9E75] bg-[#1D9E75]/10'
                        : 'border-[#3a3a3a] bg-transparent hover:border-[#555]'
                    }`}
                  >
                    <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${selected ? 'text-[#1D9E75]' : 'text-gray-500'}`} />
                    <div>
                      <div className={`text-[13px] font-medium ${selected ? 'text-white' : 'text-gray-300'}`}>{r.name}</div>
                      <div className="text-[11px] text-gray-500">{r.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Notice */}
            <div className="flex gap-2 bg-[#1a3148] border border-[#1e4b6e] rounded-lg p-3">
              <Info className="w-4 h-4 text-blue-300 flex-shrink-0 mt-0.5" />
              <span className="text-[13px] text-blue-200 leading-relaxed">
                You can always adjust your role and add other staff members after setup.
              </span>
            </div>
          </div>
        )

      /* ── STEP 3: Security ── */
      case 2: {
        const strength = getPasswordStrength(password)
        return (
          <div>
            <div className="w-11 h-11 rounded-[10px] bg-[#FAEEDA] flex items-center justify-center mb-4">
              <Lock className="w-5 h-5 text-[#854F0B]" />
            </div>
            <h2 className="text-lg font-medium text-white mb-1">Secure your account</h2>
            <p className="text-[13px] text-gray-400 mb-6 leading-relaxed">
              Choose a strong password. You can also enable two-factor authentication after setup.
            </p>

            <div className="mb-4">
              <label className="text-[13px] font-medium text-white mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg px-3 py-2.5 pr-10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#1D9E75]"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength bar */}
              {password.length > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${strength.pct}%`, background: strength.color }}
                    />
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="text-[13px] font-medium text-white mb-1.5 block">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg px-3 py-2.5 pr-10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#1D9E75]"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Requirements box */}
            <div className="bg-[#2a2a2a] rounded-lg p-3">
              <p className="text-[13px] font-medium text-white mb-2">Password requirements</p>
              {[
                { text: 'At least 8 characters', met: password.length >= 8 },
                { text: 'One uppercase letter', met: /[A-Z]/.test(password) },
                { text: 'One number or symbol', met: /[0-9!@#$%^&*]/.test(password) },
              ].map((req) => (
                <div key={req.text} className="flex items-center gap-2 mb-1">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${req.met ? 'text-[#1D9E75]' : 'text-gray-600'}`}
                  />
                  <span className={`text-[12px] ${req.met ? 'text-gray-300' : 'text-gray-500'}`}>
                    {req.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      }

      /* ── STEP 4: Permissions ── */
      case 3:
        return (
          <div>
            <div className="w-11 h-11 rounded-[10px] bg-[#EEEDFE] flex items-center justify-center mb-4">
              <Settings className="w-5 h-5 text-[#534AB7]" />
            </div>
            <h2 className="text-lg font-medium text-white mb-1">Admin permissions</h2>
            <p className="text-[13px] text-gray-400 mb-6 leading-relaxed">
              These are the default permissions for your admin account. You can customise them at any time in settings.
            </p>

            <div className="space-y-0">
              {DEFAULT_PERMISSIONS.map((perm, i) => (
                <div
                  key={perm.name}
                  className="flex items-center justify-between py-3 border-b border-[#2a2a2a] last:border-b-0"
                >
                  <div>
                    <p className="text-[13px] font-medium text-white">{perm.name}</p>
                    <p className="text-[12px] text-gray-500">{perm.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...permissions]
                      updated[i] = !updated[i]
                      setPermissions(updated)
                    }}
                    className={`w-9 h-5 rounded-full relative transition-colors ${
                      permissions[i] ? 'bg-[#1D9E75]' : 'bg-[#555]'
                    }`}
                  >
                    <div
                      className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${
                        permissions[i] ? 'left-[18px]' : 'left-[2px]'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )

      /* ── STEP 5: Done ── */
      case 4:
        return (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#E1F5EE] flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-[#1D9E75]" />
            </div>
            <h2 className="text-lg font-medium text-white mb-2">Check your email</h2>
            <p className="text-[13px] text-gray-400 mb-1 leading-relaxed">
              We&apos;ve sent a confirmation link to
            </p>
            <p className="text-[14px] font-semibold text-sky-400 mb-6">{email}</p>

            {/* Steps */}
            <div className="bg-[#2a2a2a] rounded-lg p-4 text-left mb-5">
              {[
                { n: '1', text: 'Open the email from Team Master in your inbox' },
                { n: '2', text: 'Click the confirmation link — it will take you to the sign-in page' },
                { n: '3', text: 'Sign in to start your club setup wizard' },
              ].map((s) => (
                <div key={s.n} className="flex items-start gap-3 mb-3 last:mb-0">
                  <span className="w-5 h-5 rounded-full bg-[#1D9E75] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</span>
                  <span className="text-[13px] text-gray-300">{s.text}</span>
                </div>
              ))}
            </div>

            {/* What's waiting */}
            <div className="bg-[#1a2a20] border border-[#1D9E75]/20 rounded-lg p-3 text-left">
              <p className="text-[12px] font-medium text-[#1D9E75] mb-2">Once you sign in, you&apos;ll set up:</p>
              {['Club badge & colours', 'Sport profile & league', 'Squad import', 'Staff invitations'].map((s) => (
                <div key={s} className="flex items-center gap-2 mb-1 last:mb-0">
                  <ArrowRight className="w-3 h-3 text-[#1D9E75]" />
                  <span className="text-[12px] text-gray-400">{s}</span>
                </div>
              ))}
            </div>
          </div>
        )
    }
  }

  /* ─── Render ─── */
  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl">

        {/* Progress bar — inline, not a sub-component */}
        <div className="flex items-center justify-between mb-10 max-w-lg mx-auto">
          {STEPS.map((s, i) => (
            <div key={s.short} className="flex flex-col items-center flex-1 relative">
              {i < STEPS.length - 1 && (
                <div className="absolute top-[14px] left-[50%] w-full h-[2px]"
                  style={{ background: i < step ? '#1D9E75' : '#3a3a3a' }} />
              )}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium z-10 transition-all ${
                i <= step ? 'bg-[#1D9E75] text-white' : 'bg-[#2a2a2a] text-gray-500 border border-[#3a3a3a]'
              }`}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-[11px] mt-1.5 ${i === step ? 'text-white font-medium' : 'text-gray-500'}`}>
                {s.short}
              </span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-[#222222] border border-[#2e2e2e] rounded-xl p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-[13px] text-red-300">
              {error}
            </div>
          )}

          {renderStep()}

          {/* Navigation */}
          {step < 4 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#2e2e2e]">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={back}
                  className="flex items-center gap-1.5 px-4 py-2.5 border border-[#3a3a3a] rounded-lg text-sm text-gray-300 hover:bg-[#2a2a2a] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              ) : (
                <div />
              )}

              {step === 3 ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-[#1D9E75] rounded-lg text-sm font-medium text-white hover:bg-[#0F6E56] transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create account <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={next}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-[#1D9E75] rounded-lg text-sm font-medium text-white hover:bg-[#0F6E56] transition-colors"
                >
                  Continue <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Done step — CTA button */}
          {step === 4 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-full flex items-center justify-center gap-1.5 px-5 py-3 bg-[#1D9E75] rounded-lg text-sm font-medium text-white hover:bg-[#0F6E56] transition-colors"
              >
                Back to home <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-center gap-4 mt-6 text-[13px] text-gray-500">
          <Link href="/login" className="hover:text-gray-300 transition-colors">
            Already have an account? Sign in
          </Link>
          <span>·</span>
          <Link href="/" className="hover:text-gray-300 transition-colors">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
