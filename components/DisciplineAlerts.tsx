'use client'

/**
 * DisciplineAlerts — dashboard widget that surfaces recent match discipline
 * events (red / yellow cards and staff absences) with role-appropriate copy.
 *
 * The underlying notifications are created by:
 *   - /api/match-stats/notify-cards          (reference_type = 'match_card')
 *   - /api/match-stats/notify-staff-absence  (reference_type = 'match_absence')
 *
 * Both endpoints write per-recipient copy (so a coach sees "Player X was
 * shown a red card…" and the player themselves sees "You were shown a red
 * card…"); this widget just filters the current user's notifications down to
 * those two reference_types and renders the most recent handful.
 *
 * Dropped onto every management-side and player dashboard so the exact
 * message tailored to that account is the first thing they see.
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { AlertTriangle, UserX } from 'lucide-react'
import { useNotifications, type Notification } from '@/hooks/useNotifications'

const RELEVANT_TYPES = new Set(['match_card', 'match_absence'])

function iconFor(n: Notification) {
  if (n.reference_type === 'match_absence') return UserX
  return AlertTriangle
}

function toneFor(n: Notification): { border: string; bg: string; text: string } {
  // Red cards / red-severity notifications use error tone; yellow / warnings
  // use warning. Anything else falls back to a subdued surface tone.
  if (n.type === 'error') return { border: 'border-red-500/40', bg: 'bg-red-500/5', text: 'text-red-400' }
  if (n.type === 'warning') return { border: 'border-yellow-500/40', bg: 'bg-yellow-500/5', text: 'text-yellow-500' }
  return { border: 'border-tm-border', bg: 'bg-tm-surface-hover', text: 'text-tm-text-2' }
}

function relativeTime(iso: string) {
  const t = new Date(iso).getTime()
  const diff = (Date.now() - t) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const d = Math.floor(diff / 86400)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function DisciplineAlerts({ limit = 5 }: { limit?: number }) {
  const { notifications, loading } = useNotifications()

  const items = useMemo(
    () =>
      notifications
        .filter((n) => n.reference_type && RELEVANT_TYPES.has(n.reference_type))
        .slice(0, limit),
    [notifications, limit]
  )

  // Hide the whole card if there's nothing to show — keeps the dashboard
  // uncluttered until an actual discipline event happens.
  if (loading || items.length === 0) return null

  return (
    <div className="bg-tm-surface rounded-card p-4 sm:p-6 border border-tm-border shadow-soft">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base sm:text-lg font-bold text-tm-text-1 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Match-day alerts
        </h3>
        <span className="text-[11px] text-tm-text-3">{items.length} recent</span>
      </div>
      <ul className="space-y-2">
        {items.map((n) => {
          const Icon = iconFor(n)
          const tone = toneFor(n)
          const body = (
            <div className={`rounded-lg border ${tone.border} ${tone.bg} px-3 py-2 transition-colors hover:brightness-110`}>
              <div className="flex items-start gap-2">
                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${tone.text}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-tm-text-1 leading-snug">{n.title}</p>
                  <p className="text-xs text-tm-text-2 mt-0.5 leading-snug">{n.message}</p>
                  <p className="text-[11px] text-tm-text-3 mt-1">{relativeTime(n.created_at)}{!n.read ? ' · unread' : ''}</p>
                </div>
              </div>
            </div>
          )
          return (
            <li key={n.id}>
              {n.action_url ? <Link href={n.action_url}>{body}</Link> : body}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
