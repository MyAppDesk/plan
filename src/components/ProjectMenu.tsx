import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Copy, FilePlus2, Home, Ruler, Trash2 } from 'lucide-react'
import { useLibrary } from '../store/useLibrary'
import { useProject } from '../store/useProject'

/** Name of the open plan, and the way into every other one. */
export function ProjectMenu() {
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const name = useProject((s) => s.project.name)
  const entries = useLibrary((s) => s.entries)
  const currentId = useLibrary((s) => s.currentId)
  const library = useLibrary

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', away)
    return () => window.removeEventListener('mousedown', away)
  }, [open])

  return (
    <div className="relative" ref={boxRef}>
      <button
        className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-ink-800"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent">
          <Ruler size={16} />
        </span>
        <span className="max-w-40 min-w-0 text-left leading-tight">
          <span className="block truncate font-semibold text-mist-200">{name}</span>
          <span className="block text-[10px] text-mist-400">
            {entries.length} plan{entries.length === 1 ? '' : 's'} on this device
          </span>
        </span>
        <ChevronDown size={14} className="shrink-0 text-mist-400" />
      </button>

      {open ? (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border border-ink-600 bg-ink-850 p-1.5 shadow-2xl">
          {renaming ? (
            <input
              autoFocus
              defaultValue={name}
              className="field mb-1.5"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = (e.target as HTMLInputElement).value.trim()
                  if (value && currentId) library.getState().rename(currentId, value)
                  setRenaming(false)
                }
                if (e.key === 'Escape') setRenaming(false)
              }}
              onBlur={(e) => {
                const value = e.target.value.trim()
                if (value && currentId) library.getState().rename(currentId, value)
                setRenaming(false)
              }}
            />
          ) : (
            <button className="menu-row" onClick={() => setRenaming(true)}>
              Rename this plan
            </button>
          )}

          <button
            className="menu-row"
            onClick={() => {
              if (currentId) library.getState().duplicate(currentId)
              setOpen(false)
            }}
          >
            <Copy size={14} /> Duplicate
          </button>
          <button
            className="menu-row text-danger"
            onClick={() => {
              if (!currentId) return
              if (confirm(`Delete “${name}”? This cannot be undone.`)) library.getState().remove(currentId)
              setOpen(false)
            }}
          >
            <Trash2 size={14} /> Delete
          </button>

          <div className="my-1.5 h-px bg-ink-700" />
          <div className="px-2 pb-1 text-[10px] font-semibold tracking-widest text-mist-500 uppercase">Your plans</div>
          <div className="max-h-56 overflow-y-auto">
            {entries.map((e) => (
              <button
                key={e.id}
                className={`menu-row ${e.id === currentId ? 'text-accent' : ''}`}
                onClick={() => {
                  library.getState().open(e.id)
                  setOpen(false)
                }}
              >
                <span className="flex-1 truncate text-left">{e.name}</span>
                <span className="text-[10px] text-mist-500">{new Date(e.updatedAt).toLocaleDateString()}</span>
              </button>
            ))}
          </div>

          <div className="my-1.5 h-px bg-ink-700" />
          <button
            className="menu-row"
            onClick={() => {
              library.getState().setScreen('onboarding')
              setOpen(false)
            }}
          >
            <FilePlus2 size={14} /> New plan…
          </button>
          <button
            className="menu-row"
            onClick={() => {
              library.getState().setScreen('landing')
              setOpen(false)
            }}
          >
            <Home size={14} /> About Measure
          </button>
        </div>
      ) : null}
    </div>
  )
}
