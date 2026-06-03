import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatGridProps {
  children: ReactNode
  /** Max columns on large screens. Always 1 col on mobile, 2 on tablet. */
  cols?: 2 | 3 | 4
  className?: string
}

const colMap: Record<NonNullable<StatGridProps['cols']>, string> = {
  2: 'sm:grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
}

/**
 * Responsive grid for stat cards. Keeps stat rows consistent and
 * mobile-friendly (the admin dashboard's fixed grid-cols-4 was not).
 */
export default function StatGrid({ children, cols = 4, className }: StatGridProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-3', colMap[cols], className)}>{children}</div>
  )
}
