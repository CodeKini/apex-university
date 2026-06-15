'use client'

import { useState, useRef, useEffect } from 'react'

const PRESETS = [
  '#eab308', // gold (default)
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#a855f7', // purple
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#84cc16', // lime
  '#ffffff', // white
  '#94a3b8', // slate
]

interface Props {
  value:    string
  onChange: (color: string) => void
  label?:   string
}

export default function ColorPicker({ value, onChange, label = 'Brand color' }: Props) {
  const [open, setOpen]     = useState(false)
  const [hex,  setHex]      = useState(value)
  const ref                 = useRef<HTMLDivElement>(null)

  useEffect(() => { setHex(value) }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const commit = (color: string) => {
    // Validate 6-digit hex
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      onChange(color)
      setHex(color)
    }
  }

  return (
    <div ref={ref} className="relative">
      {label && <label className="label mb-1.5 block">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 input-field w-full text-left"
      >
        <span
          className="w-5 h-5 rounded-full border border-navy-700 shrink-0"
          style={{ backgroundColor: hex }}
        />
        <span className="text-slate-300 font-mono text-sm">{hex.toUpperCase()}</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-2 left-0 card p-4 w-56 shadow-2xl">
          {/* Native color input (hidden, synced) */}
          <div className="flex items-center gap-3 mb-4">
            <input
              type="color"
              value={hex}
              onChange={(e) => { setHex(e.target.value); onChange(e.target.value) }}
              className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent p-0"
            />
            <input
              type="text"
              value={hex}
              maxLength={7}
              onChange={(e) => { setHex(e.target.value); commit(e.target.value) }}
              className="input-field flex-1 font-mono text-sm py-1.5"
              placeholder="#000000"
            />
          </div>

          {/* Presets */}
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Presets</p>
          <div className="grid grid-cols-6 gap-1.5">
            {PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => { commit(color); setOpen(false) }}
                className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: color,
                  borderColor: hex.toLowerCase() === color.toLowerCase() ? '#fff' : 'transparent',
                }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
