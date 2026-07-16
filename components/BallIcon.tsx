import React from 'react'

export type BallType = 'soccer' | 'basketball' | 'rugby' | 'tennis' | 'volleyball' | 'cricket'

interface BallIconProps {
  type: BallType
  /** Diameter in px (for the rugby oval this is the width; height is 0.6×). */
  size?: number
  /** Spin the seam pattern (used in the hero; off for static chips). */
  spin?: boolean
  spinDir?: 'cw' | 'ccw'
  /** Seconds per revolution when spinning. */
  spinDuration?: number
  className?: string
  style?: React.CSSProperties
}

// Each ball = a shaded sphere (radial-gradient background) with a seam pattern
// on top and a fixed highlight/shadow overlay, so it reads as a real 3D ball.
const GRADIENTS: Record<BallType, string> = {
  soccer:     'radial-gradient(circle at 35% 30%, #ffffff, #eef1f4 58%, #c2c9d2 100%)',
  basketball: 'radial-gradient(circle at 35% 30%, #e8873f, #cf6a1e 60%, #9a4d12 100%)',
  rugby:      'radial-gradient(ellipse at 32% 28%, #a97a48, #8a5a34 55%, #5c3a20 100%)',
  tennis:     'radial-gradient(circle at 35% 30%, #e4f36a, #c3d936 62%, #8fa221 100%)',
  volleyball: 'radial-gradient(circle at 35% 30%, #ffffff, #eef2f6 58%, #c0c8d2 100%)',
  cricket:    'radial-gradient(circle at 35% 30%, #b3243a, #8e1628 60%, #5c0d18 100%)',
}

function Seam({ type }: { type: BallType }) {
  switch (type) {
    case 'soccer':
      return (
        <>
          <g stroke="#20262c" strokeWidth="1.5" fill="none" strokeLinejoin="round">
            <line x1="50" y1="37" x2="50" y2="25.9" />
            <line x1="62.36" y1="45.98" x2="72.92" y2="42.55" />
            <line x1="57.64" y1="60.52" x2="64.17" y2="69.5" />
            <line x1="42.36" y1="60.52" x2="35.83" y2="69.5" />
            <line x1="37.64" y1="45.98" x2="27.08" y2="42.55" />
          </g>
          <g stroke="#20262c" strokeWidth="1.4" strokeLinejoin="round" fill="#1b2025">
            <polygon points="50,37 62.36,45.98 57.64,60.52 42.36,60.52 37.64,45.98" />
            <polygon points="50,5 60.46,12.6 56.47,24.9 43.53,24.9 39.54,12.6" />
            <polygon points="92.8,36.09 88.8,48.39 75.87,48.39 71.87,36.09 82.34,28.49" />
            <polygon points="76.45,86.41 63.52,86.41 59.52,74.11 69.98,66.51 80.45,74.11" />
            <polygon points="23.55,86.41 19.55,74.11 30.02,66.51 40.48,74.11 36.48,86.41" />
            <polygon points="7.2,36.09 17.66,28.49 28.13,36.09 24.13,48.39 11.2,48.39" />
          </g>
        </>
      )
    case 'basketball':
      return (
        <g stroke="#2a1206" strokeWidth="2" fill="none" strokeLinecap="round">
          <line x1="50" y1="3" x2="50" y2="97" />
          <line x1="3" y1="50" x2="97" y2="50" />
          <path d="M22,6 Q42,50 22,94" />
          <path d="M78,6 Q58,50 78,94" />
        </g>
      )
    case 'tennis':
      return (
        <g fill="none" stroke="#fbfff0" strokeWidth="3.6">
          <path d="M12,50 Q50,6 88,50" />
          <path d="M12,50 Q50,94 88,50" />
        </g>
      )
    case 'volleyball':
      return (
        <g fill="none" stroke="#33506e" strokeWidth="2" strokeLinecap="round">
          {[0, 120, 240].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 50 50)`}>
              <path d="M50,3 Q6,32 20,97" />
              <path d="M50,3 Q16,34 30,90" />
              <path d="M50,3 Q26,36 40,84" />
            </g>
          ))}
        </g>
      )
    case 'cricket':
      return (
        <>
          <line x1="50" y1="4" x2="50" y2="96" stroke="#f2e6c2" strokeWidth="2" strokeDasharray="3 3" />
          <line x1="50" y1="4" x2="50" y2="96" stroke="#3a0a12" strokeWidth="0.8" opacity="0.6" />
        </>
      )
    default:
      return null
  }
}

// Rugby is drawn on a wider viewBox with laces; it doesn't spin (an oval
// spinning looks wrong), so it's handled separately.
function RugbySeam() {
  return (
    <>
      <ellipse cx="50" cy="30" rx="47" ry="28" fill="none" stroke="#3d2513" strokeWidth="1.4" opacity="0.45" />
      <line x1="18" y1="30" x2="82" y2="30" stroke="#f4ede1" strokeWidth="2.4" />
      {[30, 40, 50, 60, 70].map((x) => (
        <line key={x} x1={x} y1="24" x2={x} y2="36" stroke="#f4ede1" strokeWidth="2" />
      ))}
    </>
  )
}

export default function BallIcon({
  type,
  size = 32,
  spin = false,
  spinDir = 'cw',
  spinDuration = 24,
  className = '',
  style,
}: BallIconProps) {
  const isRugby = type === 'rugby'
  const height = isRugby ? Math.round(size * 0.6) : size
  const seamStyle: React.CSSProperties = spin && !isRugby
    ? { animation: `tm-spin-${spinDir} ${spinDuration}s linear infinite` }
    : {}

  return (
    <div
      className={`tm-ball ${isRugby ? 'oval' : ''} ${className}`}
      style={{ width: size, height, background: GRADIENTS[type], ...style }}
    >
      <svg className="tm-seam" viewBox={isRugby ? '0 0 100 60' : '0 0 100 100'} style={seamStyle}>
        {isRugby ? <RugbySeam /> : <Seam type={type} />}
      </svg>
      <div className="tm-shade" />
    </div>
  )
}
