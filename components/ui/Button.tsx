import { ButtonHTMLAttributes, ComponentType, ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-[6px] font-medium whitespace-nowrap transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'

const sizes: Record<Size, string> = {
  sm: 'px-3.5 py-1.5 text-[13px]',
  md: 'px-4 py-2 text-sm',
}

const variants: Record<Variant, string> = {
  primary:
    'bg-tm-secondary text-tm-on-secondary shadow-sm hover:opacity-90 hover:scale-[1.02]',
  secondary:
    'bg-tm-surface text-tm-text-2 border border-tm-border hover:border-tm-secondary hover:text-tm-secondary hover:scale-[1.02] hover:shadow-md',
  outline:
    'bg-transparent text-tm-text-2 border border-tm-border hover:border-tm-secondary hover:text-tm-secondary',
  ghost: 'bg-transparent text-tm-text-2 hover:bg-tm-surface-hover',
  danger: 'bg-[#E05757] text-white hover:opacity-90 hover:scale-[1.02]',
}

interface BaseProps {
  variant?: Variant
  size?: Size
  icon?: ComponentType<{ className?: string }>
  children?: ReactNode
  className?: string
}

type ButtonProps = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> & {
    href?: string
  }

/**
 * Themed button. Renders a Next.js <Link> when `href` is provided,
 * otherwise a native <button>. Variants and sizes are consistent app-wide.
 */
export default function Button({
  variant = 'primary',
  size = 'sm',
  icon: Icon,
  children,
  className,
  href,
  ...props
}: ButtonProps) {
  const classes = cn(base, sizes[size], variants[variant], className)
  const content = (
    <>
      {Icon && <Icon className="h-[15px] w-[15px]" />}
      {children}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    )
  }

  return (
    <button className={classes} {...props}>
      {content}
    </button>
  )
}
