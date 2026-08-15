import { Arc, Circle, Group, Line, Rect, Shape, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Column, Floor, Item, Measure, Opening, Room, Selection, Site, Wall } from '../../types'
import { catalogItem } from '../../lib/catalog'
import { isStair, stairLayout } from '../../lib/stairs'
import {
  angleOf,
  dist,
  itemOutlineLocal,
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
  roomPoints,
  wallEnds,
  wallFaces,
  wallOutline,
} from '../../lib/geometry'
import type { Basis } from '../../lib/measure'
import { roomAreaOn, roomBoundsOn, roomOutline, wallLengthOn } from '../../lib/measure'

export const C = {
  wall: '#c9d2e2',
  wallLow: '#8ba0c4',
  wallOverhead: '#c9a86a',
  fence: '#a4855e',
  hedge: '#5d8a55',
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
/* the plot                                                            */
/* ------------------------------------------------------------------ */

const GROUND_2D: Record<string, string> = {
  grass: 'rgba(74,107,63,0.18)',
  gravel: 'rgba(111,106,98,0.18)',
  sand: 'rgba(179,156,116,0.16)',
  paving: 'rgba(110,114,124,0.18)',
  earth: 'rgba(107,86,68,0.18)',
}

export function SiteShape({
  site,
  scale,
  selected,
  onDown,
  onCornerDown,
  onCornerDblClick,
  onEdgeDblClick,
}: {
  site: Site
  scale: number
  selected?: boolean
  onDown?: (e: KonvaEventObject<MouseEvent>) => void
  onCornerDown?: (index: number) => (e: KonvaEventObject<MouseEvent>) => void
  onCornerDblClick?: (index: number) => (e: KonvaEventObject<MouseEvent>) => void
  onEdgeDblClick?: (e: KonvaEventObject<MouseEvent>) => void
}) {
  const pts = site.outline
  if (pts.length < 3) return null
  const flat = pts.flatMap((p) => [p.x, p.y])
  const b = polygonBounds(pts)
  const area = polygonArea(pts)

  return (
    <Group>
      <Line
        points={flat}
        closed
        fill={GROUND_2D[site.ground] ?? GROUND_2D.grass}
        stroke={selected ? C.accent : '#6d8a5e'}
        strokeWidth={selected ? 2.5 : 2}
        strokeScaleEnabled={false}
        dash={[10, 6]}
        hitStrokeWidth={14 / scale}
        onMouseDown={onDown}
        onDblClick={onEdgeDblClick}
        onTouchStart={onDown as unknown as (e: KonvaEventObject<TouchEvent>) => void}
      />
      <Label
        x={(b.minX + b.maxX) / 2}
        y={b.minY - 0.3}
        text={`${site.name} · ${formatArea(area)} · ${pts.length} corners`}
        scale={scale}
        color={selected ? C.accent : '#8fae7d'}
        size={11}
        bold
      />
      {onCornerDown
        ? pts.map((p, i) => (
            <Rect
              key={i}
              x={p.x - 5 / scale}
              y={p.y - 5 / scale}
              width={10 / scale}
              height={10 / scale}
              fill="#0e121a"
              stroke={selected ? C.accent : '#7ea86a'}
              strokeWidth={1.6}
              strokeScaleEnabled={false}
              cornerRadius={1.5 / scale}
              onMouseDown={onCornerDown(i)}
              onDblClick={onCornerDblClick?.(i)}
              onTouchStart={onCornerDown(i) as unknown as (e: KonvaEventObject<TouchEvent>) => void}
            />
          ))
        : null}
    </Group>
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
  basis,
  onDown,
  onDblClick,
}: {
  floor: Floor
  room: Room
  selected: boolean
  scale: number
  showDims: boolean
  basis: Basis
  onDown: (e: KonvaEventObject<MouseEvent>) => void
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void
}) {
  const pts = roomPoints(floor, room)
  if (pts.length < 3) return null
  const flat = pts.flatMap((p) => [p.x, p.y])
  const c = polygonCentroid(pts)
  const area = roomAreaOn(floor, room, basis)
  // the line the figures are actually taken along, so you can see what is measured
  const face = basis === 'centre' ? null : roomOutline(floor, room, basis).flatMap((p) => [p.x, p.y])
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
        onDblClick={onDblClick}
        onTouchStart={onDown as unknown as (e: KonvaEventObject<TouchEvent>) => void}
      />
      {selected && face ? (
        <Line
          points={face}
          closed
          stroke={C.accent}
          strokeWidth={1}
          dash={[0.16, 0.12]}
          strokeScaleEnabled={false}
          listening={false}
        />
      ) : null}
      {showDims ? (
        <>
          <Label x={c.x} y={c.y - 0.16} text={room.name} scale={scale} color="#e3e8f2" size={12} bold />
          <Label
            x={c.x}
            y={c.y + 0.16}
            text={room.ceiling === false ? `${formatArea(area)} · open to the sky` : formatArea(area)}
            scale={scale}
            color={C.dim}
            size={11}
          />
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
  basis,
  onDown,
  onDblClick,
  onEditFace,
}: {
  floor: Floor
  wall: Wall
  selected: boolean
  hovered: boolean
  scale: number
  showDims: boolean
  basis: Basis
  onDown: (e: KonvaEventObject<MouseEvent>) => void
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void
  onEditFace?: (face: 'left' | 'right') => (e: KonvaEventObject<MouseEvent>) => void
}) {
  const e = wallEnds(floor, wall)
  if (!e) return null
  const span = dist(e.a, e.b)
  const len = wallLengthOn(floor, wall, basis)
  const base = wallBaseOf(wall)
  const top = wallTopOf(floor, wall)
  const overhead = base > 1e-6
  const low = !overhead && top < floor.height - 1e-6
  const style = wall.style ?? 'solid'
  const open = style !== 'solid'
  const ang = angleOf(e.a, e.b)
  const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 }
  const deg = (ang * 180) / Math.PI
  const flip = deg > 90 || deg < -90
  const off = wall.thickness / 2 + 0.14
  const nx = Math.sin(ang) * (flip ? off : -off)
  const ny = -Math.cos(ang) * (flip ? off : -off)
  // the wall as it is really built: mitred into whatever it runs into
  const outline = open ? [] : wallOutline(floor, wall)
  const faces = wallFaces(floor, wall)
  const color = selected
    ? C.wallSelected
    : hovered
      ? C.wallHover
      : style === 'hedge'
        ? C.hedge
        : open
          ? C.fence
          : overhead
            ? C.wallOverhead
            : low
              ? C.wallLow
              : C.wall

  return (
    <Group>
      {outline.length === 4 ? (
        <Line
          points={outline.flatMap((p) => [p.x, p.y])}
          closed
          fill={overhead || low ? `${color}55` : color}
          stroke={overhead || low ? color : undefined}
          strokeWidth={1}
          strokeScaleEnabled={false}
          dash={overhead ? [4, 5] : low ? [10, 6] : undefined}
          hitStrokeWidth={Math.max(wall.thickness, 14 / scale)}
          onMouseDown={onDown}
          onDblClick={onDblClick}
          onTouchStart={onDown as unknown as (e: KonvaEventObject<TouchEvent>) => void}
        />
      ) : (
        <Line
          points={[e.a.x, e.a.y, e.b.x, e.b.y]}
          stroke={color}
          strokeWidth={Math.max(wall.thickness, open ? 0.06 : 0)}
          lineCap="butt"
          dash={style === 'fence' ? [0.28, 0.14] : style === 'railing' ? [0.14, 0.1] : undefined}
          hitStrokeWidth={Math.max(wall.thickness, 14 / scale)}
          onMouseDown={onDown}
          onDblClick={onDblClick}
          onTouchStart={onDown as unknown as (e: KonvaEventObject<TouchEvent>) => void}
        />
      )}
      {selected && faces && onEditFace ? (
        <>
          <FaceDimension from={faces.left[0]} to={faces.left[1]} scale={scale} onClick={onEditFace('left')} />
          <FaceDimension from={faces.right[0]} to={faces.right[1]} scale={scale} flip onClick={onEditFace('right')} />
        </>
      ) : showDims && span > 0.35 ? (
        <Label
          x={mid.x + nx}
          y={mid.y + ny}
          rotation={flip ? deg + 180 : deg}
          text={
            open
              ? `${formatLen(len)} · ${style} ${formatLen(top)}`
              : overhead
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

/**
 * A dimension line run along one face of a wall, from corner to corner, with
 * witness lines back to the face itself — so the inside and the outside of the
 * same wall each get their own figure.
 */
function FaceDimension({
  from,
  to,
  scale,
  flip,
  onClick,
}: {
  from: { x: number; y: number }
  to: { x: number; y: number }
  scale: number
  flip?: boolean
  onClick?: (e: KonvaEventObject<MouseEvent>) => void
}) {
  const len = dist(from, to)
  if (len < 1e-3) return null
  const ang = angleOf(from, to)
  const s = flip ? -1 : 1
  // outwards, away from the body of the wall
  const n = { x: -Math.sin(ang) * s, y: Math.cos(ang) * s }
  const gap = 20 / scale
  const tick = 5 / scale
  const at = (p: { x: number; y: number }, d: number) => ({ x: p.x + n.x * d, y: p.y + n.y * d })
  const p0 = at(from, gap)
  const p1 = at(to, gap)
  const deg = (ang * 180) / Math.PI
  const upside = deg > 90 || deg < -90
  const line = (points: number[]) => (
    <Line points={points} stroke={C.accent} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
  )
  const witness = (p: { x: number; y: number }) => {
    const a = at(p, gap * 0.2)
    const b = at(p, gap + tick)
    return line([a.x, a.y, b.x, b.y])
  }
  return (
    <Group>
      {line([p0.x, p0.y, p1.x, p1.y])}
      {witness(from)}
      {witness(to)}
      <DimLabel
        x={(p0.x + p1.x) / 2}
        y={(p0.y + p1.y) / 2}
        rotation={upside ? deg + 180 : deg}
        text={formatLen(len)}
        scale={scale}
        onClick={onClick}
      />
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
      {opening.kind === 'door' && opening.doorType === 'open' ? (
        <>
          {/* a cased opening: jambs only, nothing swinging */}
          <Line points={[-w / 2, -t / 2, -w / 2, t / 2]} stroke={color} strokeWidth={2} strokeScaleEnabled={false} listening={false} />
          <Line points={[w / 2, -t / 2, w / 2, t / 2]} stroke={color} strokeWidth={2} strokeScaleEnabled={false} listening={false} />
        </>
      ) : opening.kind === 'door' && opening.doorType === 'sliding' ? (
        <>
          {/* the leaf parked alongside the opening, with its travel */}
          <Rect
            x={(dir * w) / 2 - (dir > 0 ? 0 : w)}
            y={side * (t / 2 + 0.02)}
            width={w}
            height={0.05}
            fill={color}
            opacity={0.7}
            listening={false}
          />
          <Line
            points={[(-dir * w) / 2, side * (t / 2 + 0.14), (dir * w) / 2, side * (t / 2 + 0.14)]}
            stroke={color}
            strokeWidth={1}
            strokeScaleEnabled={false}
            listening={false}
          />
          <Line
            points={[
              (dir * w) / 2 - dir * 0.1,
              side * (t / 2 + 0.14) - 0.06,
              (dir * w) / 2,
              side * (t / 2 + 0.14),
              (dir * w) / 2 - dir * 0.1,
              side * (t / 2 + 0.14) + 0.06,
            ]}
            stroke={color}
            strokeWidth={1}
            strokeScaleEnabled={false}
            listening={false}
          />
        </>
      ) : opening.kind === 'door' ? (
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
  // stairs draw their real treads, whatever size and shape they are
  const stair = isStair(item.kind) ? stairLayout(item.kind, item) : null
  // anything up at head height is drawn dotted, like a beam
  const overhead = item.z >= 1.8

  return (
    <Group x={item.x} y={item.y} rotation={(item.rot * 180) / Math.PI}>
      {item.notch && item.notch.depth > 0.01 ? (
        <Line
          points={itemOutlineLocal(item).flatMap((p) => [p.x, p.y])}
          closed
          fill={selected ? 'rgba(79,140,255,0.18)' : overhead ? 'rgba(201,168,106,0.12)' : C.itemFill}
          stroke={selected ? color : overhead ? C.wallOverhead : color}
          strokeWidth={selected ? 2 : 1.2}
          strokeScaleEnabled={false}
          dash={overhead ? [0.12, 0.1] : undefined}
          onMouseDown={onDown}
          onTouchStart={onDown as unknown as (e: KonvaEventObject<TouchEvent>) => void}
        />
      ) : (
        <Rect
          x={-item.w / 2}
          y={-item.d / 2}
          width={item.w}
          height={item.d}
          fill={selected ? 'rgba(79,140,255,0.18)' : overhead ? 'rgba(201,168,106,0.12)' : C.itemFill}
          stroke={selected ? color : overhead ? C.wallOverhead : color}
          strokeWidth={selected ? 2 : 1.2}
          strokeScaleEnabled={false}
          dash={overhead ? [0.12, 0.1] : undefined}
          cornerRadius={0.02}
          onMouseDown={onDown}
          onTouchStart={onDown as unknown as (e: KonvaEventObject<TouchEvent>) => void}
        />
      )}
      {stair
        ? [
            ...stair.steps.map((st, i) => {
              const c = Math.cos(st.rot)
              const si = Math.sin(st.rot)
              const hx = (-si * st.width) / 2
              const hz = (c * st.width) / 2
              return (
                <Line
                  key={`s${i}`}
                  points={[st.x - hx, st.z - hz, st.x + hx, st.z + hz]}
                  stroke={color}
                  strokeWidth={1}
                  strokeScaleEnabled={false}
                  listening={false}
                />
              )
            }),
            <Line
              key="travel"
              points={stair.steps.flatMap((st) => [st.x, st.z])}
              stroke={color}
              strokeWidth={1.4}
              strokeScaleEnabled={false}
              listening={false}
            />,
            (() => {
              const last = stair.steps[stair.steps.length - 1]
              const c = Math.cos(last.rot)
              const si = Math.sin(last.rot)
              const tip = { x: last.x + c * last.going, y: last.z + si * last.going }
              return (
                <Line
                  key="arrow"
                  points={[
                    tip.x - c * 0.18 - si * 0.12,
                    tip.y - si * 0.18 + c * 0.12,
                    tip.x,
                    tip.y,
                    tip.x - c * 0.18 + si * 0.12,
                    tip.y - si * 0.18 - c * 0.12,
                  ]}
                  stroke={color}
                  strokeWidth={1.4}
                  strokeScaleEnabled={false}
                  listening={false}
                />
              )
            })(),
          ]
        : def.glyph.map((g, i) => {
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
          text={
            overhead
              ? `${item.name} · ${item.w.toFixed(2)}×${item.d.toFixed(2)} · ${formatLen(item.z)}–${formatLen(item.z + item.h)}`
              : `${item.name} · ${item.w.toFixed(2)}×${item.d.toFixed(2)}`
          }
          scale={scale}
          color={selected ? C.accent : overhead ? C.wallOverhead : C.dim}
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

/** A dimension label you can click to type an exact size. */
function DimLabel({
  x,
  y,
  text,
  scale,
  rotation = 0,
  onClick,
}: {
  x: number
  y: number
  text: string
  scale: number
  rotation?: number
  onClick?: (e: KonvaEventObject<MouseEvent>) => void
}) {
  const w = Math.max(34, text.length * 7 + 14)
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={1 / scale} scaleY={1 / scale}>
      <Rect
        x={-w / 2}
        y={-9}
        width={w}
        height={18}
        fill="#0e121aee"
        stroke={C.accent}
        strokeWidth={1}
        cornerRadius={4}
        onMouseDown={onClick}
        onMouseEnter={(e) => {
          const c = e.target.getStage()?.container()
          if (c) c.style.cursor = 'text'
        }}
        onMouseLeave={(e) => {
          const c = e.target.getStage()?.container()
          if (c) c.style.cursor = ''
        }}
      />
      <Text
        text={text}
        fontSize={11}
        fontFamily="Inter, system-ui, sans-serif"
        fill={C.accent}
        width={w}
        offsetX={w / 2}
        offsetY={5.5}
        align="center"
        listening={false}
      />
    </Group>
  )
}

/**
 * Dimension lines around the selection — width along the top, depth down the
 * left — with the figures editable in place.
 */
export function DimensionBox({
  hw,
  hd,
  scale,
  onEditW,
  onEditD,
}: {
  hw: number
  hd: number
  scale: number
  onEditW?: (e: KonvaEventObject<MouseEvent>) => void
  onEditD?: (e: KonvaEventObject<MouseEvent>) => void
}) {
  const off = 26 / scale
  const tick = 5 / scale
  const line = (points: number[]) => (
    <Line points={points} stroke={C.accent} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
  )
  return (
    <Group>
      {/* width */}
      {line([-hw, -hd - off, hw, -hd - off])}
      {line([-hw, -hd - off - tick, -hw, -hd + tick])}
      {line([hw, -hd - off - tick, hw, -hd + tick])}
      <DimLabel x={0} y={-hd - off} text={formatLen(hw * 2)} scale={scale} onClick={onEditW} />
      {/* depth */}
      {line([-hw - off, -hd, -hw - off, hd])}
      {line([-hw - off - tick, -hd, -hw + tick, -hd])}
      {line([-hw - off - tick, hd, -hw + tick, hd])}
      <DimLabel x={-hw - off} y={0} text={formatLen(hd * 2)} scale={scale} rotation={-90} onClick={onEditD} />
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
  basis,
  onItemResize,
  onRoomResize,
  onColumnResize,
  onEditSize,
}: {
  floor: Floor
  selection: Selection | null
  scale: number
  basis: Basis
  onItemResize: (id: string) => (sx: number, sy: number) => (e: KonvaEventObject<MouseEvent>) => void
  onRoomResize: (id: string) => (sx: number, sy: number) => (e: KonvaEventObject<MouseEvent>) => void
  onColumnResize: (id: string) => (sx: number, sy: number) => (e: KonvaEventObject<MouseEvent>) => void
  onEditSize?: (axis: 'w' | 'd') => (e: KonvaEventObject<MouseEvent>) => void
}) {
  if (!selection) return null

  if (selection.kind === 'item') {
    const item = floor.items.find((i) => i.id === selection.id)
    if (!item) return null
    return (
      <Group x={item.x} y={item.y} rotation={(item.rot * 180) / Math.PI}>
        <ResizeHandles hw={item.w / 2} hd={item.d / 2} scale={scale} onDown={onItemResize(item.id)} />
        <DimensionBox
          hw={item.w / 2}
          hd={item.d / 2}
          scale={scale}
          onEditW={onEditSize?.('w')}
          onEditD={onEditSize?.('d')}
        />
      </Group>
    )
  }

  if (selection.kind === 'column') {
    const column = (floor.columns ?? []).find((c) => c.id === selection.id)
    if (!column) return null
    return (
      <Group x={column.x} y={column.y} rotation={(column.rot * 180) / Math.PI}>
        <ResizeHandles hw={column.w / 2} hd={column.d / 2} scale={scale} onDown={onColumnResize(column.id)} />
        <DimensionBox
          hw={column.w / 2}
          hd={column.d / 2}
          scale={scale}
          onEditW={onEditSize?.('w')}
          onEditD={onEditSize?.('d')}
        />
      </Group>
    )
  }

  if (selection.kind === 'room') {
    const room = floor.rooms.find((r) => r.id === selection.id)
    if (!room) return null
    const pts = roomPoints(floor, room)
    if (pts.length < 3) return null
    const b = polygonBounds(pts)
    // handles drag the centrelines the model stores; the figures quote the measured faces
    const m = roomBoundsOn(floor, room, basis)
    return (
      <>
        <Group x={(b.minX + b.maxX) / 2} y={(b.minY + b.maxY) / 2}>
          <ResizeHandles hw={(b.maxX - b.minX) / 2} hd={(b.maxY - b.minY) / 2} scale={scale} onDown={onRoomResize(room.id)} />
        </Group>
        <Group x={(m.minX + m.maxX) / 2} y={(m.minY + m.maxY) / 2}>
          <DimensionBox
            hw={(m.maxX - m.minX) / 2}
            hd={(m.maxY - m.minY) / 2}
            scale={scale}
            onEditW={onEditSize?.('w')}
            onEditD={onEditSize?.('d')}
          />
        </Group>
      </>
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
  onDblClick,
}: {
  floor: Floor
  selection: Selection | null
  scale: number
  onDown: (id: string) => (e: KonvaEventObject<MouseEvent>) => void
  onDblClick?: (id: string) => (e: KonvaEventObject<MouseEvent>) => void
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
          onDblClick={onDblClick?.(p.id)}
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
