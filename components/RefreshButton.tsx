'use client'

import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function RefreshButton({ onRefresh, className = '', size = 'md' }: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await onRefresh()
    } catch (error) {
      console.error('Error refreshing:', error)
    } finally {
      // Add a small delay to show the spinning animation
      setTimeout(() => {
        setIsRefreshing(false)
      }, 500)
    }
  }

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`inline-flex items-center gap-2 px-4 py-2 bg-tm-surface border border-tm-border rounded-[6px] font-medium text-tm-text-2 hover:border-tm-secondary hover:text-tm-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title="Refresh data"
    >
      <RefreshCw className={`${sizeClasses[size]} ${isRefreshing ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">Refresh</span>
    </button>
  )
}
