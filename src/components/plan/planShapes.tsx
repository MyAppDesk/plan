import { Arc, Circle, Group, Line, Rect, Shape, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Column, Floor, Item, Measure, Opening, Room, Selection, Wall } from '../../types'
import { catalogItem } from '../../lib/catalog'
import {
  angleOf,
  dist,
  formatArea,
  formatLen,
  polygonArea,
  polygonBounds,
  polygonCentroid,
  pointMap,
  columnTopOf,
  snapToWallFace,
  wallBaseOf,
  wallTopOf,
  roomArea,
  roomPoints,
  wallEnds,
} from '../../lib/geometry'

export const C = {
  wall: '#c9d2e2',
  wallLow: '#8ba0c4',
  wallOverhead: '#c9a86a',
  column: '#d5dbe6',
  wallSelected: '#4f8cff',
  wallHover: '#8fb4ff',
  bg: '#0e121a',
  grid: '#182031',
  gridStrong: '#212a3d',
  axis: '#2f3c56',
  dim: '#7d879b',
  dimStrong: '#a6b0c3',
  item: '#8b95a8',
  itemFill: 'rgba(125,135,155,0.16)',
  accent: '#4f8cff',
  door: '#7fd1a8',
  window: '#6fc3ff',
  measure: '#ffb347',
  ghost: 'rgba(79,140,255,0.5)',
}

const isSel = (sel: Selection | null, kind: Selection['kind'], id: string) => sel?.kind === kind && sel.id === id

/* ------------------------------------------------------------------ */
/* text that keeps a constant on-screen size                           */
/* ------------------------------------------------------------------ */

export function Label({
  x,
  y,
  text,
  scale,
  color = C.dim,
  size = 11,
  bold,
  rotation = 0,
  bg,
  listening = false,
}: {
  x: number
  y: number
  text: string
  scale: number
  color?: string
  size?: number
  bold?: boolean
  rotation?: number
  bg?: string
  listening?: boolean
}) {
  const width = Math.max(28, text.length * size * 0.62 + 8)
  return (
    <Group x={x} y={y} scaleX={1 / scale} scaleY={1 / scale} rotation={rotation} listening={listening}>
      {bg ? <Rect x={-width / 2} y={-size * 0.82} width={width} height={size * 1.6} fill={bg} cornerRadius={3} /> : null}
      <Text
        text={text}
        fontSize={size}
        fontStyle={bold ? '600' : 'normal'}
        fontFamily="Inter, system-ui, sans-serif"
        fill={color}
        width={width}
        offsetX={width / 2}
        offsetY={size * 0.55}
        align="center"
        listening={false}
      />
    </Group>
  )
}

/* ------------------------------------------------------------------ */
/* grid                                                                */
/* ------------------------------------------------------------------ */

export function GridShape({ view, size }: { view: { x: number; y: number; scale: number; w: number; h: number }; size: number }) {
  return (
    <Shape
      listening={false}
      sceneFunc={(ctx) => {
        const { scale } = view
        const minX = -view.x / scale
        const minY = -view.y / scale
        const maxX = minX + view.w / scale
        const maxY = minY + view.h / scale
        // adapt the grid step so lines never get denser than ~8 px
        let step = size
        while (step * scale < 8) step *= 5
        const major = step * 10
        const lw = 1 / scale

        const draw = (s: number, color: string) => {
          ctx.beginPath()
          for (let x = Math.floor(minX / s) * s; x <= maxX; x += s) {
            ctx.moveTo(x, minY)
            ctx.lineTo(x, maxY)
          }
          for (let y = Math.floor(minY / s) * s; y <= maxY; y += s) {
            ctx.moveTo(minX, y)
            ctx.lineTo(maxX, y)
          }
          ctx.strokeStyle = color
          ctx.lineWidth = lw
          ctx.stroke()
        }

        draw(step, C.grid)
        draw(major, C.gridStrong)

        ctx.beginPath()
        ctx.moveTo(minX, 0)
        ctx.lineTo(maxX, 0)
        ctx.moveTo(0, minY)
        ctx.lineTo(0, maxY)
        ctx.strokeStyle = C.axis
        ctx.lineWidth = lw * 1.5
        ctx.stroke()
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* rooms                                                               */
/* ------------------------------------------------------------------ */

export function RoomShape({
  floor,
  room,
  selected,
  scale,
  showDims,
  onDown,
}: {
  floor: Floor
  room: Room
  selected: boolean
  scale: number
  showDims: boolean
  onDown: (e: KonvaEventObject<MouseEvent>) => void
}) {
  const pts = roomPoints(floor, room)
  if (pts.length < 3) return null
  const flat = pts.flatMap((p) => [p.x, p.y])
  const c = polygonCentroid(pts)
  const area = roomArea(floor, room)
  return (
    <Group>
      <Line
        points={flat}
        closed
        fill={selected ? '#2b3d5e' : room.color}
        opacity={selected ? 0.95 : 0.8}
        stroke={selected ? C.accent : 'transparent'}
        strokeWidth={2}
        strokeScaleEnabled={false}
        onMouseDown={onDown}
        onTouchStart={onDown as unknown as (e: KonvaEventObject<TouchEvent>) => void}
      />
      {showDims ? (
        <>
          <Label x={c.x} y={c.y - 0.16} text={room.name} scale={scale} color="#e3e8f2" size={12} bold />
          <Label x={c.x} y={c.y + 0.16} text={formatArea(area)} scale={scale} color={C.dim} size={11} />
        </>
      ) : null}
    </Group>
  )
}

/* ------------------------------------------------------------------ */
/* walls                                                               */
/* ------------------------------------------------------------------ */

export function WallShape({
  floor,
  wall,
  selected,
  hovered,
  scale,
  showDims,
  onDown,
  onDblClick,
}: {
  floor: Floor
  wall: Wall
  selected: boolean
  hovered: boolean
  scale: number
  showDims: boolean
  onDown: (e: KonvaEventObject<MouseEvent>) => void
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void
}) {
  const e = wallEnds(floor, wall)
  if (!e) return null
  const len = dist(e.a, e.b)
  const base = wallBaseOf(wall)
  const top = wallTopOf(floor, wall)
  const overhead = base > 1e-6
  const low = !overhead && top < floor.height - 1e-6
  const ang = angleOf(e.a, e.b)
  const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 }
  const deg = (ang * 180) / Math.PI
  const flip = deg > 90 || deg < -90
  const off = wall.thickness / 2 + 0.14
  const nx = Math.sin(ang) * (flip ? off : -off)
  const ny = -Math.cos(ang) * (flip ? off : -off)

  return (
    <Group>
      <Line
        points={[e.a.x, e.a.y, e.b.x, e.b.y]}
        stroke={
          selected ? C.wallSelected : hovered ? C.wallHover : overhead ? C.wallOverhead : low ? C.wallLow : C.wall
        }
        strokeWidth={wall.thickness}
        lineCap="butt"
        dash={overhead ? [0.1, 0.12] : low ? [0.32, 0.16] : undefined}
        hitStrokeWidth={Math.max(wall.thickness, 14 / scale)}
        onMouseDown={onDown}
        onDblClick={onDblClick}
        onTouchStart={onDown as unknown as (e: KonvaEventObject<TouchEvent>) => void}
      />
      {showDims && len > 0.35 ? (
        <Label
          x={mid.x + nx}
          y={mid.y + ny}
          rotation={flip ? deg + 180 : deg}
          text={
            overhead
              ? `${formatLen(len)} · ${formatLen(base)}–${formatLen(top)}`
              : low
                ? `${formatLen(len)} · h ${formatLen(top)}`
                : formatLen(len)
          }
          scale={scale}
          color={selected ? C.accent : overhead ? C.wallOverhead : low ? C.wallLow : C.dim}
          size={10.5}
        />
      ) : null}
    </Group>
  )
}

/* ------------------------------------------------------------------ */
/* openings                                                            */
/* ------------------------------------------------------------------ */

export function OpeningShape({
  floor,
  opening,
  selected,
  scale,
  onDown,
}: {
  floor: Floor
  opening: Opening
  selected: boolean
  scale: number
  onDown: (e: KonvaEventObject<MouseEvent>) => void
}) {
  const wall = floor.walls.find((w) => w.id === opening.wallId)
  if (!wall) return null
  const e = wallEnds(floor, wall)
  if (!e) return null
  const ang = angleOf(e.a, e.b)
  const cx = e.a.x + Math.cos(ang) * opening.offset
  const cy = e.a.y + Math.sin(ang) * opening.offset
  const t = wall.thickness
  const color = selected ? C.accent : opening.kind === 'door' ? C.door : C.window
  const w = opening.width
  const dir = opening.flipHinge ? -1 : 1
  const side = opening.flipSide ? -1 : 1

  return (
    <Group x={cx} y={cy} rotation={(ang * 180) / Math.PI}>
      {/* punch the hole in the wall */}
      <Rect x={-w / 2} y={-t / 2 - 0.005} width={w} height={t + 0.01} fill={C.bg} />
      <Rect
        x={-w / 2}
        y={-t / 2}
        width={w}
        height={t}
        stroke={color}
        strokeWidth={1.5}
        strokeScaleEnabled={false}
        fill="rgba(0,0,0,0.001)"
        onMouseDown={onDown}
        onTouchStart={onDown as unknown as (e: KonvaEventObject<TouchEvent>) => void}
      />
      {opening.kind === 'door' ? (
        <>
          <Line
            points={[(dir * w) / 2, 0, (dir * w) / 2, side * w]}
            stroke={color}
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            listening={false}
          />
          <Arc
            x={(dir * w) / 2}
            y={0}
            innerRadius={w}
            outerRadius={w}
            angle={90}
            rotation={side > 0 ? (dir > 0 ? 90 : 0) : dir > 0 ? 180 : 270}
            stroke={color}
            strokeWidth={1}
            dash={[0.1, 0.08]}
            strokeScaleEnabled={false}
            listening={false}
          />
        </>
      ) : (
        <>
          <Line
            points={[-w / 2, -t / 6, w / 2, -t / 6]}
            stroke={color}
            strokeWidth={1.2}
            strokeScaleEnabled={false}
            listening={false}
          />
          <Line
            points={[-w / 2, t / 6, w / 2, t / 6]}
            stroke={color}
            strokeWidth={1.2}
            strokeScaleEnabled={false}
            listening={false}
          />
        </>
      )}
      <Label x={0} y={-t / 2 - 0.16} text={formatLen(w)} scale={scale} color={color} size={9.5} />
    </Group>
  )
}

/* ------------------------------------------------------------------ */
/* furniture                                                           */
/* ------------------------------------------------------------------ */

export function ItemShape({
  item,
  selected,
  scale,
  showLabel,
  onDown,
  onRotateDown,
}: {
  item: Item
  selected: boolean
  scale: number
  showLabel: boolean
  onDown: (e: KonvaEventObject<MouseEvent>) => void
  onRotateDown?: (e: KonvaEventObject<MouseEvent>) => void
}) {
  const def = catalogItem(item.kind)
  const color = selected ? C.accent : C.item
  const gx = (v: number) => -item.w / 2 + v * item.w
  const gy = (v: number) => -item.d / 2 + v * item.d

  return (
    <Group x={item.x} y={item.y} rotation={(item.rot * 180) / Math.PI}>
      <Rect
        x={-item.w / 2}
        y={-item.d / 2}
        width={item.w}
        height={item.d}
        fill={selected ? 'rgba(79,140,255,0.18)' : C.itemFill}
        stroke={color}
        strokeWidth={selected ? 2 : 1.2}
        strokeScaleEnabled={false}
        cornerRadius={0.02}
        onMouseDown={onDown}
        onTouchStart={onDown as unknown as (e: KonvaEventObject<TouchEvent>) => void}
      />
      {def.glyph.map((g, i) => {
        if (g.type === 'rect')
          return (
            <Rect
              key={i}
              x={gx(g.x)}
              y={gy(g.y)}
              width={g.w * item.w}
              height={g.h * item.d}
              stroke={color}
              strokeWidth={1}
              strokeScaleEnabled={false}
              cornerRadius={(g.radius ?? 0) * Math.min(item.w, item.d) * 0.5}
              listening={false}
            />
          )
        if (g.type === 'circle')
          return (
            <Circle
              key={i}
              x={gx(g.x)}
              y={gy(g.y)}
              radius={g.r * Math.min(item.w, item.d)}
              stroke={color}
              strokeWidth={1}
              strokeScaleEnabled={false}
              listening={false}
            />
          )
        return (
          <Line
            key={i}
            points={g.points.map((v, idx) => (idx % 2 === 0 ? gx(v) : gy(v)))}
            stroke={color}
            strokeWidth={1}
            strokeScaleEnabled={false}
            listening={false}
          />
        )
      })}
      {showLabel ? (
        <Label
          x={0}
          y={item.d / 2 + 0.16}
          text={`${item.name} · ${item.w.toFixed(2)}×${item.d.toFixed(2)}`}
          scale={scale}
          color={selected ? C.accent : C.dim}
          size={9.5}
        />
      ) : null}
      {selected && onRotateDown ? (
        <Group>
          <Line
            points={[0, -item.d / 2, 0, -item.d / 2 - 26 / scale]}
            stroke={C.accent}
            strokeWidth={1}
            strokeScaleEnabled={false}
            listening={false}
          />
          <Circle
            x={0}
            y={-item.d / 2 - 26 / scale}
            radius={5 / scale}
            fill={C.accent}
            onMouseDown={onRotateDown}
            onTouchStart={onRotateDown as unknown as (e: KonvaEventObject<TouchEvent>) => void}
          />
        </Group>
      ) : null}
    </Group>
  )
}

/* ------------------------------------------------------------------ */
/* resize grips                                                        */
/* ------------------------------------------------------------------ */

const HANDLES: [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
]

const CURSORS: Record<string, string> = {
  '-1,-1': 'nwse-resize',
  '1,1': 'nwse-resize',
  '1,-1': 'nesw-resize',
  '-1,1': 'nesw-resize',
  '0,-1': 'ns-resize',
  '0,1': 'ns-resize',
  '-1,0': 'ew-resize',
  '1,0': 'ew-resize',
}

/** The usual eight grips around a box, drawn at a constant on-screen size. */
export function ResizeHandles({
  hw,
  hd,
  scale,
  onDown,
}: {
  hw: number
  hd: number
  scale: number
  onDown: (sx: number, sy: number) => (e: KonvaEventObject<MouseEvent>) => void
}) {
  const s = 8 / scale
  return (
    <Group>
      {HANDLES.map(([sx, sy]) => (
        <Rect
          key={`${sx},${sy}`}
          x={sx * hw - s / 2}
          y={sy * hd - s / 2}
          width={s}
          height={s}
          fill="#0e121a"
          stroke={C.accent}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          cornerRadius={s * 0.2}
          onMouseDown={onDown(sx, sy)}
          onTouchStart={onDown(sx, sy) as unknown as (e: KonvaEventObject<TouchEvent>) => void}
          onMouseEnter={(e) => {
            const c = e.target.getStage()?.container()
            if (c) c.style.cursor = CURSORS[`${sx},${sy}`]
          }}
          onMouseLeave={(e) => {
            const c = e.target.getStage()?.container()
            if (c) c.style.cursor = ''
          }}
        />
      ))}
    </Group>
  )
}

/**
 * Grips for whatever is selected, drawn on top of everything else so a wall or
 * a neighbouring item can never swallow the click.
 */
export function SelectionGrips({
  floor,
  selection,
  scale,
  onItemResize,
  onRoomResize,
  onColumnResize,
}: {
  floor: Floor
  selection: Selection | null
  scale: number
  onItemResize: (id: string) => (sx: number, sy: number) => (e: KonvaEventObject<MouseEvent>) => void
  onRoomResize: (id: string) => (sx: number, sy: number) => (e: KonvaEventObject<MouseEvent>) => void
  onColumnResize: (id: string) => (sx: number, sy: number) => (e: KonvaEventObject<MouseEvent>) => void
}) {
  if (!selection) return null

  if (selection.kind === 'item') {
    const item = floor.items.find((i) => i.id === selection.id)
    if (!item) return null
    return (
      <Group x={item.x} y={item.y} rotation={(item.rot * 180) / Math.PI}>
        <ResizeHandles hw={item.w / 2} hd={item.d / 2} scale={scale} onDown={onItemResize(item.id)} />
      </Group>
    )
  }

  if (selection.kind === 'column') {
    const column = (floor.columns ?? []).find((c) => c.id === selection.id)
    if (!column) return null
    return (
      <Group x={column.x} y={column.y} rotation={(column.rot * 180) / Math.PI}>
        <ResizeHandles hw={column.w / 2} hd={column.d / 2} scale={scale} onDown={onColumnResize(column.id)} />
      </Group>
    )
  }

  if (selection.kind === 'room') {
    const room = floor.rooms.find((r) => r.id === selection.id)
    if (!room) return null
    const pts = roomPoints(floor, room)
    if (pts.length < 3) return null
    const b = polygonBounds(pts)
    return (
      <Group x={(b.minX + b.maxX) / 2} y={(b.minY + b.maxY) / 2}>
        <ResizeHandles hw={(b.maxX - b.minX) / 2} hd={(b.maxY - b.minY) / 2} scale={scale} onDown={onRoomResize(room.id)} />
      </Group>
    )
  }

  return null
}

/* ------------------------------------------------------------------ */
/* columns                                                             */
/* ------------------------------------------------------------------ */

export function ColumnShape({
  floor,
  column,
  selected,
  scale,
  showLabel,
  onDown,
}: {
  floor: Floor
  column: Column
  selected: boolean
  scale: number
  showLabel: boolean
  onDown: (e: KonvaEventObject<MouseEvent>) => void
}) {
  const color = selected ? C.accent : C.column
  const top = columnTopOf(floor, column)
  const grounded = column.base < 1e-6
  const r = Math.max(column.w, column.d) / 2
  const label = grounded
    ? `${Math.round(column.w * 100)}×${Math.round(column.d * 100)}`
    : `${formatLen(column.base)}–${formatLen(top)}`

  return (
    <Group x={column.x} y={column.y} rotation={(column.rot * 180) / Math.PI}>
      {column.shape === 'round' ? (
        <Circle
          radius={r}
          fill={grounded ? 'rgba(213,219,230,0.35)' : 'rgba(201,168,106,0.25)'}
          stroke={color}
          strokeWidth={selected ? 2 : 1.4}
          strokeScaleEnabled={false}
          dash={grounded ? undefined : [6, 5]}
          onMouseDown={onDown}
          onTouchStart={onDown as unknown as (e: KonvaEventObject<TouchEvent>) => void}
        />
      ) : (
        <Rect
          x={-column.w / 2}
          y={-column.d / 2}
          width={column.w}
          height={column.d}
          fill={grounded ? 'rgba(213,219,230,0.35)' : 'rgba(201,168,106,0.25)'}
          stroke={color}
          strokeWidth={selected ? 2 : 1.4}
          strokeScaleEnabled={false}
          dash={grounded ? undefined : [6, 5]}
          onMouseDown={onDown}
          onTouchStart={onDown as unknown as (e: KonvaEventObject<TouchEvent>) => void}
        />
      )}
      {/* the usual structural cross-hatch */}
      <Line
        points={[-column.w / 2, -column.d / 2, column.w / 2, column.d / 2]}
        stroke={color}
        strokeWidth={1}
        strokeScaleEnabled={false}
        listening={false}
      />
      <Line
        points={[-column.w / 2, column.d / 2, column.w / 2, -column.d / 2]}
        stroke={color}
        strokeWidth={1}
        strokeScaleEnabled={false}
        listening={false}
      />
      {showLabel ? (
        <Label
          x={0}
          y={Math.max(column.d, column.w) / 2 + 0.16}
          text={label}
          scale={scale}
          color={selected ? C.accent : grounded ? C.dim : C.wallOverhead}
          size={9.5}
        />
      ) : null}
    </Group>
  )
}

export function ColumnGhost({ at, floor, snapWalls }: { at: { x: number; y: number }; floor?: Floor; snapWalls?: boolean }) {
  const size = 0.3
  const placed =
    snapWalls && floor ? (snapToWallFace(floor, { ...at, w: size, d: size, rot: 0 }) ?? { ...at, rot: 0 }) : { ...at, rot: 0 }
  return (
    <Group listening={false} x={placed.x} y={placed.y} rotation={(placed.rot * 180) / Math.PI} opacity={0.7}>
      <Rect
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        fill="rgba(79,140,255,0.25)"
        stroke={C.accent}
        strokeWidth={1.5}
        strokeScaleEnabled={false}
      />
    </Group>
  )
}

/* ------------------------------------------------------------------ */
/* measures + corners                                                  */
/* ------------------------------------------------------------------ */

export function MeasureShape({
  m,
  selected,
  scale,
  onDown,
  onEndDown,
}: {
  m: Measure
  selected: boolean
  scale: number
  onDown: (e: KonvaEventObject<MouseEvent>) => void
  onEndDown: (end: 'a' | 'b') => (e: KonvaEventObject<MouseEvent>) => void
}) {
  const a = { x: m.ax, y: m.ay }
  const b = { x: m.bx, y: m.by }
  const len = dist(a, b)
  const ang = (angleOf(a, b) * 180) / Math.PI
  const flip = ang > 90 || ang < -90
  return (
    <Group>
      <Line
        points={[m.ax, m.ay, m.bx, m.by]}
        stroke={selected ? C.accent : C.measure}
        strokeWidth={1.5}
        dash={[0.16, 0.1]}
        strokeScaleEnabled={false}
        hitStrokeWidth={12 / scale}
        onMouseDown={onDown}
      />
      {(['a', 'b'] as const).map((end) => (
        <Circle
          key={end}
          x={end === 'a' ? m.ax : m.bx}
          y={end === 'a' ? m.ay : m.by}
          radius={4.5 / scale}
          fill={C.measure}
          onMouseDown={onEndDown(end)}
        />
      ))}
      <Label
        x={(m.ax + m.bx) / 2}
        y={(m.ay + m.by) / 2 - 0.16}
        rotation={flip ? ang + 180 : ang}
        text={formatLen(len)}
        scale={scale}
        color={C.measure}
        size={11}
        bold
        bg="rgba(14,18,26,0.85)"
      />
    </Group>
  )
}

export function CornerHandles({
  floor,
  selection,
  scale,
  onDown,
}: {
  floor: Floor
  selection: Selection | null
  scale: number
  onDown: (id: string) => (e: KonvaEventObject<MouseEvent>) => void
}) {
  return (
    <Group>
      {floor.points.map((p) => (
        <Circle
          key={p.id}
          x={p.x}
          y={p.y}
          radius={(isSel(selection, 'point', p.id) ? 6 : 4) / scale}
          fill={isSel(selection, 'point', p.id) ? C.accent : '#0e121a'}
          stroke={C.wall}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          onMouseDown={onDown(p.id)}
          onTouchStart={onDown(p.id) as unknown as (e: KonvaEventObject<TouchEvent>) => void}
        />
      ))}
    </Group>
  )
}

/* ------------------------------------------------------------------ */
/* drafts / ghosts                                                     */
/* ------------------------------------------------------------------ */

export function RectDraft({ a, b, scale }: { a: { x: number; y: number }; b: { x: number; y: number }; scale: number }) {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const w = Math.abs(b.x - a.x)
  const h = Math.abs(b.y - a.y)
  return (
    <Group listening={false}>
      <Rect x={x} y={y} width={w} height={h} fill="rgba(79,140,255,0.12)" stroke={C.accent} strokeWidth={1.5} strokeScaleEnabled={false} dash={[0.2, 0.12]} />
      <Label x={x + w / 2} y={y - 0.2} text={`${w.toFixed(2)} m`} scale={scale} color={C.accent} size={11} bold bg="rgba(14,18,26,0.85)" />
      <Label x={x - 0.25} y={y + h / 2} rotation={-90} text={`${h.toFixed(2)} m`} scale={scale} color={C.accent} size={11} bold bg="rgba(14,18,26,0.85)" />
      <Label x={x + w / 2} y={y + h / 2} text={formatArea(w * h)} scale={scale} color="#cfd8ea" size={11} />
    </Group>
  )
}

export function PathDraft({
  pts,
  cursor,
  closed,
  scale,
  thickness,
}: {
  pts: { x: number; y: number }[]
  cursor: { x: number; y: number } | null
  closed: boolean
  scale: number
  thickness: number
}) {
  const all = cursor ? [...pts, cursor] : pts
  if (!all.length) return null
  const flat = all.flatMap((p) => [p.x, p.y])
  const last = all[all.length - 1]
  const prev = all[all.length - 2]
  return (
    <Group listening={false}>
      <Line points={flat} closed={closed} stroke={C.ghost} strokeWidth={thickness} lineCap="butt" />
      <Line points={flat} closed={closed} stroke={C.accent} strokeWidth={1.5} strokeScaleEnabled={false} />
      {all.map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={4 / scale} fill={C.accent} />
      ))}
      {prev && last ? (
        <Label
          x={(prev.x + last.x) / 2}
          y={(prev.y + last.y) / 2 - 0.22}
          text={formatLen(dist(prev, last))}
          scale={scale}
          color={C.accent}
          size={11}
          bold
          bg="rgba(14,18,26,0.85)"
        />
      ) : null}
      {closed && all.length > 2 ? (
        <Label
          x={polygonCentroid(all).x}
          y={polygonCentroid(all).y}
          text={formatArea(polygonArea(all))}
          scale={scale}
          color="#cfd8ea"
          size={11}
          bg="rgba(14,18,26,0.85)"
        />
      ) : null}
    </Group>
  )
}

/** Preview of a Shift-drag extrusion: the slab of wall you are about to pull out. */
export function ExtrudeDraft({
  a,
  b,
  n,
  offset,
  scale,
}: {
  a: { x: number; y: number }
  b: { x: number; y: number }
  n: { x: number; y: number }
  offset: number
  scale: number
}) {
  const a2 = { x: a.x + n.x * offset, y: a.y + n.y * offset }
  const b2 = { x: b.x + n.x * offset, y: b.y + n.y * offset }
  return (
    <Group listening={false}>
      <Line
        points={[a.x, a.y, a2.x, a2.y, b2.x, b2.y, b.x, b.y]}
        closed
        fill="rgba(79,140,255,0.18)"
        stroke={C.accent}
        strokeWidth={1.5}
        strokeScaleEnabled={false}
        dash={[8, 6]}
      />
      <Label
        x={(a2.x + b2.x) / 2}
        y={(a2.y + b2.y) / 2}
        text={`${offset >= 0 ? 'out' : 'in'} ${formatLen(Math.abs(offset))}`}
        scale={scale}
        color={C.accent}
        size={11}
        bold
        bg="rgba(14,18,26,0.85)"
      />
    </Group>
  )
}

export function ItemGhost({
  kind,
  at,
  floor,
  snapWalls,
}: {
  kind: string
  at: { x: number; y: number }
  floor?: Floor
  snapWalls?: boolean
}) {
  const def = catalogItem(kind)
  const placed =
    snapWalls && floor
      ? (snapToWallFace(floor, { x: at.x, y: at.y, w: def.w, d: def.d, rot: 0 }) ?? { ...at, rot: 0 })
      : { ...at, rot: 0 }
  return (
    <Group listening={false} x={placed.x} y={placed.y} rotation={(placed.rot * 180) / Math.PI} opacity={0.6}>
      <Rect
        x={-def.w / 2}
        y={-def.d / 2}
        width={def.w}
        height={def.d}
        fill="rgba(79,140,255,0.15)"
        stroke={C.accent}
        strokeWidth={1.5}
        strokeScaleEnabled={false}
        dash={[0.14, 0.1]}
      />
    </Group>
  )
}

export function OpeningGhost({
  floor,
  wallId,
  offset,
  kind,
}: {
  floor: Floor
  wallId: string
  offset: number
  kind: 'door' | 'window'
}) {
  const wall = floor.walls.find((w) => w.id === wallId)
  if (!wall) return null
  const e = wallEnds(floor, wall, pointMap(floor))
  if (!e) return null
  const ang = angleOf(e.a, e.b)
  const w = kind === 'door' ? 0.8 : 1.2
  return (
    <Group
      listening={false}
      x={e.a.x + Math.cos(ang) * offset}
      y={e.a.y + Math.sin(ang) * offset}
      rotation={(ang * 180) / Math.PI}
    >
      <Rect
        x={-w / 2}
        y={-wall.thickness / 2 - 0.01}
        width={w}
        height={wall.thickness + 0.02}
        fill="rgba(79,140,255,0.35)"
        stroke={C.accent}
        strokeWidth={1.5}
        strokeScaleEnabled={false}
      />
    </Group>
  )
}
