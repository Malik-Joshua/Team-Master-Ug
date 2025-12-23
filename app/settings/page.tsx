'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { Settings as SettingsIcon, User, Lock, Mail, Phone, Save, AlertCircle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    const loadUser = async () => {
      // Check for dev mode
      if (typeof window !== 'undefined') {
        const devUser = localStorage.getItem('dev_user')
        if (devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            setFormData({
              name: userData.name || '',
              email: userData.email || '',
              phone: userData.phone || '',
            })
            setLoading(false)
            return
          } catch (e) {
            console.error('Error parsing dev user:', e)
          }
        }
      }

      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser) {
          router.push('/login')
          return
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (profile) {
          setUser(profile)
          setFormData({
            name: profile.name || '',
            email: profile.email || '',
            phone: profile.phone || '',
          })
        }
      } catch (error) {
        console.error('Error loading user:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [router])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        setError('Please log in to update your profile')
        return
      }

      // Update user profile
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          name: formData.name.trim(),
          phone: formData.phone.trim() || null,
        })
        .eq('user_id', authUser.id)

      if (updateError) {
        throw updateError
      }

      // Update email in auth if changed
      if (formData.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email.trim().toLowerCase(),
        })

        if (emailError) {
          throw emailError
        }
      }

      setSuccess('Profile updated successfully!')
      // Reload user data
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .single()

      if (profile) {
        setUser(profile)
      }
    } catch (error: any) {
      console.error('Error updating profile:', error)
      setError(error.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match')
      setSaving(false)
      return
    }

    if (passwordData.newPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      setSaving(false)
      return
    }

    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        setError('Please log in to change your password')
        return
      }

      // Update password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      })

      if (passwordError) {
        throw passwordError
      }

      setSuccess('Password changed successfully!')
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (error: any) {
      console.error('Error changing password:', error)
      setError(error.message || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Layout pageTitle="Settings">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!user) {
    return null
  }

  return (
    <Layout pageTitle="Settings">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <div className="flex items-center gap-3 mb-2">
            <SettingsIcon className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-neutral-text">Settings</h1>
          </div>
          <p className="text-neutral-medium">Manage your account settings and preferences</p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Profile Settings */}
        <div className="bg-white rounded-card border border-neutral-light shadow-soft">
          <div className="p-6 border-b border-neutral-light">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-neutral-text">Profile Information</h2>
            </div>
          </div>
          <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-light rounded-button focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-light rounded-button focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+256 700 000 000"
                  className="w-full px-4 py-2 border border-neutral-light rounded-button focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">
                  Role
                </label>
                <input
                  type="text"
                  value={user.role?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'N/A'}
                  disabled
                  className="w-full px-4 py-2 border border-neutral-light rounded-button bg-neutral-light text-neutral-medium cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-neutral-light">
              <button
                type="submit"
                disabled={saving}
                className="bg-club-gradient text-white px-6 py-3 rounded-button font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Password Settings */}
        <div className="bg-white rounded-card border border-neutral-light shadow-soft">
          <div className="p-6 border-b border-neutral-light">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-neutral-text">Change Password</h2>
            </div>
          </div>
          <form onSubmit={handleChangePassword} className="p-6 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-light rounded-button focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  minLength={6}
                  className="w-full px-4 py-2 border border-neutral-light rounded-button focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-neutral-medium mt-1">Must be at least 6 characters long</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  minLength={6}
                  className="w-full px-4 py-2 border border-neutral-light rounded-button focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-neutral-light">
              <button
                type="submit"
                disabled={saving || !passwordData.newPassword || !passwordData.confirmPassword}
                className="bg-club-gradient text-white px-6 py-3 rounded-button font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {saving ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Account Information */}
        <div className="bg-white rounded-card border border-neutral-light shadow-soft">
          <div className="p-6 border-b border-neutral-light">
            <h2 className="text-xl font-bold text-neutral-text">Account Information</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-neutral-light">
              <span className="text-sm font-medium text-neutral-medium">User ID</span>
              <span className="text-sm text-neutral-text font-mono">{user.user_id?.substring(0, 8)}...</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-neutral-light">
              <span className="text-sm font-medium text-neutral-medium">Unique ID</span>
              <span className="text-sm text-neutral-text font-mono">{user.unique_id || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-neutral-light">
              <span className="text-sm font-medium text-neutral-medium">Account Status</span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                user.status === 'active' ? 'bg-success/20 text-success' :
                user.status === 'inactive' ? 'bg-secondary/20 text-secondary' :
                user.status === 'injured' ? 'bg-warning/20 text-warning' :
                'bg-neutral-light text-neutral-medium'
              }`}>
                {user.status?.toUpperCase() || 'PENDING'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-neutral-medium">Member Since</span>
              <span className="text-sm text-neutral-text">
                {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}


