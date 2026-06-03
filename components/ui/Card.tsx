import { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  /** Apply default inner padding. Set false when using CardHeader/CardBody. */
  padded?: boolean
}

/**
 * Surface container — the standard "panel" used across the app.
 * For panels with a titled header use `padded={false}` together with
 * <CardHeader> and <CardBody>.
 */
export default function Card({ children, className, padded = true }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[10px] border border-tm-border bg-tm-surface',
        padded ? 'p-4 sm:p-5' : 'overflow-hidden',
        className
      )}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: ReactNode
  icon?: ComponentType<{ className?: string }>
  /** Right-aligned action (e.g. a "View all" link or button) */
  action?: ReactNode
  className?: string
}

export function CardHeader({ title, icon: Icon, action, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-tm-border px-4 py-3.5 sm:px-5',
        className
      )}
    >
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-tm-text-1">
        {Icon && <Icon className="h-[17px] w-[17px] text-tm-secondary" />}
        {title}
      </h3>
      {action}
    </div>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-4 sm:p-5', className)}>{children}</div>
}
