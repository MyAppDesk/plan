import { Layers, Sofa, Square } from 'lucide-react'
import { useProject } from '../../store/useProject'

/** Floor / ceiling / furniture switches, right on top of the 3D view. */
export function ViewOptions3D() {
  const floors = useProject((s) => s.project.floors)
  const activeFloorId = useProject((s) => s.activeFloorId)
  const setActiveFloor = useProject((s) => s.setActiveFloor)
  const showAllFloors = useProject((s) => s.showAllFloors)
  const showCeiling = useProject((s) => s.showCeiling)
  const showFurniture = useProject((s) => s.showFurniture)
  const toggleUi = useProject((s) => s.toggleUi)
  const view = useProject((s) => s.view)
  const walking = view === 'walk'
  const activeFloor = floors.find((f) => f.id === activeFloorId)
  const openRooms = (activeFloor?.rooms ?? []).filter((r) => r.ceiling === false).length

  return (
    <div className="absolute top-3 right-3 w-52 rounded-lg border border-ink-600 bg-ink-900/90 p-2 backdrop-blur">
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-widest text-mist-400 uppercase">
        <Layers size={13} /> Floors
      </div>

      <div className="mb-2 flex rounded-md border border-ink-600 bg-ink-850 p-0.5">
        {[
          { all: false, label: 'This floor' },
          { all: true, label: 'All floors' },
        ].map((o) => (
          <button
            key={o.label}
            disabled={walking}
            onClick={() => {
              if (showAllFloors !== o.all) toggleUi('showAllFloors')
            }}
            className={`flex-1 rounded px-2 py-1 transition-colors disabled:opacity-50 ${
              (walking || showAllFloors) === o.all ? 'bg-accent-soft text-mist-200' : 'text-mist-400 hover:text-mist-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mb-2 space-y-0.5">
        {floors.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFloor(f.id)}
            className={`flex w-full items-center justify-between rounded px-2 py-1 text-left transition-colors ${
              f.id === activeFloorId ? 'bg-ink-700 text-mist-200' : 'text-mist-400 hover:bg-ink-800'
            }`}
          >
            <span className="truncate">{f.name}</span>
            <span className="tabular-nums text-[10px] text-mist-500">+{f.elevation.toFixed(2)} m</span>
          </button>
        ))}
      </div>

      {walking ? (
        <p className="px-1 pb-1 text-[10px] leading-relaxed text-mist-400">
          Walk mode always shows every floor — take the stairs to change level.
        </p>
      ) : null}

      {showCeiling && openRooms ? (
        <p className="px-1 pb-1.5 text-[10px] leading-relaxed text-mist-400">
          {openRooms} room{openRooms === 1 ? '' : 's'} on this floor {openRooms === 1 ? 'is' : 'are'} open to the sky
          and stay uncovered.
        </p>
      ) : null}

      <div className="flex gap-1 border-t border-ink-700 pt-1.5">
        <button
          onClick={() => toggleUi('showCeiling')}
          className={`flex flex-1 items-center justify-center gap-1 rounded px-1.5 py-1 transition-colors ${
            showCeiling ? 'bg-accent-soft text-mist-200' : 'text-mist-400 hover:bg-ink-800'
          }`}
        >
          <Square size={13} /> Ceilings
        </button>
        <button
          onClick={() => toggleUi('showFurniture')}
          className={`flex flex-1 items-center justify-center gap-1 rounded px-1.5 py-1 transition-colors ${
            showFurniture ? 'bg-accent-soft text-mist-200' : 'text-mist-400 hover:bg-ink-800'
          }`}
        >
          <Sofa size={13} /> Furniture
        </button>
      </div>
    </div>
  )
}
