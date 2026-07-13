import { LucideIcon } from 'lucide-react'
import Link from 'next/link'
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
  /** When provided, the whole card becomes a link to this route (e.g. "/players"). */
  href?: string
  /** When provided instead of href, the whole card becomes a button that calls this. */
  onClick?: () => void
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
  href,
  onClick,
}: StatCardProps) {
  const isInteractive = !!href || !!onClick

  const cardClassName = cn(
    'rounded-[10px] border border-tm-border bg-tm-surface p-4 sm:p-5 transition-all duration-200',
    isInteractive &&
      'cursor-pointer text-left w-full hover:-translate-y-0.5 hover:border-tm-primary hover:shadow-[0_0_16px_2px_var(--tm-primary),0_8px_20px_rgba(0,0,0,0.35)]',
    className
  )

  const content = (
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
  )

  if (href) {
    return (
      <Link href={href} className={cardClassName}>
        {content}
      </Link>
    )
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cardClassName}>
        {content}
      </button>
    )
  }

  return <div className={cardClassName}>{content}</div>
}
