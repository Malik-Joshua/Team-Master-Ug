'use client'

import React, { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, Mail, Lock, User, Phone, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react'

function SignupForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: 'player',
    position: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const positions = {
    forwards: [
      { value: 'prop', label: 'Prop' },
      { value: 'hooker', label: 'Hooker' },
      { value: 'lock', label: 'Lock' },
      { value: 'flanker', label: 'Flanker' },
      { value: '8th_man', label: '8th Man' },
    ],
    backs: [
      { value: 'scrum_half', label: 'Scrum Half' },
      { value: 'fly_half', label: 'Fly Half' },
      { value: 'inside_center', label: 'Inside Center' },
      { value: 'outside_center', label: 'Outside Center' },
      { value: 'winger', label: 'Winger' },
    ],
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      setError('Please fill in all required fields')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.role === 'player' && !formData.position) {
      setError('Please select your position')
      setLoading(false)
      return
    }

    try {
      // Call signup API
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          phone: formData.phone || null,
          role: formData.role,
          position: formData.role === 'player' ? formData.position : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create account')
        setLoading(false)
        return
      }

      // Success!
      setSuccess(true)
      
      // If email confirmation is required, show message
      if (data.data?.requiresEmailConfirmation) {
        setTimeout(() => {
          router.push('/login?message=Please check your email to confirm your account')
        }, 3000)
      } else {
        // Auto sign in and redirect
        const supabase = createClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        })

        if (signInError) {
          // Even if auto sign-in fails, account is created
          router.push('/login?message=Account created successfully! Please sign in.')
        } else {
          router.push('/dashboard')
        }
      }
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || 'An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-club-gradient flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-card shadow-large p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/20 mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-text mb-2">Account Created!</h1>
            <p className="text-neutral-medium mb-6">
              Your account has been successfully created. Redirecting you to sign in...
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-club-gradient flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-card shadow-large p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-club-gradient mb-4">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-neutral-text mb-2">Create Account</h1>
            <p className="text-neutral-medium">Sign up to access the management system</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-neutral-text mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-neutral-medium" />
                </div>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-neutral-text placeholder-neutral-medium"
                  placeholder="Enter your full name"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-text mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-neutral-medium" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-neutral-text placeholder-neutral-medium"
                  placeholder="Enter your email"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Phone Field */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-neutral-text mb-2">
                Phone Number (Optional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-neutral-medium" />
                </div>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="block w-full pl-10 pr-3 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-neutral-text placeholder-neutral-medium"
                  placeholder="Enter your phone number"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Role Field */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-neutral-text mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value, position: '' })}
                required
                className="block w-full px-3 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-neutral-text bg-white"
                disabled={loading}
              >
                <option value="player">Player</option>
                <option value="coach">Coach</option>
                <option value="data_admin">Team Manager</option>
                <option value="finance_admin">Finance Admin</option>
              </select>
            </div>

            {/* Position Field (only for players) */}
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
                  className="block w-full px-3 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-neutral-text bg-white"
                  disabled={loading}
                >
                  <option value="">Select your position</option>
                  <optgroup label="Forwards">
                    {positions.forwards.map((pos) => (
                      <option key={pos.value} value={pos.value}>
                        {pos.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Backs">
                    {positions.backs.map((pos) => (
                      <option key={pos.value} value={pos.value}>
                        {pos.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-text mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-neutral-medium" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  className="block w-full pl-10 pr-10 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-neutral-text placeholder-neutral-medium"
                  placeholder="Enter your password (min. 6 characters)"
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

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-text mb-2">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-neutral-medium" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  minLength={6}
                  className="block w-full pl-10 pr-10 py-3 border border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-neutral-text placeholder-neutral-medium"
                  placeholder="Confirm your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-medium hover:text-neutral-text"
                  disabled={loading}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-club-gradient text-white py-3 px-4 rounded-button font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 space-y-3 text-center">
            <div className="text-sm text-neutral-medium">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign In
              </Link>
            </div>
            <Link
              href="/"
              className="inline-flex items-center text-sm text-neutral-medium hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
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
      <SignupForm />
    </Suspense>
  )
}




