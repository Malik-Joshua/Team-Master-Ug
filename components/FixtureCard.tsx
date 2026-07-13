import { Calendar, Clock, MapPin } from 'lucide-react'

interface FixtureCardProps {
  label: string
  homeTeam: string
  awayTeam: string
  date: string
  time: string
  venue: string
  /** Club slogan — hypes the team ahead of the fixture; rendered in the
   *  club's primary colour when provided. */
  slogan?: string | null
  onViewSquad?: () => void
  onMatchDay?: () => void
}

export default function FixtureCard({
  label,
  homeTeam,
  awayTeam,
  date,
  time,
  venue,
  slogan,
  onViewSquad,
  onMatchDay,
}: FixtureCardProps) {
  return (
    <div
      className="rounded-[10px] p-4 mb-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--tm-primary)] hover:shadow-[0_0_16px_2px_var(--tm-primary),0_8px_20px_rgba(0,0,0,0.35)]"
      style={{ background: 'var(--tm-bg-elevated)', border: '1px solid var(--tm-border)' }}
    >
      {/* Label */}
      <div className="text-[10px] font-medium tracking-[0.06em] uppercase mb-2" style={{ color: 'var(--tm-text-muted)' }}>
        {label}
      </div>

      {/* Matchup */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[13px] font-medium" style={{ color: 'var(--tm-text-1)' }}>{homeTeam}</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: 'var(--tm-text-3)', background: 'var(--tm-surface-hover)' }}>
          VS
        </span>
        <span className="text-[13px] font-medium" style={{ color: 'var(--tm-text-1)' }}>{awayTeam}</span>
      </div>

      {slogan && (
        <p className="text-[12px] font-semibold italic mb-2.5 truncate" style={{ color: 'var(--tm-primary)' }}>
          &ldquo;{slogan}&rdquo;
        </p>
      )}

      {/* Meta */}
      <div className="flex gap-3.5 mb-3">
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--tm-text-3)' }}>
          <Calendar className="w-[13px] h-[13px]" />
          {date}
        </div>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--tm-text-3)' }}>
          <Clock className="w-[13px] h-[13px]" />
          {time}
        </div>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--tm-text-3)' }}>
          <MapPin className="w-[13px] h-[13px]" />
          {venue}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onViewSquad}
          className="flex-1 py-1.5 rounded-[6px] text-[12px] font-medium cursor-pointer border-none hover:opacity-80 transition-opacity"
          style={{ background: 'var(--tm-surface-hover)', color: 'var(--tm-text-2)' }}
        >
          View squad
        </button>
        <button
          onClick={onMatchDay}
          className="flex-1 py-1.5 rounded-[6px] text-[12px] font-medium cursor-pointer border-none hover:opacity-90 transition-opacity"
          style={{ background: 'var(--tm-secondary)', color: 'var(--tm-text-on-secondary)' }}
        >
          Match day ↗
        </button>
      </div>
    </div>
  )
}
