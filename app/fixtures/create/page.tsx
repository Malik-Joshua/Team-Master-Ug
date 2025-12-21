'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { Calendar, MapPin, Trophy, Save, ArrowLeft, X } from 'lucide-react'
import Link from 'next/link'

export default function CreateFixturePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    match_date: '',
    opponent: '',
    tournament_type: 'friendly',
    venue: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.match_date || !formData.opponent) {
      alert('Please fill in match date and opponent')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/fixtures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create fixture')
      }

      alert('Fixture created successfully!')
      router.push('/fixtures')
    } catch (error: any) {
      console.error('Error creating fixture:', error)
      alert(`Error creating fixture: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout pageTitle="Create Fixture">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link
                href="/fixtures"
                className="p-2 hover:bg-neutral-light rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-text" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-neutral-text flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-primary" />
                  Create New Fixture
                </h1>
                <p className="text-neutral-medium mt-1">Register an upcoming match</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Match Date */}
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Match Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.match_date}
                  onChange={(e) => setFormData({ ...formData, match_date: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-light rounded-button focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Opponent */}
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">
                  Opponent *
                </label>
                <input
                  type="text"
                  required
                  value={formData.opponent}
                  onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
                  placeholder="e.g., Kampala RFC"
                  className="w-full px-4 py-2 border border-neutral-light rounded-button focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Tournament Type */}
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">
                  <Trophy className="w-4 h-4 inline mr-1" />
                  Tournament Type *
                </label>
                <select
                  required
                  value={formData.tournament_type}
                  onChange={(e) => setFormData({ ...formData, tournament_type: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-light rounded-button focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="friendly">Friendly</option>
                  <option value="league">League</option>
                  <option value="uganda_cup">Uganda Cup</option>
                  <option value="sevens">Sevens</option>
                </select>
              </div>

              {/* Venue */}
              <div>
                <label className="block text-sm font-medium text-neutral-text mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Venue
                </label>
                <input
                  type="text"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  placeholder="e.g., Home Ground, Away"
                  className="w-full px-4 py-2 border border-neutral-light rounded-button focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center gap-4 pt-4 border-t border-neutral-light">
              <button
                type="submit"
                disabled={loading}
                className="bg-club-gradient text-white px-6 py-3 rounded-button font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Creating...' : 'Create Fixture'}
              </button>
              <Link
                href="/fixtures"
                className="px-6 py-3 bg-neutral-light text-neutral-text rounded-button font-semibold hover:bg-neutral-medium transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}

