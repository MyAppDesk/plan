import { Copy, Trash2, RotateCw, FlipHorizontal2, ArrowLeftRight } from 'lucide-react'
import { ROOM_COLORS, useActiveFloor, useProject } from '../../store/useProject'
import { CATALOG, catalogItem } from '../../lib/catalog'
import {
  dist,
  formatArea,
  formatLen,
  polygonBounds,
  roomArea,
  roomPerimeter,
  roomPoints,
  wallEnds,
  wallLength,
} from '../../lib/geometry'
import { ColorPicker, NumberField, Row, SegButtons, Section, TextField } from '../ui/fields'

const ITEM_COLORS = ['#8b6a45', '#9a7f5f', '#5d6778', '#6f7c93', '#4c7a4c', '#cfd4de', '#e9ecf2', '#43485a', '#5b4b63', '#a2564f']

export function PropertiesPanel() {
  const floor = useActiveFloor()
  const selection = useProject((s) => s.selection)
  const st = useProject

  if (!selection) return <FloorProps />

  if (selection.kind === 'room') {
    const room = floor.rooms.find((r) => r.id === selection.id)
    if (!room) return <FloorProps />
    const pts = roomPoints(floor, room)
    const b = polygonBounds(pts)
    const w = b.maxX - b.minX
    const h = b.maxY - b.minY
    const rect = pts.length === 4
    return (
      <>
        <Section title="Room">
          <TextField label="Name" value={room.name} onChange={(name) => st.getState().updateRoom(room.id, { name })} />
          <Row>
            <NumberField
              label="Width"
              value={w}
              step={0.1}
              min={0.3}
              onChange={(v) => st.getState().resizeRoom(room.id, v, h)}
            />
            <NumberField
              label="Depth"
              value={h}
              step={0.1}
              min={0.3}
              onChange={(v) => st.getState().resizeRoom(room.id, w, v)}
            />
          </Row>
          {!rect ? <p className="text-[11px] text-mist-400">Width and depth scale the whole outline of this {pts.length}-sided room.</p> : null}
          <NumberField
            label="Ceiling height"
            value={room.height ?? floor.height}
            step={0.05}
            min={1.6}
            max={6}
            onChange={(v) => st.getState().updateRoom(room.id, { height: v })}
          />
          <div>
            <span className="field-label">Colour</span>
            <ColorPicker value={room.color} colors={ROOM_COLORS} onChange={(color) => st.getState().updateRoom(room.id, { color })} />
          </div>
        </Section>
        <Section title="Measurements">
          <Stat label="Floor area" value={formatArea(roomArea(floor, room))} />
          <Stat label="Perimeter" value={formatLen(roomPerimeter(floor, room))} />
          <Stat label="Wall area" value={formatArea(roomPerimeter(floor, room) * (room.height ?? floor.height))} />
          <Stat label="Volume" value={`${(roomArea(floor, room) * (room.height ?? floor.height)).toFixed(2)} m³`} />
          <Stat label="Corners" value={String(pts.length)} />
        </Section>
        <Actions
          onDuplicate={() => st.getState().duplicate(selection)}
          onDelete={() => st.getState().remove(selection)}
        />
      </>
    )
  }

  if (selection.kind === 'wall') {
    const wall = floor.walls.find((w) => w.id === selection.id)
    if (!wall) return <FloorProps />
    const len = wallLength(floor, wall)
    const ends = wallEnds(floor, wall)
    const angle = ends ? (Math.atan2(ends.b.y - ends.a.y, ends.b.x - ends.a.x) * 180) / Math.PI : 0
    const openings = floor.openings.filter((o) => o.wallId === wall.id)
    return (
      <>
        <Section title="Wall">
          <NumberField label="Length" value={len} step={0.1} min={0.1} onChange={(v) => st.getState().setWallLength(wall.id, v)} />
          <Row>
            <NumberField
              label="Thickness"
              value={wall.thickness}
              step={0.01}
              min={0.03}
              max={1}
              onChange={(v) => st.getState().updateWall(wall.id, { thickness: v })}
            />
            <NumberField
              label="Height"
              value={wall.height ?? floor.height}
              step={0.05}
              min={0.3}
              max={8}
              onChange={(v) => st.getState().updateWall(wall.id, { height: v })}
            />
          </Row>
          {wall.height !== null ? (
            <button className="btn w-full" onClick={() => st.getState().updateWall(wall.id, { height: null })}>
              Use floor height ({floor.height.toFixed(2)} m)
            </button>
          ) : null}
          <Stat label="Angle" value={`${angle.toFixed(1)}°`} />
          <Stat label="Openings" value={String(openings.length)} />
        </Section>
        {openings.length ? (
          <Section title="Openings on this wall">
            {openings.map((o) => (
              <button
                key={o.id}
                className="btn w-full justify-between"
                onClick={() => st.getState().select({ kind: 'opening', id: o.id })}
              >
                <span className="capitalize">{o.kind}</span>
                <span className="text-mist-400">{formatLen(o.width)}</span>
              </button>
            ))}
          </Section>
        ) : null}
        <Actions onDelete={() => st.getState().remove(selection)} />
      </>
    )
  }

  if (selection.kind === 'opening') {
    const op = floor.openings.find((o) => o.id === selection.id)
    if (!op) return <FloorProps />
    const wall = floor.walls.find((w) => w.id === op.wallId)
    const len = wall ? wallLength(floor, wall) : 0
    return (
      <>
        <Section title={op.kind === 'door' ? 'Door' : 'Window'}>
          <SegButtons
            value={op.kind}
            options={[
              { value: 'door', label: 'Door' },
              { value: 'window', label: 'Window' },
            ]}
            onChange={(kind) =>
              st.getState().updateOpening(op.id, {
                kind,
                height: kind === 'door' ? 2.03 : 1.2,
                sill: kind === 'door' ? 0 : 1.0,
              })
            }
          />
          <Row>
            <NumberField
              label="Width"
              value={op.width}
              step={0.05}
              min={0.2}
              max={Math.max(0.2, len)}
              onChange={(width) => st.getState().updateOpening(op.id, { width })}
            />
            <NumberField
              label="Height"
              value={op.height}
              step={0.05}
              min={0.2}
              max={4}
              onChange={(height) => st.getState().updateOpening(op.id, { height })}
            />
          </Row>
          <Row>
            <NumberField
              label="Sill height"
              value={op.sill}
              step={0.05}
              min={0}
              max={2.5}
              disabled={op.kind === 'door'}
              onChange={(sill) => st.getState().updateOpening(op.id, { sill })}
            />
            <NumberField
              label="Position on wall"
              value={op.offset}
              step={0.05}
              min={0}
              max={len}
              onChange={(offset) => st.getState().updateOpening(op.id, { offset })}
            />
          </Row>
          <Row>
            <button className="btn" onClick={() => st.getState().updateOpening(op.id, { flipHinge: !op.flipHinge })}>
              <ArrowLeftRight size={14} /> Hinge
            </button>
            <button className="btn" onClick={() => st.getState().updateOpening(op.id, { flipSide: !op.flipSide })}>
              <FlipHorizontal2 size={14} /> Swing
            </button>
          </Row>
          <div className="grid grid-cols-3 gap-1.5">
            {(op.kind === 'door'
              ? [
                  { label: '70', w: 0.7 },
                  { label: '80', w: 0.8 },
                  { label: '90', w: 0.9 },
                ]
              : [
                  { label: '60', w: 0.6 },
                  { label: '120', w: 1.2 },
                  { label: '180', w: 1.8 },
                ]
            ).map((p) => (
              <button key={p.label} className="btn" onClick={() => st.getState().updateOpening(op.id, { width: p.w })}>
                {p.label} cm
              </button>
            ))}
          </div>
          {wall ? (
            <button className="btn w-full" onClick={() => st.getState().select({ kind: 'wall', id: wall.id })}>
              Select host wall
            </button>
          ) : null}
        </Section>
        <Actions onDelete={() => st.getState().remove(selection)} />
      </>
    )
  }

  if (selection.kind === 'item') {
    const item = floor.items.find((i) => i.id === selection.id)
    if (!item) return <FloorProps />
    const def = catalogItem(item.kind)
    return (
      <>
        <Section title="Furniture">
          <TextField label="Name" value={item.name} onChange={(name) => st.getState().updateItem(item.id, { name })} />
          <Row cols={3}>
            <NumberField label="Width" value={item.w} step={0.05} min={0.05} onChange={(w) => st.getState().updateItem(item.id, { w })} />
            <NumberField label="Depth" value={item.d} step={0.05} min={0.05} onChange={(d) => st.getState().updateItem(item.id, { d })} />
            <NumberField label="Height" value={item.h} step={0.05} min={0.02} onChange={(h) => st.getState().updateItem(item.id, { h })} />
          </Row>
          <Row cols={3}>
            <NumberField label="X" value={item.x} step={0.05} min={-1000} onChange={(x) => st.getState().updateItem(item.id, { x })} />
            <NumberField label="Y" value={item.y} step={0.05} min={-1000} onChange={(y) => st.getState().updateItem(item.id, { y })} />
            <NumberField label="Off floor" value={item.z} step={0.05} min={0} onChange={(z) => st.getState().updateItem(item.id, { z })} />
          </Row>
          <Row>
            <NumberField
              label="Rotation"
              unit="°"
              value={(item.rot * 180) / Math.PI}
              step={5}
              min={-360}
              max={360}
              onChange={(deg) => st.getState().updateItem(item.id, { rot: (deg * Math.PI) / 180 })}
            />
            <div className="flex items-end">
              <button
                className="btn w-full"
                onClick={() => st.getState().updateItem(item.id, { rot: item.rot + Math.PI / 2 })}
              >
                <RotateCw size={14} /> 90°
              </button>
            </div>
          </Row>
          <div>
            <span className="field-label">Colour</span>
            <ColorPicker value={item.color} colors={ITEM_COLORS} onChange={(color) => st.getState().updateItem(item.id, { color })} />
          </div>
          <button
            className="btn w-full"
            onClick={() => st.getState().updateItem(item.id, { w: def.w, d: def.d, h: def.h })}
          >
            Reset to catalogue size ({def.w}×{def.d}×{def.h} m)
          </button>
        </Section>
        <Section title="Swap model">
          <div className="grid grid-cols-2 gap-1.5">
            {CATALOG.filter((c) => c.group === def.group).map((c) => (
              <button
                key={c.kind}
                className={`btn justify-start truncate ${c.kind === item.kind ? 'border-accent text-accent' : ''}`}
                onClick={() => st.getState().updateItem(item.id, { kind: c.kind, name: c.name, w: c.w, d: c.d, h: c.h })}
              >
                {c.name}
              </button>
            ))}
          </div>
        </Section>
        <Actions onDuplicate={() => st.getState().duplicate(selection)} onDelete={() => st.getState().remove(selection)} />
      </>
    )
  }

  if (selection.kind === 'point') {
    const p = floor.points.find((q) => q.id === selection.id)
    if (!p) return <FloorProps />
    const walls = floor.walls.filter((w) => w.a === p.id || w.b === p.id)
    return (
      <>
        <Section title="Corner">
          <Row>
            <NumberField label="X" value={p.x} step={0.05} min={-1000} onChange={(x) => st.getState().movePoint(p.id, x, p.y)} />
            <NumberField label="Y" value={p.y} step={0.05} min={-1000} onChange={(y) => st.getState().movePoint(p.id, p.x, y)} />
          </Row>
          <Stat label="Walls joined here" value={String(walls.length)} />
          {walls.map((w) => (
            <button key={w.id} className="btn w-full justify-between" onClick={() => st.getState().select({ kind: 'wall', id: w.id })}>
              <span>Wall</span>
              <span className="text-mist-400">{formatLen(wallLength(floor, w))}</span>
            </button>
          ))}
        </Section>
        <Actions onDelete={() => st.getState().remove(selection)} />
      </>
    )
  }

  if (selection.kind === 'measure') {
    const m = floor.measures.find((x) => x.id === selection.id)
    if (!m) return <FloorProps />
    return (
      <>
        <Section title="Measurement">
          <Stat label="Distance" value={formatLen(dist({ x: m.ax, y: m.ay }, { x: m.bx, y: m.by }))} />
          <Row>
            <NumberField label="From X" value={m.ax} step={0.05} min={-1000} onChange={(ax) => st.getState().updateMeasure(m.id, { ax })} />
            <NumberField label="From Y" value={m.ay} step={0.05} min={-1000} onChange={(ay) => st.getState().updateMeasure(m.id, { ay })} />
          </Row>
          <Row>
            <NumberField label="To X" value={m.bx} step={0.05} min={-1000} onChange={(bx) => st.getState().updateMeasure(m.id, { bx })} />
            <NumberField label="To Y" value={m.by} step={0.05} min={-1000} onChange={(by) => st.getState().updateMeasure(m.id, { by })} />
          </Row>
        </Section>
        <Actions onDelete={() => st.getState().remove(selection)} />
      </>
    )
  }

  return <FloorProps />
}

function FloorProps() {
  const floor = useActiveFloor()
  const st = useProject
  const totalArea = floor.rooms.reduce((sum, r) => sum + roomArea(floor, r), 0)
  return (
    <>
      <Section title="Floor">
        <TextField label="Name" value={floor.name} onChange={(name) => st.getState().updateFloor(floor.id, { name })} />
        <Row>
          <NumberField
            label="Ceiling height"
            value={floor.height}
            step={0.05}
            min={1.6}
            max={8}
            onChange={(height) => st.getState().updateFloor(floor.id, { height })}
          />
          <NumberField
            label="Elevation"
            value={floor.elevation}
            step={0.1}
            min={-50}
            onChange={(elevation) => st.getState().updateFloor(floor.id, { elevation })}
          />
        </Row>
        <NumberField
          label="Default wall thickness"
          value={floor.wallThickness}
          step={0.01}
          min={0.03}
          max={1}
          onChange={(wallThickness) => st.getState().updateFloor(floor.id, { wallThickness })}
        />
        <button
          className="btn w-full"
          onClick={() => {
            const t = floor.wallThickness
            floor.walls.forEach((w) => st.getState().updateWall(w.id, { thickness: t }))
          }}
        >
          Apply thickness to every wall
        </button>
      </Section>
      <Section title="This floor">
        <Stat label="Rooms" value={String(floor.rooms.length)} />
        <Stat label="Total floor area" value={formatArea(totalArea)} />
        <Stat label="Walls" value={String(floor.walls.length)} />
        <Stat label="Doors" value={String(floor.openings.filter((o) => o.kind === 'door').length)} />
        <Stat label="Windows" value={String(floor.openings.filter((o) => o.kind === 'window').length)} />
        <Stat label="Furniture" value={String(floor.items.length)} />
      </Section>
      <div className="px-3 py-3 text-[11px] leading-relaxed text-mist-400">
        Nothing selected. Click a room, wall, door, window or piece of furniture on the plan to edit its exact sizes.
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-800 py-1 last:border-0">
      <span className="text-mist-400">{label}</span>
      <span className="font-medium tabular-nums text-mist-200">{value}</span>
    </div>
  )
}

function Actions({ onDelete, onDuplicate }: { onDelete: () => void; onDuplicate?: () => void }) {
  return (
    <div className="flex gap-2 px-3 py-3">
      {onDuplicate ? (
        <button className="btn flex-1" onClick={onDuplicate}>
          <Copy size={14} /> Duplicate
        </button>
      ) : null}
      <button className="btn btn-danger flex-1" onClick={onDelete}>
        <Trash2 size={14} /> Delete
      </button>
    </div>
  )
}
