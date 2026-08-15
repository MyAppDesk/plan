import { Layers, Trash2 } from 'lucide-react'
import { useProject } from '../../store/useProject'
import { useLibrary } from '../../store/useLibrary'
import { polygonArea } from '../../lib/geometry'
import { NumberField, SegButtons, Section, Select, TextField, Toggle } from '../ui/fields'

const GRIDS = [
  { value: '0.05', label: '5 cm' },
  { value: '0.1', label: '10 cm' },
  { value: '0.25', label: '25 cm' },
  { value: '0.5', label: '50 cm' },
]

export function SettingsPanel() {
  const s = useProject()
  const library = useLibrary()
  const entries = library.entries
  const currentId = library.currentId
  const floors = s.project.floors
  const site = s.project.site

  return (
    <>
      <Section title="Project">
        <TextField label="Name" value={s.project.name} onChange={s.setProjectName} />
      </Section>

      <Section title="Drawing">
        <Toggle label="Snap to grid" checked={s.snap} onChange={() => s.toggleUi('snap')} />
        <div>
          <span className="field-label">Grid step</span>
          <SegButtons
            value={String(s.gridSize)}
            options={GRIDS}
            onChange={(v) => s.setGridSize(Number(v))}
          />
        </div>
        <Toggle label="Snap furniture to walls" checked={s.snapWalls} onChange={() => s.toggleUi('snapWalls')} />
        <p className="px-1 text-[11px] leading-relaxed text-mist-400">
          Furniture lands against the face of the wall — never inside it — and lines up with it when it is roughly
          parallel. Turn it off to place things freely.
        </p>
        <Toggle label="Show grid" checked={s.showGrid} onChange={() => s.toggleUi('showGrid')} />
        <Toggle label="Show dimensions & labels" checked={s.showDims} onChange={() => s.toggleUi('showDims')} />
      </Section>

      <Section title="Preview">
        <Toggle label="Show furniture" checked={s.showFurniture} onChange={() => s.toggleUi('showFurniture')} />
        <Toggle label="Draw ceilings in 3D" checked={s.showCeiling} onChange={() => s.toggleUi('showCeiling')} />
        <Toggle label="Show every floor in 3D" checked={s.showAllFloors} onChange={() => s.toggleUi('showAllFloors')} />
      </Section>

      <Section
        title="Floors"
        action={
          <button className="icon-btn" title="Add a floor" onClick={() => s.addFloor(false)}>
            <Layers size={15} />
          </button>
        }
      >
        {floors.map((f) => (
          <div
            key={f.id}
            className={`rounded-md border p-2 ${f.id === s.activeFloorId ? 'border-accent-soft bg-ink-800' : 'border-ink-700'}`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <button className="flex-1 truncate text-left font-medium" onClick={() => s.setActiveFloor(f.id)}>
                {f.name}
              </button>
              <button
                className="icon-btn"
                disabled={floors.length <= 1}
                title="Delete floor"
                onClick={() => s.removeFloor(f.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Height"
                value={f.height}
                step={0.05}
                min={1.6}
                max={8}
                onChange={(height) => s.updateFloor(f.id, { height })}
              />
              <NumberField
                label="Elevation"
                value={f.elevation}
                step={0.1}
                min={-50}
                onChange={(elevation) => s.updateFloor(f.id, { elevation })}
              />
            </div>
          </div>
        ))}
        <button className="btn w-full" onClick={() => s.addFloor(true)}>
          Duplicate current floor
        </button>
      </Section>

      <Section title="Plot of land">
        <Toggle
          label="This plan sits on a plot"
          checked={!!site?.enabled}
          onChange={() => s.updateSite({ enabled: !site?.enabled })}
        />
        {site?.enabled ? (
          <>
            <TextField label="Name" value={site.name} onChange={(name) => s.updateSite({ name })} />
            <div>
              <span className="field-label">Ground</span>
              <Select
                value={site.ground}
                options={[
                  { value: 'grass', label: 'Grass' },
                  { value: 'gravel', label: 'Gravel' },
                  { value: 'sand', label: 'Sand' },
                  { value: 'paving', label: 'Paving' },
                  { value: 'earth', label: 'Bare earth' },
                ]}
                onChange={(ground) => s.updateSite({ ground: ground as typeof site.ground })}
              />
            </div>
            <div className="flex items-center justify-between border-b border-ink-800 py-1">
              <span className="text-mist-400">Corners</span>
              <span className="font-medium tabular-nums text-mist-200">{site.outline.length}</span>
            </div>
            <div className="flex items-center justify-between border-b border-ink-800 py-1">
              <span className="text-mist-400">Plot area</span>
              <span className="font-medium tabular-nums text-mist-200">{polygonArea(site.outline).toFixed(1)} m²</span>
            </div>
            <button className="btn w-full" onClick={s.fitSiteToPlan}>
              Fit the plot around everything drawn
            </button>
            <button className="btn w-full" onClick={() => s.setTool('plot')}>
              Redraw the outline (L)
            </button>
            <p className="text-[11px] leading-relaxed text-mist-400">
              The plot is a polygon, so it can be any shape — drag its green corners, double-click an edge to add
              one, double-click a corner to remove it, or press <b>L</b> and click a new outline. Draw as many
              buildings inside it as you like; for a fence or a hedge, draw a wall (W) and set its Type.
            </p>
          </>
        ) : null}
      </Section>

      <Section title="Walkthrough">
        <NumberField
          label="Your height"
          value={(s.project.eyeHeight ?? 1.65) + 0.1}
          step={0.01}
          min={1}
          max={2.3}
          onChange={(v) => s.setEyeHeight(v - 0.1)}
        />
        <p className="text-[11px] leading-relaxed text-mist-400">
          Walk mode puts the camera at {(s.project.eyeHeight ?? 1.65).toFixed(2)} m, roughly eye level for that height.
        </p>
      </Section>

      <Section title="Plans on this device">
        {entries.map((e) => (
          <button
            key={e.id}
            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors ${
              e.id === currentId ? 'bg-accent-soft/40 text-mist-200' : 'text-mist-300 hover:bg-ink-800'
            }`}
            onClick={() => library.open(e.id)}
          >
            <span className="truncate">{e.name}</span>
            <span className="text-[10px] text-mist-400">{new Date(e.updatedAt).toLocaleDateString()}</span>
          </button>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => library.setScreen('onboarding')}>
            New plan…
          </button>
          <button className="btn" onClick={() => library.setScreen('landing')}>
            About Measure
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-mist-400">
          Stored in this browser only — about {(library.bytes() / 1024).toFixed(0)} kB so far. No cookies, no account,
          nothing uploaded. Export the JSON to keep a copy or move a plan to another device.
        </p>
      </Section>
    </>
  )
}
