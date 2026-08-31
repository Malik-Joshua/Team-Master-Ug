'use client'

import { useEffect, useRef, useState } from 'react'
import Layout from '@/components/Layout'
import { User, Mail, Phone, Shield, Camera, Save, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RefreshButton from '@/components/RefreshButton'
import RoleCard from '@/components/RoleCard'
import ClubColorPicker from '@/components/ui/ClubColorPicker'


export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [club, setClub] = useState<any>(null)
  const [position, setPosition] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingPicture, setUploadingPicture] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const pictureInputRef = useRef<HTMLInputElement>(null)

  // Club slogan editing (admin only) — hypes the team, shown on selection
  // screens elsewhere in the app.
  const [editingSlogan, setEditingSlogan] = useState(false)
  const [sloganDraft, setSloganDraft] = useState('')
  const [savingSlogan, setSavingSlogan] = useState(false)

  // Club name editing (admin only) — the club's actual name, shown on fixtures
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Club theme editing (admin only) — lets an admin re-skin the whole app
  // (e.g. re-branding an existing test club's data for a new client demo)
  // without re-running onboarding. Applied live everywhere Layout.tsx reads
  // club_settings.primary_color.
  const [editingTheme, setEditingTheme] = useState(false)
  const [themeDraft, setThemeDraft] = useState('#0ea5e9')
  const [savingTheme, setSavingTheme] = useState(false)

  const handleSaveTheme = async () => {
    setSavingTheme(true)
    try {
      const res = await fetch('/api/club/update-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary_color: themeDraft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save theme')
      setClub((prev: any) => ({ ...(prev || {}), primary_color: data.primary_color }))
      setEditingTheme(false)
      // The colour drives every page's CSS variables via Layout.tsx, which
      // re-reads club_settings on mount — a reload is the simplest way to
      // guarantee every already-mounted page (sidebar, topbar, etc.) picks
      // up the new palette immediately rather than waiting for their own
      // next navigation.
      window.location.reload()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
      setSavingTheme(false)
    }
  }

  const handleSaveSlogan = async () => {
    setSavingSlogan(true)
    try {
      const res = await fetch('/api/club/update-slogan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slogan: sloganDraft.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save slogan')
      setClub((prev: any) => ({ ...(prev || {}), club_slogan: data.slogan }))
      setEditingSlogan(false)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setSavingSlogan(false)
    }
  }

  const handleSaveName = async () => {
    setSavingName(true)
    try {
      const res = await fetch('/api/club/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameDraft.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save club name')
      setClub((prev: any) => ({ ...(prev || {}), club_nickname: data.club_nickname }))
      setEditingName(false)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setSavingName(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('persist', 'true')
      const res = await fetch('/api/club/upload-badge', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Upload failed')
      }
      const { url } = await res.json()
      setClub((prev: any) => ({ ...(prev || {}), badge_url: url }))
      alert('Club logo updated! It will appear across the app.')
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }
  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPicture(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/profile/upload-picture', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Upload failed')
      }
      const { url } = await res.json()
      setUser((prev: any) => ({ ...prev, profile_picture_url: url }))
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setUploadingPicture(false)
      if (pictureInputRef.current) pictureInputRef.current.value = ''
    }
  }

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    emergency_contact: '',
    emergency_phone: '',
    birth_date: '',
  })

  useEffect(() => {
    const loadProfile = async () => {
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
            birth_date: profile.birth_date ? new Date(profile.birth_date).toISOString().split('T')[0] : '',
          })

          // Players have a position (in the players table) used to pick their role card
          if (profile.role === 'player') {
            const { data: playerRow } = await supabase
              .from('players')
              .select('position')
              .eq('user_id', authUser.id)
              .maybeSingle()
            setPosition(playerRow?.position || null)
          }
        }

        // Load club branding (latest-updated row = source of truth).
        // club_slogan is a newer column (migration 043) — fall back to
        // selecting without it if that migration hasn't run yet.
        let clubData: any
        let clubError: any
        ;({ data: clubData, error: clubError } = await supabase
          .from('club_settings')
          .select('club_nickname, club_slogan, badge_url, league, primary_color')
          .order('updated_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle())
        if (clubError?.message?.includes('club_slogan')) {
          const retry = await supabase
            .from('club_settings')
            .select('club_nickname, badge_url, league, primary_color')
            .order('updated_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          clubData = retry.data
        }
        if (clubData) setClub(clubData)
      }
      setLoading(false)
    }

    loadProfile()
  }, [])

  const handleSave = async () => {
    // Use API route to update profile (bypasses RLS and schema cache issues)
    try {
      const response = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone || null,
          emergency_contact: formData.emergency_contact || null,
          emergency_phone: formData.emergency_phone || null,
        birth_date: formData.birth_date || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update profile')
      }

      const result = await response.json()
        setEditing(false)
      setUser({ ...user, ...result.data })
        alert('Profile updated successfully!')
    } catch (error: any) {
      console.error('Error updating profile:', error)
        alert(`Error updating profile: ${error.message}`)
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

  const loadProfile = async () => {
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
          birth_date: profile.birth_date ? new Date(profile.birth_date).toISOString().split('T')[0] : '',
        })

        if (profile.role === 'player') {
          const { data: playerRow } = await supabase
            .from('players')
            .select('position')
            .eq('user_id', authUser.id)
            .maybeSingle()
          setPosition(playerRow?.position || null)
        }
      }

      let clubData: any
      let clubError: any
      ;({ data: clubData, error: clubError } = await supabase
        .from('club_settings')
        .select('club_nickname, club_slogan, badge_url, league, primary_color')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle())
      if (clubError?.message?.includes('club_slogan')) {
        const retry = await supabase
          .from('club_settings')
          .select('club_nickname, badge_url, league, primary_color')
          .order('updated_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        clubData = retry.data
      }
      if (clubData) setClub(clubData)
    }
    setLoading(false)
  }

  return (
    <Layout pageTitle="My Profile">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Role card — a morale boost reminding players/coaches why their role matters */}
        <RoleCard role={user.role} position={position} />

        {/* Club membership card — shows the full club crest so members feel part of the club */}
        <div className="overflow-hidden rounded-card border border-tm-border bg-tm-surface shadow-soft">
          <div className="h-1.5 w-full bg-tm-secondary" />
          <div className="flex items-center gap-4 p-5 sm:gap-5 sm:p-6">
            <div className="group relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-tm-border bg-tm-surface-hover sm:h-24 sm:w-24">
              {club?.badge_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={club.badge_url}
                  alt={club?.club_nickname || 'Club logo'}
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <span className="font-serif text-2xl font-semibold text-tm-secondary">
                  {(club?.club_nickname || 'Team Master')
                    .split(' ')
                    .map((w: string) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </span>
              )}
              {user.role === 'admin' && (
                <>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    title="Upload club logo"
                    className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100"
                  >
                    {uploadingLogo ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <span className="flex flex-col items-center gap-0.5">
                        <Camera className="h-5 w-5" />
                        <span className="text-[9px] font-medium">{club?.badge_url ? 'Change' : 'Upload'}</span>
                      </span>
                    )}
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-tm-text-3">
                Club membership
              </p>
              <h2 className="truncate text-xl font-semibold text-tm-text-1 sm:text-2xl">
                {club?.club_nickname || 'Team Master'}
              </h2>
              <p className="truncate text-sm text-tm-text-3">
                {club?.league || 'Rugby · Premiership'}
              </p>
            </div>
            <div className="hidden flex-shrink-0 flex-col items-end gap-1.5 sm:flex">
              <span className="rounded-full bg-tm-badge px-3 py-1 text-xs font-medium capitalize text-tm-badge-text">
                {user.role.replace('_', ' ')}
              </span>
              <span className="text-[11px] text-tm-text-3">Active member</span>
            </div>
          </div>

          {/* Club name — the official name of the club, shown on fixtures and
              match day alerts. Admins can edit it here. */}
          <div className="border-t border-tm-border px-5 py-4 sm:px-6">
            {editingName ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="e.g. The Heathens"
                  className="w-full flex-1 rounded-lg border-2 border-tm-border px-3 py-2 text-sm text-tm-text-1 transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <div className="flex flex-shrink-0 gap-2">
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-tm-secondary px-3 py-2 text-sm font-semibold text-tm-on-secondary transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" /> {savingName ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    disabled={savingName}
                    className="rounded-lg border border-tm-border px-3 py-2 text-sm font-medium text-tm-text-1 transition-colors hover:bg-tm-surface-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-tm-text-3">Club Name</p>
                  <p className="text-sm font-semibold text-tm-text-1">{club?.club_nickname || 'Team Master'}</p>
                </div>
                {user.role === 'admin' && (
                  <button
                    onClick={() => { setNameDraft(club?.club_nickname || ''); setEditingName(true) }}
                    className="flex-shrink-0 text-xs font-medium text-tm-text-3 underline decoration-dotted hover:text-tm-text-1"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Club slogan — hypes the team; admins can edit it here and it
              renders wherever the club's rallying line is shown (e.g. a
              player's "You're Selected!" dashboard alert). */}
          <div className="border-t border-tm-border px-5 py-4 sm:px-6">
            {editingSlogan ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={sloganDraft}
                  onChange={(e) => setSloganDraft(e.target.value)}
                  placeholder="e.g. Strength. Unity. Victory."
                  className="w-full flex-1 rounded-lg border-2 border-tm-border px-3 py-2 text-sm text-tm-text-1 transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <div className="flex flex-shrink-0 gap-2">
                  <button
                    onClick={handleSaveSlogan}
                    disabled={savingSlogan}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-tm-secondary px-3 py-2 text-sm font-semibold text-tm-on-secondary transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" /> {savingSlogan ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingSlogan(false)}
                    disabled={savingSlogan}
                    className="rounded-lg border border-tm-border px-3 py-2 text-sm font-medium text-tm-text-1 transition-colors hover:bg-tm-surface-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                {club?.club_slogan ? (
                  <p className="truncate font-semibold italic text-primary">&ldquo;{club.club_slogan}&rdquo;</p>
                ) : (
                  <p className="text-sm text-tm-text-3">
                    {user.role === 'admin' ? 'No club slogan set yet — add one to hype the team.' : 'No club slogan set yet.'}
                  </p>
                )}
                {user.role === 'admin' && (
                  <button
                    onClick={() => { setSloganDraft(club?.club_slogan || ''); setEditingSlogan(true) }}
                    className="flex-shrink-0 text-xs font-medium text-tm-text-3 underline decoration-dotted hover:text-tm-text-1"
                  >
                    {club?.club_slogan ? 'Edit' : 'Add slogan'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Club theme — admin only. Re-skins the whole app from a single
              colour without re-running onboarding. This is the escape hatch
              for re-branding an existing club's data (players, fixtures,
              stats, squads all stay put) for a different client — e.g.
              switching a test club over to a new prospect's colours ahead
              of a demo. */}
          {user.role === 'admin' && (
            <div className="border-t border-tm-border px-5 py-4 sm:px-6">
              {editingTheme ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-tm-text-3">Club Theme</p>
                  <ClubColorPicker value={themeDraft} onChange={setThemeDraft} />
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleSaveTheme}
                      disabled={savingTheme}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-tm-secondary px-3 py-2 text-sm font-semibold text-tm-on-secondary transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" /> {savingTheme ? 'Applying…' : 'Apply theme'}
                    </button>
                    <button
                      onClick={() => setEditingTheme(false)}
                      disabled={savingTheme}
                      className="rounded-lg border border-tm-border px-3 py-2 text-sm font-medium text-tm-text-1 transition-colors hover:bg-tm-surface-hover"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-[11px] text-tm-text-3">
                    Applies instantly across the whole app — players, fixtures, stats, and squads are untouched.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-6 w-6 flex-shrink-0 rounded-full border border-tm-border"
                      style={{ background: club?.primary_color || '#0ea5e9' }}
                    />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-tm-text-3">Club Theme</p>
                      <p className="text-sm text-tm-text-1">{(club?.primary_color || '#0ea5e9').toUpperCase()}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setThemeDraft(club?.primary_color || '#0ea5e9'); setEditingTheme(true) }}
                    className="flex-shrink-0 text-xs font-medium text-tm-text-3 underline decoration-dotted hover:text-tm-text-1"
                  >
                    Change theme
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-tm-surface rounded-card shadow-soft border border-tm-border p-6 hover:shadow-medium transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-[20px] font-medium text-tm-text-1">My Profile</h1>
            <div className="flex gap-3">
              <RefreshButton onRefresh={loadProfile} />
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="px-6 py-3 bg-tm-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-shrink-0">
              <div className="group relative w-32 h-32 rounded-full overflow-hidden bg-tm-surface-hover">
                {user.profile_picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.profile_picture_url}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-tm-secondary">
                    <User className="w-16 h-16 text-tm-on-secondary" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => pictureInputRef.current?.click()}
                  disabled={uploadingPicture}
                  title="Upload profile picture"
                  className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100 cursor-pointer"
                >
                  {uploadingPicture ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <span className="flex flex-col items-center gap-0.5">
                      <Camera className="h-6 w-6" />
                      <span className="text-[9px] font-medium">
                        {user.profile_picture_url ? 'Change' : 'Upload'}
                      </span>
                    </span>
                  )}
                </button>
                <input
                  ref={pictureInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePictureUpload}
                />
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-tm-text-3 mb-1">
                  Unique ID
                </label>
                <div className="flex items-center text-tm-text-1">
                  <Shield className="w-4 h-4 mr-2" />
                  {user.unique_id}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-tm-text-3 mb-1">
                  Name
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                ) : (
                  <div className="flex items-center text-tm-text-1">
                    <User className="w-4 h-4 mr-2 text-tm-text-3" />
                    {user.name}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-tm-text-3 mb-1">
                  Email
                </label>
                <div className="flex items-center text-tm-text-1">
                  <Mail className="w-4 h-4 mr-2 text-tm-text-3" />
                  {user.email}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-tm-text-3 mb-1">
                  Phone
                </label>
                {editing ? (
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                ) : (
                  <div className="flex items-center text-tm-text-1">
                    <Phone className="w-4 h-4 mr-2 text-tm-text-3" />
                    {user.phone || 'Not provided'}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-tm-text-3 mb-1">
                  Role
                </label>
                <div className="text-tm-text-1 capitalize">
                  {user.role.replace('_', ' ')}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-tm-text-3 mb-1">
                  Status
                </label>
                <div className="text-tm-text-1 capitalize">
                  {user.status}
                </div>
              </div>

              {user.birth_date && (
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-1">
                    Birth Date
                  </label>
                  <div className="text-tm-text-1">
                    {new Date(user.birth_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              )}

              {editing && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-1">
                      Emergency Contact
                    </label>
                    <input
                      type="text"
                      value={formData.emergency_contact}
                      onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-1">
                      Emergency Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.emergency_phone}
                      onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-1">
                      Birth Date
                    </label>
                    <input
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      max={new Date().toISOString().split('T')[0]}
                    />
                    <p className="text-xs text-tm-text-3 mt-1">
                      Your birthday will be used to show birthday alerts and wish you a happy birthday!
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSave}
                      className="px-6 py-3 bg-tm-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
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
                          birth_date: user.birth_date ? new Date(user.birth_date).toISOString().split('T')[0] : '',
                        })
                      }}
                      className="px-6 py-3 bg-tm-surface-hover text-tm-text-1 rounded-[6px] font-semibold hover:bg-tm-surface-hover transition-all duration-300"
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

