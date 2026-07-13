import { LucideIcon, TrendingUp, TrendingDown, AlertCircle, Calendar } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface ConceptStatCardProps {
  label: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  meta?: string
  icon: LucideIcon
  iconBgColor: string
  iconTextColor: string
  /** Override the big value's color (e.g. red for an "injured" alert). Defaults to the primary text color. */
  valueColor?: string
  /** When provided, the whole card becomes a link to this route (e.g. "/players"). */
  href?: string
  /** When provided instead of href, the whole card becomes a button that calls this. */
  onClick?: () => void
}

export default function ConceptStatCard({
  label,
  value,
  change,
  changeType = 'neutral',
  meta,
  icon: Icon,
  iconBgColor,
  iconTextColor,
  valueColor,
  href,
  onClick,
}: ConceptStatCardProps) {
  const getChangeIcon = () => {
    if (changeType === 'positive') return <TrendingUp className="w-[14px] h-[14px]" />
    if (changeType === 'negative') return <TrendingDown className="w-[14px] h-[14px]" />
    return <AlertCircle className="w-[14px] h-[14px]" />
  }

  const getChangeColor = () => {
    if (changeType === 'positive') return '#1D9E75'
    if (changeType === 'negative') return '#E24B4A'
    return '#5A6478'
  }

  const isInteractive = !!href || !!onClick

  const content = (
    <>
      {/* Top section */}
      <div className="flex items-start justify-between mb-[10px]">
        <span className="text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: 'var(--tm-text-3)' }}>
          {label}
        </span>
        <div
          className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
          style={{ background: iconBgColor }}
        >
          <Icon className="w-[15px] h-[15px]" style={{ color: iconTextColor }} />
        </div>
      </div>

      {/* Value */}
      <div className="text-[26px] font-medium mb-[6px]" style={{ color: valueColor || 'var(--tm-text-1)' }}>{value}</div>

      {/* Change */}
      {change && (
        <div className="flex items-center gap-1 text-[12px]" style={{ color: getChangeColor() }}>
          {getChangeIcon()}
          {change}
        </div>
      )}

      {/* Divider */}
      <div className="w-full h-[0.5px] my-[10px]" style={{ background: 'var(--tm-divider)' }} />

      {/* Meta */}
      {meta && <div className="text-[11px]" style={{ color: 'var(--tm-text-3)' }}>{meta}</div>}
    </>
  )

  const className = cn(
    'rounded-[10px] p-4 transition-all duration-200 hover:scale-[1.02] hover:border-[var(--tm-primary)] group text-left w-full',
    isInteractive
      ? 'cursor-pointer hover:shadow-[0_0_16px_2px_var(--tm-primary),0_8px_20px_rgba(0,0,0,0.35)]'
      : 'cursor-default hover:shadow-lg'
  )
  const style = { background: 'var(--tm-surface)', border: '1px solid var(--tm-border)' }

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {content}
      </Link>
    )
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} style={style}>
        {content}
      </button>
    )
  }

  return (
    <div className={className} style={style}>
      {content}
    </div>
  )
}
