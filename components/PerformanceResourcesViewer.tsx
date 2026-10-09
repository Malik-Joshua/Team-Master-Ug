'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, Utensils, Dumbbell, PlayCircle, MapPin, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * Read-only viewer for performance resources (diet plans, gym programmes, play
 * and position info). Self-contained: fetches its own data, so any role that
 * has the performance feature can see what coaches/admins publish — not just
 * players. Each card shows who created it; per-viewer dismiss (localStorage)
 * lets a user clear cards without affecting anyone else.
 */

type Resource = {
  id: string
  title: string
  resource_type: string
  description: string | null
  content: string | null
  links: { url: string; label?: string }[] | null
  attachment_url: string | null
  created_at: string
  created_by_profile: { name: string; role: string; profile_picture_url: string | null } | null
}

const TYPES: Record<string, { label: string; icon: any; color: string }> = {
  diet_plan: { label: 'Diet Plan', icon: Utensils, color: 'bg-success' },
  gym_programme: { label: 'Gym Programme', icon: Dumbbell, color: 'bg-primary' },
  play_info: { label: 'Play Information', icon: PlayCircle, color: 'bg-info' },
  position_info: { label: 'Position Information', icon: MapPin, color: 'bg-warning' },
}

const roleLabel = (role?: string) => {
  switch (role) {
    case 'admin': return 'Admin'
    case 'coach': return 'Head Coach'
    case 'asst_coach': return 'Assistant Coach'
    case 'data_admin': return 'Team Manager'
    case 'physio': return 'Physio'
    default: return role ? role.replace(/_/g, ' ') : ''
  }
}

export default function PerformanceResourcesViewer({ viewerId }: { viewerId?: string | null }) {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('all')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [showDismissed, setShowDismissed] = useState(false)

  const key = viewerId ? `dismissed_perf_resources_${viewerId}` : null
  useEffect(() => {
    if (!key) return
    try { const raw = localStorage.getItem(key); if (raw) setDismissed(new Set(JSON.parse(raw))) } catch {}
  }, [key])
  const persist = (next: Set<string>) => { try { if (key) localStorage.setItem(key, JSON.stringify([...next])) } catch {} }
  const dismiss = (id: string) => setDismissed((p) => { const n = new Set(p).add(id); persist(n); return n })
  const restore = (id: string) => setDismissed((p) => { const n = new Set(p); n.delete(id); persist(n); return n })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/performance-resources', { cache: 'no-store' })
      const j = await r.json()
      setResources(j.resources || [])
    } catch (e) {
      console.error('Failed to load performance resources', e)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const typeInfo = (t: string) => TYPES[t] || { label: 'Resource', icon: FileText, color: 'bg-neutral-medium' }
  const byType = type === 'all' ? resources : resources.filter((r) => r.resource_type === type)
  const visible = byType.filter((r) => showDismissed || !dismissed.has(r.id))

  return (
    <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-tm-text-1">Performance Resources</h2>
        <div className="flex items-center gap-3">
          {dismissed.size > 0 && (
            <button onClick={() => setShowDismissed((v) => !v)} className="text-xs text-tm-text-3 hover:text-tm-text-1 underline">
              {showDismissed ? 'Hide dismissed' : `Show dismissed (${dismissed.size})`}
            </button>
          )}
          <select value={type} onChange={(e) => setType(e.target.value)} className="px-4 py-2 border border-tm-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="all">All Resources</option>
            <option value="diet_plan">Diet Plans</option>
            <option value="gym_programme">Gym Programmes</option>
            <option value="play_info">Play Information</option>
            <option value="position_info">Position Information</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" /></div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-tm-text-3 mx-auto mb-4" />
          <p className="text-tm-text-3">{resources.length === 0 ? 'No performance resources available yet' : 'No resources to show — all dismissed'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visible.map((resource) => {
            const info = typeInfo(resource.resource_type)
            const Icon = info.icon
            const isDismissed = dismissed.has(resource.id)
            const creator = resource.created_by_profile
            return (
              <div key={resource.id} className={`border border-tm-border rounded-lg p-6 hover:shadow-md transition-shadow relative ${isDismissed ? 'opacity-60' : ''}`}>
                <button
                  onClick={() => (isDismissed ? restore(resource.id) : dismiss(resource.id))}
                  className="absolute top-4 right-4 text-tm-text-3 hover:text-tm-text-1 p-1 rounded hover:bg-tm-surface-hover transition-colors"
                  title={isDismissed ? 'Restore this card' : 'Dismiss this card'}
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-start gap-3 mb-4 pr-8">
                  <div className={`${info.color} p-3 rounded-lg`}><Icon className="w-5 h-5 text-white" /></div>
                  <div>
                    <h3 className="text-lg font-bold text-tm-text-1">{resource.title}</h3>
                    <span className="text-xs text-tm-text-3">{info.label}</span>
                  </div>
                </div>
                {resource.description && <p className="text-sm text-tm-text-3 mb-4">{resource.description}</p>}
                {resource.content && <div className="text-sm text-tm-text-1 whitespace-pre-wrap mb-4">{resource.content}</div>}
                {((resource.links && resource.links.length > 0) || resource.attachment_url) && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-tm-text-1">Links:</p>
                    <div className="flex flex-wrap gap-2">
                      {resource.links && resource.links.length > 0 ? resource.links.map((link, i) => (
                        <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm inline-flex items-center gap-1 px-3 py-1 bg-primary/10 rounded-lg">
                          <FileText className="w-4 h-4" />{link.label || 'Link'}
                        </a>
                      )) : resource.attachment_url ? (
                        <a href={resource.attachment_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm inline-flex items-center gap-1 px-3 py-1 bg-primary/10 rounded-lg">
                          <FileText className="w-4 h-4" />View Attachment
                        </a>
                      ) : null}
                    </div>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-tm-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {creator?.profile_picture_url ? (
                      <img src={creator.profile_picture_url} alt={creator.name} className="h-6 w-6 rounded-full object-cover border border-tm-border flex-shrink-0" />
                    ) : (
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-tm-secondary text-[10px] font-bold text-tm-on-secondary">
                        {(creator?.name || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-xs text-tm-text-3 truncate">
                      {creator ? <>By {creator.name}{creator.role ? ` · ${roleLabel(creator.role)}` : ''}</> : 'Unknown author'}
                    </span>
                  </div>
                  <span className="text-xs text-tm-text-3 flex-shrink-0">{new Date(resource.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
