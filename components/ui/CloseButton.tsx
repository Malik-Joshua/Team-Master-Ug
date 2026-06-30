'use client'

import { X } from 'lucide-react'

interface CloseButtonProps {
  onClick: () => void
  /** 'sm' = 28px, 'md' = 32px (default) */
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}

/**
 * Uniform close / exit button used in every modal and slide-over.
 * Shows a bordered container with an accent glow on hover so it's
 * always visible and consistent across the app.
 */
export function CloseButton({
  onClick,
  size = 'md',
  className = '',
  'aria-label': ariaLabel = 'Close',
}: CloseButtonProps) {
  const dim = size === 'sm' ? '28px' : '32px'
  const iconCls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex items-center justify-center flex-shrink-0 rounded-lg border transition-all duration-150 ${className}`}
      style={{
        width: dim,
        height: dim,
        borderColor: 'var(--tm-border, rgba(255,255,255,0.07))',
        color: 'var(--tm-text-3, #506478)',
        background: 'transparent',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--acc, #5BA3D9)'
        el.style.color = 'var(--acc, #5BA3D9)'
        el.style.background = 'var(--acc-dim, rgba(91,163,217,0.10))'
        el.style.boxShadow = '0 0 10px var(--acc-glow, rgba(91,163,217,0.22))'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--tm-border, rgba(255,255,255,0.07))'
        el.style.color = 'var(--tm-text-3, #506478)'
        el.style.background = 'transparent'
        el.style.boxShadow = 'none'
      }}
    >
      <X className={iconCls} />
    </button>
  )
}
