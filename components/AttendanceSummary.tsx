'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * Dashboard card: training attendance for one week (Mon–Sun), one row per
 * session. Each row shows a single bar split into present / absent /
 * justified / injured plus a "present / recorded" count, so it reads like a
 * register rather than a chart that needs explaining. Arrows step between
 * weeks; "View all" opens the full per-session summary on the Training page.
 */

type SessionRow = {
  id: string
  date: string
  title: string
  time: string | null
  present: number
  absent: number
  justified: number
  injured: number
  total: number
}

const COLORS = {
  present: '#1D9E75',
  absent: '#E24B4A',
  justified: '#888780',
  injured: '#EF9F27',
}

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (x.getDay() + 6) % 7 // Monday = 0
  x.setDate(x.getDate() - day)
  return x
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTime(t: string | null): string | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h)) return null
  const suffix = h >= 12 ? 'pm' : 'am'
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''}${suffix}`
}

export default function AttendanceSummary() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [rows, setRows] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (start: Date) => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const end = new Date(start)
      end.setDate(end.getDate() + 6)

      const { data: sessions, error: sErr } = await supabase
        .from('training_sessions')
        .select('id, session_date, session_time, description, session_number')
        .gte('session_date', iso(start))
        .lte('session_date', iso(end))
        .order('session_date', { ascending: true })
        .order('session_time', { ascending: true })
      if (sErr) throw sErr

      const ids = (sessions || []).map((s: any) => s.id)
      let attendance: any[] = []
      if (ids.length > 0) {
        const { data: att, error: aErr } = await supabase
          .from('training_attendance')
          .select('session_id, attendance_status')
          .in('session_id', ids)
        if (aErr) throw aErr
        attendance = att || []
      }

      setRows(
        (sessions || []).map((s: any) => {
          const recs = attendance.filter((a) => a.session_id === s.id)
          const count = (code: string) => recs.filter((a) => a.attendance_status === code).length
          return {
            id: s.id,
            date: s.session_date,
            title: s.description || `Training session ${s.session_number ?? ''}`.trim(),
            time: formatTime(s.session_time),
            present: count('P'),
            absent: count('X'),
            justified: count('A'),
            injured: count('I'),
            total: recs.length,
          }
        })
      )
    } catch (err: any) {
      console.error('Error loading weekly attendance:', err)
      setError('Couldn’t load attendance for this week.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Open on the most recent week that actually had training (up to this
  // week), so the card isn't empty just because nothing is scheduled yet.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const thisWeek = startOfWeek(new Date())
    const endOfThisWeek = new Date(thisWeek)
    endOfThisWeek.setDate(endOfThisWeek.getDate() + 6)
    createClient()
      .from('training_sessions')
      .select('session_date')
      .lte('session_date', iso(endOfThisWeek))
      .order('session_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.session_date) setWeekStart(startOfWeek(new Date(`${data.session_date}T00:00:00`)))
        setReady(true)
      }, () => setReady(true))
  }, [])

  useEffect(() => {
    if (ready) load(weekStart)
  }, [weekStart, load, ready])

  const shiftWeek = (delta: number) => {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + delta * 7)
    setWeekStart(next)
  }

  const thisWeek = startOfWeek(new Date()).getTime() === weekStart.getTime()
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const rangeLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`

  const today = iso(new Date())
  const totals = rows.reduce(
    (t, r) => ({
      present: t.present + r.present,
      absent: t.absent + r.absent,
      justified: t.justified + r.justified,
      injured: t.injured + r.injured,
      total: t.total + r.total,
    }),
    { present: 0, absent: 0, justified: 0, injured: 0, total: 0 }
  )
  const rate = totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : null

  return (
    <div className="rounded-[10px] overflow-hidden" style={{ background: 'var(--tm-surface)', border: '1px solid var(--tm-border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 py-3.5 px-4 border-b" style={{ borderColor: 'var(--tm-border)' }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <ClipboardList className="w-[17px] h-[17px] flex-shrink-0" style={{ color: 'var(--tm-secondary)' }} />
          <span className="text-[14px] font-medium truncate" style={{ color: 'var(--tm-text-1)' }}>
            Training attendance
          </span>
        </div>
        <Link
          href="/training#sessions-summary"
          className="text-[12px] font-medium flex items-center gap-1 flex-shrink-0 hover:opacity-80"
          style={{ color: 'var(--tm-secondary)' }}
        >
          View all <ArrowRight className="w-[13px] h-[13px]" />
        </Link>
      </div>

      <div className="p-4">
        {/* Week switcher */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="p-1 rounded hover:bg-white/5"
            aria-label="Previous week"
            style={{ color: 'var(--tm-text-3)' }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <div className="text-[13px] font-medium" style={{ color: 'var(--tm-text-1)' }}>
              {thisWeek ? 'This week' : rangeLabel}
            </div>
            {thisWeek && <div className="text-[11px]" style={{ color: 'var(--tm-text-3)' }}>{rangeLabel}</div>}
          </div>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            disabled={thisWeek}
            className="p-1 rounded hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Next week"
            style={{ color: 'var(--tm-text-3)' }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-3.5 gap-y-1 mb-2">
          {([
            ['Present', COLORS.present],
            ['Absent', COLORS.absent],
            ['Justified', COLORS.justified],
            ['Injured', COLORS.injured],
          ] as const).map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-[2px]" style={{ background: color }} />
              <span className="text-[11px]" style={{ color: 'var(--tm-text-3)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Session rows */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: 'var(--tm-secondary)' }} />
          </div>
        ) : error ? (
          <p className="py-6 text-center text-[12px]" style={{ color: 'var(--tm-text-3)' }}>{error}</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-[12px]" style={{ color: 'var(--tm-text-3)' }}>
            No training sessions scheduled {thisWeek ? 'this week' : 'in this week'}.
          </p>
        ) : (
          <div>
            {rows.map((r) => {
              const d = new Date(`${r.date}T00:00:00`)
              const pct = (n: number) => (r.total > 0 ? `${(n / r.total) * 100}%` : '0%')
              const upcoming = r.total === 0 && r.date > today
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[96px_minmax(0,1fr)_44px] sm:grid-cols-[120px_minmax(0,1fr)_48px] items-center gap-2.5 py-2 border-t"
                  style={{ borderColor: 'var(--tm-border)' }}
                  title={r.total > 0 ? `${r.present} present, ${r.absent} absent, ${r.justified} justified, ${r.injured} injured` : undefined}
                >
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium" style={{ color: 'var(--tm-text-1)' }}>
                      {d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </div>
                    <div className="text-[11px] truncate" style={{ color: 'var(--tm-text-3)' }}>
                      {[r.time, r.title].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {r.total > 0 ? (
                    <div className="flex h-3 rounded-[3px] overflow-hidden" style={{ background: 'var(--tm-surface-hover)' }}>
                      <div style={{ width: pct(r.present), background: COLORS.present }} />
                      <div style={{ width: pct(r.absent), background: COLORS.absent }} />
                      <div style={{ width: pct(r.justified), background: COLORS.justified }} />
                      <div style={{ width: pct(r.injured), background: COLORS.injured }} />
                    </div>
                  ) : (
                    <div className="text-[11px]" style={{ color: 'var(--tm-text-3)' }}>
                      {upcoming ? 'Upcoming' : 'Attendance not recorded yet'}
                    </div>
                  )}
                  <div className="text-[12px] text-right tabular-nums" style={{ color: 'var(--tm-text-1)' }}>
                    {r.total > 0 ? `${r.present}/${r.total}` : '—'}
                  </div>
                </div>
              )
            })}

            {/* Week total */}
            <div className="pt-2.5 mt-1 border-t text-[11px] leading-relaxed" style={{ borderColor: 'var(--tm-border)', color: 'var(--tm-text-3)' }}>
              {totals.total > 0 ? (
                <>
                  <span style={{ color: COLORS.present }}>{totals.present} present</span>
                  {' · '}
                  <span style={{ color: COLORS.absent }}>{totals.absent} absent</span>
                  {' · '}
                  <span>{totals.justified} justified</span>
                  {' · '}
                  <span style={{ color: COLORS.injured }}>{totals.injured} injured</span>
                  {rate !== null && <span style={{ color: 'var(--tm-text-1)' }}>{` · ${rate}% attendance`}</span>}
                </>
              ) : (
                <>No attendance recorded for this week yet.</>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
