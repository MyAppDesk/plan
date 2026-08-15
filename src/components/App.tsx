import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { PlanEditor } from './plan/PlanEditor'

// the whole three.js bundle only loads the first time you open a 3D view
const Scene3D = lazy(() => import('./three/Scene3D').then((m) => ({ default: m.Scene3D })))
import { TopBar } from './TopBar'
import { ToolRail } from './ToolRail'
import { StatusBar } from './StatusBar'
import { SidePanel } from './SidePanel'
import { HelpDialog } from './HelpDialog'
import { useProject, redo, undo } from '../store/useProject'
import { useDoors } from '../store/useDoors'
import { emit } from '../lib/bus'
import type { Tool } from '../types'

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  r: 'room',
  p: 'poly',
  w: 'wall',
  d: 'door',
  n: 'window',
  k: 'column',
  i: 'item',
  m: 'measure',
  x: 'delete',
}

export function App() {
  const view = useProject((s) => s.view)
  const nearDoor = useDoors((s) => s.near)
  const setView = useProject((s) => s.setView)
  const [help, setHelp] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return
      const st = useProject.getState()
      const meta = e.metaKey || e.ctrlKey

      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
        return
      }
      if (meta && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (meta) return

      if (e.key === '1') setView('2d')
      if (e.key === '2') setView('3d')
      if (e.key === '3') setView('walk')
      if (e.key === '?') setHelp((v) => !v)
      if (e.key === 'Escape') st.select(null)

      if (st.view !== '2d') return

      const tool = TOOL_KEYS[e.key.toLowerCase()]
      if (tool) st.setTool(tool)
      if (e.key.toLowerCase() === 'g') st.toggleUi('snap')
      if (e.key.toLowerCase() === 'h') st.toggleUi('snapWalls')
      if (e.key.toLowerCase() === 'f') emit('fit')
      if ((e.key === 'Delete' || e.key === 'Backspace') && st.selection) {
        e.preventDefault()
        st.remove(st.selection)
      }
      if (e.key.toLowerCase() === 'c' && st.selection) st.duplicate(st.selection)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setView])

  const exportJson = () => {
    const project = useProject.getState().project
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${project.name.replace(/\s+/g, '-').toLowerCase() || 'floorplan'}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJson = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        useProject.getState().loadProject(JSON.parse(String(reader.result)))
        useDoors.getState().closeAll()
        emit('fit')
      } catch {
        alert('That file could not be read as a Measure project.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar onHelp={() => setHelp(true)} onExport={exportJson} onImport={() => fileRef.current?.click()} />

      <div className="flex min-h-0 flex-1">
        <ToolRail />
        <main className="relative min-w-0 flex-1">
          <PlanEditor hidden={view !== '2d'} />
          {view !== '2d' ? (
            <div className="absolute inset-0">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-mist-400">Loading the 3D view…</div>
                }
              >
                <Scene3D active />
              </Suspense>
            </div>
          ) : null}

          {view === 'walk' ? (
            <>
              <div className="pointer-events-none absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2">
                <div className="h-full w-full rounded-full border border-white/70" />
              </div>
              {nearDoor ? (
                <div className="pointer-events-none absolute top-[58%] left-1/2 -translate-x-1/2 rounded-md border border-accent-soft bg-ink-900/90 px-3 py-1.5 backdrop-blur">
                  <p className="text-mist-200">
                    <kbd>E</kbd> {nearDoor.open ? 'close' : 'open'} the {nearDoor.label}
                  </p>
                </div>
              ) : null}
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg border border-ink-600 bg-ink-900/85 px-4 py-2.5 text-center backdrop-blur">
                <p className="text-mist-200">
                  Click to look around · <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to move ·{' '}
                  <kbd>Shift</kbd> to run · <kbd>C</kbd> to crouch · <kbd>E</kbd> for doors ·{' '}
                  <kbd>Esc</kbd> to release the cursor
                </p>
              </div>
            </>
          ) : null}
        </main>
        <SidePanel />
      </div>

      <StatusBar />
      {help ? <HelpDialog onClose={() => setHelp(false)} /> : null}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) importJson(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
