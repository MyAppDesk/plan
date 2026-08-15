import { DoorOpen, AppWindow, Sofa, Square, Ruler } from 'lucide-react'
import { useActiveFloor, useProject } from '../../store/useProject'
import { formatArea, formatLen, roomArea, wallLength, dist } from '../../lib/geometry'
import { Section } from '../ui/fields'

export function OutlinePanel() {
  const floor = useActiveFloor()
  const selection = useProject((s) => s.selection)
  const select = useProject((s) => s.select)
  const total = floor.rooms.reduce((sum, r) => sum + roomArea(floor, r), 0)

  const rowClass = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
      active ? 'bg-accent-soft/50 text-mist-200' : 'text-mist-300 hover:bg-ink-800'
    }`

  return (
    <>
      <Section title={`Rooms — ${formatArea(total)}`}>
        {floor.rooms.length === 0 ? <Empty text="No rooms yet. Press R and drag on the plan." /> : null}
        {floor.rooms.map((r) => (
          <button
            key={r.id}
            className={rowClass(selection?.kind === 'room' && selection.id === r.id)}
            onClick={() => select({ kind: 'room', id: r.id })}
          >
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: r.color }} />
            <Square size={14} className="shrink-0 text-mist-400" />
            <span className="flex-1 truncate">{r.name}</span>
            <span className="tabular-nums text-mist-400">{formatArea(roomArea(floor, r))}</span>
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
              {formatLen(wallLength(floor, w))} · {Math.round(w.thickness * 100)} cm
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
