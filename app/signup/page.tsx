'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Mail, Lock, User, Phone, AlertCircle, CheckCircle, Users, Shield, BarChart3, DollarSign, UserCheck, HeartPulse, Award } from 'lucide-react'
import Link from 'next/link'
import { ROLE_LIMITS, type Role } from '@/lib/role-limits'

const roleOptions = [
  { value: 'player', label: 'Player', icon: Users, description: 'Join as a player', limit: ROLE_LIMITS.player },
  { value: 'coach', label: 'Coach', icon: UserCheck, description: 'Join as a coach', limit: ROLE_LIMITS.coach },
  { value: 'physio', label: 'Physiotherapist', icon: HeartPulse, description: 'Join as a physiotherapist', limit: ROLE_LIMITS.physio },
  { value: 'data_admin', label: 'Team Manager', icon: BarChart3, description: 'Join as a team manager', limit: ROLE_LIMITS.data_admin },
  { value: 'finance_admin', label: 'Finance Admin', icon: DollarSign, description: 'Join as a finance admin', limit: ROLE_LIMITS.finance_admin },
  { value: 'admin', label: 'Administrator', icon: Shield, description: 'Join as an administrator', limit: ROLE_LIMITS.admin },
  { value: 'club_captain', label: 'Club Captain', icon: Award, description: 'Join as club captain (must link to existing player account)', limit: ROLE_LIMITS.club_captain },
] as const

const playerPositions = [
  { value: 'prop', label: 'Prop' },
  { value: 'hooker', label: 'Hooker' },
  { value: 'lock', label: 'Lock' },
  { value: 'flanker', label: 'Flanker' },
  { value: '8th_man', label: '8th Man' },
  { value: 'scrum_half', label: 'Scrum Half' },
  { value: 'fly_half', label: 'Fly Half' },
  { value: 'inside_center', label: 'Inside Center' },
  { value: 'outside_center', label: 'Outside Center' },
  { value: 'winger', label: 'Winger' },
]

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: 'player' as Role,
    position: '',
    linked_player_email: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    // Validate position for players
    if (formData.role === 'player' && !formData.position) {
      setError('Please select a position for players')
      return
    }

    // Validate linked_player_email for club_captain
    if (formData.role === 'club_captain' && !formData.linked_player_email) {
      setError('Please provide the email of your existing player account to link to')
      return
    }

    setLoading(true)

    try {
      // Create auth user
      const supabase = createClient()
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : '/dashboard'
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      })

      if (authError) {
        setError(authError.message || 'Failed to create account. Please try again.')
        setLoading(false)
        return
      }

      if (!authData.user) {
        setError('Failed to create account. Please try again.')
        setLoading(false)
        return
      }

      // Create user profile via API route (which will check limits)
      const signupResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          role: formData.role,
          position: formData.role === 'player' ? formData.position : null,
          user_id: authData.user.id,
          linked_player_email: formData.role === 'club_captain' ? formData.linked_player_email : null,
        }),
      })

      const signupResult = await signupResponse.json()

      if (!signupResponse.ok) {
        // Clean up auth user if profile creation fails
        await supabase.auth.signOut()
        setError(signupResult.error || 'Failed to create profile. Please try again.')
        setLoading(false)
        return
      }

      setSuccess(true)
      
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login?signup=success')
      }, 2000)
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || 'An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-club-gradient flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-card shadow-soft p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-neutral-text mb-2">Join Mongers Rugby Club</h1>
          <p className="text-neutral-medium">Create your account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-secondary/10 border border-secondary/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-secondary">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-success mb-1">Account created successfully!</p>
              <p className="text-sm text-success/80">
                Please check your email to verify your account. You will be redirected to the login page shortly.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-6">
          {/* Role Selection */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-neutral-text mb-2">
              Account Type <span className="text-red-500">*</span>
            </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roleOptions.map((roleOption) => {
                  const Icon = roleOption.icon
                  const isSelected = formData.role === roleOption.value

                  return (
                    <button
                      key={roleOption.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, role: roleOption.value as Role, position: '' })}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-soft'
                        : 'border-neutral-light hover:border-primary/50 hover:bg-neutral-light/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <Icon className={`w-5 h-5 mt-0.5 ${isSelected ? 'text-primary' : 'text-neutral-medium'}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-neutral-text">{roleOption.label}</h3>
                              {isSelected && (
                                <span className="px-2 py-0.5 bg-primary text-white text-xs rounded-full">Selected</span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-medium mt-1">{roleOption.description}</p>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
          </div>

          {/* Position Selection for Players */}
          {formData.role === 'player' && (
            <div>
              <label htmlFor="position" className="block text-sm font-medium text-neutral-text mb-2">
                Position <span className="text-red-500">*</span>
              </label>
              <select
                id="position"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                required
                className="w-full px-4 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                disabled={loading || success}
              >
                <option value="">Select your position...</option>
                {playerPositions.map((pos) => (
                  <option key={pos.value} value={pos.value}>
                    {pos.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-text mb-2">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-medium" />
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full pl-10 pr-4 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="John Doe"
                disabled={loading || success}
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-text mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-medium" />
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full pl-10 pr-4 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="your.email@example.com"
                disabled={loading || success}
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-neutral-text mb-2">
              Phone Number <span className="text-neutral-medium text-xs">(Optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-medium" />
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="+256 700 000 000"
                disabled={loading || success}
              />
            </div>
          </div>

          {formData.role === 'club_captain' && (
            <div>
              <label htmlFor="linked_player_email" className="block text-sm font-medium text-neutral-text mb-2">
                Linked Player Account Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-medium" />
                <input
                  id="linked_player_email"
                  type="email"
                  value={formData.linked_player_email}
                  onChange={(e) => setFormData({ ...formData, linked_player_email: e.target.value })}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  placeholder="player.email@example.com"
                  disabled={loading || success}
                />
              </div>
              <p className="text-xs text-neutral-medium mt-1">
                Enter the email address of your existing player account. This links your club captain account to your player stats.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-text mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-medium" />
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
                className="w-full pl-10 pr-4 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="At least 8 characters"
                disabled={loading || success}
              />
            </div>
            <p className="text-xs text-neutral-medium mt-1">Must be at least 8 characters long</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-text mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-medium" />
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                minLength={8}
                className="w-full pl-10 pr-4 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="Confirm your password"
                disabled={loading || success}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-primary text-white py-3 px-6 rounded-button font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating account...
              </>
            ) : success ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Account Created!
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-medium">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:text-primary-dark font-medium">
              Sign In
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
