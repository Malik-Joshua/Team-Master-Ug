'use client'

import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { Users, Activity, DollarSign, Package, BarChart3, Settings } from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  const managementCards = [
    { name: 'User Management', icon: Users, href: '/users', color: 'bg-info' },
    { name: 'Player Data', icon: Activity, href: '/players', color: 'bg-primary' },
    { name: 'Financial Records', icon: DollarSign, href: '/finance', color: 'bg-success' },
    { name: 'Match Stats', icon: BarChart3, href: '/matches', color: 'bg-warning' },
    { name: 'Inventory', icon: Package, href: '/inventory', color: 'bg-info' },
    { name: 'System Settings', icon: Settings, href: '/settings', color: 'bg-neutral-dark' },
  ]

  const activities = [
    { type: 'player', message: 'New player registered: James Anderson', time: '10 minutes ago', color: 'bg-primary' },
    { type: 'match', message: 'Match stats logged: Uganda Cup Final', time: '2 hours ago', color: 'bg-info' },
    { type: 'finance', message: 'Revenue added: UGX 5,000,000 sponsorship', time: '5 hours ago', color: 'bg-success' },
  ]

  return (
    <Layout pageTitle="Admin Control Panel">
      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="Users" value={124} icon={Users} iconColor="bg-primary" />
          <StatCard title="Active Players" value={72} icon={Activity} iconColor="bg-success" />
          <StatCard title="Revenue" value="UGX 45M" icon={DollarSign} iconColor="bg-success" />
          <StatCard title="Inventory" value="45 items" icon={Package} iconColor="bg-info" />
        </div>

        {/* Management Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {managementCards.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.name}
                href={card.href}
                className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift card-hover"
              >
                <div className={`${card.color} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-neutral-text">{card.name}</h3>
              </Link>
            )
          })}
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <h3 className="text-xl font-bold text-neutral-text mb-6">Recent Activity Feed</h3>
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 hover:bg-neutral-light rounded-lg transition-colors">
                <div className={`w-2 h-2 rounded-full ${activity.color} mt-2 flex-shrink-0`} />
                <div className="flex-1">
                  <p className="text-sm text-neutral-text">{activity.message}</p>
                  <p className="text-xs text-neutral-medium mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

