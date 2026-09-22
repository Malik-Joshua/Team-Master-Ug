'use client'

/**
 * Three-segment (Hour / Minute / AM-PM) time picker, used anywhere a coach
 * enters a session start or finish time — training sessions and gym
 * sessions share this exact component so the input experience is identical
 * across both.
 *
 * Stores/emits a 24-hour "HH:MM" string (e.g. "14:30") via onChange, same
 * shape a native <input type="time"> produces, so callers don't need to
 * know this is dropdown-based internally.
 */
export default function TimeDropdowns({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  const parts = (() => {
    if (!value) return { hour: '', minute: '', period: 'AM' as 'AM' | 'PM' }
    const [hourValue, minute = '00'] = value.split(':')
    const hour24 = Number(hourValue)
    return {
      hour: String(hour24 % 12 || 12),
      minute,
      period: (hour24 >= 12 ? 'PM' : 'AM') as 'AM' | 'PM',
    }
  })()

  const update = (hour: string, minute: string, period: 'AM' | 'PM') => {
    if (!hour) {
      onChange('')
      return
    }
    const hour12 = Number(hour)
    const hour24 = period === 'PM' ? (hour12 % 12) + 12 : hour12 % 12
    onChange(`${String(hour24).padStart(2, '0')}:${minute || '00'}`)
  }

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
      <select
        aria-label={`${label} hour`}
        value={parts.hour}
        onChange={(e) => update(e.target.value, parts.minute || '00', parts.period)}
        className="w-full px-4 py-2.5 border-2 border-tm-border bg-tm-surface text-tm-text-1 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
      >
        <option value="">Hour</option>
        {Array.from({ length: 12 }, (_, index) => String(index + 1)).map(hour => (
          <option key={hour} value={hour}>{hour}</option>
        ))}
      </select>
      <select
        aria-label={`${label} minute`}
        value={parts.minute}
        disabled={!parts.hour}
        onChange={(e) => update(parts.hour, e.target.value, parts.period)}
        className="w-full px-4 py-2.5 border-2 border-tm-border bg-tm-surface text-tm-text-1 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all disabled:opacity-50"
      >
        <option value="" disabled>Minute</option>
        {Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')).map(minute => (
          <option key={minute} value={minute}>{minute}</option>
        ))}
      </select>
      <select
        aria-label={`${label} AM or PM`}
        value={parts.period}
        disabled={!parts.hour}
        onChange={(e) => update(parts.hour, parts.minute || '00', e.target.value as 'AM' | 'PM')}
        className="px-4 py-2.5 border-2 border-tm-border bg-tm-surface text-tm-text-1 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all disabled:opacity-50"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  )
}
