'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import RefreshButton from '@/components/RefreshButton'
import { Search, AlertTriangle, X, UserPlus, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface StaffMember {
  user_id: string
  name: string
  email: string
  role: string
  status?: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  coach: 'Coach',
  data_admin: 'Team Manager',
  finance_admin: 'Finance Admin',
  physio: 'Physio',
  club_captain: 'Club Captain',
}

type ConfirmAction = { member: StaffMember; action: 'suspend' | 'fire' | 'reinstate' } | null

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === 'active') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/15 text-success">Active</span>
  }
  if (status === 'suspended') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/15 text-warning">Suspended</span>
  }
  if (status === 'fired') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary/15 text-secondary">Fired</span>
  }
  // DB 'inactive' — show as suspended until DB migration expands the constraint
  if (status === 'inactive') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/15 text-warning">Inactive</span>
  }
  return null
}

export default function StaffPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [confirm, setConfirm] = useState<ConfirmAction>(null)
  const [actioning, setActioning] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [staffForm, setStaffForm] = useState({ name: '', email: '', phone: '', role: 'coach' })

  const handleAddStaff = async () => {
    if (!staffForm.name.trim() || !staffForm.email.trim() || !staffForm.role) return
    setSaving(true)
    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: staffForm.name.trim(),
          email: staffForm.email.trim(),
          phone: staffForm.phone.trim() || undefined,
          role: staffForm.role,
          status: 'active',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to add staff member')
        return
      }
      // Mirror the Add Player UX: confirm the onboarding email went out, or
      // fall back to showing the temp password for the admin to hand over.
      const d = data.data || data
      if (d?.emailSent) {
        alert(`${staffForm.name} added! An onboarding email with their login details has been sent to ${staffForm.email}.`)
      } else {
        const reason = d?.emailError ? ` (${d.emailError})` : ''
        alert(
          `${staffForm.name} added! Could not send the onboarding email${reason}.\n\n` +
          `Share these sign-in details with them directly:\n` +
          `Email: ${staffForm.email}\nTemporary password: ${d?.tempPassword || '(unavailable)'}`
        )
      }
      setShowAddModal(false)
      setStaffForm({ name: '', email: '', phone: '', role: 'coach' })
      await loadData()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', authUser.id)
      .single()

    if (profile) {
      setUser(profile)

      if (profile.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      try {
        const response = await fetch('/api/admin/staff', { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          setStaff(data.staff || [])
        } else {
          setStaff([])
        }
      } catch (error) {
        console.error('Error loading staff:', error)
        setStaff([])
      }
    }

    setLoading(false)
  }, [router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAction = async () => {
    if (!confirm) return
    setActioning(true)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: confirm.member.user_id, action: confirm.action }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Action failed')
      } else {
        setStaff(prev =>
          prev.map(m => m.user_id === confirm.member.user_id ? { ...m, status: data.status } : m)
        )
      }
    } catch (e) {
      alert('An error occurred. Please try again.')
    } finally {
      setActioning(false)
      setConfirm(null)
    }
  }

  if (loading) {
    return (
      <Layout pageTitle="Staff">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!user || user.role !== 'admin') return null

  const filteredStaff = staff.filter((member) => {
    const search = searchTerm.toLowerCase()
    const name = (member.name || '').toLowerCase()
    const email = (member.email || '').toLowerCase()
    const role = (ROLE_LABELS[member.role] || member.role).toLowerCase()
    return name.includes(search) || email.includes(search) || role.includes(search)
  })

  // When more than one person holds the same role, number them so they're
  // distinguishable (e.g. "Admin #1", "Admin #2"). Computed from the full
  // staff list (not the filtered view) so the numbers stay stable while
  // searching.
  const roleTotals: Record<string, number> = {}
  staff.forEach((m) => { roleTotals[m.role] = (roleTotals[m.role] || 0) + 1 })
  const roleNumberById: Record<string, number> = {}
  const roleRunning: Record<string, number> = {}
  staff.forEach((m) => {
    roleRunning[m.role] = (roleRunning[m.role] || 0) + 1
    roleNumberById[m.user_id] = roleRunning[m.role]
  })
  const roleLabelFor = (member: StaffMember) => {
    const base = ROLE_LABELS[member.role] || member.role.replace('_', ' ')
    return roleTotals[member.role] > 1 ? `${base} #${roleNumberById[member.user_id]}` : base
  }

  const getActionLabel = (action: 'suspend' | 'fire' | 'reinstate') =>
    action === 'suspend' ? 'Suspend' : action === 'fire' ? 'Fire' : 'Reinstate'

  const getActionColor = (action: 'suspend' | 'fire' | 'reinstate') =>
    action === 'reinstate'
      ? 'bg-success text-white hover:bg-success/90'
      : action === 'suspend'
      ? 'bg-warning text-white hover:bg-warning/90'
      : 'bg-secondary text-white hover:bg-secondary/90'

  return (
    <Layout pageTitle="Staff">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-[20px] font-medium text-tm-text-1 mb-1 sm:mb-2">Staff Directory</h1>
            <p className="text-sm sm:text-[13px] text-tm-text-3">Manage staff members and their access</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-tm-secondary text-tm-on-secondary px-4 py-2.5 rounded-[6px] text-sm font-semibold hover:opacity-90 transition-all shadow-soft inline-flex items-center whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Staff Member
            </button>
            <RefreshButton onRefresh={loadData} />
          </div>
        </div>

        <div className="bg-tm-surface rounded-card p-4 sm:p-6 border border-tm-border shadow-soft">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-tm-text-3 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            />
          </div>
        </div>

        <div className="bg-tm-surface rounded-card border border-tm-border shadow-soft overflow-hidden">
          {/* Mobile card layout */}
          <div className="md:hidden divide-y divide-tm-border">
            {filteredStaff.length === 0 ? (
              <div className="px-4 py-8 text-center text-tm-text-3">No staff members found</div>
            ) : (
              filteredStaff.map((member) => (
                <div key={member.user_id} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-tm-secondary flex items-center justify-center text-tm-on-secondary font-bold flex-shrink-0">
                      {member.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-tm-text-1 truncate">{member.name}</p>
                      <p className="text-sm text-tm-text-3 truncate">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {roleLabelFor(member)}
                    </span>
                    <StatusBadge status={member.status} />
                  </div>
                  {member.user_id !== user.user_id && (
                    <div className="flex gap-2 flex-wrap">
                      {(!member.status || member.status === 'active') && (
                        <>
                          <button onClick={() => setConfirm({ member, action: 'suspend' })} className="px-3 py-1.5 rounded-md text-xs font-medium bg-warning/15 text-warning hover:bg-warning/25 transition-colors">Suspend</button>
                          <button onClick={() => setConfirm({ member, action: 'fire' })} className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary/15 text-secondary hover:bg-secondary/25 transition-colors">Fire</button>
                        </>
                      )}
                      {(member.status === 'suspended' || member.status === 'inactive') && (
                        <>
                          <button onClick={() => setConfirm({ member, action: 'reinstate' })} className="px-3 py-1.5 rounded-md text-xs font-medium bg-success/15 text-success hover:bg-success/25 transition-colors">Reinstate</button>
                          <button onClick={() => setConfirm({ member, action: 'fire' })} className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary/15 text-secondary hover:bg-secondary/25 transition-colors">Fire</button>
                        </>
                      )}
                      {member.status === 'fired' && (
                        <span className="text-xs text-tm-text-3 italic">Permanently fired</span>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-tm-surface-hover">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tm-border">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-tm-text-3">No staff members found</td>
                  </tr>
                ) : (
                  filteredStaff.map((member) => (
                    <tr key={member.user_id} className="hover:bg-tm-surface-hover/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-tm-secondary flex items-center justify-center text-tm-on-secondary font-bold flex-shrink-0">
                            {member.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <span className="font-medium text-tm-text-1">{member.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {roleLabelFor(member)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-tm-text-3">{member.email}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={member.status} />
                      </td>
                      <td className="px-6 py-4">
                        {member.user_id === user.user_id ? (
                          <span className="text-xs text-tm-text-3">—</span>
                        ) : (
                          <div className="flex gap-2">
                            {(!member.status || member.status === 'active') && (
                              <>
                                <button onClick={() => setConfirm({ member, action: 'suspend' })} className="px-3 py-1.5 rounded-md text-xs font-medium bg-warning/15 text-warning hover:bg-warning/25 transition-colors">Suspend</button>
                                <button onClick={() => setConfirm({ member, action: 'fire' })} className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary/15 text-secondary hover:bg-secondary/25 transition-colors">Fire</button>
                              </>
                            )}
                            {(member.status === 'suspended' || member.status === 'inactive') && (
                              <>
                                <button onClick={() => setConfirm({ member, action: 'reinstate' })} className="px-3 py-1.5 rounded-md text-xs font-medium bg-success/15 text-success hover:bg-success/25 transition-colors">Reinstate</button>
                                <button onClick={() => setConfirm({ member, action: 'fire' })} className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary/15 text-secondary hover:bg-secondary/25 transition-colors">Fire</button>
                              </>
                            )}
                            {member.status === 'fired' && (
                              <span className="text-xs text-tm-text-3 italic">Permanently fired</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {filteredStaff.length > 0 && (
          <p className="text-sm text-tm-text-3">
            {filteredStaff.length} staff member{filteredStaff.length !== 1 ? 's' : ''} found
          </p>
        )}
      </div>

      {/* Add Staff Member modal */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => !saving && setShowAddModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-tm-surface rounded-card border border-tm-border shadow-large w-full max-w-lg">
              <div className="p-6 border-b border-tm-border flex items-center justify-between">
                <h2 className="text-2xl font-bold text-tm-text-1">Add Staff Member</h2>
                <button onClick={() => !saving && setShowAddModal(false)} className="text-tm-text-3 hover:text-tm-text-1 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-tm-text-3">
                  Fill in their details and we&apos;ll email them an onboarding link with a temporary password so they can sign in and set up their own account.
                </p>
                <div>
                  <label className="block text-sm font-medium text-tm-text-1 mb-1">Full name <span className="text-secondary">*</span></label>
                  <input
                    type="text"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    placeholder="e.g. Jane Doe"
                    className="w-full px-4 py-2.5 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-1 mb-1">Email <span className="text-secondary">*</span></label>
                  <input
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="name@example.com"
                    className="w-full px-4 py-2.5 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-1 mb-1">Phone (optional)</label>
                  <input
                    type="tel"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    placeholder="+256…"
                    className="w-full px-4 py-2.5 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-1 mb-1">Role <span className="text-secondary">*</span></label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="admin">Admin</option>
                    <option value="coach">Coach</option>
                    <option value="asst_coach">Assistant Coach</option>
                    <option value="data_admin">Team Manager</option>
                    <option value="finance_admin">Finance Admin</option>
                    <option value="physio">Physio</option>
                  </select>
                  <p className="text-xs text-tm-text-3 mt-1">You can add more than one person per role — they&apos;ll be numbered (e.g. &quot;Admin #2&quot;).</p>
                </div>
              </div>
              <div className="p-6 border-t border-tm-border flex justify-end gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                  className="px-5 py-2 border border-tm-border rounded-[6px] font-semibold text-tm-text-1 hover:bg-tm-surface-hover transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStaff}
                  disabled={saving || !staffForm.name.trim() || !staffForm.email.trim()}
                  className="px-5 py-2 bg-tm-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-colors inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Adding…' : 'Add & Send Invite'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Confirmation modal */}
      {confirm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => !actioning && setConfirm(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-tm-surface rounded-card border border-tm-border shadow-large w-full max-w-md p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary/15">
                    <AlertTriangle className="w-5 h-5 text-secondary" />
                  </div>
                  <h2 className="text-[16px] font-semibold text-tm-text-1">
                    {confirm.action === 'suspend' ? 'Suspend Staff Member' : confirm.action === 'fire' ? 'Fire Staff Member' : 'Reinstate Staff Member'}
                  </h2>
                </div>
                <button onClick={() => !actioning && setConfirm(null)} className="text-tm-text-3 hover:text-tm-text-1 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-tm-text-2 mb-6">
                {confirm.action === 'suspend' && <>Are you sure you want to <strong>suspend</strong> <strong>{confirm.member.name}</strong>? They will lose access to the system until reinstated.</>}
                {confirm.action === 'fire' && <>Are you sure you want to <strong>permanently fire</strong> <strong>{confirm.member.name}</strong>? Their account will be disabled immediately.</>}
                {confirm.action === 'reinstate' && <>Are you sure you want to <strong>reinstate</strong> <strong>{confirm.member.name}</strong>? They will regain full access to the system.</>}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirm(null)}
                  disabled={actioning}
                  className="px-4 py-2 rounded-md text-sm font-medium border border-tm-border text-tm-text-1 hover:bg-tm-surface-hover transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={actioning}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${getActionColor(confirm.action)}`}
                >
                  {actioning ? 'Processing…' : getActionLabel(confirm.action)}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
