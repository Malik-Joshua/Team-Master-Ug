import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Buttons / controls rendered on the right of the header */
  actions?: ReactNode
}

/**
 * Standard page header used across every page so titles, subtitles and
 * action buttons sit in a consistent place with consistent typography.
 */
export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[20px] font-medium leading-tight text-tm-text-1">{title}</h1>
        {subtitle && <p className="mt-[2px] text-[13px] text-tm-text-3">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
      )}
    </div>
  )
}
