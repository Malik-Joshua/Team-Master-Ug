'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import { User, Mail, Phone, Lock, Bell, Shield, Save, Camera, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Tab = 'account'

export default function SettingsPage() {
  const [activeTab] = useState<Tab>('account')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()

  // Profile settings
  const [profileData, setProfileData] = useState({
    name: '',
    phone: '',
    emergency_contact: '',
    emergency_phone: '',
  })

  // Password settings
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    messageNotifications: true,
    taskNotifications: true,
  })

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const supabase = createClient()
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
          router.push('/login')
          return
        }

        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (profileError) {
          console.error('Error loading profile:', profileError)
          setError('Failed to load profile settings')
        } else if (profile) {
          setUser(profile)
          setProfileData({
            name: profile.name || '',
            phone: profile.phone || '',
            emergency_contact: profile.emergency_contact || '',
            emergency_phone: profile.emergency_phone || '',
          })
        }
      } catch (err: any) {
        console.error('Error loading settings:', err)
        setError('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [router])

  const handleSaveProfile = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        setError('You must be logged in to update settings')
        return
      }

      // Update profile in user_profiles table
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          name: profileData.name,
          phone: profileData.phone || null,
          emergency_contact: profileData.emergency_contact || null,
          emergency_phone: profileData.emergency_phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', authUser.id)

      if (updateError) {
        console.error('Error updating profile:', updateError)
        setError(`Failed to update profile: ${updateError.message}`)
      } else {
        setSuccess('Profile updated successfully!')
        // Update user state
        setUser({ ...user, ...profileData })
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err: any) {
      console.error('Error saving profile:', err)
      setError(`Failed to save profile: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    // Validate passwords
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setError('Please fill in all password fields')
      setSaving(false)
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match')
      setSaving(false)
      return
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long')
      setSaving(false)
      return
    }

    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        setError('You must be logged in to change password')
        return
      }

      // Update password using Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      })

      if (updateError) {
        console.error('Error updating password:', updateError)
        setError(`Failed to update password: ${updateError.message}`)
      } else {
        setSuccess('Password updated successfully!')
        // Clear password fields
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err: any) {
      console.error('Error changing password:', err)
      setError(`Failed to change password: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNotifications = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Save notification preferences to localStorage for now
      // In the future, this could be saved to a user_preferences table
      if (typeof window !== 'undefined') {
        localStorage.setItem('notification_preferences', JSON.stringify(notificationSettings))
        setSuccess('Notification preferences saved!')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err: any) {
      console.error('Error saving notifications:', err)
      setError(`Failed to save notification preferences: ${err.message}`)
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

  return (
    <Layout pageTitle="Settings">
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-[20px] font-medium text-tm-text-1">Settings</h1>
          <p className="text-[13px] text-tm-text-3">Manage your account settings and preferences</p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-[#E05757]/10 border border-[#E05757]/30 text-[#E05757] px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded-lg flex items-center gap-2">
            <Save className="w-5 h-5" />
            <span>{success}</span>
          </div>
        )}

        {/* ── Account Tab ── */}
        {activeTab === 'account' && <>

        {/* Profile Settings */}
        <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-tm-text-1">Profile Information</h2>
              <p className="text-sm text-tm-text-3">Update your personal information</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter your full name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone Number
              </label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter your phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                Emergency Contact Name
              </label>
              <input
                type="text"
                value={profileData.emergency_contact}
                onChange={(e) => setProfileData({ ...profileData, emergency_contact: e.target.value })}
                className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter emergency contact name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                Emergency Contact Phone
              </label>
              <input
                type="tel"
                value={profileData.emergency_phone}
                onChange={(e) => setProfileData({ ...profileData, emergency_phone: e.target.value })}
                className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter emergency contact phone"
              />
            </div>

            {user && (
              <div>
                <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={user.email || ''}
                  className="w-full px-4 py-2 border border-tm-border rounded-lg bg-tm-surface-hover/50 cursor-not-allowed"
                  disabled
                />
                <p className="text-xs text-tm-text-3 mt-1">Email cannot be changed from settings</p>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                onClick={handleSaveProfile}
                disabled={saving || !profileData.name}
                className="px-6 py-2 bg-primary text-tm-on-secondary rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>

        {/* Password Settings */}
        <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Lock className="w-6 h-6 text-warning" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-tm-text-1">Change Password</h2>
              <p className="text-sm text-tm-text-3">Update your account password</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter new password (min. 6 characters)"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-tm-text-1 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-4 py-2 border border-tm-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Confirm new password"
              />
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleChangePassword}
                disabled={saving || !passwordData.newPassword || !passwordData.confirmPassword}
                className="px-6 py-2 bg-warning text-white rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {saving ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-info/10 rounded-lg">
              <Bell className="w-6 h-6 text-info" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-tm-text-1">Notification Preferences</h2>
              <p className="text-sm text-tm-text-3">Manage how you receive notifications</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-tm-border rounded-lg">
              <div>
                <label className="text-sm font-semibold text-tm-text-1">Email Notifications</label>
                <p className="text-xs text-tm-text-3">Receive notifications via email</p>
              </div>
              <input
                type="checkbox"
                checked={notificationSettings.emailNotifications}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, emailNotifications: e.target.checked })}
                className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-between p-4 border border-tm-border rounded-lg">
              <div>
                <label className="text-sm font-semibold text-tm-text-1">Message Notifications</label>
                <p className="text-xs text-tm-text-3">Get notified about new messages</p>
              </div>
              <input
                type="checkbox"
                checked={notificationSettings.messageNotifications}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, messageNotifications: e.target.checked })}
                className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-between p-4 border border-tm-border rounded-lg">
              <div>
                <label className="text-sm font-semibold text-tm-text-1">Task Notifications</label>
                <p className="text-xs text-tm-text-3">Get notified about new tasks and assignments</p>
              </div>
              <input
                type="checkbox"
                checked={notificationSettings.taskNotifications}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, taskNotifications: e.target.checked })}
                className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleSaveNotifications}
                disabled={saving}
                className="px-6 py-2 bg-info text-white rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>

        {/* Account Information */}
        {user && (
          <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-success/10 rounded-lg">
                <Shield className="w-6 h-6 text-success" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-tm-text-1">Account Information</h2>
                <p className="text-sm text-tm-text-3">Your account details</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-tm-surface-hover/50 rounded-lg">
                <span className="text-sm font-medium text-tm-text-3">Role</span>
                <span className="text-sm font-semibold text-tm-text-1 capitalize">{user.role?.replace('_', ' ') || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-tm-surface-hover/50 rounded-lg">
                <span className="text-sm font-medium text-tm-text-3">Status</span>
                <span className="text-sm font-semibold text-tm-text-1 capitalize">{user.status || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-tm-surface-hover/50 rounded-lg">
                <span className="text-sm font-medium text-tm-text-3">User ID</span>
                <span className="text-sm font-mono text-tm-text-1 text-xs">{user.user_id || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        </> /* end account tab */}
      </div>
    </Layout>
  )
}

