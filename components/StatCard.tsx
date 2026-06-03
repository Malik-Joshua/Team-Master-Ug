import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
  /** Override icon text color. Defaults to text-tm-on-secondary so icons are readable on brand accents. */
  iconTextColor?: string
  /** Override the value's color (e.g. red for an "injured" alert). Defaults to the primary text color. */
  valueColor?: string
  description?: string
  className?: string
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = 'bg-primary',
  iconTextColor = 'text-tm-on-secondary',
  valueColor,
  description,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-[10px] border border-tm-border bg-tm-surface p-4 sm:p-5 transition-all duration-200 hover:border-tm-primary hover:shadow-lg',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-2 truncate text-[11px] font-medium uppercase tracking-[0.05em] text-tm-text-3">
            {title}
          </p>
          <p
            className="break-words text-[26px] font-medium leading-none text-tm-text-1"
            style={valueColor ? { color: valueColor } : undefined}
          >
            {value}
          </p>
          {description && <p className="mt-2 text-[11px] text-tm-text-3">{description}</p>}
        </div>
        <div
          className={cn(
            'flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[8px]',
            iconColor
          )}
        >
          <Icon className={cn('h-[17px] w-[17px]', iconTextColor)} />
        </div>
      </div>
    </div>
  )
}
