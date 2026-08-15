import { Copy, Trash2, RotateCw, FlipHorizontal2, ArrowLeftRight, Split } from 'lucide-react'
import { useActiveFloor, useProject } from '../../store/useProject'
import { ROOM_COLORS } from '../../lib/build'
import { CATALOG, catalogItem } from '../../lib/catalog'
import type { Item } from '../../types'
import {
  dist,
  formatArea,
  formatLen,
  polygonArea,
  polygonBounds,
  roomArea,
  roomPerimeter,
  roomPoints,
  wallEnds,
  wallLength,
} from '../../lib/geometry'
import { isStair, stairLayout } from '../../lib/stairs'
import { ColorPicker, NumberField, Row, SegButtons, Section, Select, TextField, Toggle } from '../ui/fields'

interface HeightPreset {
  id: string
  label: string
  group?: string
  base: number
  height: number | null
}

const FLOOR_GROUP = 'Standing on the floor'
const CEILING_GROUP = 'Hanging from the ceiling'

/** Typical sizes; anything else is typed straight into the two fields. */
function heightPresets(ceiling: number): HeightPreset[] {
  return [
    { id: 'full', label: 'Full height — floor to ceiling', group: FLOOR_GROUP, base: 0, height: null },
    { id: 'f120', label: 'Half wall — 1.20 m', group: FLOOR_GROUP, base: 0, height: 1.2 },
    { id: 'f110', label: 'Terrace parapet — 1.10 m', group: FLOOR_GROUP, base: 0, height: 1.1 },
    { id: 'f090', label: 'Half wall — 0.90 m', group: FLOOR_GROUP, base: 0, height: 0.9 },
    { id: 'f040', label: 'Kerb / step — 0.40 m', group: FLOOR_GROUP, base: 0, height: 0.4 },
    { id: 'c030', label: 'Beam — 0.30 m deep', group: CEILING_GROUP, base: ceiling - 0.3, height: null },
    { id: 'c050', label: 'Boxing — 0.50 m deep', group: CEILING_GROUP, base: ceiling - 0.5, height: null },
    { id: 'c210', label: 'Clear 2.10 m underneath', group: CEILING_GROUP, base: 2.1, height: null },
  ]
}

function matchPreset(presets: HeightPreset[], base: number, height: number | null): string {
  const hit = presets.find((p) => Math.abs(p.base - base) < 1e-6 && p.height === height)
  return hit?.id ?? 'custom'
}

const CUSTOM_OPTION = { value: 'custom', label: 'Custom — set the numbers below' }

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
          <Toggle
            label="Has a ceiling"
            checked={room.ceiling !== false}
            onChange={() => st.getState().updateRoom(room.id, { ceiling: room.ceiling === false })}
          />
          <p className="text-[11px] leading-relaxed text-mist-400">
            {room.ceiling === false
              ? 'Open to the sky — a terrace, a patio or a light well. Nothing is drawn overhead in 3D.'
              : 'Covered. If there is a floor above, its slab is the ceiling; otherwise a roof is drawn at ' +
                (room.height ?? floor.height).toFixed(2) +
                ' m.'}
          </p>
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
          <NumberField
            label="Thickness"
            value={wall.thickness}
            step={0.01}
            min={0.03}
            max={1}
            onChange={(v) => st.getState().updateWall(wall.id, { thickness: v })}
          />
          <Select
            label="Type"
            value={wall.style ?? 'solid'}
            options={[
              { value: 'solid', label: 'Solid wall' },
              { value: 'fence', label: 'Fence — posts and rails' },
              { value: 'railing', label: 'Railing — posts and balusters' },
              { value: 'hedge', label: 'Hedge' },
            ]}
            onChange={(style) => {
              const preset =
                style === 'fence'
                  ? { thickness: 0.08, height: 1.8 }
                  : style === 'railing'
                    ? { thickness: 0.06, height: 1.0 }
                    : style === 'hedge'
                      ? { thickness: 0.5, height: 1.6 }
                      : {}
              st.getState().updateWall(wall.id, { style: style as typeof wall.style, base: 0, ...preset })
            }}
          />
          <Select
            label="Vertical extent"
            value={matchPreset(heightPresets(floor.height), wall.base, wall.height)}
            options={[
              CUSTOM_OPTION,
              ...heightPresets(floor.height).map((p) => ({ value: p.id, label: p.label, group: p.group })),
            ]}
            onChange={(id) => {
              const p = heightPresets(floor.height).find((x) => x.id === id)
              if (p) st.getState().updateWall(wall.id, { base: p.base, height: p.height })
            }}
          />
          <Row>
            <NumberField
              label="Starts at"
              value={wall.base}
              step={0.05}
              min={0}
              max={Math.max(0, floor.height - 0.05)}
              onChange={(v) => st.getState().updateWall(wall.id, { base: v })}
            />
            <NumberField
              label="Height"
              value={wall.height ?? floor.height - wall.base}
              step={0.05}
              min={0.05}
              max={8}
              onChange={(v) => st.getState().updateWall(wall.id, { height: v })}
            />
          </Row>
          <p className="text-[11px] leading-relaxed text-mist-400">
            Type any size you like: <b>starts at</b> is the gap under the wall, <b>height</b> is how tall the wall
            itself is. Top edge sits at{' '}
            <b>{(wall.height === null ? floor.height : wall.base + wall.height).toFixed(2)} m</b>
            {wall.base > 0
              ? ' — it hangs from above, so you can walk underneath it.'
              : wall.height !== null
                ? ' — a low wall you cannot walk through.'
                : ', the full ceiling height.'}
          </p>
          {wall.height !== null ? (
            <button className="btn w-full" onClick={() => st.getState().updateWall(wall.id, { height: null })}>
              Stretch up to the ceiling ({floor.height.toFixed(2)} m)
            </button>
          ) : null}
          <button
            className="btn w-full"
            title="Adds a corner in the middle so the wall can bend around a column"
            onClick={() => {
              const e2 = wallEnds(floor, wall)
              if (e2) st.getState().splitWall(wall.id, { x: (e2.a.x + e2.b.x) / 2, y: (e2.a.y + e2.b.y) / 2 })
            }}
          >
            <Split size={14} /> Add a corner in the middle
          </button>
          <p className="text-[11px] text-mist-400">Tip: double-click anywhere on a wall to drop a corner there.</p>
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
          {op.kind === 'door' ? (
            <SegButtons
              value={op.doorType}
              options={[
                { value: 'hinged', label: 'Hinged' },
                { value: 'sliding', label: 'Sliding' },
                { value: 'open', label: 'Opening' },
              ]}
              onChange={(doorType) => st.getState().updateOpening(op.id, { doorType })}
            />
          ) : null}
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
              <ArrowLeftRight size={14} /> {op.doorType === 'sliding' ? 'Slide side' : 'Hinge'}
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
          {op.kind === 'door' ? (
            <p className="text-[11px] leading-relaxed text-mist-400">
              {op.doorType === 'open'
                ? 'A cased opening: a doorway with jambs and a head but no leaf. Nothing to open, nothing in your way in walk mode.'
                : 'Doors start closed in walk mode — stand next to one and press E (or click) to open it.'}
            </p>
          ) : null}
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
        {isStair(item.kind) ? <StairInfo item={item} /> : null}
        {item.z >= 1.2 || item.kind.startsWith('loft') ? <OverheadInfo item={item} /> : null}
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

  if (selection.kind === 'column') {
    const column = (floor.columns ?? []).find((c) => c.id === selection.id)
    if (!column) return <FloorProps />
    const top = column.height === null ? floor.height : column.base + column.height
    const round = column.shape === 'round'
    return (
      <>
        <Section title="Column">
          <TextField label="Name" value={column.name} onChange={(name) => st.getState().updateColumn(column.id, { name })} />
          <SegButtons
            value={column.shape}
            options={[
              { value: 'rect', label: 'Square' },
              { value: 'round', label: 'Round' },
            ]}
            onChange={(shape) => st.getState().updateColumn(column.id, { shape })}
          />
          {round ? (
            <NumberField
              label="Diameter"
              value={column.w}
              step={0.05}
              min={0.05}
              onChange={(v) => st.getState().updateColumn(column.id, { w: v, d: v })}
            />
          ) : (
            <Row>
              <NumberField label="Width" value={column.w} step={0.05} min={0.05} onChange={(w) => st.getState().updateColumn(column.id, { w })} />
              <NumberField label="Depth" value={column.d} step={0.05} min={0.05} onChange={(d) => st.getState().updateColumn(column.id, { d })} />
            </Row>
          )}
          <Row>
            <NumberField label="X" value={column.x} step={0.05} min={-1000} onChange={(x) => st.getState().updateColumn(column.id, { x })} />
            <NumberField label="Y" value={column.y} step={0.05} min={-1000} onChange={(y) => st.getState().updateColumn(column.id, { y })} />
          </Row>
          <Select
            label="Vertical extent"
            value={matchPreset(heightPresets(floor.height), column.base, column.height)}
            options={[
              CUSTOM_OPTION,
              ...heightPresets(floor.height).map((p) => ({ value: p.id, label: p.label, group: p.group })),
            ]}
            onChange={(id) => {
              const p = heightPresets(floor.height).find((x) => x.id === id)
              if (p) st.getState().updateColumn(column.id, { base: p.base, height: p.height })
            }}
          />
          <Row>
            <NumberField
              label="Starts at"
              value={column.base}
              step={0.05}
              min={0}
              max={Math.max(0, floor.height - 0.05)}
              onChange={(base) => st.getState().updateColumn(column.id, { base })}
            />
            <NumberField
              label="Height"
              value={column.height ?? floor.height - column.base}
              step={0.05}
              min={0.05}
              max={8}
              onChange={(height) => st.getState().updateColumn(column.id, { height })}
            />
          </Row>
          <p className="text-[11px] leading-relaxed text-mist-400">
            Any size goes: <b>starts at</b> lifts it off the floor, <b>height</b> is how tall it is. Top edge at{' '}
            <b>{top.toFixed(2)} m</b>.
          </p>
          <Row>
            <NumberField
              label="Rotation"
              unit="°"
              value={(column.rot * 180) / Math.PI}
              step={5}
              min={-360}
              max={360}
              onChange={(deg) => st.getState().updateColumn(column.id, { rot: (deg * Math.PI) / 180 })}
            />
            <div className="flex items-end">
              <button className="btn w-full" onClick={() => st.getState().updateColumn(column.id, { rot: column.rot + Math.PI / 2 })}>
                <RotateCw size={14} /> 90°
              </button>
            </div>
          </Row>
          <div>
            <span className="field-label">Colour</span>
            <ColorPicker value={column.color} colors={ITEM_COLORS} onChange={(color) => st.getState().updateColumn(column.id, { color })} />
          </div>
        </Section>
        <Section title="Measurements">
          <Stat label="Footprint" value={round ? `⌀ ${formatLen(column.w)}` : `${formatLen(column.w)} × ${formatLen(column.d)}`} />
          <Stat label="Spans" value={`${formatLen(column.base)} → ${formatLen(top)}`} />
          <Stat label="Blocks walking" value={column.base < 1.7 && top > 0.1 ? 'Yes' : 'No — you pass under it'} />
        </Section>
        <Actions onDuplicate={() => st.getState().duplicate(selection)} onDelete={() => st.getState().remove(selection)} />
      </>
    )
  }

  if (selection.kind === 'site') {
    const site = useProject.getState().project.site
    if (!site) return <FloorProps />
    const area = polygonArea(site.outline)
    let perimeter = 0
    site.outline.forEach((p, i) => {
      perimeter += dist(p, site.outline[(i + 1) % site.outline.length])
    })
    const b = polygonBounds(site.outline)
    return (
      <>
        <Section title="Plot of land">
          <TextField label="Name" value={site.name} onChange={(name) => st.getState().updateSite({ name })} />
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
              onChange={(ground) => st.getState().updateSite({ ground: ground as typeof site.ground })}
            />
          </div>
          <Stat label="Area" value={formatArea(area)} />
          <Stat label="Perimeter" value={formatLen(perimeter)} />
          <Stat label="Corners" value={String(site.outline.length)} />
          <Stat label="Widest points" value={`${formatLen(b.maxX - b.minX)} × ${formatLen(b.maxY - b.minY)}`} />
        </Section>
        <Section title="Shape">
          <p className="text-[11px] leading-relaxed text-mist-400">
            Drag a green corner to move it, double-click an edge to add one, double-click a corner to remove it, or
            drag inside the outline to move the whole plot.
          </p>
          <button className="btn w-full" onClick={() => st.getState().setTool('plot')}>
            Draw a new outline (L)
          </button>
          <button className="btn w-full" onClick={() => st.getState().fitSiteToPlan()}>
            Fit a rectangle around the plan
          </button>
          <button className="btn btn-danger w-full" onClick={() => st.getState().updateSite({ enabled: false })}>
            Turn the plot off
          </button>
        </Section>
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

/** Anything carried up near the ceiling: a loft deck, a storage box, a shelf. */
function OverheadInfo({ item }: { item: Item }) {
  const floor = useActiveFloor()
  const top = item.z + item.h
  const clear = item.z
  return (
    <Section title="Overhead">
      <Stat label="Underside" value={formatLen(item.z)} />
      <Stat label="Top" value={formatLen(top)} />
      <Stat label="Headroom under it" value={formatLen(clear)} />
      <Stat label="Storage volume" value={`${(item.w * item.d * item.h).toFixed(2)} m³`} />
      {top > floor.height + 0.01 ? (
        <p className="text-[11px] leading-relaxed text-warn">
          It pokes through the {floor.height.toFixed(2)} m ceiling — lower it or make it shallower.
        </p>
      ) : null}
      <button
        className="btn w-full"
        onClick={() => useProject.getState().updateItem(item.id, { z: Math.max(0, floor.height - item.h) })}
      >
        Tuck it under the ceiling
      </button>
      <button
        className="btn w-full"
        onClick={() =>
          useProject.getState().updateItem(item.id, { z: 2.05, h: Math.max(0.25, floor.height - 2.05) })
        }
      >
        Standard altillo — 2.05 m up, filling to the ceiling
      </button>
      <div>
        <span className="field-label">Cut-out along the back edge</span>
        <Row cols={3}>
          <NumberField
            label="Depth"
            value={item.notch?.depth ?? 0}
            step={0.05}
            min={0}
            max={item.d}
            onChange={(depth) =>
              useProject.getState().updateItem(item.id, {
                notch: { left: 0, right: 0, ...item.notch, depth },
              })
            }
          />
          <NumberField
            label="Left"
            value={item.notch?.left ?? 0}
            step={0.05}
            min={0}
            max={item.w}
            onChange={(left) =>
              useProject.getState().updateItem(item.id, {
                notch: { depth: 0, right: 0, ...item.notch, left },
              })
            }
          />
          <NumberField
            label="Right"
            value={item.notch?.right ?? 0}
            step={0.05}
            min={0}
            max={item.w}
            onChange={(right) =>
              useProject.getState().updateItem(item.id, {
                notch: { depth: 0, left: 0, ...item.notch, right },
              })
            }
          />
        </Row>
        <p className="mt-1 text-[11px] leading-relaxed text-mist-400">
          Takes a bite out of the back of the footprint, so the loft can wrap around a room — over the hall and
          in front of a cupboard without covering it.
        </p>
      </div>
      <p className="text-[11px] leading-relaxed text-mist-400">
        Drawn dotted on the plan because it is above head height, and you walk underneath it in walk mode.
      </p>
    </Section>
  )
}

/** Straight flight: the step count follows from the rise you type. */
function StairInfo({ item }: { item: Item }) {
  const floor = useActiveFloor()
  const floors = useProject((s) => s.project.floors)
  const above = floors
    .filter((f) => f.elevation > floor.elevation + 0.1)
    .sort((a, b) => a.elevation - b.elevation)[0]
  const { count, riser, going, run, shape } = stairLayout(item.kind, item)
  const steep = riser > 0.19 || going < 0.24

  return (
    <Section title="Flight">
      <Stat
        label="Shape"
        value={
          shape === 'straight'
            ? 'Straight'
            : shape === 'quarter'
              ? 'Quarter turn'
              : shape === 'half'
                ? 'Half turn'
                : 'Spiral'
        }
      />
      <Stat label="Steps" value={String(count)} />
      <Stat label="Riser" value={`${(riser * 100).toFixed(1)} cm`} />
      <Stat label="Going (tread)" value={`${(going * 100).toFixed(1)} cm`} />
      <Stat label="Rise" value={formatLen(item.h)} />
      <Stat label="Walking length" value={formatLen(run)} />
      <Stat label="Footprint" value={`${formatLen(item.w)} × ${formatLen(item.d)}`} />
      {steep ? (
        <p className="text-[11px] leading-relaxed text-warn">
          Steep for a home stair. Comfortable is roughly 17–18 cm of riser and 28 cm of going — make the flight
          longer (Depth) or the rise smaller.
        </p>
      ) : null}
      {above ? (
        <button
          className="btn w-full"
          onClick={() =>
            useProject.getState().updateItem(item.id, { h: above.elevation - floor.elevation })
          }
        >
          Fit the rise to {above.name} ({(above.elevation - floor.elevation).toFixed(2)} m)
        </button>
      ) : (
        <p className="text-[11px] text-mist-400">Add a floor above and this flight will land on it.</p>
      )}
      <button
        className="btn w-full"
        onClick={() => {
          const steps = Math.ceil(item.h / 0.18)
          const needed = steps * 0.28
          const factor = needed / Math.max(0.1, stairLayout(item.kind, { ...item, d: item.d }).run)
          useProject.getState().updateItem(item.id, { d: Number((item.d * factor).toFixed(2)) })
        }}
      >
        Set a comfortable run (28 cm per step)
      </button>
      <p className="text-[11px] leading-relaxed text-mist-400">
        The flight climbs towards its <b>depth</b> direction, and it cuts its own well in the slab above. In walk
        mode you simply walk up it.
      </p>
    </Section>
  )
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
          label="Floor slab thickness"
          value={floor.slab}
          step={0.05}
          min={0.04}
          max={1}
          onChange={(slab) => st.getState().updateFloor(floor.id, { slab })}
        />
        <p className="text-[11px] leading-relaxed text-mist-400">
          The slab hangs below the floor level, so this floor's walls end at{' '}
          {(floor.elevation + floor.height).toFixed(2)} m and the next floor starts at{' '}
          {(floor.elevation + floor.height + floor.slab).toFixed(2)} m with no gap.
        </p>
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
        <Stat label="Open to the sky" value={String(floor.rooms.filter((r) => r.ceiling === false).length)} />
        <Stat label="Total floor area" value={formatArea(totalArea)} />
        <Stat label="Walls" value={String(floor.walls.length)} />
        <Stat label="Doors" value={String(floor.openings.filter((o) => o.kind === 'door').length)} />
        <Stat label="Windows" value={String(floor.openings.filter((o) => o.kind === 'window').length)} />
        <Stat label="Columns" value={String((floor.columns ?? []).length)} />
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
