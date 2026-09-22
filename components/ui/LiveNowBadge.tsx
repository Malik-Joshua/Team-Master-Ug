'use client'

/**
 * Small pulsing "LIVE NOW" pill — dropped onto a session/fixture card when
 * it's currently happening (see lib/session-live.ts for the time-window
 * check, and hooks/useNow.ts for the periodic re-render that keeps it
 * accurate without a page refresh).
 */
export default function LiveNowBadge({ label = 'LIVE NOW' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      {label}
    </span>
  )
}
