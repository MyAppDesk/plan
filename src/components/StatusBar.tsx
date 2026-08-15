import { useActiveFloor, useProject } from '../store/useProject'
import { useCursor } from '../store/useCursor'
import { formatArea } from '../lib/geometry'
import { BASIS_LABEL, floorAreaOn } from '../lib/measure'
import type { Tool } from '../types'

const HINTS: Record<Tool, string> = {
  select: 'Drag to move (Shift keeps it straight) · Alt-drag a wall face to extrude · click a dimension figure to type an exact size',
  room: 'Drag to draw a rectangular room — its size shows while you drag',
  poly: 'Click each corner · click the first one again or press Enter to close · Esc cancels',
  wall: 'Click to chain walls · Enter to finish · close a space and it becomes a room you can rename',
  door: 'Click a wall to drop a door, then drag it along the wall',
  window: 'Click a wall to drop a window, then set its sill height on the right',
  plot: 'Click each corner of the plot · Enter or click the first corner to close · Esc cancels',
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
  const message = useProject((s) => s.message)
  const x = useCursor((s) => s.x)
  const y = useCursor((s) => s.y)
  const scale = useCursor((s) => s.scale)

  const basis = useProject((s) => s.dimBasis)
  const total = floorAreaOn(floor, basis)

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
      {message ? <span className="chip bg-warn/15 text-warn">{message}</span> : null}
      {selection ? <span className="chip capitalize">{selection.kind} selected</span> : null}
      <span>{floor.name}</span>
      <span className="text-mist-500">·</span>
      <span title={`Floor area, measured ${BASIS_LABEL[basis]}`}>
        {formatArea(total)} {BASIS_LABEL[basis]}
      </span>
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
