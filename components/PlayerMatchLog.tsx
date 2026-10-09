'use client'

import { useEffect, useState } from 'react'
import { LineChart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * A player's match-by-match stats as a simple log: one row per match they
 * have recorded stats for (opponent, date, result), plus a season-average row.
 * Replaces the old "Performance Over Time" line chart, which plotted the same
 * hard-coded numbers for every player and was hard to read. Players with no
 * recorded games get an empty state instead of numbers.
 */

type Row = {
  matchId: string
  opponent: string
  date: string
  result: string | null
  ourScore: number | null
  theirScore: number | null
  minutes: number
  tries: number
  tackles: number
  missed: number
  carries: number
  errors: number
}

const DEFAULT_ROWS = 5

export default function PlayerMatchLog({ playerId, title = 'Performance over time' }: { playerId: string | null | undefined; title?: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!playerId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(false)
      const { data, error: err } = await createClient()
        .from('match_stats')
        .select('match_id, minutes_played, tries_scored, tackles_made, tackles_missed, ball_carries, ball_handling_errors, matches:matches (opponent, match_date, result, score_our_team, score_opponent)')
        .eq('player_id', playerId)
      if (cancelled) return
      if (err) {
        console.error('Error loading match log:', err)
        setError(true)
        setRows([])
      } else {
        setRows(
          (data || [])
            .map((s: any) => ({
              matchId: s.match_id,
              opponent: s.matches?.opponent || 'Unknown opponent',
              date: s.matches?.match_date || '',
              result: s.matches?.result ?? null,
              ourScore: s.matches?.score_our_team ?? null,
              theirScore: s.matches?.score_opponent ?? null,
              minutes: s.minutes_played || 0,
              tries: s.tries_scored || 0,
              tackles: s.tackles_made || 0,
              missed: s.tackles_missed || 0,
              carries: s.ball_carries || 0,
              errors: s.ball_handling_errors || 0,
            }))
            .sort((a, b) => b.date.localeCompare(a.date))
        )
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [playerId])

  const games = rows.length
  const sum = (k: keyof Row) => rows.reduce((t, r) => t + (r[k] as number), 0)
  const avg = (k: keyof Row) => (games ? sum(k) / games : 0)
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
  const tackleAttempts = sum('tackles') + sum('missed')
  const tackleSuccess = tackleAttempts > 0 ? Math.round((sum('tackles') / tackleAttempts) * 100) : null
  const visible = showAll ? rows : rows.slice(0, DEFAULT_ROWS)

  const resultBadge = (r: Row) => {
    const res = (r.result || '').toLowerCase()
    const style =
      res === 'win' ? 'bg-success/15 text-success' :
      res === 'loss' ? 'bg-[#E05757]/15 text-[#E05757]' :
      res === 'draw' ? 'bg-tm-surface-hover text-tm-text-2' : ''
    if (!style) return null
    const score = r.ourScore !== null && r.theirScore !== null ? ` ${r.ourScore}–${r.theirScore}` : ''
    return <span className={`ml-2 px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap ${style}`}>{res.charAt(0).toUpperCase()}{score}</span>
  }

  const num = 'px-1.5 sm:px-2 py-2.5 text-right tabular-nums'

  return (
    <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h3 className="text-xl font-bold text-tm-text-1">{title}</h3>
        {games > 0 && (
          <span className="text-sm text-tm-text-3">
            {games} game{games === 1 ? '' : 's'} recorded
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : error ? (
        <p className="py-8 text-center text-sm text-tm-text-3">Couldn&apos;t load match stats. Try refreshing the page.</p>
      ) : games === 0 ? (
        <div className="py-10 text-center">
          <LineChart className="w-10 h-10 mx-auto mb-3 text-tm-text-3" />
          <p className="font-semibold text-tm-text-1">No match stats yet</p>
          <p className="text-sm text-tm-text-3 mt-1">Your numbers appear here after your first game is recorded.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full min-w-[420px] sm:min-w-[560px] text-sm">
              <thead>
                <tr className="text-xs text-tm-text-3">
                  <th className="px-2 py-2 text-left font-medium">Match</th>
                  <th className="px-1.5 sm:px-2 py-2 text-right font-medium">Mins</th>
                  <th className="px-1.5 sm:px-2 py-2 text-right font-medium">Tries</th>
                  <th className="px-1.5 sm:px-2 py-2 text-right font-medium">Tackles</th>
                  <th className="px-1.5 sm:px-2 py-2 text-right font-medium">Missed</th>
                  <th className="px-1.5 sm:px-2 py-2 text-right font-medium">Carries</th>
                  <th className="hidden sm:table-cell px-2 py-2 text-right font-medium">Errors</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.matchId} className="border-t border-tm-border text-tm-text-1">
                    <td className="px-2 py-2.5">
                      <span className="font-medium">vs {r.opponent}</span>
                      {resultBadge(r)}
                      {r.date && (
                        <div className="text-xs text-tm-text-3">
                          {new Date(`${r.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </td>
                    <td className={num}>{r.minutes}</td>
                    <td className={num}>{r.tries}</td>
                    <td className={num}>{r.tackles}</td>
                    <td className={num}>{r.missed}</td>
                    <td className={num}>{r.carries}</td>
                    <td className={`hidden sm:table-cell ${num}`}>{r.errors}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-tm-border text-tm-text-3">
                  <td className="px-2 py-2.5 text-sm">Average per game</td>
                  <td className={num}>{fmt(avg('minutes'))}</td>
                  <td className={num}>{fmt(avg('tries'))}</td>
                  <td className={num}>{fmt(avg('tackles'))}</td>
                  <td className={num}>{fmt(avg('missed'))}</td>
                  <td className={num}>{fmt(avg('carries'))}</td>
                  <td className={`hidden sm:table-cell ${num}`}>{fmt(avg('errors'))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-tm-text-3">
              {sum('tries')} tr{sum('tries') === 1 ? 'y' : 'ies'} in {games} game{games === 1 ? '' : 's'}
              {tackleSuccess !== null && <> · {tackleSuccess}% tackle success</>}
            </p>
            {games > DEFAULT_ROWS && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-sm font-medium text-tm-secondary hover:opacity-80"
              >
                {showAll ? 'Show last 5' : `Show all ${games} games`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
