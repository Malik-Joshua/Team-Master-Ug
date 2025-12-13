'use client'

import Link from 'next/link'
import { AlertCircle, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-bg flex items-center justify-center p-4">
      <div className="bg-white rounded-card shadow-soft border border-neutral-light p-8 max-w-md w-full text-center">
        <AlertCircle className="w-16 h-16 text-secondary mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-neutral-text mb-2">404 - Page Not Found</h2>
        <p className="text-neutral-medium mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-button font-semibold hover:bg-primary-dark transition-colors"
        >
          <Home className="w-4 h-4" />
          Go Home
        </Link>
      </div>
    </div>
  )
}

