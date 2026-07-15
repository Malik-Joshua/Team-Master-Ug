import Link from 'next/link'
import { Trophy, X, Calendar, Clock, MapPin } from 'lucide-react'

interface MatchLike {
  tournament_type?: string | null
  opponent: string
  match_date: string
  venue?: string | null
  notes?: string | null
}

interface MatchDayModalProps {
  match: MatchLike | null | undefined
  onClose: () => void
  /** Where the "Manage Fixtures" button sends the user. Defaults to /fixtures. */
  manageHref?: string
  /** Club badge URL. If provided, displays the badge; otherwise shows Trophy icon. */
  clubBadgeUrl?: string | null
  /** The club's current display name (read live from club_settings), shown as
   *  the home team in "{homeTeamName} vs {opponent}". Falls back to
   *  "Team Master" so a club that hasn't set a nickname still sees a name. */
  homeTeamName?: string | null
}

const formatDateSafe = (dateString: string | null | undefined, options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) => {
  if (!dateString) return 'TBD'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'TBD'
  return date.toLocaleDateString('en-US', options)
}

const formatTimeSafe = (dateString: string | null | undefined) => {
  if (!dateString) return 'TBD'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'TBD'
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Shared "Match Day Details" popup — same look for the club owner, coach, and
 * team manager, so whichever role clicks "Match day" on a fixture card sees
 * the identical screen.
 */
export default function MatchDayModal({ match, onClose, manageHref = '/fixtures', clubBadgeUrl, homeTeamName }: MatchDayModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 sm:p-6 animate-fade-in backdrop-blur-sm">
      <div className="rounded-2xl shadow-2xl max-w-lg w-full max-h-[88vh] overflow-hidden flex flex-col" style={{ background: 'var(--tm-surface)', border: '1px solid var(--tm-border)' }}>
        {/* Header */}
        <div className="px-7 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--tm-border)', background: 'var(--tm-surface-hover)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: 'var(--tm-primary-subtle)' }}>
              {clubBadgeUrl ? (
                <img src={clubBadgeUrl} alt="Club logo" className="w-full h-full object-cover" />
              ) : (
                <Trophy className="w-5 h-5" style={{ color: 'var(--tm-secondary)' }} />
              )}
            </div>
            <div>
              <h3 className="text-[17px] font-semibold leading-tight" style={{ color: 'var(--tm-text-1)' }}>Match Day Details</h3>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--tm-text-3)' }}>Everything about the next fixture</p>
            </div>
          </div>
          <button onClick={onClose} className="cursor-pointer w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--tm-border)]" style={{ color: 'var(--tm-text-3)' }} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-7 py-6 space-y-5 overflow-y-auto">
          {match ? (
            <>
              <div className="text-center">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] px-3 py-1 rounded-full" style={{ background: 'var(--tm-primary-subtle)', color: 'var(--tm-secondary)' }}>
                  {match.tournament_type?.replace('_', ' ') || 'Match'}
                </span>
                <h4 className="text-[20px] font-bold mt-3 leading-tight" style={{ color: 'var(--tm-text-1)' }}>
                  {homeTeamName || 'Team Master'} <span className="text-[12px] font-semibold px-2.5 py-1 mx-2 rounded-full align-middle" style={{ background: 'var(--tm-border)', color: 'var(--tm-text-3)' }}>vs</span> {match.opponent}
                </h4>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 hover:bg-[var(--tm-surface-hover)] hover:-translate-y-0.5 hover:shadow-md" style={{ background: 'var(--tm-surface-hover)', border: '1px solid var(--tm-border)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--tm-primary-subtle)' }}>
                    <Calendar className="w-5 h-5" style={{ color: 'var(--tm-secondary)' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tm-text-3)' }}>Date</p>
                    <p className="text-[14px] font-semibold mt-0.5" style={{ color: 'var(--tm-text-1)' }}>
                      {formatDateSafe(match.match_date)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" style={{ background: 'var(--tm-surface-hover)', border: '1px solid var(--tm-border)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--tm-primary-subtle)' }}>
                    <Clock className="w-5 h-5" style={{ color: 'var(--tm-secondary)' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tm-text-3)' }}>Kickoff Time</p>
                    <p className="text-[14px] font-semibold mt-0.5" style={{ color: 'var(--tm-text-1)' }}>
                      {formatTimeSafe(match.match_date)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" style={{ background: 'var(--tm-surface-hover)', border: '1px solid var(--tm-border)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--tm-primary-subtle)' }}>
                    <MapPin className="w-5 h-5" style={{ color: 'var(--tm-secondary)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tm-text-3)' }}>Venue</p>
                    <p className="text-[14px] font-semibold mt-0.5 break-words" style={{ color: 'var(--tm-text-1)' }}>
                      {match.venue || 'TBD'}
                    </p>
                  </div>
                </div>
              </div>

              {match.notes && (
                <div className="pt-4 border-t" style={{ borderColor: 'var(--tm-border)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tm-text-3)' }}>Match Day Notes</p>
                  <p className="text-[13px] leading-relaxed px-4 py-3 rounded-xl" style={{ color: 'var(--tm-text-2)', background: 'var(--tm-surface-hover)', border: '1px solid var(--tm-border)' }}>
                    {match.notes}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-14 h-14 mx-auto opacity-20 mb-3" style={{ color: 'var(--tm-text-muted)' }} />
              <p className="text-[14px] font-semibold" style={{ color: 'var(--tm-text-1)' }}>No upcoming fixtures scheduled</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--tm-border)', background: 'var(--tm-surface-hover)' }}>
          <button
            onClick={onClose}
            className="px-5 py-2 border rounded-lg text-[13px] font-semibold cursor-pointer transition-colors hover:bg-[var(--tm-border)]"
            style={{ background: 'transparent', borderColor: 'var(--tm-border)', color: 'var(--tm-text-2)' }}
          >
            Cancel
          </button>
          <Link
            href={manageHref}
            className="px-5 py-2 rounded-lg text-[13px] font-semibold text-center hover:opacity-90 transition-opacity border-none cursor-pointer bg-[var(--tm-secondary)]"
            style={{ color: 'var(--tm-on-secondary)' }}
          >
            Manage Fixtures
          </Link>
        </div>
      </div>
    </div>
  )
}
