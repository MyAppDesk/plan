import { useActiveFloor, useProject } from '../store/useProject'
import { useCursor } from '../store/useCursor'
import { formatArea, roomArea } from '../lib/geometry'
import type { Tool } from '../types'

const HINTS: Record<Tool, string> = {
  select: 'Drag to move · Shift-drag a wall to extrude it · double-click a wall to add a corner · grips resize',
  room: 'Drag to draw a rectangular room — its size shows while you drag',
  poly: 'Click each corner · click the first one again or press Enter to close · Esc cancels',
  wall: 'Click to chain wall segments · Enter or double-click to finish · Esc cancels',
  door: 'Click a wall to drop a door, then drag it along the wall',
  window: 'Click a wall to drop a window, then set its sill height on the right',
  column: 'Click to drop a column · set its footprint, base and height on the right',
  item: 'Click on the plan to place the selected catalogue item',
  measure: 'Click two points to measure the distance between them',
  delete: 'Click anything to delete it',
}

export function StatusBar() {
  const tool = useProject((s) => s.tool)
  const view = useProject((s) => s.view)
  const selection = useProject((s) => s.selection)
  const snap = useProject((s) => s.snap)
  const gridSize = useProject((s) => s.gridSize)
  const floor = useActiveFloor()
  const x = useCursor((s) => s.x)
  const y = useCursor((s) => s.y)
  const scale = useCursor((s) => s.scale)

  const total = floor.rooms.reduce((sum, r) => sum + roomArea(floor, r), 0)

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-ink-700 bg-ink-850 px-3 text-[11px] text-mist-400">
      {view === '2d' ? (
        <>
          <span className="font-medium text-mist-300 capitalize">{tool}</span>
          <span className="hidden truncate md:inline">{HINTS[tool]}</span>
        </>
      ) : view === '3d' ? (
        <span>Drag to orbit · wheel to zoom · right-drag to pan</span>
      ) : (
        <span>Walk mode — click the view to look around</span>
      )}
      <span className="flex-1" />
      {selection ? <span className="chip capitalize">{selection.kind} selected</span> : null}
      <span>{floor.name}</span>
      <span className="text-mist-500">·</span>
      <span>{formatArea(total)}</span>
      {view === '2d' ? (
        <>
          <span className="text-mist-500">·</span>
          <span>{snap ? `grid ${Math.round(gridSize * 100)} cm` : 'free'}</span>
          <span className="text-mist-500">·</span>
          <span>1 m = {Math.round(scale)} px</span>
          <span className="text-mist-500">·</span>
          <span className="w-32 text-right tabular-nums">
            {x.toFixed(2)}, {y.toFixed(2)} m
          </span>
        </>
      ) : null}
    </footer>
  )
}
