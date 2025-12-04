'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen bg-neutral-bg flex items-center justify-center p-4">
          <div className="bg-white rounded-card shadow-soft border border-neutral-light p-8 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-neutral-text mb-2">Something went wrong!</h2>
            <p className="text-neutral-medium mb-6">{error.message || 'An unexpected error occurred'}</p>
            <button
              onClick={reset}
              className="px-6 py-2 bg-primary text-white rounded-button font-semibold hover:bg-primary-dark transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}

