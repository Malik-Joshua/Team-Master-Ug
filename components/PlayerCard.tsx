// Shared "trading card" design for representing a player — a photo panel
// (full-bleed, cropped to the frame rather than floating with padding around
// it), a jersey-number/position badge, an optional captain marker, and a
// colour-block footer with the player's name. This is the same visual
// language as the pitch-view player cards (components/TeamPitchView.tsx),
// generalised so any screen that needs to show "this player" can pull from
// the same card design instead of a plain cropped photo — one shared design
// for every player, not a one-off per screen.

interface PlayerCardProps {
  name: string
  photoUrl?: string | null
  /** Full position label, e.g. "Fly Half" — used to derive a short badge code
   *  when `code` isn't given explicitly. */
  position?: string | null
  /** Short badge code, e.g. "FH" or "FWD"/"BCK". Overrides the derived code. */
  code?: string
  /** Jersey number; shows "–" when not assigned. */
  number?: number | string | null
  captain?: boolean
  viceCaptain?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const POSITION_CODES: Record<string, string> = {
  loosehead_prop: '1', prop: '1', hooker: '2', tighthead_prop: '3',
  lock: '4', blindside_flanker: '6', openside_flanker: '7', flanker: '6',
  '8th_man': '8', number_8: '8', scrum_half: '9', fly_half: '10',
  left_wing: '11', winger: '11', inside_center: '12', outside_center: '13',
  right_wing: '14', full_back: '15',
}

function deriveCode(position?: string | null): string {
  if (!position) return '–'
  return POSITION_CODES[position] || position.slice(0, 3).toUpperCase()
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

const SIZES = {
  sm: { w: 'w-[74px]', top: 'h-[60px]', num: 'text-sm', name: 'text-[9px]' },
  md: { w: 'w-[96px]', top: 'h-[86px]', num: 'text-xl', name: 'text-[10px]' },
  lg: { w: 'w-[112px]', top: 'h-[100px]', num: 'text-2xl', name: 'text-[11px]' },
}

export default function PlayerCard({
  name, photoUrl, position, code, number, captain, viceCaptain, size = 'md', className = '',
}: PlayerCardProps) {
  const s = SIZES[size]
  const badgeCode = code || deriveCode(position)

  return (
    <div
      className={`${s.w} group relative overflow-hidden rounded-lg border border-white/30 shadow-[0_3px_10px_rgba(0,0,0,0.45)] transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.04] hover:border-tm-primary hover:shadow-[0_0_14px_3px_var(--tm-primary),0_10px_22px_rgba(0,0,0,0.5)] ${className}`}
    >
      <div className={`relative ${s.top} overflow-hidden bg-gradient-to-br from-sky-400 to-cyan-700`}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.28),transparent_45%)]" />
            <div className="absolute inset-x-0 bottom-1.5 flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-black/25 text-sm font-bold text-white">
                {initials(name)}
              </div>
            </div>
          </>
        )}
        {number != null && (
          <div className="absolute right-1 top-0.5 rounded bg-tm-primary px-1 text-right leading-none">
            <div className={`${s.num} font-black text-tm-on-primary`}>{number}</div>
            <div className="-mt-0.5 text-[9px] font-bold text-black">{badgeCode}</div>
          </div>
        )}
        {number == null && (
          <div className="absolute right-1 top-1 rounded bg-tm-primary px-1.5 py-0.5 text-[9px] font-bold text-black leading-none">
            {badgeCode}
          </div>
        )}
        {(captain || viceCaptain) && (
          <div className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-tm-primary text-[9px] font-black text-tm-on-primary ring-1 ring-white/70">
            {captain ? 'C' : 'V'}
          </div>
        )}
      </div>
      <div className="bg-tm-primary px-1 py-1">
        <div className={`truncate text-center ${s.name} font-bold leading-tight text-tm-on-primary`}>{name}</div>
      </div>
    </div>
  )
}
