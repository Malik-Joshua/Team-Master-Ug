'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

/**
 * TeamPitchView — a saved matchday squad shown on a rugby pitch with game-style
 * player cards.
 *
 *  - Two top-level tabs: STARTING and BENCH.
 *  - Within each tab, a Forwards/Backs toggle switches which unit's positions
 *    are shown, so only 7-8 cards are ever on screen at once (no overlap).
 */

type Selection = {
  player_id: string
  player_name?: string
  player?: { name?: string }
  profile_picture_url?: string | null
  position?: string
  jersey_number?: number | null
  is_starting?: boolean
  is_substitute?: boolean
  is_captain?: boolean
  is_assistant_captain?: boolean
}

type Stat = { attendanceRate: number | null; caps: number }
type Category = 'forwards' | 'backs'

// Forwards pitch (1-8) and backs pitch (9-15) are shown as separate screens,
// each laid out with generous spacing so cards never overlap.
const FORWARDS_SLOTS: Record<number, { code: string; label: string; x: number; y: number }> = {
  1: { code: 'LHP', label: 'Loosehead Prop',    x: 25, y: 16 },
  2: { code: 'HK',  label: 'Hooker',            x: 50, y: 10 },
  3: { code: 'THP', label: 'Tighthead Prop',    x: 75, y: 16 },
  4: { code: 'LK',  label: 'Lock',              x: 38, y: 40 },
  5: { code: 'LK',  label: 'Lock',              x: 62, y: 40 },
  6: { code: 'BF',  label: 'Blindside Flanker', x: 20, y: 66 },
  8: { code: 'N8',  label: 'Number Eight',      x: 50, y: 72 },
  7: { code: 'OF',  label: 'Openside Flanker',  x: 80, y: 66 },
}
const BACKS_SLOTS: Record<number, { code: string; label: string; x: number; y: number }> = {
  9:  { code: 'SH', label: 'Scrum Half',      x: 20, y: 10 },
  10: { code: 'FH', label: 'Fly Half',        x: 42, y: 24 },
  12: { code: 'IC', label: 'Inside Centre',   x: 60, y: 38 },
  13: { code: 'OC', label: 'Outside Centre',  x: 76, y: 54 },
  11: { code: 'LW', label: 'Left Wing',       x: 10, y: 64 },
  14: { code: 'RW', label: 'Right Wing',      x: 90, y: 70 },
  15: { code: 'FB', label: 'Full-Back',       x: 50, y: 90 },
}

const SLUG_TO_SLOTS: Record<string, number[]> = {
  loosehead_prop: [1], prop: [1, 3], hooker: [2], tighthead_prop: [3],
  lock: [4, 5], blindside_flanker: [6], openside_flanker: [7], flanker: [6, 7],
  '8th_man': [8], scrum_half: [9], fly_half: [10], left_wing: [11],
  inside_center: [12], outside_center: [13], right_wing: [14], winger: [11, 14],
  full_back: [15],
}
const FORWARD_SLUGS = new Set(['loosehead_prop', 'prop', 'hooker', 'tighthead_prop', 'lock', 'blindside_flanker', 'openside_flanker', 'flanker', '8th_man'])

const slugCategory = (slug?: string): Category => (FORWARD_SLUGS.has(slug || '') ? 'forwards' : 'backs')
const codeForSlug = (slug?: string) => {
  const num = (SLUG_TO_SLOTS[slug || ''] || [])[0]
  if (num == null) return (slug || '').replace(/_/g, ' ').slice(0, 3).toUpperCase()
  return (FORWARDS_SLOTS[num] || BACKS_SLOTS[num])?.code || ''
}

const displayName = (s: Selection) => s.player_name || s.player?.name || 'Player'
const shortName = (name: string) => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}
const initials = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

/** Game-style portrait player card (photo or initials). */
function PlayerCard({ sel, stat, number, code, size = 'pitch' }: {
  sel: Selection
  stat?: Stat
  number: number | string
  code: string
  size?: 'pitch' | 'bench'
}) {
  const name = displayName(sel)
  const attend = stat?.attendanceRate
  const photo = sel.profile_picture_url
  const w = size === 'pitch' ? 'w-[74px]' : 'w-[96px]'
  const topH = size === 'pitch' ? 'h-[60px]' : 'h-[86px]'
  const numText = size === 'pitch' ? 'text-base' : 'text-xl'

  return (
    <div
      className={`${w} group relative cursor-pointer overflow-hidden rounded-lg border border-white/30 shadow-[0_3px_10px_rgba(0,0,0,0.45)] transition-all duration-200 ease-out hover:z-10 hover:-translate-y-1.5 hover:scale-[1.06] hover:border-tm-primary hover:shadow-[0_0_14px_3px_var(--tm-primary),0_10px_22px_rgba(0,0,0,0.5)]`}
    >
      <div className={`relative ${topH} overflow-hidden bg-gradient-to-br from-sky-400 to-cyan-700`}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={name} className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.28),transparent_45%)]" />
        )}
        {!photo && (
          <div className="absolute inset-x-0 bottom-1.5 flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-black/25 text-sm font-bold text-white">
              {initials(name)}
            </div>
          </div>
        )}
        <div className="absolute right-1 top-0.5 rounded bg-tm-primary px-1 text-right leading-none">
          <div className={`${numText} font-black text-tm-on-primary`}>{number}</div>
          <div className="-mt-0.5 text-[9px] font-bold text-black">{code}</div>
        </div>
        {(sel.is_captain || sel.is_assistant_captain) && (
          <div className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-tm-primary text-[9px] font-black text-tm-on-primary ring-1 ring-white/70">
            {sel.is_captain ? 'C' : 'V'}
          </div>
        )}
      </div>
      <div className="bg-tm-primary px-1 pb-1 pt-0.5">
        <div className="truncate text-center text-[10px] font-bold leading-tight text-tm-on-primary">{shortName(name)}</div>
        <div className="mx-auto mt-0.5 h-[3px] w-[85%] overflow-hidden rounded-full bg-black/30" title={attend != null ? `Attendance ${attend}%` : 'No data yet'}>
          <div className="h-full rounded-full bg-tm-on-primary/90" style={{ width: `${attend != null ? attend : 0}%` }} />
        </div>
      </div>
    </div>
  )
}

function EmptySlot({ number, code, size = 'pitch' }: { number: number; code: string; size?: 'pitch' | 'bench' }) {
  const w = size === 'pitch' ? 'w-[74px] py-3' : 'w-[70px] py-2.5'
  return (
    <div className={`flex ${w} flex-col items-center justify-center rounded-lg border border-dashed border-white/50 bg-black/25 opacity-70`}>
      <div className="text-lg font-black text-white/80">{number}</div>
      <div className="text-[9px] font-bold uppercase text-white/70">{code}</div>
    </div>
  )
}

/** Pitch showing only one unit's positions (forwards OR backs) at a time. */
function UnitPitch({ selectionsBySlot, slots, stats }: {
  selectionsBySlot: Record<number, Selection>
  slots: Record<number, { code: string; label: string; x: number; y: number }>
  stats: Record<string, Stat>
}) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-gradient-to-b from-green-600 to-green-700 shadow-inner">
      {/* mowing stripes */}
      <div className="absolute inset-0 opacity-15">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={`h-[12.5%] w-full ${i % 2 === 0 ? 'bg-black/25' : ''}`} />
        ))}
      </div>
      {/* Rugby pitch markings: in-goal areas, try lines, 5m/22m/halfway lines,
          5m & 15m channel markers, and goalposts — so it reads as a real
          rugby pitch, not a plain green rectangle. */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* in-goal areas, tinted slightly darker */}
        <rect x="3" y="3" width="94" height="7" fill="black" opacity="0.12" />
        <rect x="3" y="90" width="94" height="7" fill="black" opacity="0.12" />

        <g stroke="white" fill="none" opacity="0.55">
          {/* outer boundary (touchlines + dead-ball lines) */}
          <rect x="3" y="3" width="94" height="94" strokeWidth="0.4" />
          {/* try lines */}
          <line x1="3" y1="10" x2="97" y2="10" strokeWidth="0.45" />
          <line x1="3" y1="90" x2="97" y2="90" strokeWidth="0.45" />
          {/* 5m lines */}
          <line x1="3" y1="15" x2="97" y2="15" strokeWidth="0.25" strokeDasharray="1.2 1" />
          <line x1="3" y1="85" x2="97" y2="85" strokeWidth="0.25" strokeDasharray="1.2 1" />
          {/* 22m lines */}
          <line x1="3" y1="27" x2="97" y2="27" strokeWidth="0.35" />
          <line x1="3" y1="73" x2="97" y2="73" strokeWidth="0.35" />
          {/* 10m either side of halfway */}
          <line x1="3" y1="42" x2="97" y2="42" strokeWidth="0.22" strokeDasharray="1.2 1" />
          <line x1="3" y1="58" x2="97" y2="58" strokeWidth="0.22" strokeDasharray="1.2 1" />
          {/* halfway line */}
          <line x1="3" y1="50" x2="97" y2="50" strokeWidth="0.4" />
          {/* 5m and 15m channel markers (vertical, dashed, short ticks) */}
          {[8, 22, 78, 92].map((x) => (
            <line key={x} x1={x} y1="3" x2={x} y2="97" strokeWidth="0.15" strokeDasharray="0.8 1.6" opacity="0.6" />
          ))}
        </g>

        {/* goalposts at each try line */}
        {[10, 90].map((y) => (
          <g key={y} stroke="white" strokeWidth="0.5" opacity="0.7">
            <line x1="46" y1={y} x2="46" y2={y - (y === 10 ? 6 : -6)} />
            <line x1="54" y1={y} x2="54" y2={y - (y === 10 ? 6 : -6)} />
            <line x1="46" y1={y - (y === 10 ? 4 : -4)} x2="54" y2={y - (y === 10 ? 4 : -4)} />
          </g>
        ))}
      </svg>
      {Object.entries(slots).map(([numStr, slot]) => {
        const num = Number(numStr)
        const sel = selectionsBySlot[num]
        return (
          <div key={num} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
            {sel ? (
              <PlayerCard sel={sel} stat={stats[sel.player_id]} number={sel.jersey_number || num} code={slot.code} />
            ) : (
              <EmptySlot number={num} code={slot.code} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Toggle: a pill showing the current unit, and a chevron button to flip to the other. */
function UnitToggle({ category, onToggle }: { category: Category; onToggle: () => void }) {
  const other: Category = category === 'forwards' ? 'backs' : 'forwards'
  return (
    <div className="mb-2 flex items-center justify-between">
      <span className="rounded bg-teal-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
        {category}
      </span>
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 rounded-full border border-tm-border bg-tm-surface-hover px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-tm-text-1 transition-colors hover:bg-tm-surface"
      >
        {category === 'forwards' ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        {other}
      </button>
    </div>
  )
}

export default function TeamPitchView({ starting, substitutes, stats }: {
  starting: Selection[]
  substitutes: Selection[]
  stats: Record<string, Stat>
}) {
  const [tab, setTab] = useState<'starting' | 'bench'>('starting')
  const [category, setCategory] = useState<Category>('forwards')

  // Assign starters to shirt-number slots (greedy: first free slot for the slug).
  const slotAssignments: Record<number, Selection> = {}
  const taken = new Set<number>()
  const unplaced: Selection[] = []
  for (const p of starting) {
    const slots = SLUG_TO_SLOTS[p.position || ''] || []
    const free = slots.find((s) => !taken.has(s))
    if (free != null) { slotAssignments[free] = p; taken.add(free) } else unplaced.push(p)
  }
  const unplacedInCategory = unplaced.filter((p) => slugCategory(p.position) === category)

  const benchForwards = substitutes.filter((s) => slugCategory(s.position) === 'forwards')
  const benchBacks = substitutes.filter((s) => slugCategory(s.position) === 'backs')
  const benchInCategory = category === 'forwards' ? benchForwards : benchBacks

  const tabs: { key: 'starting' | 'bench'; label: string; count: number }[] = [
    { key: 'starting', label: 'Starting', count: starting.length },
    { key: 'bench', label: 'Bench', count: substitutes.length },
  ]

  return (
    <div className="overflow-hidden rounded-xl border border-tm-border">
      {/* Full-width tab bar (like the game) */}
      <div className="flex bg-tm-bg">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-center text-sm font-bold uppercase tracking-wider transition-colors ${
              tab === t.key ? 'bg-teal-500 text-white' : 'bg-tm-surface-hover text-tm-text-3 hover:text-tm-text-1'
            }`}
          >
            {t.label} <span className="ml-1 opacity-80">({t.count})</span>
          </button>
        ))}
      </div>

      {tab === 'starting' ? (
        <div className="bg-tm-surface p-3">
          <UnitToggle category={category} onToggle={() => setCategory((c) => (c === 'forwards' ? 'backs' : 'forwards'))} />

          <UnitPitch
            selectionsBySlot={slotAssignments}
            slots={category === 'forwards' ? FORWARDS_SLOTS : BACKS_SLOTS}
            stats={stats}
          />

          {unplacedInCategory.length > 0 && (
            <div className="mt-3">
              <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tm-text-3">
                Other {category}
              </h5>
              <div className="flex flex-wrap gap-3">
                {unplacedInCategory.map((s) => (
                  <PlayerCard key={s.player_id} sel={s} stat={stats[s.player_id]} number={s.jersey_number || '–'} code={codeForSlug(s.position)} size="bench" />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-tm-surface p-4">
          <UnitToggle category={category} onToggle={() => setCategory((c) => (c === 'forwards' ? 'backs' : 'forwards'))} />

          {substitutes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-tm-border p-6 text-center text-sm text-tm-text-3">
              No substitutes selected for this fixture.
            </p>
          ) : benchInCategory.length === 0 ? (
            <p className="rounded-lg border border-dashed border-tm-border p-6 text-center text-sm text-tm-text-3">
              No {category} on the bench for this fixture.
            </p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {benchInCategory.map((s) => (
                <PlayerCard key={s.player_id} sel={s} stat={stats[s.player_id]} number={s.jersey_number || '–'} code={codeForSlug(s.position)} size="bench" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
