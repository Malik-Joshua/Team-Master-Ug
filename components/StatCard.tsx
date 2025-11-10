import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
  description?: string
  className?: string
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = 'bg-primary',
  description,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-card p-6 border border-neutral-light hover-lift card-shadow card-hover',
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-medium mb-1">{title}</p>
          <p className="text-3xl font-bold text-neutral-text">{value}</p>
          {description && (
            <p className="text-xs text-neutral-medium mt-1">{description}</p>
          )}
        </div>
        <div className={cn(`${iconColor} p-3 rounded-xl shadow-md`)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  )
}

