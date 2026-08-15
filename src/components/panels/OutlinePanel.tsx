import { DoorOpen, AppWindow, Sofa, Square, Ruler, Columns3, Sun, Wand2, Brush } from 'lucide-react'
import { useActiveFloor, useProject } from '../../store/useProject'
import { formatArea, formatLen, dist } from '../../lib/geometry'
import { floorAreaOn, roomAreaOn, wallLengthOn } from '../../lib/measure'
import { Section } from '../ui/fields'

export function OutlinePanel() {
  const floor = useActiveFloor()
  const selection = useProject((s) => s.selection)
  const select = useProject((s) => s.select)
  const basis = useProject((s) => s.dimBasis)
  const total = floorAreaOn(floor, basis)

  const rowClass = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
      active ? 'bg-accent-soft/50 text-mist-200' : 'text-mist-300 hover:bg-ink-800'
    }`

  return (
    <>
      <Section title={`Rooms — ${formatArea(total)}`}>
        <div className="grid grid-cols-2 gap-1.5 pb-1">
          <button
            className="btn"
            title="Turns every space your walls enclose into a room"
            onClick={() => useProject.getState().detectRooms()}
          >
            <Wand2 size={14} /> Find rooms
          </button>
          <button
            className="btn"
            title="Splits walls at junctions and removes duplicates"
            onClick={() => useProject.getState().tidyWalls()}
          >
            <Brush size={14} /> Tidy walls
          </button>
        </div>
        {floor.rooms.length === 0 ? (
          <Empty text="No rooms yet. Drag one with R, or draw walls with W and they become rooms as soon as they close a space." />
        ) : null}
        {floor.rooms.map((r) => (
          <button
            key={r.id}
            className={rowClass(selection?.kind === 'room' && selection.id === r.id)}
            onClick={() => select({ kind: 'room', id: r.id })}
          >
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: r.color }} />
            {r.ceiling === false ? (
              <Sun size={14} className="shrink-0 text-warn" />
            ) : (
              <Square size={14} className="shrink-0 text-mist-400" />
            )}
            <span className="flex-1 truncate">{r.name}</span>
            <span className="tabular-nums text-mist-400">{formatArea(roomAreaOn(floor, r, basis))}</span>
          </button>
        ))}
      </Section>

      <Section title={`Doors & windows — ${floor.openings.length}`}>
        {floor.openings.length === 0 ? <Empty text="No openings yet. Press D or N and click a wall." /> : null}
        {floor.openings.map((o) => (
          <button
            key={o.id}
            className={rowClass(selection?.kind === 'opening' && selection.id === o.id)}
            onClick={() => select({ kind: 'opening', id: o.id })}
          >
            {o.kind === 'door' ? <DoorOpen size={14} className="shrink-0" /> : <AppWindow size={14} className="shrink-0" />}
            <span className="flex-1 truncate capitalize">{o.kind}</span>
            <span className="tabular-nums text-mist-400">
              {formatLen(o.width)} × {formatLen(o.height)}
            </span>
          </button>
        ))}
      </Section>

      <Section title={`Columns — ${(floor.columns ?? []).length}`}>
        {(floor.columns ?? []).length === 0 ? <Empty text="No columns yet. Press K and click on the plan." /> : null}
        {(floor.columns ?? []).map((c) => (
          <button
            key={c.id}
            className={rowClass(selection?.kind === 'column' && selection.id === c.id)}
            onClick={() => select({ kind: 'column', id: c.id })}
          >
            <Columns3 size={14} className="shrink-0 text-mist-400" />
            <span className="flex-1 truncate">{c.name}</span>
            <span className="tabular-nums text-mist-400">
              {c.shape === 'round' ? `⌀ ${formatLen(c.w)}` : `${c.w.toFixed(2)}×${c.d.toFixed(2)}`}
            </span>
          </button>
        ))}
      </Section>

      <Section title={`Furniture — ${floor.items.length}`}>
        {floor.items.length === 0 ? <Empty text="No furniture yet. Pick something in the Catalog tab." /> : null}
        {floor.items.map((it) => (
          <button
            key={it.id}
            className={rowClass(selection?.kind === 'item' && selection.id === it.id)}
            onClick={() => select({ kind: 'item', id: it.id })}
          >
            <Sofa size={14} className="shrink-0 text-mist-400" />
            <span className="flex-1 truncate">{it.name}</span>
            <span className="tabular-nums text-mist-400">
              {it.w.toFixed(2)}×{it.d.toFixed(2)}
            </span>
          </button>
        ))}
      </Section>

      <Section title={`Walls — ${floor.walls.length}`}>
        {floor.walls.map((w) => (
          <button
            key={w.id}
            className={rowClass(selection?.kind === 'wall' && selection.id === w.id)}
            onClick={() => select({ kind: 'wall', id: w.id })}
          >
            <span className="h-3 w-3 shrink-0 rounded-sm bg-mist-300" />
            <span className="flex-1 truncate">Wall</span>
            <span className="tabular-nums text-mist-400">
              {formatLen(wallLengthOn(floor, w, basis))} · {Math.round(w.thickness * 100)} cm
            </span>
          </button>
        ))}
      </Section>

      {floor.measures.length ? (
        <Section title={`Measurements — ${floor.measures.length}`}>
          {floor.measures.map((m) => (
            <button
              key={m.id}
              className={rowClass(selection?.kind === 'measure' && selection.id === m.id)}
              onClick={() => select({ kind: 'measure', id: m.id })}
            >
              <Ruler size={14} className="shrink-0 text-warn" />
              <span className="flex-1 truncate">Tape</span>
              <span className="tabular-nums text-mist-400">{formatLen(dist({ x: m.ax, y: m.ay }, { x: m.bx, y: m.by }))}</span>
            </button>
          ))}
        </Section>
      ) : null}
    </>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="px-1 text-[11px] text-mist-400">{text}</p>
}
