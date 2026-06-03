/**
 * Animated sport-ball background used on the landing page and onboarding so the
 * brand entry experience is consistent (navy backdrop, dot grid, floating balls).
 * Render inside a `relative overflow-hidden` parent.
 */
export default function SportBallsBackground() {
  return (
    <>
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      {/* Floating sport balls */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        {/* Soccer ball — top left */}
        <svg viewBox="0 0 64 64" className="absolute" width="72" height="72"
          style={{ top: '12%', left: '6%', opacity: 0.1, animation: 'float-slow 7s ease-in-out infinite', animationDelay: '0s' }}>
          <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
          <polygon points="32,10 38,20 26,20" stroke="white" strokeWidth="1.5" fill="none"/>
          <polygon points="10,38 18,32 18,44" stroke="white" strokeWidth="1.5" fill="none"/>
          <polygon points="54,38 46,32 46,44" stroke="white" strokeWidth="1.5" fill="none"/>
          <polygon points="22,54 26,44 38,44 42,54" stroke="white" strokeWidth="1.5" fill="none"/>
        </svg>

        {/* Basketball — top right */}
        <svg viewBox="0 0 64 64" className="absolute" width="90" height="90"
          style={{ top: '8%', right: '8%', opacity: 0.09, animation: 'float-mid 8s ease-in-out infinite', animationDelay: '1.5s' }}>
          <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M32 4 Q48 18 48 32 Q48 46 32 60" stroke="white" strokeWidth="1.5" fill="none"/>
          <path d="M32 4 Q16 18 16 32 Q16 46 32 60" stroke="white" strokeWidth="1.5" fill="none"/>
          <line x1="4" y1="32" x2="60" y2="32" stroke="white" strokeWidth="1.5"/>
        </svg>

        {/* Rugby ball — mid left */}
        <svg viewBox="0 0 80 50" className="absolute" width="100" height="64"
          style={{ top: '42%', left: '3%', opacity: 0.08, animation: 'float-fast 6s ease-in-out infinite', animationDelay: '3s' }}>
          <ellipse cx="40" cy="25" rx="36" ry="20" stroke="white" strokeWidth="2" fill="none"/>
          <line x1="4" y1="25" x2="76" y2="25" stroke="white" strokeWidth="1.5"/>
          <path d="M28 10 Q40 25 28 40" stroke="white" strokeWidth="1.5" fill="none"/>
          <path d="M52 10 Q40 25 52 40" stroke="white" strokeWidth="1.5" fill="none"/>
        </svg>

        {/* Tennis ball — bottom left */}
        <svg viewBox="0 0 64 64" className="absolute" width="60" height="60"
          style={{ bottom: '18%', left: '12%', opacity: 0.1, animation: 'float-mid 9s ease-in-out infinite', animationDelay: '0.8s' }}>
          <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M10 20 Q22 32 10 44" stroke="white" strokeWidth="1.5" fill="none"/>
          <path d="M54 20 Q42 32 54 44" stroke="white" strokeWidth="1.5" fill="none"/>
        </svg>

        {/* Volleyball — mid right */}
        <svg viewBox="0 0 64 64" className="absolute" width="78" height="78"
          style={{ top: '38%', right: '5%', opacity: 0.08, animation: 'float-slow 10s ease-in-out infinite', animationDelay: '2.2s' }}>
          <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M8 22 Q32 14 56 22" stroke="white" strokeWidth="1.5" fill="none"/>
          <path d="M8 42 Q32 50 56 42" stroke="white" strokeWidth="1.5" fill="none"/>
          <line x1="32" y1="4" x2="32" y2="60" stroke="white" strokeWidth="1.5"/>
        </svg>

        {/* Cricket ball — bottom right */}
        <svg viewBox="0 0 64 64" className="absolute" width="56" height="56"
          style={{ bottom: '22%', right: '10%', opacity: 0.09, animation: 'float-fast 7.5s ease-in-out infinite', animationDelay: '4s' }}>
          <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M20 10 Q32 32 20 54" stroke="white" strokeWidth="1.5" fill="none"/>
          <path d="M44 10 Q32 32 44 54" stroke="white" strokeWidth="1.5" fill="none"/>
          <line x1="4" y1="32" x2="60" y2="32" stroke="white" strokeWidth="1"/>
        </svg>

        {/* Small soccer ball — upper mid */}
        <svg viewBox="0 0 64 64" className="absolute" width="44" height="44"
          style={{ top: '20%', left: '38%', opacity: 0.07, animation: 'float-slow 11s ease-in-out infinite', animationDelay: '5s' }}>
          <circle cx="32" cy="32" r="28" stroke="white" strokeWidth="2" fill="none"/>
          <polygon points="32,10 38,20 26,20" stroke="white" strokeWidth="1.5" fill="none"/>
        </svg>
      </div>
    </>
  )
}
