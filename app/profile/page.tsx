'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import { User, Mail, Phone, Shield, Camera, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    emergency_contact: '',
    emergency_phone: '',
  })

  useEffect(() => {
    const loadProfile = async () => {
      // Check for dev mode first
      if (typeof window !== 'undefined') {
        const devUser = localStorage.getItem('dev_user')
        if (devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            setFormData({
              name: userData.name || '',
              phone: userData.phone || '',
              emergency_contact: userData.emergency_contact || '',
              emergency_phone: userData.emergency_phone || '',
            })
            setLoading(false)
            return
          } catch (e) {
            // Invalid dev data, fall through
          }
        }
      }

      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (authUser) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (profile) {
          setUser(profile)
          setFormData({
            name: profile.name || '',
            phone: profile.phone || '',
            emergency_contact: profile.emergency_contact || '',
            emergency_phone: profile.emergency_phone || '',
          })
        }
      }
      setLoading(false)
    }

    loadProfile()
  }, [])

  const handleSave = async () => {
    // In dev mode, just update localStorage
    if (typeof window !== 'undefined' && localStorage.getItem('dev_user')) {
      const devUser = JSON.parse(localStorage.getItem('dev_user') || '{}')
      const updatedUser = { ...devUser, ...formData }
      localStorage.setItem('dev_user', JSON.stringify(updatedUser))
      setUser(updatedUser)
      setEditing(false)
      alert('Profile updated! (Dev Mode)')
      return
    }

    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (authUser) {
      const { error } = await supabase
        .from('user_profiles')
        .update(formData)
        .eq('user_id', authUser.id)

      if (!error) {
        setEditing(false)
        setUser({ ...user, ...formData })
      }
    }
  }

  if (loading) {
    return (
      <Layout pageTitle="My Profile">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!user) return null

  return (
    <Layout pageTitle="My Profile">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-card shadow-soft border border-neutral-light p-6 hover:shadow-medium transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-4xl font-extrabold text-club-gradient">My Profile</h1>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-6 py-3 bg-club-gradient text-white rounded-button font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium"
              >
                Edit Profile
              </button>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-shrink-0">
              <div className="relative w-32 h-32 rounded-full overflow-hidden bg-neutral-light">
                {user.profile_picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.profile_picture_url}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-club-gradient">
                    <User className="w-16 h-16 text-white" />
                  </div>
                )}
                {editing && (
                  <label className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center cursor-pointer hover:bg-opacity-70 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-1">
                  Unique ID
                </label>
                <div className="flex items-center text-neutral-text">
                  <Shield className="w-4 h-4 mr-2" />
                  {user.unique_id}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-1">
                  Name
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                ) : (
                  <div className="flex items-center text-neutral-text">
                    <User className="w-4 h-4 mr-2 text-neutral-medium" />
                    {user.name}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-1">
                  Email
                </label>
                <div className="flex items-center text-neutral-text">
                  <Mail className="w-4 h-4 mr-2 text-neutral-medium" />
                  {user.email}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-1">
                  Phone
                </label>
                {editing ? (
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                ) : (
                  <div className="flex items-center text-neutral-text">
                    <Phone className="w-4 h-4 mr-2 text-neutral-medium" />
                    {user.phone || 'Not provided'}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-1">
                  Role
                </label>
                <div className="text-neutral-text capitalize">
                  {user.role.replace('_', ' ')}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-1">
                  Status
                </label>
                <div className="text-neutral-text capitalize">
                  {user.status}
                </div>
              </div>

              {editing && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-1">
                      Emergency Contact
                    </label>
                    <input
                      type="text"
                      value={formData.emergency_contact}
                      onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-1">
                      Emergency Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.emergency_phone}
                      onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSave}
                      className="px-6 py-3 bg-club-gradient text-white rounded-button font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false)
                        setFormData({
                          name: user.name || '',
                          phone: user.phone || '',
                          emergency_contact: user.emergency_contact || '',
                          emergency_phone: user.emergency_phone || '',
                        })
                      }}
                      className="px-6 py-3 bg-neutral-light text-neutral-text rounded-button font-semibold hover:bg-neutral-medium transition-all duration-300"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

