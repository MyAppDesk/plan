import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Layer, Line, Stage } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { ID, Selection } from '../../types'
import { useActiveFloor, useProject } from '../../store/useProject'
import { useCursor } from '../../store/useCursor'
import { on } from '../../lib/bus'
import {
  angleOf,
  clamp,
  dist,
  floorBounds,
  nearestPoint,
  nearestWall,
  pointMap,
  roomPoints,
  wallEnds,
  type Vec,
} from '../../lib/geometry'
import {
  C,
  CornerHandles,
  GridShape,
  ItemGhost,
  ItemShape,
  MeasureShape,
  OpeningGhost,
  OpeningShape,
  PathDraft,
  RectDraft,
  RoomShape,
  WallShape,
} from './planShapes'

type Drag =
  | { kind: 'pan'; startX: number; startY: number; viewX: number; viewY: number }
  | { kind: 'point'; id: ID }
  | { kind: 'wall'; id: ID; a: { id: ID; x: number; y: number }; b: { id: ID; x: number; y: number }; origin: Vec }
  | { kind: 'room'; id: ID; origin: Vec; applied: Vec }
  | { kind: 'item'; id: ID; grab: Vec }
  | { kind: 'rotate'; id: ID }
  | { kind: 'opening'; id: ID }
  | { kind: 'measure'; id: ID; end: 'a' | 'b' }
  | null

interface Guides {
  x?: number
  y?: number
}

export function PlanEditor({ hidden }: { hidden?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [view, setView] = useState({ x: 200, y: 140, scale: 60 })
  const [drag, setDrag] = useState<Drag>(null)
  const [cursor, setCursorPos] = useState<Vec>({ x: 0, y: 0 })
  const [guides, setGuides] = useState<Guides>({})
  const [rectDraft, setRectDraft] = useState<{ a: Vec; b: Vec } | null>(null)
  const [path, setPath] = useState<Vec[]>([])
  const [measureStart, setMeasureStart] = useState<Vec | null>(null)
  const [hoverWall, setHoverWall] = useState<{ id: ID; offset: number } | null>(null)
  const shiftRef = useRef(false)
  const spaceRef = useRef(false)

  const floor = useActiveFloor()
  const tool = useProject((s) => s.tool)
  const selection = useProject((s) => s.selection)
  const snap = useProject((s) => s.snap)
  const gridSize = useProject((s) => s.gridSize)
  const showGrid = useProject((s) => s.showGrid)
  const showDims = useProject((s) => s.showDims)
  const showFurniture = useProject((s) => s.showFurniture)
  const catalogKind = useProject((s) => s.catalogKind)
  const store = useProject

  /* ------------------------------------------------------------------ */
  /* sizing + fit                                                        */
  /* ------------------------------------------------------------------ */

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const fit = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const b = floorBounds(floor)
    const pad = 1.2
    const bw = b.maxX - b.minX + pad * 2
    const bh = b.maxY - b.minY + pad * 2
    const scale = clamp(Math.min(el.clientWidth / bw, el.clientHeight / bh), 6, 300)
    setView({
      scale,
      x: el.clientWidth / 2 - ((b.minX + b.maxX) / 2) * scale,
      y: el.clientHeight / 2 - ((b.minY + b.maxY) / 2) * scale,
    })
  }, [floor])

  useEffect(() => on('fit', fit), [fit])

  useEffect(
    () =>
      on('png', () => {
        const stage = stageRef.current
        if (!stage) return
        const url = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' })
        const a = document.createElement('a')
        a.href = url
        a.download = `${floor.name.replace(/\s+/g, '-').toLowerCase()}-plan.png`
        a.click()
      }),
    [floor.name],
  )
  // fit once on first mount
  const didFit = useRef(false)
  useEffect(() => {
    if (didFit.current || !size.w) return
    didFit.current = true
    fit()
  }, [fit, size.w])

  useEffect(() => {
    useCursor.getState().set({ scale: view.scale })
  }, [view.scale])

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */

  const toWorld = useCallback(
    (p: { x: number; y: number }): Vec => ({ x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale }),
    [view],
  )

  const px = useCallback((n: number) => n / view.scale, [view.scale])

  /** grid + corner + alignment snapping, plus ortho when Shift is held */
  const snapTo = useCallback(
    (w: Vec, opts: { exclude?: ID[]; from?: Vec | null } = {}): { p: Vec; guides: Guides } => {
      const g: Guides = {}
      let out = { ...w }

      const vertex = nearestPoint(floor, w, px(10), opts.exclude ?? [])
      if (vertex) return { p: { x: vertex.x, y: vertex.y }, guides: {} }

      if (opts.from && shiftRef.current) {
        if (Math.abs(w.x - opts.from.x) > Math.abs(w.y - opts.from.y)) out.y = opts.from.y
        else out.x = opts.from.x
      }

      // align with an existing corner on either axis
      const tol = px(7)
      for (const p of floor.points) {
        if (opts.exclude?.includes(p.id)) continue
        if (g.x === undefined && Math.abs(p.x - out.x) < tol) {
          out.x = p.x
          g.x = p.x
        }
        if (g.y === undefined && Math.abs(p.y - out.y) < tol) {
          out.y = p.y
          g.y = p.y
        }
      }

      if (snap) {
        if (g.x === undefined) out.x = Math.round(out.x / gridSize) * gridSize
        if (g.y === undefined) out.y = Math.round(out.y / gridSize) * gridSize
      }
      out = { x: Number(out.x.toFixed(4)), y: Number(out.y.toFixed(4)) }
      return { p: out, guides: g }
    },
    [floor, gridSize, px, snap],
  )

  const snapDelta = useCallback(
    (d: Vec): Vec =>
      snap ? { x: Math.round(d.x / gridSize) * gridSize, y: Math.round(d.y / gridSize) * gridSize } : d,
    [gridSize, snap],
  )

  /* ------------------------------------------------------------------ */
  /* keyboard                                                            */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftRef.current = true
      if (e.code === 'Space') spaceRef.current = true
      const editing = (e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)
      if (editing) return
      if (e.key === 'Escape') {
        setPath([])
        setRectDraft(null)
        setMeasureStart(null)
      }
      if (e.key === 'Enter' && path.length >= 2) {
        if (tool === 'poly' && path.length >= 3) store.getState().createPolyRoom(path)
        if (tool === 'wall') store.getState().createWallPath(path)
        setPath([])
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftRef.current = false
      if (e.code === 'Space') spaceRef.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [path, store, tool])

  useEffect(() => {
    setPath([])
    setRectDraft(null)
    setMeasureStart(null)
    setHoverWall(null)
  }, [tool])

  /* ------------------------------------------------------------------ */
  /* pointer handling                                                    */
  /* ------------------------------------------------------------------ */

  const pointer = (): Vec | null => {
    const stage = stageRef.current
    const p = stage?.getPointerPosition()
    return p ? toWorld(p) : null
  }

  const onStageDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = stageRef.current
    if (!stage) return
    const raw = stage.getPointerPosition()
    if (!raw) return
    const w = toWorld(raw)
    const evt = e.evt as MouseEvent
    const button = 'button' in evt ? evt.button : 0
    const onEmpty = e.target === stage

    if (button === 1 || spaceRef.current || (onEmpty && (tool === 'select' || tool === 'delete'))) {
      if (onEmpty && tool === 'select' && button === 0 && !spaceRef.current) store.getState().select(null)
      setDrag({ kind: 'pan', startX: raw.x, startY: raw.y, viewX: view.x, viewY: view.y })
      return
    }
    if (button !== 0) return

    const s = snapTo(w, { from: path.length ? path[path.length - 1] : null })

    switch (tool) {
      case 'room':
        setRectDraft({ a: s.p, b: s.p })
        break
      case 'poly':
      case 'wall': {
        if (tool === 'poly' && path.length >= 3 && dist(s.p, path[0]) < px(12)) {
          store.getState().createPolyRoom(path)
          setPath([])
          break
        }
        setPath((prev) => [...prev, s.p])
        break
      }
      case 'door':
      case 'window': {
        const near = nearestWall(floor, w, 0.8)
        if (near) store.getState().createOpening(near.wall.id, tool, near.t * near.length)
        break
      }
      case 'item':
        store.getState().createItem(catalogKind, s.p.x, s.p.y)
        break
      case 'measure': {
        if (!measureStart) setMeasureStart(s.p)
        else {
          store.getState().createMeasure(measureStart, s.p)
          setMeasureStart(null)
        }
        break
      }
    }
  }

  const onStageMove = () => {
    const stage = stageRef.current
    if (!stage) return
    const raw = stage.getPointerPosition()
    if (!raw) return
    const w = toWorld(raw)
    setCursorPos(w)
    useCursor.getState().set({ x: w.x, y: w.y })

    if (drag?.kind === 'pan') {
      setView((v) => ({ ...v, x: drag.viewX + (raw.x - drag.startX), y: drag.viewY + (raw.y - drag.startY) }))
      return
    }

    if (drag) {
      applyDrag(drag, w)
      return
    }

    if (tool === 'room' && rectDraft) {
      const s = snapTo(w, { from: rectDraft.a })
      setRectDraft({ a: rectDraft.a, b: s.p })
      setGuides(s.guides)
      return
    }
    if (tool === 'poly' || tool === 'wall' || tool === 'measure') {
      const s = snapTo(w, { from: path.length ? path[path.length - 1] : measureStart })
      setCursorPos(s.p)
      setGuides(s.guides)
      return
    }
    if (tool === 'door' || tool === 'window') {
      const near = nearestWall(floor, w, 0.8)
      setHoverWall(near ? { id: near.wall.id, offset: near.t * near.length } : null)
      return
    }
    setGuides({})
  }

  const applyDrag = (d: Drag, w: Vec) => {
    const st = store.getState()
    switch (d?.kind) {
      case 'point': {
        const s = snapTo(w, { exclude: [d.id] })
        setGuides(s.guides)
        st.movePoint(d.id, s.p.x, s.p.y)
        break
      }
      case 'wall': {
        const raw = { x: w.x - d.origin.x, y: w.y - d.origin.y }
        const delta = snapDelta(raw)
        st.movePoint(d.a.id, d.a.x + delta.x, d.a.y + delta.y)
        st.movePoint(d.b.id, d.b.x + delta.x, d.b.y + delta.y)
        break
      }
      case 'room': {
        const raw = { x: w.x - d.origin.x, y: w.y - d.origin.y }
        const delta = snapDelta(raw)
        const dx = delta.x - d.applied.x
        const dy = delta.y - d.applied.y
        if (dx || dy) {
          st.moveRoom(d.id, dx, dy)
          setDrag({ ...d, applied: delta })
        }
        break
      }
      case 'item': {
        const target = { x: w.x - d.grab.x, y: w.y - d.grab.y }
        const s = snapTo(target, { exclude: floor.points.map((p) => p.id) })
        st.updateItem(d.id, { x: s.p.x, y: s.p.y })
        break
      }
      case 'rotate': {
        const it = floor.items.find((i) => i.id === d.id)
        if (!it) break
        let rot = angleOf({ x: it.x, y: it.y }, w) + Math.PI / 2
        if (shiftRef.current || snap) rot = Math.round(rot / (Math.PI / 12)) * (Math.PI / 12)
        st.updateItem(d.id, { rot })
        break
      }
      case 'opening': {
        const op = floor.openings.find((o) => o.id === d.id)
        if (!op) break
        const wall = floor.walls.find((x) => x.id === op.wallId)
        if (!wall) break
        const e = wallEnds(floor, wall)
        if (!e) break
        const len = dist(e.a, e.b)
        const ang = angleOf(e.a, e.b)
        const t = (w.x - e.a.x) * Math.cos(ang) + (w.y - e.a.y) * Math.sin(ang)
        const half = op.width / 2
        let offset = clamp(t, half, Math.max(half, len - half))
        if (snap) offset = clamp(Math.round(offset / gridSize) * gridSize, half, Math.max(half, len - half))
        st.updateOpening(d.id, { offset })
        break
      }
      case 'measure': {
        const s = snapTo(w)
        st.updateMeasure(d.id, d.end === 'a' ? { ax: s.p.x, ay: s.p.y } : { bx: s.p.x, by: s.p.y })
        break
      }
    }
  }

  const onStageUp = () => {
    if (drag && drag.kind !== 'pan') {
      if (drag.kind === 'point') {
        const p = floor.points.find((q) => q.id === drag.id)
        if (p) store.getState().movePoint(drag.id, p.x, p.y, true)
      }
      store.getState().endDrag()
    }
    setDrag(null)
    setGuides({})

    if (tool === 'room' && rectDraft) {
      const { a, b } = rectDraft
      const w = Math.abs(b.x - a.x)
      const h = Math.abs(b.y - a.y)
      if (w > 0.25 && h > 0.25) store.getState().createRect(Math.min(a.x, b.x), Math.min(a.y, b.y), w, h)
      setRectDraft(null)
    }
  }

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    const p = stage?.getPointerPosition()
    if (!p) return
    const factor = Math.exp(-e.evt.deltaY * 0.0016)
    const next = clamp(view.scale * factor, 5, 400)
    setView({
      scale: next,
      x: p.x - ((p.x - view.x) / view.scale) * next,
      y: p.y - ((p.y - view.y) / view.scale) * next,
    })
  }

  const onDblClick = () => {
    if (tool === 'poly' && path.length >= 3) {
      store.getState().createPolyRoom(path)
      setPath([])
    }
    if (tool === 'wall' && path.length >= 2) {
      store.getState().createWallPath(path)
      setPath([])
    }
  }

  /* ------------------------------------------------------------------ */
  /* entity interaction                                                  */
  /* ------------------------------------------------------------------ */

  const startEntity = (sel: Selection) => (e: KonvaEventObject<MouseEvent>) => {
    const evt = e.evt as MouseEvent
    if ('button' in evt && evt.button !== 0) return
    if (spaceRef.current) return
    const st = store.getState()

    if (tool === 'delete') {
      e.cancelBubble = true
      st.remove(sel)
      return
    }
    if (tool !== 'select') return // let the active tool handle the click

    e.cancelBubble = true
    st.select(sel)
    const w = pointer()
    if (!w) return
    st.beginDrag()

    switch (sel.kind) {
      case 'point':
        setDrag({ kind: 'point', id: sel.id })
        break
      case 'wall': {
        const wall = floor.walls.find((x) => x.id === sel.id)
        const ends = wall ? wallEnds(floor, wall) : null
        if (wall && ends)
          setDrag({
            kind: 'wall',
            id: sel.id,
            a: { id: wall.a, x: ends.a.x, y: ends.a.y },
            b: { id: wall.b, x: ends.b.x, y: ends.b.y },
            origin: w,
          })
        break
      }
      case 'room':
        setDrag({ kind: 'room', id: sel.id, origin: w, applied: { x: 0, y: 0 } })
        break
      case 'item': {
        const it = floor.items.find((i) => i.id === sel.id)
        if (it) setDrag({ kind: 'item', id: sel.id, grab: { x: w.x - it.x, y: w.y - it.y } })
        break
      }
      case 'opening':
        setDrag({ kind: 'opening', id: sel.id })
        break
      case 'measure':
        setDrag({ kind: 'measure', id: sel.id, end: 'b' })
        break
    }
  }

  const startRotate = (id: ID) => (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    store.getState().beginDrag()
    setDrag({ kind: 'rotate', id })
  }

  const startMeasureEnd = (id: ID) => (end: 'a' | 'b') => (e: KonvaEventObject<MouseEvent>) => {
    if (tool !== 'select') return
    e.cancelBubble = true
    store.getState().select({ kind: 'measure', id })
    store.getState().beginDrag()
    setDrag({ kind: 'measure', id, end })
  }

  /* ------------------------------------------------------------------ */
  /* render                                                              */
  /* ------------------------------------------------------------------ */

  const pts = useMemo(() => pointMap(floor), [floor])
  const cursorStyle =
    drag?.kind === 'pan' ? 'grabbing' : spaceRef.current ? 'grab' : tool === 'select' ? 'default' : 'crosshair'

  return (
    <div
      ref={wrapRef}
      className={`relative h-full w-full ${hidden ? 'pointer-events-none invisible absolute inset-0' : ''}`}
      style={{ background: C.bg, cursor: cursorStyle }}
    >
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        onMouseDown={onStageDown}
        onTouchStart={onStageDown}
        onMouseMove={onStageMove}
        onTouchMove={onStageMove}
        onMouseUp={onStageUp}
        onTouchEnd={onStageUp}
        onMouseLeave={onStageUp}
        onWheel={onWheel}
        onDblClick={onDblClick}
        onContextMenu={(e) => e.evt.preventDefault()}
      >
        <Layer listening={false}>{showGrid ? <GridShape view={{ ...view, w: size.w, h: size.h }} size={gridSize < 0.05 ? 0.05 : gridSize} /> : null}</Layer>

        <Layer>
          {floor.rooms.map((room) => (
            <RoomShape
              key={room.id}
              floor={floor}
              room={room}
              scale={view.scale}
              showDims={showDims}
              selected={selection?.kind === 'room' && selection.id === room.id}
              onDown={startEntity({ kind: 'room', id: room.id })}
            />
          ))}

          {floor.walls.map((wall) => (
            <WallShape
              key={wall.id}
              floor={floor}
              wall={wall}
              scale={view.scale}
              showDims={showDims}
              selected={selection?.kind === 'wall' && selection.id === wall.id}
              hovered={hoverWall?.id === wall.id}
              onDown={startEntity({ kind: 'wall', id: wall.id })}
            />
          ))}

          {floor.openings.map((op) => (
            <OpeningShape
              key={op.id}
              floor={floor}
              opening={op}
              scale={view.scale}
              selected={selection?.kind === 'opening' && selection.id === op.id}
              onDown={startEntity({ kind: 'opening', id: op.id })}
            />
          ))}

          {showFurniture
            ? floor.items.map((item) => (
                <ItemShape
                  key={item.id}
                  item={item}
                  scale={view.scale}
                  showLabel={showDims}
                  selected={selection?.kind === 'item' && selection.id === item.id}
                  onDown={startEntity({ kind: 'item', id: item.id })}
                  onRotateDown={startRotate(item.id)}
                />
              ))
            : null}

          {floor.measures.map((m) => (
            <MeasureShape
              key={m.id}
              m={m}
              scale={view.scale}
              selected={selection?.kind === 'measure' && selection.id === m.id}
              onDown={startEntity({ kind: 'measure', id: m.id })}
              onEndDown={startMeasureEnd(m.id)}
            />
          ))}

          {tool === 'select' ? (
            <CornerHandles
              floor={floor}
              selection={selection}
              scale={view.scale}
              onDown={(id) => startEntity({ kind: 'point', id })}
            />
          ) : null}
        </Layer>

        <Layer listening={false}>
          {guides.x !== undefined ? (
            <Line
              points={[guides.x, -1e4, guides.x, 1e4]}
              stroke={C.accent}
              strokeWidth={1}
              dash={[6, 6]}
              strokeScaleEnabled={false}
              opacity={0.6}
            />
          ) : null}
          {guides.y !== undefined ? (
            <Line
              points={[-1e4, guides.y, 1e4, guides.y]}
              stroke={C.accent}
              strokeWidth={1}
              dash={[6, 6]}
              strokeScaleEnabled={false}
              opacity={0.6}
            />
          ) : null}

          {rectDraft ? <RectDraft a={rectDraft.a} b={rectDraft.b} scale={view.scale} /> : null}

          {(tool === 'poly' || tool === 'wall') && path.length ? (
            <PathDraft
              pts={path}
              cursor={cursor}
              closed={tool === 'poly' && path.length >= 3}
              scale={view.scale}
              thickness={floor.wallThickness}
            />
          ) : null}

          {tool === 'measure' && measureStart ? (
            <PathDraft pts={[measureStart]} cursor={cursor} closed={false} scale={view.scale} thickness={0.02} />
          ) : null}

          {tool === 'item' ? <ItemGhost kind={catalogKind} at={cursor} /> : null}

          {(tool === 'door' || tool === 'window') && hoverWall ? (
            <OpeningGhost floor={floor} wallId={hoverWall.id} offset={hoverWall.offset} kind={tool} />
          ) : null}

          {selection?.kind === 'room'
            ? (() => {
                const room = floor.rooms.find((r) => r.id === selection.id)
                if (!room) return null
                const rp = roomPoints(floor, room, pts)
                if (rp.length < 3) return null
                return (
                  <Line
                    points={rp.flatMap((p) => [p.x, p.y])}
                    closed
                    stroke={C.accent}
                    strokeWidth={2}
                    dash={[8, 6]}
                    strokeScaleEnabled={false}
                  />
                )
              })()
            : null}
        </Layer>
      </Stage>
    </div>
  )
}
