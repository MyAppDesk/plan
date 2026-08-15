import {
  AppWindow,
  Columns3,
  DoorOpen,
  Eraser,
  Minus,
  MousePointer2,
  PenTool,
  Ruler,
  Sofa,
  SquareDashed,
} from 'lucide-react'
import { useProject } from '../store/useProject'
import { Tip } from './ui/Tip'
import type { Tool } from '../types'

const TOOLS: { value: Tool; icon: typeof Ruler; label: string; key: string }[] = [
  { value: 'select', icon: MousePointer2, label: 'Select & move', key: 'V' },
  { value: 'room', icon: SquareDashed, label: 'Rectangular room', key: 'R' },
  { value: 'poly', icon: PenTool, label: 'Polygon room', key: 'P' },
  { value: 'wall', icon: Minus, label: 'Wall, half wall or beam', key: 'W' },
  { value: 'door', icon: DoorOpen, label: 'Door', key: 'D' },
  { value: 'window', icon: AppWindow, label: 'Window', key: 'N' },
  { value: 'column', icon: Columns3, label: 'Column or pier', key: 'K' },
  { value: 'item', icon: Sofa, label: 'Place furniture', key: 'I' },
  { value: 'measure', icon: Ruler, label: 'Tape measure', key: 'M' },
  { value: 'delete', icon: Eraser, label: 'Delete', key: 'X' },
]

const SEPARATE_AFTER: Tool[] = ['wall', 'item', 'measure']

export function ToolRail() {
  const tool = useProject((s) => s.tool)
  const setTool = useProject((s) => s.setTool)
  const view = useProject((s) => s.view)
  const disabled = view !== '2d'

  return (
    <aside
      className="flex shrink-0 flex-col items-center gap-1 border-r border-ink-700 bg-ink-850 py-2"
      style={{ width: 52 }}
    >
      {TOOLS.map((t) => {
        const Icon = t.icon
        return (
          <div key={t.value} className="contents">
            <Tip label={t.label} hint={t.key}>
              <button
                className={`rail-btn ${tool === t.value && !disabled ? 'is-active' : ''} ${disabled ? 'opacity-40' : ''}`}
                aria-label={`${t.label} (${t.key})`}
                disabled={disabled}
                onClick={() => setTool(t.value)}
              >
                <Icon size={18} />
              </button>
            </Tip>
            {SEPARATE_AFTER.includes(t.value) ? <span className="my-1 h-px w-6 bg-ink-700" /> : null}
          </div>
        )
      })}
    </aside>
  )
}
