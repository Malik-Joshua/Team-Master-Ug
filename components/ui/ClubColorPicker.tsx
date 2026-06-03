'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
// @ts-ignore - themeEngine is a JS module
import { PRESETS, getPresetThemeName } from '@/themeEngine'
import { cn } from '@/lib/utils'

interface ClubColorPickerProps {
  /** Current chosen colour (hex). The whole app theme is derived from this single colour. */
  value: string
  onChange: (hex: string) => void
}

// Preset themes the engine can produce. The admin picks ONE — the app derives
// the full palette (surfaces, text, accents) from it automatically.
const PRESET_KEYS = ['navy', 'yellow', 'red', 'green', 'purple', 'bw'] as const

const PRESET_LABELS: Record<string, string> = {
  navy: 'Navy & Sky',
  yellow: 'Black & Gold',
  red: 'Crimson',
  green: 'Forest & Teal',
  purple: 'Deep Purple',
  bw: 'Black & White',
}

export default function ClubColorPicker({ value, onChange }: ClubColorPickerProps) {
  const [custom, setCustom] = useState(value)
  // Which preset family the current value maps to (so we can show the active state)
  const activePreset = getPresetThemeName(value)

  const applyCustom = (hex: string) => {
    setCustom(hex)
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) onChange(hex)
  }

  return (
    <div className="space-y-4">
      {/* Preset theme swatches */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {PRESET_KEYS.map((key) => {
          const preset = (PRESETS as any)[key]
          const accent = preset.acc as string
          const bg = preset.p9 as string
          const isActive = activePreset === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(accent)}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-150 hover:scale-[1.02]',
                isActive ? 'border-tm-secondary ring-1 ring-tm-secondary' : 'border-tm-border'
              )}
              style={{ background: bg }}
            >
              <span
                className="h-8 w-8 flex-shrink-0 rounded-lg"
                style={{ background: accent, boxShadow: `0 0 0 3px ${accent}22` }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium" style={{ color: preset.t1 }}>
                  {PRESET_LABELS[key]}
                </span>
                <span className="block text-[11px]" style={{ color: preset.t2 }}>
                  {accent.toUpperCase()}
                </span>
              </span>
              {isActive && (
                <span
                  className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: accent }}
                >
                  <Check className="h-3 w-3" style={{ color: preset.btnTxt }} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Custom exact colour */}
      <div className="rounded-xl border border-tm-border bg-tm-surface p-3">
        <p className="mb-2 text-[12px] font-medium text-tm-text-2">Or use your exact club colour</p>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(custom) ? custom : '#5BA3D9'}
            onChange={(e) => applyCustom(e.target.value)}
            className="h-10 w-12 cursor-pointer rounded-lg border border-tm-border bg-transparent p-0.5"
            aria-label="Pick club colour"
          />
          <input
            type="text"
            value={custom}
            onChange={(e) => applyCustom(e.target.value)}
            placeholder="#5BA3D9"
            className="tm-input max-w-[140px] font-mono"
          />
          <p className="text-[11px] text-tm-text-3">
            The app adapts its whole look to this colour.
          </p>
        </div>
      </div>
    </div>
  )
}
