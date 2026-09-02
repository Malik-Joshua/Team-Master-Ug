'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Layout from '@/components/Layout'
import RefreshButton from '@/components/RefreshButton'
import { createClient } from '@/lib/supabase/client'
import {
  MessageSquare, ThumbsUp, Flag, CornerDownRight, Send, Trash2,
  Users, Calendar, ClipboardCheck, Loader2, Trophy,
} from 'lucide-react'

/**
 * Coach ↔ Assistant Coach collaboration feed.
 *
 * The Head Coach and Assistant Coach share the same permissions, so either
 * can schedule a session, record match-day attendance or pick a squad. This
 * page is where those actions become reviewable: each one lands here as a
 * feed entry the other can 👍 back, 🚩 object to, comment on and reply to —
 * live, via Supabase Realtime, so two people working at once see each
 * other's input immediately instead of overwriting each other.
 */

interface Person { name: string; role: string }
interface Comment {
  id: string
  activity_id: string
  author_id: string
  parent_id: string | null
  body: string
  stance: 'comment' | 'support' | 'object'
  edited_at: string | null
  created_at: string
  author: Person | null
}
interface Reaction {
  id: string
  activity_id: string
  user_id: string
  kind: 'like' | 'object'
  user: Person | null
}
interface Activity {
  id: string
  actor_id: string
  kind: 'training_session' | 'match_attendance' | 'team_selection'
  reference_id: string
  title: string
  summary: string | null
  created_at: string
  actor: Person | null
  comments: Comment[]
  reactions: Reaction[]
}

const KIND_META: Record<Activity['kind'], { label: string; icon: any; tone: string }> = {
  training_session: { label: 'Training', icon: Calendar, tone: 'text-info' },
  match_attendance: { label: 'Attendance', icon: ClipboardCheck, tone: 'text-success' },
  team_selection: { label: 'Squad', icon: Trophy, tone: 'text-primary' },
}

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const d = Math.floor(diff / 86400)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

const roleLabel = (r?: string) =>
  r === 'asst_coach' ? 'Assistant Coach'
  : r === 'coach' ? 'Head Coach'
  : r === 'data_admin' ? 'Team Manager'
  : r === 'admin' ? 'Owner'
  : r || ''

export default function CollaborationPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [viewerId, setViewerId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  // Per-activity composer state, keyed by activity id (or `${id}:${parentId}`
  // for a reply box) so several drafts can be open at once.
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [replyingTo, setReplyingTo] = useState<Record<string, string | null>>({})
  const [busy, setBusy] = useState<string>('')
  const didInitialLoad = useRef(false)

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true)
    try {
      const r = await fetch('/api/collaboration', { cache: 'no-store' })
      const j = await r.json()
      if (j.needsMigration) setNeedsMigration(true)
      setActivities(j.activities || [])
      if (j.viewerId) setViewerId(j.viewerId)
    } catch (e) {
      console.error('Failed to load collaboration feed', e)
    } finally {
      setLoading(false)
      didInitialLoad.current = true
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Realtime: any insert/update/delete on the three collaboration tables
  // re-pulls the feed. A refetch (rather than patching local state from the
  // payload) keeps joined author names correct without duplicating the
  // server's shaping logic here — the feed is small and capped at 50.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('coach-collaboration')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_activities' }, () => load({ quiet: true }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_comments' }, () => load({ quiet: true }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_reactions' }, () => load({ quiet: true }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const react = async (activityId: string, kind: 'like' | 'object') => {
    setBusy(`react:${activityId}:${kind}`)
    // Optimistic: flip the viewer's own reaction locally so the button
    // responds instantly; realtime will reconcile the authoritative state.
    setActivities((prev) => prev.map((a) => {
      if (a.id !== activityId) return a
      const mine = a.reactions.find((r) => r.user_id === viewerId)
      const others = a.reactions.filter((r) => r.user_id !== viewerId)
      if (mine?.kind === kind) return { ...a, reactions: others }
      return { ...a, reactions: [...others, { id: 'temp', activity_id: activityId, user_id: viewerId, kind, user: null }] }
    }))
    try {
      await fetch('/api/collaboration/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, kind }),
      })
    } catch { load({ quiet: true }) } finally { setBusy('') }
  }

  const submitComment = async (activityId: string, stance: Comment['stance'], parentId?: string | null) => {
    const key = parentId ? `${activityId}:${parentId}` : activityId
    const body = (drafts[key] || '').trim()
    if (!body) return
    setBusy(`comment:${key}`)
    try {
      const r = await fetch('/api/collaboration/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, body, stance, parentId: parentId || null }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        alert(j.error || 'Could not post that comment.')
        return
      }
      setDrafts((d) => ({ ...d, [key]: '' }))
      setReplyingTo((s) => ({ ...s, [activityId]: null }))
      load({ quiet: true })
    } finally { setBusy('') }
  }

  const deleteComment = async (id: string) => {
    if (!confirm('Delete this comment?')) return
    setBusy(`del:${id}`)
    try {
      await fetch(`/api/collaboration/comments?id=${id}`, { method: 'DELETE' })
      load({ quiet: true })
    } finally { setBusy('') }
  }

  const objectionCount = useMemo(
    () => activities.reduce((n, a) =>
      n + a.reactions.filter((r) => r.kind === 'object').length
        + a.comments.filter((c) => c.stance === 'object').length, 0),
    [activities]
  )

  return (
    <Layout pageTitle="Coach Collaboration">
      <div className="space-y-6">
        <div className="bg-tm-surface rounded-card p-5 sm:p-6 border border-tm-border shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-tm-text-1 flex items-center gap-2">
                <Users className="w-6 h-6 text-primary flex-shrink-0" />
                Coach Collaboration
              </h2>
              <p className="text-sm text-tm-text-3 mt-1">
                Every squad selection, training session and match-day attendance the coaching staff records shows up here.
                Back it, flag a concern, or talk it through — updates appear live for whoever else is looking.
              </p>
            </div>
            <RefreshButton onRefresh={() => load()} />
          </div>
          {objectionCount > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/5 px-3 py-2">
              <Flag className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <span className="text-sm text-tm-text-2">
                <strong className="text-tm-text-1">{objectionCount}</strong> open concern{objectionCount === 1 ? '' : 's'} raised on recent work.
              </span>
            </div>
          )}
        </div>

        {needsMigration && (
          <div className="rounded-card border border-yellow-500/40 bg-yellow-500/5 p-4 text-sm text-tm-text-2">
            The collaboration tables aren&apos;t set up yet. Run{' '}
            <code className="text-tm-text-1">supabase/migrations/051_coach_collaboration.sql</code>{' '}
            in the Supabase SQL editor to enable this feed.
          </div>
        )}

        {loading && !didInitialLoad.current ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : activities.length === 0 ? (
          <div className="bg-tm-surface rounded-card border border-tm-border p-12 text-center text-tm-text-3">
            <MessageSquare className="w-14 h-14 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-semibold text-tm-text-1">Nothing to review yet</p>
            <p className="text-sm mt-1">
              Once a coach schedules a session, records match-day attendance or saves a squad, it appears here for the other to review.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((a) => {
              const meta = KIND_META[a.kind] || KIND_META.team_selection
              const Icon = meta.icon
              const likes = a.reactions.filter((r) => r.kind === 'like')
              const objections = a.reactions.filter((r) => r.kind === 'object')
              const mine = a.reactions.find((r) => r.user_id === viewerId)
              const roots = a.comments.filter((c) => !c.parent_id)
              const repliesOf = (id: string) => a.comments.filter((c) => c.parent_id === id)
              const isMineActivity = a.actor_id === viewerId

              return (
                <div key={a.id} className="bg-tm-surface rounded-card border border-tm-border shadow-soft overflow-hidden">
                  {/* Activity header */}
                  <div className="p-4 sm:p-5 border-b border-tm-border">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-tm-surface-hover ${meta.tone}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-tm-surface-hover px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-tm-text-3">
                            {meta.label}
                          </span>
                          <h3 className="text-base font-bold text-tm-text-1">{a.title}</h3>
                        </div>
                        <p className="text-xs text-tm-text-3 mt-1">
                          {a.actor?.name || 'A coach'}
                          {a.actor?.role ? ` · ${roleLabel(a.actor.role)}` : ''}
                          {isMineActivity ? ' · you' : ''} · {relativeTime(a.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Reactions */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => react(a.id, 'like')}
                        disabled={!!busy}
                        title={likes.map((l) => l.user?.name).filter(Boolean).join(', ') || 'Back this'}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                          mine?.kind === 'like'
                            ? 'border-success/50 bg-success/10 text-success'
                            : 'border-tm-border text-tm-text-3 hover:border-success/40 hover:text-success'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" /> Back{likes.length ? ` · ${likes.length}` : ''}
                      </button>
                      <button
                        onClick={() => react(a.id, 'object')}
                        disabled={!!busy}
                        title={objections.map((l) => l.user?.name).filter(Boolean).join(', ') || 'Flag a concern'}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                          mine?.kind === 'object'
                            ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-500'
                            : 'border-tm-border text-tm-text-3 hover:border-yellow-500/40 hover:text-yellow-500'
                        }`}
                      >
                        <Flag className="w-3.5 h-3.5" /> Object{objections.length ? ` · ${objections.length}` : ''}
                      </button>
                      <span className="inline-flex items-center gap-1.5 text-xs text-tm-text-3">
                        <MessageSquare className="w-3.5 h-3.5" /> {a.comments.length}
                      </span>
                    </div>
                  </div>

                  {/* Thread */}
                  <div className="p-4 sm:p-5 space-y-3">
                    {roots.map((c) => (
                      <div key={c.id} className="space-y-2">
                        <CommentRow
                          comment={c}
                          viewerId={viewerId}
                          onDelete={() => deleteComment(c.id)}
                          onReply={() => setReplyingTo((s) => ({ ...s, [a.id]: s[a.id] === c.id ? null : c.id }))}
                        />
                        {repliesOf(c.id).map((r) => (
                          <div key={r.id} className="ml-6 pl-3 border-l border-tm-border">
                            <CommentRow comment={r} viewerId={viewerId} onDelete={() => deleteComment(r.id)} />
                          </div>
                        ))}
                        {replyingTo[a.id] === c.id && (
                          <div className="ml-6 pl-3 border-l border-tm-border">
                            <Composer
                              value={drafts[`${a.id}:${c.id}`] || ''}
                              onChange={(v) => setDrafts((d) => ({ ...d, [`${a.id}:${c.id}`]: v }))}
                              onSubmit={() => submitComment(a.id, 'comment', c.id)}
                              busy={busy === `comment:${a.id}:${c.id}`}
                              placeholder={`Reply to ${c.author?.name || 'this'}…`}
                              compact
                            />
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Top-level composer with explicit stances */}
                    <Composer
                      value={drafts[a.id] || ''}
                      onChange={(v) => setDrafts((d) => ({ ...d, [a.id]: v }))}
                      onSubmit={() => submitComment(a.id, 'comment')}
                      onSupport={() => submitComment(a.id, 'support')}
                      onObject={() => submitComment(a.id, 'object')}
                      busy={busy === `comment:${a.id}`}
                      placeholder="Add a note for the other coach…"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}

function CommentRow({
  comment, viewerId, onDelete, onReply,
}: {
  comment: Comment
  viewerId: string
  onDelete: () => void
  onReply?: () => void
}) {
  const tone =
    comment.stance === 'object'
      ? 'border-yellow-500/40 bg-yellow-500/5'
      : comment.stance === 'support'
      ? 'border-success/40 bg-success/5'
      : 'border-tm-border bg-tm-surface-hover'

  return (
    <div className={`rounded-lg border ${tone} px-3 py-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-tm-text-1">
            {comment.author?.name || 'Someone'}
            {comment.author?.role ? <span className="font-normal text-tm-text-3"> · {roleLabel(comment.author.role)}</span> : null}
            {comment.stance === 'object' && <span className="ml-1.5 text-yellow-500">🚩 objected</span>}
            {comment.stance === 'support' && <span className="ml-1.5 text-success">👍 backed</span>}
          </p>
          <p className="text-sm text-tm-text-2 mt-0.5 whitespace-pre-wrap break-words">{comment.body}</p>
          <p className="text-[11px] text-tm-text-3 mt-1">
            {relativeTime(comment.created_at)}{comment.edited_at ? ' · edited' : ''}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {onReply && (
            <button onClick={onReply} title="Reply" className="rounded p-1 text-tm-text-3 hover:text-tm-text-1">
              <CornerDownRight className="w-3.5 h-3.5" />
            </button>
          )}
          {comment.author_id === viewerId && (
            <button onClick={onDelete} title="Delete" className="rounded p-1 text-tm-text-3 hover:text-red-500">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Composer({
  value, onChange, onSubmit, onSupport, onObject, busy, placeholder, compact,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onSupport?: () => void
  onObject?: () => void
  busy: boolean
  placeholder: string
  compact?: boolean
}) {
  return (
    <div className={compact ? '' : 'pt-1'}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={compact ? 2 : 2}
        className="tm-textarea text-sm"
        onKeyDown={(e) => {
          // ⌘/Ctrl+Enter submits — the fast path when you're going back and
          // forth; plain Enter still inserts a newline.
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onSubmit() }
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onClick={onSubmit}
          disabled={busy || !value.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-tm-secondary px-3 py-1.5 text-xs font-semibold text-tm-on-secondary transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {compact ? 'Reply' : 'Comment'}
        </button>
        {onSupport && (
          <button
            onClick={onSupport}
            disabled={busy || !value.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 px-3 py-1.5 text-xs font-semibold text-success transition-colors hover:bg-success/10 disabled:opacity-50"
          >
            <ThumbsUp className="w-3.5 h-3.5" /> Back it
          </button>
        )}
        {onObject && (
          <button
            onClick={onObject}
            disabled={busy || !value.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-500/40 px-3 py-1.5 text-xs font-semibold text-yellow-500 transition-colors hover:bg-yellow-500/10 disabled:opacity-50"
          >
            <Flag className="w-3.5 h-3.5" /> Raise a concern
          </button>
        )}
      </div>
    </div>
  )
}
