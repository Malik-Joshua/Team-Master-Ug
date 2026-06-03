import { ClipboardList, ArrowRight } from 'lucide-react'

interface AttendanceChip {
  label: string
  value: number
  bgColor: string
  textColor: string
}

interface AttendanceSummaryProps {
  chips: AttendanceChip[]
  presentData: number[]
  absentData: number[]
  labels: string[]
}

export default function AttendanceSummary({
  chips,
  presentData,
  absentData,
  labels,
}: AttendanceSummaryProps) {
  const maxValue = Math.max(...presentData, ...absentData, 1)

  return (
    <div className="rounded-[10px] overflow-hidden" style={{ background: 'var(--tm-surface)', border: '1px solid var(--tm-border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 px-4.5 border-b" style={{ borderColor: 'var(--tm-border)' }}>
        <div className="flex items-center gap-1.5">
          <ClipboardList className="w-[17px] h-[17px]" style={{ color: 'var(--tm-secondary)' }} />
          <span className="text-[14px] font-medium" style={{ color: 'var(--tm-text-1)' }}>
            Training attendance summary
          </span>
        </div>
        <a
          href="#"
          className="text-[12px] font-medium flex items-center gap-1 cursor-pointer"
          style={{ color: 'var(--tm-secondary)' }}
        >
          View all <ArrowRight className="w-[13px] h-[13px]" />
        </a>
      </div>

      {/* Body */}
      <div className="p-4.5">
        {/* Chips */}
        <div className="grid grid-cols-4 gap-2.5 mb-[18px]">
          {chips.map((chip, index) => (
            <div
              key={index}
              className="rounded-[6px] p-3 text-center"
              style={{ background: chip.bgColor }}
            >
              <div
                className="text-[22px] font-medium mb-[3px]"
                style={{ color: chip.textColor }}
              >
                {chip.value}
              </div>
              <div className="text-[11px] opacity-70" style={{ color: chip.textColor }}>
                {chip.label}
              </div>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="pt-0 pb-1">
          {/* Legend */}
          <div className="flex gap-3.5 mb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-[2px] bg-[#1D9E75]" />
              <span className="text-[11px]" style={{ color: 'var(--tm-text-3)' }}>Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-[2px] bg-[#E24B4A]" />
              <span className="text-[11px]" style={{ color: 'var(--tm-text-3)' }}>Absent</span>
            </div>
          </div>

          {/* Bars */}
          <div className="flex items-end gap-1.5 h-[96px]">
            {labels.map((label, index) => (
              <div key={index} className="flex flex-col items-center gap-1 flex-1">
                <div className="flex gap-0.5 items-end w-full h-[80px]">
                  <div
                    className="rounded-t-[3px] flex-1 min-h-[3px] transition-opacity hover:opacity-75"
                    style={{
                      background: '#1D9E75',
                      height: `${(presentData[index] / maxValue) * 100}%`,
                    }}
                  />
                  <div
                    className="rounded-t-[3px] flex-1 min-h-[3px] transition-opacity hover:opacity-75"
                    style={{
                      background: '#E24B4A',
                      height: `${(absentData[index] / maxValue) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-[10px]" style={{ color: 'var(--tm-text-3)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
