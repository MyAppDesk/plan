import { X } from 'lucide-react'

const SECTIONS = [
  {
    title: 'Draw',
    rows: [
      ['R', 'Drag a rectangular room — width, depth and area update while you drag'],
      ['P', 'Polygon room: click each corner, Enter or click the first corner to close'],
      ['W', 'Single wall: chain clicks, Enter or double-click to finish'],
      ['—', 'Corners weld to each other, so neighbouring rooms share one wall'],
    ],
  },
  {
    title: 'Edit',
    rows: [
      ['V', 'Select and drag corners, walls, rooms, openings and furniture'],
      ['—', 'The right panel edits exact lengths, thicknesses, heights and sizes'],
      ['—', 'Changing a wall length moves its far corner along the wall'],
      ['Del', 'Delete the selection · C duplicates it'],
      ['Ctrl+Z', 'Undo · Ctrl+Shift+Z redo'],
    ],
  },
  {
    title: 'Openings & furniture',
    rows: [
      ['D', 'Door: click a wall, then drag it along the wall'],
      ['N', 'Window: same, with an editable sill height'],
      ['I', 'Place the item selected in the Catalog tab'],
      ['M', 'Tape measure between any two points'],
    ],
  },
  {
    title: 'Preview',
    rows: [
      ['1 2 3', 'Plan · 3D · Walk'],
      ['3D', 'Drag to orbit, wheel to zoom, right-drag to pan'],
      ['Walk', 'Click to look around, WASD to move, Shift to run, C to crouch, Esc to release'],
    ],
  },
  {
    title: 'View',
    rows: [
      ['F', 'Zoom to fit'],
      ['G', 'Toggle grid snapping'],
      ['Shift', 'While drawing: constrain to horizontal / vertical'],
      ['Space', 'Hold and drag to pan with any tool'],
    ],
  },
]

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-ink-600 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-ink-700 bg-ink-900 px-4 py-3">
          <h2 className="text-base font-semibold text-mist-200">How to use Measure</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="grid gap-5 p-4 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h3 className="mb-2 text-[11px] font-semibold tracking-widest text-mist-400 uppercase">{s.title}</h3>
              <ul className="space-y-1.5">
                {s.rows.map(([k, text]) => (
                  <li key={k + text} className="flex gap-2">
                    <span className="w-14 shrink-0 text-right">
                      {k === '—' ? <span className="text-mist-500">·</span> : <kbd>{k}</kbd>}
                    </span>
                    <span className="text-mist-300">{text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <footer className="border-t border-ink-700 px-4 py-3 text-[11px] text-mist-400">
          Everything is stored in this browser. Use Export / Import in the toolbar for backups or to move the plan to
          another machine.
        </footer>
      </div>
    </div>
  )
}
