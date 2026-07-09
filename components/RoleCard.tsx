'use client'

import { useState } from 'react'

/**
 * RoleCard
 * -----------------------------------------------------------------------------
 * A morale-boosting hero card shown on a user's own profile.
 *  - Coaches see the coach card.
 *  - Players see the card for their playing position.
 *  - Any other role renders nothing.
 *
 * Card artwork lives in /public/cards/ and is named by the position slug
 * (matching the values used across the app), e.g.:
 *   public/cards/loosehead_prop.jpg, public/cards/fly_half.jpg, public/cards/coach.jpg
 *
 * The motivational copy below is the app-rendered caption that sits beside the
 * artwork. Refine the `title` / `tagline` for each entry to match your card art.
 */

type CardInfo = { title: string; tagline: string }

// Keyed by position slug (players) or 'coach'. Keep keys in sync with the
// position values defined in app/players/page.tsx.
export const CARD_INFO: Record<string, CardInfo> = {
  loosehead_prop: {
    title: 'Loosehead Prop — The Granite Block',
    tagline:
      'Position 1: the anchor. A massive, powerful, unmovable force in the scrum — raw stability and unyielding power the whole pack is built on.',
  },
  tighthead_prop: {
    title: 'Tighthead Prop — The Hydraulic Press',
    tagline:
      'Position 3: the ultimate in industrial power. You absorb and deliver maximum pressure — overwhelming force in every scrum.',
  },
  hooker: {
    title: 'Hooker — The Raptor Talon',
    tagline:
      'Position 2: central to the scrum and relentless in the ball-winning fight. Agile yet aggressive — fast hands, a lethal strike, and a grip that never lets go.',
  },
  lock: {
    title: 'Locks — The Construction Cranes',
    tagline:
      'Positions 4 & 5: the engine room. Towering, strong and dominant in the lineout — unified height and power that rules the air.',
  },
  blindside_flanker: {
    title: 'Blindside Flanker — The Wolf',
    tagline:
      'Position 6: the workhorse. Powerful, tireless and an intense defensive specialist on the narrow side — coiled, watchful aggression ready to strike.',
  },
  openside_flanker: {
    title: 'Openside Flanker — The Mongoose',
    tagline:
      'Position 7: the relentless jackal of the breakdown. Low, fast and devastatingly agile — first to the ball, first to the fight.',
  },
  '8th_man': {
    title: 'Number Eight — The Lion',
    tagline:
      'Position 8: the complete forward. Dominant, powerful and versatile — the commanding presence that links the pack to the backs.',
  },
  scrum_half: {
    title: 'Scrum-Half — The Clockwork Mechanism',
    tagline:
      'Position 9: the conductor. Small, intricate and agile — precise distribution and total control of the tempo.',
  },
  fly_half: {
    title: 'Fly-Half — The Tactical Compass',
    tagline:
      'Position 10: the mastermind. You direct the attack with strategic kicks and passes — every decision points the team to the strike.',
  },
  inside_center: {
    title: 'Inside Center — The Battering Ram',
    tagline:
      'Position 12: the defensive rock and crash-ball runner. Forceful, blunt, unstoppable impact straight through the line.',
  },
  outside_center: {
    title: 'Outside Center — The Katana',
    tagline:
      'Position 13: creativity, precise distribution and the sharpest line-break. Finely balanced and razor-edged — you cut defences open.',
  },
  left_wing: {
    title: 'Left Wing — The Supersonic Jet',
    tagline:
      'Position 11: the elusive finisher. Searing pace and breakaway speed — when you are gone, you are untouchable.',
  },
  right_wing: {
    title: 'Right Wing — The Jaguar',
    tagline:
      'Position 14: the powerful finisher. Strong, aggressive, direct running that bulldozes over the line to score.',
  },
  full_back: {
    title: 'Full-Back — The Castle Turret',
    tagline:
      'Position 15: the last line of defence. Security, counter-attacker and ever-watchful eyes — reliable protection at the back.',
  },
  coach: {
    title: 'Coach — The Grand Architect',
    tagline:
      'Mastermind and structure. You design the plan, build the team and shape belief into performance — the strategy flows from you.',
  },
}

// Legacy position values (from before the taxonomy split) mapped to a sensible
// default card so existing player rows still render something.
const LEGACY_POSITION_MAP: Record<string, string> = {
  prop: 'loosehead_prop',
  flanker: 'blindside_flanker',
  winger: 'left_wing',
}

interface RoleCardProps {
  role?: string | null
  position?: string | null
}

export default function RoleCard({ role, position }: RoleCardProps) {
  const [imgOk, setImgOk] = useState(true)

  // Decide which card key to use. Legacy values (prop/flanker/winger) map to a
  // default card so existing player rows still resolve.
  const normalizedPosition = position
    ? LEGACY_POSITION_MAP[position] || position
    : position

  const key =
    role === 'coach'
      ? 'coach'
      : role === 'player' && normalizedPosition
      ? normalizedPosition
      : null

  if (!key) return null

  const info = CARD_INFO[key]
  if (!info) return null

  const src = `/cards/${key}.jpg`

  // Clean initials from the position name only (the part before the em dash),
  // e.g. "Fly-Half — The Tactical Compass" -> "FH". Used by the placeholder.
  const initials = info.title
    .split('—')[0]
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="group overflow-hidden rounded-card border border-tm-border bg-tm-surface shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-tm-secondary/70 hover:shadow-[0_16px_44px_rgba(0,0,0,0.45)]">
      <div className="h-1.5 w-full bg-tm-secondary transition-all duration-300 group-hover:h-2" />
      <div className="p-4 sm:p-5">
        {/* Personal framing above the self-contained card artwork */}
        <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-tm-text-3">
          {role === 'coach' ? 'Your role' : 'Your position'}
        </p>

        {/* Full-width landscape role card, framed in the club's primary colour.
            The artwork already contains the position name, metaphor and
            description, so no extra copy is shown. */}
        <div className="mt-3 overflow-hidden rounded-2xl border-2 border-tm-primary shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-shadow duration-300 group-hover:shadow-[0_10px_32px_rgba(0,0,0,0.5)]">
          {imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={`${info.title} role card`}
              onError={() => setImgOk(false)}
              className="block w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            // Fallback if the artwork isn't in place yet.
            <div className="flex aspect-[1408/768] w-full flex-col items-center justify-center bg-tm-surface-hover text-center">
              <span className="text-4xl font-bold text-tm-secondary">{initials}</span>
              <span className="mt-3 text-[11px] leading-tight text-tm-text-3">
                Card artwork coming soon
              </span>
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-xs font-medium uppercase tracking-wide text-tm-secondary">
          One team. One badge. Your role matters.
        </p>
      </div>
    </div>
  )
}
