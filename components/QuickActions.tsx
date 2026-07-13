import { LucideIcon } from 'lucide-react'

interface QuickActionProps {
  icon: LucideIcon
  label: string
  iconBgColor: string
  iconTextColor: string
  onClick?: () => void
}

interface QuickActionsProps {
  actions: QuickActionProps[]
}

export default function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {actions.map((action, index) => {
        const Icon = action.icon
        return (
          <button
            key={index}
            onClick={action.onClick}
            className="rounded-[10px] p-3.5 flex flex-col items-center gap-2 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--tm-primary)] hover:bg-[var(--tm-primary-subtle)] hover:scale-[1.03] hover:shadow-[0_0_14px_2px_var(--tm-primary),0_8px_16px_rgba(0,0,0,0.3)]"
            style={{ background: 'var(--tm-surface)', border: '1px solid var(--tm-border)' }}
          >
            <div
              className="w-9 h-9 rounded-[9px] flex items-center justify-center transition-transform duration-200 hover:rotate-6"
              style={{ background: action.iconBgColor }}
            >
              <Icon className="w-[18px] h-[18px]" style={{ color: action.iconTextColor }} />
            </div>
            <span className="text-[12px] font-medium text-center" style={{ color: 'var(--tm-text-1)' }}>
              {action.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
