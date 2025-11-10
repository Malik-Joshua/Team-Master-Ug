'use client'

import Link from 'next/link'
import { ArrowRight, Users, BarChart3, DollarSign } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-club-gradient">
      <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center text-white mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">Mongers Rugby Club</h1>
          <p className="text-xl md:text-2xl text-blue-100 mb-8">
            Comprehensive Management System
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dev-login"
              className="bg-white text-primary px-8 py-4 rounded-button font-semibold text-lg hover:bg-blue-50 transition-colors inline-flex items-center justify-center shadow-soft hover:shadow-medium"
            >
              Access Dashboard (Dev Mode)
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="bg-blue-800 text-white px-8 py-4 rounded-button font-semibold text-lg hover:bg-blue-900 transition-colors inline-flex items-center justify-center border-2 border-white"
            >
              Real Authentication
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white/10 backdrop-blur-lg rounded-card p-6 text-white">
            <Users className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Player Management</h3>
            <p className="text-blue-100">Track player profiles, performance, and statistics</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-card p-6 text-white">
            <BarChart3 className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Performance Analytics</h3>
            <p className="text-blue-100">Comprehensive match and training statistics</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-card p-6 text-white">
            <DollarSign className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Financial Tracking</h3>
            <p className="text-blue-100">Manage expenses, revenue, and financial reports</p>
          </div>
        </div>
      </div>
    </div>
  )
}
