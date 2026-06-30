'use client'

import { useId } from 'react'

// ─── Position metadata ────────────────────────────────────────────────────────

const POSITIONS: Record<string, { number: number; label: string; shape: string }> = {
  prop:           { number: 1,  label: 'Prop',           shape: 'pillars' },
  hooker:         { number: 2,  label: 'Hooker',         shape: 'hook'    },
  lock:           { number: 4,  label: 'Lock',           shape: 'tower'   },
  flanker:        { number: 6,  label: 'Flanker',        shape: 'slash'   },
  number_8:       { number: 8,  label: 'Number 8',       shape: 'anchor'  },
  scrum_half:     { number: 9,  label: 'Scrum Half',     shape: 'spiral'  },
  fly_half:       { number: 10, label: 'Fly Half',       shape: 'kick'    },
  inside_centre:  { number: 12, label: 'Inside Centre',  shape: 'arrow'   },
  outside_centre: { number: 13, label: 'Outside Centre', shape: 'split'   },
  winger:         { number: 11, label: 'Winger',         shape: 'bolt'    },
  full_back:      { number: 15, label: 'Full Back',      shape: 'catch'   },
}

// ─── Fly Half — detailed hero icon ───────────────────────────────────────────

function FlyHalfHeroIcon({ uid }: { uid: string }) {
  return (
    <>
      {/* ── Decorative pitch arc lines ── */}
      <g stroke="var(--acc, #5BA3D9)" fill="none" strokeWidth="1">
        <path d="M -10 84 Q 50 54 110 84" opacity="0.09" />
        <path d="M  -5 74 Q 50 46 105 74" opacity="0.07" />
        <path d="M   8 65 Q 50 40  92 65" opacity="0.06" />
      </g>

      {/* Ground glow beneath player */}
      <ellipse
        cx="33" cy="91" rx="16" ry="3.5"
        fill="var(--acc, #5BA3D9)" opacity="0.12"
        filter={`url(#${uid}-soft)`}
      />

      {/* ── Player silhouette ── */}

      {/* Head */}
      <circle cx="33" cy="19" r="6.5" fill="var(--t1, #EDF2F8)" />

      {/* Torso — leaning slightly into the kick */}
      <path
        d="M 28,26 C 30,28 37,28 39,26 L 42,56 C 40,58 32,58 29,56 Z"
        fill="var(--t1, #EDF2F8)"
      />

      {/* Back arm — right arm counterbalancing behind */}
      <path
        d="M 29,36 Q 18,44 14,51"
        stroke="var(--t1, #EDF2F8)" strokeWidth="4.5" strokeLinecap="round" fill="none"
      />

      {/* Front arm — left arm reaching forward */}
      <path
        d="M 39,36 Q 49,41 53,46"
        stroke="var(--t1, #EDF2F8)" strokeWidth="4.5" strokeLinecap="round" fill="none"
      />

      {/* Standing (left) leg */}
      <path
        d="M 33,56 L 31,76 L 29,89"
        stroke="var(--t1, #EDF2F8)" strokeWidth="5.5" strokeLinecap="round" fill="none"
      />
      {/* Standing foot */}
      <path
        d="M 29,89 L 20,91"
        stroke="var(--t1, #EDF2F8)" strokeWidth="4.5" strokeLinecap="round" fill="none"
      />

      {/* Kicking (right) leg — swinging up and forward */}
      <path
        d="M 39,56 Q 51,63 63,43"
        stroke="var(--t1, #EDF2F8)" strokeWidth="5.5" strokeLinecap="round" fill="none"
      />
      {/* Kicking boot — exaggerated toe for impact feel */}
      <ellipse
        cx="66" cy="41"
        rx="5.5" ry="3.5"
        transform="rotate(-32 66 41)"
        fill="var(--t1, #EDF2F8)"
      />

      {/* ── Power / speed lines at kick point ── */}
      <g stroke="var(--acc, #5BA3D9)" strokeWidth="1.8" strokeLinecap="round" opacity="0.75">
        <line x1="68" y1="37" x2="73" y2="31" />
        <line x1="66" y1="40" x2="71" y2="34" />
        <line x1="71" y1="40" x2="76" y2="34" />
      </g>

      {/* ── Ball trajectory arc (dashed) ── */}
      <path
        d="M 78 25 Q 85 13 94 7"
        fill="none"
        stroke="var(--acc, #5BA3D9)"
        strokeWidth="1.5"
        strokeDasharray="3,2.5"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* ── Rugby ball — accent color, in flight ── */}
      <g filter={`url(#${uid}-glow)`} transform="translate(78,24) rotate(-38)">
        {/* Ball body */}
        <ellipse cx="0" cy="0" rx="9" ry="5.5" fill="var(--acc, #5BA3D9)" />
        {/* Laces */}
        <line x1="0" y1="-5.5" x2="0"  y2="5.5"  stroke="var(--p9, #080F1C)" strokeWidth="0.9" opacity="0.4" />
        <line x1="-2" y1="-2"  x2="2"  y2="-2"  stroke="var(--p9, #080F1C)" strokeWidth="0.7" opacity="0.4" />
        <line x1="-2" y1="0"   x2="2"  y2="0"   stroke="var(--p9, #080F1C)" strokeWidth="0.7" opacity="0.4" />
        <line x1="-2" y1="2"   x2="2"  y2="2"   stroke="var(--p9, #080F1C)" strokeWidth="0.7" opacity="0.4" />
        {/* Specular highlight */}
        <ellipse cx="-2.5" cy="-1.5" rx="3" ry="1.5" fill="white" opacity="0.20" transform="rotate(-15)" />
      </g>

      {/* ── Jersey #10 badge (bottom-right corner) ── */}
      <circle cx="81" cy="81" r="13" fill="var(--acc, #5BA3D9)" />
      <circle cx="81" cy="81" r="11" fill="none" stroke="var(--p9, #080F1C)" strokeWidth="1.5" opacity="0.22" />
      <text
        x="81" y="86"
        textAnchor="middle"
        fontSize="11" fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing="-0.5"
        fill="var(--btn-txt, #080F1C)"
      >
        10
      </text>
    </>
  )
}

// ─── Generic position badge shapes ───────────────────────────────────────────

function ShapeElement({ shape, uid }: { shape: string; uid: string }) {
  const c = 'var(--acc, #5BA3D9)'
  const op = 0.55

  switch (shape) {
    case 'pillars': // Prop — two solid vertical pillars (scrum)
      return (
        <g fill={c} opacity={op}>
          <rect x="34" y="52" width="8" height="20" rx="2" />
          <rect x="58" y="52" width="8" height="20" rx="2" />
          <rect x="34" y="68" width="32" height="4" rx="2" />
        </g>
      )
    case 'hook': // Hooker — curved hook
      return (
        <path
          d="M 50,44 Q 68,44 68,58 Q 68,74 50,74 Q 38,74 38,64"
          stroke={c} strokeWidth="5" strokeLinecap="round" fill="none" opacity={op}
        />
      )
    case 'tower': // Lock — two tall vertical lines (lineout)
      return (
        <g stroke={c} strokeWidth="5" strokeLinecap="round" opacity={op}>
          <line x1="40" y1="36" x2="40" y2="74" />
          <line x1="60" y1="36" x2="60" y2="74" />
          <line x1="40" y1="55" x2="60" y2="55" />
        </g>
      )
    case 'slash': // Flanker — diagonal breakaway
      return (
        <g stroke={c} strokeWidth="4.5" strokeLinecap="round" opacity={op}>
          <line x1="36" y1="68" x2="64" y2="36" />
          <line x1="44" y1="72" x2="68" y2="44" />
        </g>
      )
    case 'anchor': // Number 8 — X cross (dominant force)
      return (
        <g stroke={c} strokeWidth="4.5" strokeLinecap="round" opacity={op}>
          <line x1="36" y1="36" x2="64" y2="68" />
          <line x1="64" y1="36" x2="36" y2="68" />
          <circle cx="50" cy="52" r="5" fill={c} opacity="0.6" stroke="none" />
        </g>
      )
    case 'spiral': // Scrum Half — spin pass arc
      return (
        <>
          <path
            d="M 32,60 Q 50,32 68,60"
            stroke={c} strokeWidth="4" strokeLinecap="round" fill="none" opacity={op}
          />
          {/* Mini ball */}
          <ellipse cx="69" cy="60" rx="6" ry="3.5" transform="rotate(-30 69 60)"
                   fill={c} opacity={op + 0.2} />
          {/* Spin lines */}
          <g stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity={op - 0.1}>
            <line x1="60" y1="52" x2="65" y2="47" />
            <line x1="64" y1="55" x2="69" y2="50" />
          </g>
        </>
      )
    case 'arrow': // Inside Centre — penetrating arrow
      return (
        <g fill={c} opacity={op}>
          <path d="M 50,34 L 66,55 L 57,55 L 57,72 L 43,72 L 43,55 L 34,55 Z" />
        </g>
      )
    case 'split': // Outside Centre — diverging arrows (wide play)
      return (
        <g stroke={c} strokeWidth="4" strokeLinecap="round" fill="none" opacity={op}>
          <path d="M 50,68 L 50,50 L 34,34" />
          <path d="M 50,50 L 66,34" />
          <path d="M 28,40 L 34,34 L 38,42" />
          <path d="M 72,40 L 66,34 L 62,42" />
        </g>
      )
    case 'bolt': // Winger — lightning bolt (pure speed)
      return (
        <g fill={c} opacity={op}>
          <path d="M 58,34 L 44,54 L 52,54 L 42,74 L 64,50 L 54,50 Z" />
        </g>
      )
    case 'catch': // Full Back — arms raised to catch a high ball
      return (
        <g stroke={c} strokeWidth="4.5" strokeLinecap="round" fill="none" opacity={op}>
          {/* Left arm raised */}
          <path d="M 44,64 Q 38,54 36,42" />
          {/* Right arm raised */}
          <path d="M 56,64 Q 62,54 64,42" />
          {/* Ball */}
          <circle cx="50" cy="38" r="7" stroke={c} strokeWidth="3.5" fill="none" opacity={op + 0.2} />
          {/* Body */}
          <line x1="44" y1="64" x2="56" y2="64" />
          <line x1="50" y1="64" x2="50" y2="76" />
        </g>
      )
    default:
      return null
  }
}

function GenericPositionIcon({ number, shape, uid }: { number: number; shape: string; uid: string }) {
  return (
    <>
      {/* Subtle decorative rings */}
      <circle cx="50" cy="50" r="32" fill="none"
              stroke="var(--acc, #5BA3D9)" strokeWidth="0.5" opacity="0.12" />

      {/* Position shape */}
      <ShapeElement shape={shape} uid={uid} />

      {/* Jersey number badge */}
      <circle cx="50" cy="50" r="18" fill="var(--p7, #112035)"
              stroke="var(--acc, #5BA3D9)" strokeWidth="1.5" opacity="0.9" />
      <text
        x="50" y={number >= 10 ? '56' : '57'}
        textAnchor="middle"
        fontSize={number >= 10 ? '16' : '20'}
        fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="var(--t1, #EDF2F8)"
        letterSpacing="-0.5"
      >
        {number}
      </text>
    </>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface PositionIconProps {
  /** Matches the `position` field in user_profiles (e.g. "fly_half", "prop") */
  position: string
  size?: number
  className?: string
}

export default function PositionIcon({ position, size = 80, className = '' }: PositionIconProps) {
  const uid = useId().replace(/:/g, '-')
  const meta = POSITIONS[position] ?? { number: 0, label: position, shape: 'bolt' }
  const isFlyHalf = position === 'fly_half'

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`${meta.label} position icon`}
      role="img"
    >
      <defs>
        {/* Background radial gradient */}
        <radialGradient id={`${uid}-bg`} cx="42%" cy="38%" r="65%">
          <stop offset="0%"   stopColor="var(--p6, #1A3A5C)" />
          <stop offset="100%" stopColor="var(--p9, #080F1C)" />
        </radialGradient>

        {/* Accent glow for ball / key elements */}
        <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Soft blur for ground glow */}
        <filter id={`${uid}-soft`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" />
        </filter>

        {/* Clip path for decorative elements */}
        <clipPath id={`${uid}-clip`}>
          <circle cx="50" cy="50" r="47" />
        </clipPath>
      </defs>

      {/* ── Badge background ── */}
      <circle cx="50" cy="50" r="50" fill="var(--p9, #080F1C)" />
      <circle cx="50" cy="50" r="48" fill={`url(#${uid}-bg)`} />

      {/* ── Clipped inner content ── */}
      <g clipPath={`url(#${uid}-clip)`}>
        {isFlyHalf
          ? <FlyHalfHeroIcon uid={uid} />
          : <GenericPositionIcon number={meta.number} shape={meta.shape} uid={uid} />
        }
      </g>

      {/* ── Outer ring border ── */}
      <circle cx="50" cy="50" r="48" fill="none"
              stroke="var(--acc, #5BA3D9)" strokeWidth="1.5" opacity="0.50" />
      {/* Inner ring (subtle) */}
      <circle cx="50" cy="50" r="44" fill="none"
              stroke="var(--acc, #5BA3D9)" strokeWidth="0.5" opacity="0.18" />

      {/* Top accent mark */}
      <circle cx="50" cy="3.5" r="2" fill="var(--acc, #5BA3D9)" opacity="0.55" />
    </svg>
  )
}

// ─── Named re-export for direct use ──────────────────────────────────────────

export { POSITIONS }
