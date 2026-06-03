import { HeartPulse, ArrowRight } from 'lucide-react'

interface Injury {
  name: string
  injury: string
  date: string
  status: 'active' | 'recovery'
  returnDate: string
}

interface InjuryListProps {
  injuries: Injury[]
}

export default function InjuryList({ injuries }: InjuryListProps) {
  const getStatusColor = (status: string) => {
    if (status === 'active') return '#E05757'
    if (status === 'recovery') return '#E09F42'
    return '#2DB88A'
  }

  const getStatusBgColor = (status: string) => {
    if (status === 'active') return 'rgba(224, 87, 87, 0.12)'
    if (status === 'recovery') return 'rgba(224, 159, 66, 0.12)'
    return 'rgba(45, 184, 138, 0.12)'
  }

  const getStatusTextColor = (status: string) => {
    if (status === 'active') return '#E05757'
    if (status === 'recovery') return '#E09F42'
    return '#2DB88A'
  }

  return (
    <div className="flex flex-col">
      {injuries.map((injury, index) => (
        <div
          key={index}
          className="flex items-center gap-2.5 p-2.5 border-b"
          style={{ borderColor: 'var(--tm-border)' }}
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: getStatusColor(injury.status) }}
          />
          <div className="flex-1">
            <div className="text-[13px] font-medium" style={{ color: 'var(--tm-text-1)' }}>{injury.name}</div>
            <div className="text-[11px] mt-[1px]" style={{ color: 'var(--tm-text-3)' }}>
              {injury.injury} · {injury.date}
            </div>
          </div>
          <div>
            <div
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
              style={{
                background: getStatusBgColor(injury.status),
                color: getStatusTextColor(injury.status),
              }}
            >
              {injury.status.charAt(0).toUpperCase() + injury.status.slice(1)}
            </div>
            <div className="text-[11px] text-right mt-0.5" style={{ color: 'var(--tm-text-3)' }}>
              Return {injury.returnDate}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
