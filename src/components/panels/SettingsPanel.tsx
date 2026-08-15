import { Layers, Trash2 } from 'lucide-react'
import { useProject } from '../../store/useProject'
import { NumberField, SegButtons, Section, TextField, Toggle } from '../ui/fields'

const GRIDS = [
  { value: '0.05', label: '5 cm' },
  { value: '0.1', label: '10 cm' },
  { value: '0.25', label: '25 cm' },
  { value: '0.5', label: '50 cm' },
]

export function SettingsPanel() {
  const s = useProject()
  const floors = s.project.floors

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
        <Toggle label="Show ceilings in 3D" checked={s.showCeiling} onChange={() => s.toggleUi('showCeiling')} />
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

      <Section title="Danger zone">
        <button className="btn btn-danger w-full" onClick={() => {
          if (confirm('Replace everything with the sample flat? Your current drawing will be lost.')) s.resetProject()
        }}>
          Reset to sample flat
        </button>
        <p className="text-[11px] text-mist-400">
          Your work is saved in this browser automatically. Export the JSON from the toolbar to keep a copy or move it to
          another device.
        </p>
      </Section>
    </>
  )
}
