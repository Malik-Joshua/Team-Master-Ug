'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import RefreshButton from '@/components/RefreshButton'
import { Search } from 'lucide-react'
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

export default function StaffPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

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

  if (loading) {
    return (
      <Layout pageTitle="Staff">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!user || user.role !== 'admin') {
    return null
  }

  const filteredStaff = staff.filter((member) => {
    const search = searchTerm.toLowerCase()
    const name = (member.name || '').toLowerCase()
    const email = (member.email || '').toLowerCase()
    const role = (ROLE_LABELS[member.role] || member.role).toLowerCase()
    return name.includes(search) || email.includes(search) || role.includes(search)
  })

  return (
    <Layout pageTitle="Staff">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-[20px] font-medium text-tm-text-1 mb-1 sm:mb-2">
              Staff Directory
            </h1>
            <p className="text-sm sm:text-[13px] text-tm-text-3">
              View active staff members and their roles
            </p>
          </div>
          <RefreshButton onRefresh={loadData} />
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
              <div className="px-4 py-8 text-center text-tm-text-3">
                No staff members found
              </div>
            ) : (
              filteredStaff.map((member) => (
                <div key={member.user_id} className="p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-tm-secondary flex items-center justify-center text-tm-on-secondary font-bold flex-shrink-0">
                      {member.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-tm-text-1 truncate">{member.name}</p>
                      <p className="text-sm text-tm-text-3 truncate">{member.email}</p>
                    </div>
                  </div>
                  <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {ROLE_LABELS[member.role] || member.role.replace('_', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-tm-surface-hover">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">
                    Email
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tm-border">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-tm-text-3">
                      No staff members found
                    </td>
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
                          {ROLE_LABELS[member.role] || member.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-tm-text-3">{member.email}</td>
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
    </Layout>
  )
}
