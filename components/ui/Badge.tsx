import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral'

const tones: Record<Tone, string> = {
  accent: 'bg-tm-badge text-tm-badge-text',
  success: 'bg-success/10 text-success border border-success/20',
  warning: 'bg-warning/10 text-warning border border-warning/20',
  danger: 'bg-[#E05757]/10 text-[#E05757] border border-[#E05757]/20',
  neutral: 'bg-tm-surface-hover text-tm-text-2 border border-tm-border',
}

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  className?: string
}

/** Small status pill with consistent tones across the app. */
export default function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
