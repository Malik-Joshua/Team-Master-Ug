'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Shield, BarChart3, DollarSign, UserCheck } from 'lucide-react'

const roles = [
  {
    value: 'player',
    label: 'Player',
    icon: Users,
    description: 'View personal stats, profile, and performance',
  },
  {
    value: 'coach',
    label: 'Coach',
    icon: UserCheck,
    description: 'Manage players, schedule training, view team stats',
  },
  {
    value: 'data_admin',
    label: 'Team Manager',
    icon: BarChart3,
    description: 'Log match stats, training attendance, player data',
  },
  {
    value: 'finance_admin',
    label: 'Finance Admin',
    icon: DollarSign,
    description: 'Manage finances, expenses, and revenue',
  },
  {
    value: 'admin',
    label: 'General Admin',
    icon: Shield,
    description: 'Full access to all features and user management',
  },
]

export default function DevLoginPage() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<string>('')

  const handleLogin = () => {
    if (!selectedRole) {
      alert('Please select a role first')
      return
    }

    const roleLabel = roles.find((r) => r.value === selectedRole)?.label || selectedRole
    const devUserData = {
      id: `dev-user-${selectedRole}-${Date.now()}`,
      user_id: `dev-user-${selectedRole}-${Date.now()}`,
      name: `Demo ${roleLabel}`,
      email: `${selectedRole}@demo.com`,
      role: selectedRole,
      unique_id: `MNG-DEV-${selectedRole.toUpperCase()}-${Date.now()}`,
      status: 'active',
    }

    localStorage.setItem('dev_role', selectedRole)
    localStorage.setItem('dev_user', JSON.stringify(devUserData))

    setTimeout(() => {
      router.push('/dashboard')
    }, 100)
  }

  return (
    <div className="min-h-screen bg-club-gradient flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Development Login</h1>
          <p className="text-xl text-blue-100">Select a role to preview the UI</p>
          <p className="text-sm text-blue-200 mt-2">No password required - for development only</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => {
            const Icon = role.icon
            const isSelected = selectedRole === role.value
            return (
              <button
                key={role.value}
                onClick={() => setSelectedRole(role.value)}
                className={`bg-white rounded-card p-6 text-left transition-all transform hover:scale-105 ${
                  isSelected ? 'ring-4 ring-yellow-400 shadow-large' : 'shadow-soft hover:shadow-medium'
                }`}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-club-gradient mb-4">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-neutral-text mb-2">{role.label}</h3>
                <p className="text-sm text-neutral-medium mb-4">{role.description}</p>
                {isSelected && (
                  <div className="flex items-center text-green-600 font-medium text-sm">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Selected
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={handleLogin}
            disabled={!selectedRole}
            className="bg-white text-primary px-8 py-4 rounded-button font-semibold text-lg hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center shadow-soft hover:shadow-medium"
          >
            Access Dashboard
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <div className="mt-4">
            <Link href="/login" className="text-white hover:text-blue-200 text-sm underline">
              Use real authentication instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
