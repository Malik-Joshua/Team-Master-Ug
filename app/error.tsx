'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-tm-bg flex items-center justify-center p-4">
      <div className="bg-tm-surface rounded-card shadow-soft border border-tm-border p-8 max-w-md w-full text-center">
        <AlertCircle className="w-16 h-16 text-[#E05757] mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-tm-text-1 mb-2">Something went wrong!</h2>
        <p className="text-tm-text-3 mb-6">{error.message || 'An unexpected error occurred'}</p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-tm-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}



