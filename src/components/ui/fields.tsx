import { useEffect, useState, type ReactNode } from 'react'

export function Row({ children, cols = 2 }: { children: ReactNode; cols?: number }) {
  return <div className={`grid gap-2 ${cols === 3 ? 'grid-cols-3' : cols === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>{children}</div>
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel-section">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold tracking-widest text-mist-400 uppercase">{title}</h3>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        className="field"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(local)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </label>
  )
}

/** Commits on blur / Enter so typing does not spam the undo history. */
export function NumberField({
  label,
  value,
  onChange,
  step = 0.05,
  min = 0,
  max = 1000,
  unit = 'm',
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
  disabled?: boolean
}) {
  const [local, setLocal] = useState(String(round(value)))
  useEffect(() => setLocal(String(round(value))), [value])

  const commit = (raw: string) => {
    const n = Number(String(raw).replace(',', '.'))
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
    else setLocal(String(round(value)))
  }

  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <div className="relative">
        <input
          className="field pr-8 tabular-nums"
          inputMode="decimal"
          value={local}
          disabled={disabled}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              const dir = e.key === 'ArrowUp' ? 1 : -1
              const next = Number((Number(local) + dir * step * (e.shiftKey ? 10 : 1)).toFixed(4))
              setLocal(String(next))
              onChange(Math.min(max, Math.max(min, next)))
            }
          }}
        />
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[11px] text-mist-400">{unit}</span>
      </div>
    </label>
  )
}

function round(v: number) {
  return Math.round(v * 1000) / 1000
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left transition-colors hover:bg-ink-800"
    >
      <span className="text-mist-300">{label}</span>
      <span
        className={`relative h-4.5 w-8 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-ink-600'}`}
        style={{ height: 18, width: 32 }}
      >
        <span
          className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all"
          style={{ left: checked ? 16 : 2 }}
        />
      </span>
    </button>
  )
}

export function ColorPicker({ value, onChange, colors }: { value: string; onChange: (c: string) => void; colors: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-md border transition-transform hover:scale-110 ${
            value.toLowerCase() === c.toLowerCase() ? 'border-accent ring-2 ring-accent/40' : 'border-ink-600'
          }`}
          style={{ background: c }}
          title={c}
        />
      ))}
      <label
        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-ink-600 text-[10px] text-mist-400"
        title="Custom colour"
      >
        +
        <input type="color" className="sr-only" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  )
}

export function SegButtons<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-md border border-ink-600 bg-ink-850 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded px-2 py-1 text-center transition-colors ${
            value === o.value ? 'bg-accent-soft text-mist-200' : 'text-mist-400 hover:text-mist-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
