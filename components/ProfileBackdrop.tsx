'use client'

/**
 * Ambient backdrop for the profile page: a full-viewport rugby-themed
 * illustration pattern sitting behind the content, at very low opacity,
 * texture and identity rather than a literal photo. This replaced an earlier
 * version that blurred the user's own profile picture; the static artwork
 * gives the same "this is home" ambience without needing a photo, without
 * privacy concerns over whichever picture a user uploads, and without any
 * blur-quality/legibility trade-offs.
 *
 * Source artwork lives at /public/patterns/rugby-doodles.png: black
 * line-art on a transparent background.
 *
 * Design choices:
 * - fixed inset-0 plus a non-negative z-index (z-0): stays put while the
 *   page scrolls, sits behind the "relative z-10" content wrapper and the
 *   opaque sidebar/topbar above it. Deliberately not a negative z-index:
 *   Chromium has a confirmed compositing bug where position: fixed plus
 *   negative z-index can silently fail to paint at all, even though
 *   computed styles look correct.
 * - filter: invert(1) flips the black line-art to light/white strokes so
 *   it is actually visible against the app's dark theme (the transparent
 *   background is untouched by invert, so no hard white box appears).
 * - Low opacity keeps it as ambience in the page's negative space; every
 *   piece of real content lives inside its own opaque card, so legibility
 *   isn't a concern here.
 * - A faint wash of the active club colour (blended with soft-light) ties
 *   the pattern to whichever club theme is currently applied.
 */
export default function ProfileBackdrop() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-0 overflow-hidden"
      style={{ backgroundColor: 'var(--tm-bg, #0D1828)' }}
    >
      <div
        className="absolute inset-0 bg-cover bg-top opacity-[0.08]"
        style={{
          backgroundImage: "url('/patterns/rugby-doodles.png')",
          filter: 'invert(1)',
        }}
      />

      {/* Club-colour wash: ties the pattern to the active club theme */}
      <div
        className="absolute inset-0 opacity-20 mix-blend-soft-light"
        style={{ backgroundColor: 'var(--tm-primary, transparent)' }}
      />
    </div>
  )
}
