'use client'

import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { BarChart3, Calendar, UserCheck, Save, Package } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DataAdminDashboard() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    tournament: '',
    player: '',
    tacklesMade: '',
    tacklesMissed: '',
    ballCarries: '',
    minutesPlayed: '',
  })

  return (
    <Layout pageTitle="Match Data Entry">
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div 
            onClick={() => router.push('/matches')}
            className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift cursor-pointer card-hover transition-all duration-300"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-text">Log Match</h3>
                <p className="text-sm text-neutral-medium">Record match statistics</p>
              </div>
            </div>
          </div>
          <div 
            onClick={() => router.push('/training')}
            className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift cursor-pointer card-hover transition-all duration-300"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-info rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-text">Training</h3>
                <p className="text-sm text-neutral-medium">Manage training sessions</p>
              </div>
            </div>
          </div>
          <div 
            onClick={() => router.push('/players')}
            className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift cursor-pointer card-hover transition-all duration-300"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-success rounded-xl flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-text">Update Status</h3>
                <p className="text-sm text-neutral-medium">Change player status</p>
              </div>
            </div>
          </div>
          <div 
            onClick={() => router.push('/inventory')}
            className="bg-white rounded-card p-6 border border-neutral-light shadow-soft hover-lift cursor-pointer card-hover transition-all duration-300"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-warning rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-text">Inventory</h3>
                <p className="text-sm text-neutral-medium">Manage equipment & supplies</p>
              </div>
            </div>
          </div>
        </div>

        {/* Match Stats Entry Form */}
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <h3 className="text-xl font-bold text-neutral-text mb-6">Match Stats Entry Form</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-text mb-2">Tournament</label>
              <select
                value={formData.tournament}
                onChange={(e) => setFormData({ ...formData, tournament: e.target.value })}
                className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              >
                <option value="">Select tournament...</option>
                <option value="uganda-cup">Uganda Cup</option>
                <option value="league">League</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-text mb-2">Player</label>
              <select
                value={formData.player}
                onChange={(e) => setFormData({ ...formData, player: e.target.value })}
                className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              >
                <option value="">Select player...</option>
                <option value="player1">John Doe</option>
                <option value="player2">Jane Smith</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-text mb-2">Tackles Made</label>
              <input
                type="number"
                value={formData.tacklesMade}
                onChange={(e) => setFormData({ ...formData, tacklesMade: e.target.value })}
                className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-text mb-2">Tackles Missed</label>
              <input
                type="number"
                value={formData.tacklesMissed}
                onChange={(e) => setFormData({ ...formData, tacklesMissed: e.target.value })}
                className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-text mb-2">Ball Carries</label>
              <input
                type="number"
                value={formData.ballCarries}
                onChange={(e) => setFormData({ ...formData, ballCarries: e.target.value })}
                className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-text mb-2">Minutes Played</label>
              <input
                type="number"
                value={formData.minutesPlayed}
                onChange={(e) => setFormData({ ...formData, minutesPlayed: e.target.value })}
                className="w-full px-4 py-3 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          </div>
          <div className="mt-6">
            <button className="px-6 py-3 bg-club-gradient text-white rounded-button font-semibold hover:opacity-90 transition-opacity inline-flex items-center">
              <Save className="w-5 h-5 mr-2" />
              Save Match Stats
            </button>
          </div>
        </div>

        {/* Recent Entries Log */}
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <h3 className="text-xl font-bold text-neutral-text mb-4">Recent Entries Log</h3>
          <div className="space-y-2">
            <div className="p-4 bg-neutral-light/50 rounded-lg hover:bg-neutral-light transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-text">John Doe - Uganda Cup Final</p>
                  <p className="text-sm text-neutral-medium">2 hours ago</p>
                </div>
                <div className="flex space-x-2">
                  <button className="text-primary hover:text-primary-dark text-sm font-medium">Edit</button>
                  <button className="text-secondary hover:text-secondary-dark text-sm font-medium">Delete</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

