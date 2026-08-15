import {
  Box,
  Download,
  Footprints,
  FolderOpen,
  Grid2x2,
  HelpCircle,
  Image as ImageIcon,
  Magnet,
  Maximize,
  Plus,
  Redo2,
  Ruler,
  Undo2,
} from 'lucide-react'
import { useStore } from 'zustand'
import { useProject, redo, undo } from '../store/useProject'
import { emit } from '../lib/bus'
import type { ViewMode } from '../types'

const VIEWS: { value: ViewMode; label: string; icon: typeof Box; hint: string }[] = [
  { value: '2d', label: 'Plan', icon: Grid2x2, hint: 'Plan view (1)' },
  { value: '3d', label: '3D', icon: Box, hint: '3D view (2)' },
  { value: 'walk', label: 'Walk', icon: Footprints, hint: 'Walk through (3)' },
]

export function TopBar({
  onHelp,
  onExport,
  onImport,
}: {
  onHelp: () => void
  onExport: () => void
  onImport: () => void
}) {
  const view = useProject((s) => s.view)
  const setView = useProject((s) => s.setView)
  const snap = useProject((s) => s.snap)
  const toggleUi = useProject((s) => s.toggleUi)
  const floors = useProject((s) => s.project.floors)
  const activeFloorId = useProject((s) => s.activeFloorId)
  const setActiveFloor = useProject((s) => s.setActiveFloor)
  const addFloor = useProject((s) => s.addFloor)
  const name = useProject((s) => s.project.name)

  const canUndo = useStore(useProject.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useProject.temporal, (s) => s.futureStates.length > 0)

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-ink-700 bg-ink-850 px-3">
      <div className="flex items-center gap-2 pr-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent">
          <Ruler size={16} />
        </span>
        <div className="leading-tight">
          <div className="font-semibold text-mist-200">Measure</div>
          <div className="-mt-0.5 max-w-32 truncate text-[10px] text-mist-400">{name}</div>
        </div>
      </div>

      <div className="flex rounded-lg border border-ink-600 bg-ink-800 p-0.5">
        {VIEWS.map((v) => {
          const Icon = v.icon
          return (
            <button
              key={v.value}
              title={v.hint}
              onClick={() => setView(v.value)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors ${
                view === v.value ? 'bg-accent-soft text-mist-200' : 'text-mist-400 hover:text-mist-200'
              }`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
        {floors.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFloor(f.id)}
            className={`shrink-0 rounded-md px-2.5 py-1 transition-colors ${
              f.id === activeFloorId ? 'bg-ink-700 text-mist-200' : 'text-mist-400 hover:bg-ink-800'
            }`}
          >
            {f.name}
          </button>
        ))}
        <button className="icon-btn" title="Add floor" onClick={() => addFloor(false)}>
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-0.5">
        <button className="icon-btn" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => undo()}>
          <Undo2 size={16} />
        </button>
        <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => redo()}>
          <Redo2 size={16} />
        </button>
        <span className="mx-1 h-5 w-px bg-ink-700" />
        <button
          className={`icon-btn ${snap ? 'is-active' : ''}`}
          title="Snap to grid (G)"
          onClick={() => toggleUi('snap')}
        >
          <Magnet size={16} />
        </button>
        <button className="icon-btn" title="Zoom to fit (F)" onClick={() => emit('fit')}>
          <Maximize size={16} />
        </button>
        <span className="mx-1 h-5 w-px bg-ink-700" />
        <button className="icon-btn" title="Import project" onClick={onImport}>
          <FolderOpen size={16} />
        </button>
        <button className="icon-btn" title="Export project (JSON)" onClick={onExport}>
          <Download size={16} />
        </button>
        <button className="icon-btn" title="Export plan as PNG" onClick={() => emit('png')}>
          <ImageIcon size={16} />
        </button>
        <button className="icon-btn" title="Help (?)" onClick={onHelp}>
          <HelpCircle size={16} />
        </button>
      </div>
    </header>
  )
}
