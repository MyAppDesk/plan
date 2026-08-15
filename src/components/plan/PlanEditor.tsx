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
  closestOnSegment,
  dist,
  floorBounds,
  nearestPoint,
  nearestWall,
  pointMap,
  polygonBounds,
  roomPoints,
  snapToWallFace,
  wallEnds,
  wallFaces,
  wallLength,
  type Vec,
} from '../../lib/geometry'
import { BASIS_LABEL, roomBoundsOn } from '../../lib/measure'
import {
  C,
  ColumnGhost,
  ColumnShape,
  CornerHandles,
  GridShape,
  ExtrudeDraft,
  ItemGhost,
  ItemShape,
  MeasureShape,
  OpeningGhost,
  OpeningShape,
  PathDraft,
  RectDraft,
  RoomShape,
  SelectionGrips,
  SiteShape,
  WallShape,
} from './planShapes'

type Drag =
  | { kind: 'pan'; startX: number; startY: number; viewX: number; viewY: number }
  | { kind: 'point'; id: ID; origin: Vec }
  | { kind: 'wall'; id: ID; a: { id: ID; x: number; y: number }; b: { id: ID; x: number; y: number }; origin: Vec }
  | { kind: 'room'; id: ID; origin: Vec; applied: Vec }
  | { kind: 'item'; id: ID; grab: Vec; origin: Vec }
  | { kind: 'column'; id: ID; grab: Vec; origin: Vec }
  | {
      kind: 'column-resize'
      id: ID
      sx: number
      sy: number
      base: { x: number; y: number; w: number; d: number; rot: number }
    }
  | {
      kind: 'item-resize'
      id: ID
      sx: number
      sy: number
      base: { x: number; y: number; w: number; d: number; rot: number }
    }
  | {
      kind: 'room-resize'
      id: ID
      sx: number
      sy: number
      base: { minX: number; minY: number; maxX: number; maxY: number }
    }
  | { kind: 'extrude'; id: ID; a: Vec; b: Vec; n: Vec; offset: number }
  | { kind: 'site-point'; index: number; origin: Vec }
  | { kind: 'site'; origin: Vec; applied: Vec }
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
  const [editing, setEditing] = useState<
    | { kind: 'text'; screen: Vec; value: string; apply: (v: string) => void; label: string }
    | { kind: 'number'; screen: Vec; value: number; apply: (v: number) => void; label: string }
    | null
  >(null)
  const shiftRef = useRef(false)
  const altRef = useRef(false)
  const spaceRef = useRef(false)

  const floor = useActiveFloor()
  const tool = useProject((s) => s.tool)
  const selection = useProject((s) => s.selection)
  const snap = useProject((s) => s.snap)
  const snapWalls = useProject((s) => s.snapWalls)
  const gridSize = useProject((s) => s.gridSize)
  const showGrid = useProject((s) => s.showGrid)
  const showDims = useProject((s) => s.showDims)
  const dimBasis = useProject((s) => s.dimBasis)
  const showFurniture = useProject((s) => s.showFurniture)
  const catalogKind = useProject((s) => s.catalogKind)
  const site = useProject((s) => s.project.site)
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
    const fb = floorBounds(floor)
    const sb = site?.enabled ? polygonBounds(site.outline) : null
    const b = sb
      ? {
          minX: Math.min(fb.minX, sb.minX),
          maxX: Math.max(fb.maxX, sb.maxX),
          minY: Math.min(fb.minY, sb.minY),
          maxY: Math.max(fb.maxY, sb.maxY),
        }
      : fb
    const pad = 1.2
    const bw = b.maxX - b.minX + pad * 2
    const bh = b.maxY - b.minY + pad * 2
    const scale = clamp(Math.min(el.clientWidth / bw, el.clientHeight / bh), 6, 300)
    setView({
      scale,
      x: el.clientWidth / 2 - ((b.minX + b.maxX) / 2) * scale,
      y: el.clientHeight / 2 - ((b.minY + b.maxY) / 2) * scale,
    })
  }, [floor, site])

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

  /** Where the pointer is on screen, for the little inline editors. */
  const screenPointer = (): Vec => {
    const p = stageRef.current?.getPointerPosition()
    return p ? { x: p.x, y: p.y } : { x: size.w / 2, y: size.h / 2 }
  }

  const editNumber = (label: string, value: number, apply: (v: number) => void) => {
    setEditing({ kind: 'number', screen: screenPointer(), value, apply, label })
  }

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
      if (e.key === 'Alt') altRef.current = true
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
        if (tool === 'plot' && path.length >= 3) store.getState().setSiteOutline(path)
        if (tool === 'wall') store.getState().createWallPath(path)
        setPath([])
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftRef.current = false
      if (e.key === 'Alt') altRef.current = false
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
      case 'plot':
      case 'wall': {
        const closes = tool !== 'wall' && path.length >= 3 && dist(s.p, path[0]) < px(12)
        if (closes) {
          if (tool === 'poly') store.getState().createPolyRoom(path)
          else store.getState().setSiteOutline(path)
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
      case 'column':
        store.getState().createColumn(s.p.x, s.p.y)
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
    if (tool === 'item' || tool === 'column') {
      setCursorPos(snapTo(w).p)
      return
    }
    if (tool === 'poly' || tool === 'plot' || tool === 'wall' || tool === 'measure') {
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

  /** Shift keeps a drag on one axis: the thing moves dead straight from where it started. */
  const straight = (from: Vec, to: Vec): Vec => {
    if (!shiftRef.current) return to
    return Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? { x: to.x, y: from.y } : { x: from.x, y: to.y }
  }

  /** The same lock, for the drags that work in deltas rather than positions. */
  const straightDelta = (delta: Vec): Vec => {
    if (!shiftRef.current) return delta
    return Math.abs(delta.x) >= Math.abs(delta.y) ? { x: delta.x, y: 0 } : { x: 0, y: delta.y }
  }

  const applyDrag = (d: Drag, w: Vec) => {
    const st = store.getState()
    const floorSite = st.project.site
    switch (d?.kind) {
      case 'point': {
        const s = snapTo(w, { exclude: [d.id], from: d.origin })
        setGuides(s.guides)
        const p = straight(d.origin, s.p)
        st.movePoint(d.id, p.x, p.y)
        break
      }
      case 'wall': {
        const raw = { x: w.x - d.origin.x, y: w.y - d.origin.y }
        const delta = straightDelta(snapDelta(raw))
        st.movePoint(d.a.id, d.a.x + delta.x, d.a.y + delta.y)
        st.movePoint(d.b.id, d.b.x + delta.x, d.b.y + delta.y)
        break
      }
      case 'room': {
        const raw = { x: w.x - d.origin.x, y: w.y - d.origin.y }
        const delta = straightDelta(snapDelta(raw))
        const dx = delta.x - d.applied.x
        const dy = delta.y - d.applied.y
        if (dx || dy) {
          st.moveRoom(d.id, dx, dy)
          setDrag({ ...d, applied: delta })
        }
        break
      }
      case 'item': {
        const it = floor.items.find((i) => i.id === d.id)
        if (!it) break
        const target = { x: w.x - d.grab.x, y: w.y - d.grab.y }
        const s = snapTo(target, { exclude: floor.points.map((p) => p.id) })
        let next = { x: s.p.x, y: s.p.y, w: it.w, d: it.d, rot: it.rot }
        if (snapWalls && !shiftRef.current) next = snapToWallFace(floor, next) ?? next
        const p = straight(d.origin, next)
        st.updateItem(d.id, { x: p.x, y: p.y, rot: next.rot })
        break
      }
      case 'column': {
        const c = floor.columns.find((x) => x.id === d.id)
        if (!c) break
        const target = { x: w.x - d.grab.x, y: w.y - d.grab.y }
        const s = snapTo(target, { exclude: floor.points.map((p) => p.id) })
        let next = { x: s.p.x, y: s.p.y, w: c.w, d: c.d, rot: c.rot }
        if (snapWalls && !shiftRef.current) next = snapToWallFace(floor, next) ?? next
        const p = straight(d.origin, next)
        st.updateColumn(d.id, { x: p.x, y: p.y, rot: next.rot })
        break
      }
      case 'column-resize':
      case 'item-resize': {
        const { base, sx, sy } = d
        const cos = Math.cos(base.rot)
        const sin = Math.sin(base.rot)
        const dx = w.x - base.x
        const dy = w.y - base.y
        const lx = dx * cos + dy * sin
        const ly = -dx * sin + dy * cos
        let nw = base.w
        let nd = base.d
        let clx = 0
        let cly = 0
        const round = (v: number) => (snap ? Math.max(gridSize, Math.round(v / gridSize) * gridSize) : v)
        if (sx !== 0) {
          const anchor = (-sx * base.w) / 2
          nw = Math.max(0.05, round(Math.abs(lx - anchor)))
          clx = anchor + (sx * nw) / 2
        }
        if (sy !== 0) {
          const anchor = (-sy * base.d) / 2
          nd = Math.max(0.05, round(Math.abs(ly - anchor)))
          cly = anchor + (sy * nd) / 2
        }
        const box = {
          w: nw,
          d: nd,
          x: base.x + clx * cos - cly * sin,
          y: base.y + clx * sin + cly * cos,
        }
        if (d.kind === 'column-resize') st.updateColumn(d.id, box)
        else st.updateItem(d.id, box)
        break
      }
      case 'room-resize': {
        const s = snapTo(w, { exclude: floor.rooms.find((r) => r.id === d.id)?.loop ?? [] })
        setGuides(s.guides)
        const box = { ...d.base }
        if (d.sx > 0) box.maxX = Math.max(box.minX + 0.2, s.p.x)
        if (d.sx < 0) box.minX = Math.min(box.maxX - 0.2, s.p.x)
        if (d.sy > 0) box.maxY = Math.max(box.minY + 0.2, s.p.y)
        if (d.sy < 0) box.minY = Math.min(box.maxY - 0.2, s.p.y)
        st.setRoomBounds(d.id, box)
        break
      }
      case 'extrude': {
        let offset = (w.x - d.a.x) * d.n.x + (w.y - d.a.y) * d.n.y
        if (snap) offset = Math.round(offset / gridSize) * gridSize
        setDrag({ ...d, offset })
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
      case 'site-point': {
        const s = snapTo(w)
        setGuides(s.guides)
        const p = straight(d.origin, s.p)
        st.moveSitePoint(d.index, p.x, p.y)
        break
      }
      case 'site': {
        const outline = floorSite?.outline
        if (!outline) break
        const delta = straightDelta(snapDelta({ x: w.x - d.origin.x, y: w.y - d.origin.y }))
        const dx = delta.x - d.applied.x
        const dy = delta.y - d.applied.y
        if (!dx && !dy) break
        st.setSiteOutline(outline.map((p) => ({ x: p.x + dx, y: p.y + dy })))
        setDrag({ ...d, applied: delta })
        break
      }
    }
  }

  const onStageUp = () => {
    if (drag?.kind === 'extrude') {
      if (Math.abs(drag.offset) > 0.05) store.getState().extrudeWall(drag.id, drag.offset)
      setDrag(null)
      setGuides({})
      return
    }
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
    if (tool === 'plot' && path.length >= 3) {
      store.getState().setSiteOutline(path)
      setPath([])
    }
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
      case 'point': {
        const p = floor.points.find((q) => q.id === sel.id)
        setDrag({ kind: 'point', id: sel.id, origin: p ? { x: p.x, y: p.y } : w })
        break
      }
      case 'wall': {
        const wall = floor.walls.find((x) => x.id === sel.id)
        const ends = wall ? wallEnds(floor, wall) : null
        if (wall && ends && altRef.current) {
          // Alt-drag pulls the wall out into a column, a recess or a bay
          st.endDrag()
          const ang = angleOf(ends.a, ends.b)
          setDrag({
            kind: 'extrude',
            id: sel.id,
            a: { x: ends.a.x, y: ends.a.y },
            b: { x: ends.b.x, y: ends.b.y },
            n: { x: -Math.sin(ang), y: Math.cos(ang) },
            offset: 0,
          })
          break
        }
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
        if (it)
          setDrag({ kind: 'item', id: sel.id, grab: { x: w.x - it.x, y: w.y - it.y }, origin: { x: it.x, y: it.y } })
        break
      }
      case 'column': {
        const c = floor.columns.find((x) => x.id === sel.id)
        if (c)
          setDrag({ kind: 'column', id: sel.id, grab: { x: w.x - c.x, y: w.y - c.y }, origin: { x: c.x, y: c.y } })
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

  const startItemResize = (id: ID) => (sx: number, sy: number) => (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    if (tool !== 'select') return
    const it = floor.items.find((i) => i.id === id)
    if (!it) return
    store.getState().select({ kind: 'item', id })
    store.getState().beginDrag()
    setDrag({ kind: 'item-resize', id, sx, sy, base: { x: it.x, y: it.y, w: it.w, d: it.d, rot: it.rot } })
  }

  const startColumnResize = (id: ID) => (sx: number, sy: number) => (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    if (tool !== 'select') return
    const c = floor.columns.find((x) => x.id === id)
    if (!c) return
    store.getState().select({ kind: 'column', id })
    store.getState().beginDrag()
    setDrag({ kind: 'column-resize', id, sx, sy, base: { x: c.x, y: c.y, w: c.w, d: c.d, rot: c.rot } })
  }

  const startRoomResize = (id: ID) => (sx: number, sy: number) => (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    if (tool !== 'select') return
    const room = floor.rooms.find((r) => r.id === id)
    if (!room) return
    store.getState().select({ kind: 'room', id })
    store.getState().beginDrag()
    setDrag({ kind: 'room-resize', id, sx, sy, base: polygonBounds(roomPoints(floor, room)) })
  }

  /** Clicking a dimension figure types an exact size straight onto the plan. */
  const editSelectionSize = (axis: 'w' | 'd') => (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    const st = store.getState()
    const sel = st.selection
    if (!sel) return
    if (sel.kind === 'item' || sel.kind === 'column') {
      const list = sel.kind === 'item' ? floor.items : floor.columns
      const target = list.find((x) => x.id === sel.id)
      if (!target) return
      editNumber(axis === 'w' ? 'Width' : 'Depth', axis === 'w' ? target.w : target.d, (v) => {
        const patch = axis === 'w' ? { w: v } : { d: v }
        if (sel.kind === 'item') st.updateItem(sel.id, patch)
        else st.updateColumn(sel.id, patch)
      })
    }
    if (sel.kind === 'room') {
      const room = floor.rooms.find((r) => r.id === sel.id)
      if (!room) return
      const b = polygonBounds(roomPoints(floor, room))
      const m = roomBoundsOn(floor, room, dimBasis)
      // the walls the figure is measured from stay put, so the typed size is the clear one
      const padW = b.maxX - b.minX - (m.maxX - m.minX)
      const padD = b.maxY - b.minY - (m.maxY - m.minY)
      const label = `${axis === 'w' ? 'Room width' : 'Room depth'} (${BASIS_LABEL[dimBasis]})`
      editNumber(label, axis === 'w' ? m.maxX - m.minX : m.maxY - m.minY, (v) =>
        st.setRoomBounds(sel.id, {
          minX: b.minX,
          minY: b.minY,
          maxX: axis === 'w' ? b.minX + Math.max(0.2, v + padW) : b.maxX,
          maxY: axis === 'd' ? b.minY + Math.max(0.2, v + padD) : b.maxY,
        }),
      )
    }
  }

  /** Each face of a wall carries its own figure — the inside one and the outside one. */
  const editWallFace = (id: ID) => (face: 'left' | 'right') => (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    const wall = floor.walls.find((w) => w.id === id)
    if (!wall) return
    const faces = wallFaces(floor, wall)
    if (!faces) return
    const shown = dist(faces[face][0], faces[face][1])
    const centre = wallLength(floor, wall)
    const other = dist(faces[face === 'left' ? 'right' : 'left'][0], faces[face === 'left' ? 'right' : 'left'][1])
    const label = shown < other ? 'Inside face' : shown > other ? 'Outside face' : 'Wall face'
    // the neighbours keep cutting the same amount off the ends, so both faces shift together
    editNumber(label, shown, (v) => store.getState().setWallLength(id, Math.max(0.05, centre + (v - shown))))
  }

  const renameRoom = (id: ID) => (e: KonvaEventObject<MouseEvent>) => {
    if (tool !== 'select') return
    e.cancelBubble = true
    const room = floor.rooms.find((r) => r.id === id)
    if (!room) return
    store.getState().select({ kind: 'room', id })
    setEditing({
      kind: 'text',
      screen: screenPointer(),
      value: room.name,
      label: 'Room name',
      apply: (name) => store.getState().updateRoom(id, { name }),
    })
  }

  const startSiteDrag = (e: KonvaEventObject<MouseEvent>) => {
    if (tool !== 'select' || spaceRef.current) return
    e.cancelBubble = true
    const w = pointer()
    if (!w) return
    store.getState().select({ kind: 'site', id: 'site' })
    store.getState().beginDrag()
    setDrag({ kind: 'site', origin: w, applied: { x: 0, y: 0 } })
  }

  const startSiteCorner = (index: number) => (e: KonvaEventObject<MouseEvent>) => {
    if (tool !== 'select') return
    e.cancelBubble = true
    store.getState().select({ kind: 'site', id: 'site' })
    store.getState().beginDrag()
    const corner = site?.outline[index]
    setDrag({ kind: 'site-point', index, origin: corner ? { x: corner.x, y: corner.y } : (pointer() ?? { x: 0, y: 0 }) })
  }

  /** Double-click adds a corner on an edge, or removes the one you hit. */
  const siteCornerDblClick = (index: number) => (e: KonvaEventObject<MouseEvent>) => {
    if (tool !== 'select') return
    e.cancelBubble = true
    if ((site?.outline.length ?? 0) <= 3) {
      store.getState().flash('A plot needs at least three corners.')
      window.setTimeout(() => store.getState().flash(null), 2500)
      return
    }
    store.getState().removeSitePoint(index)
  }

  const siteEdgeDblClick = (e: KonvaEventObject<MouseEvent>) => {
    if (tool !== 'select' || !site) return
    e.cancelBubble = true
    const w = pointer()
    if (!w) return
    // insert on whichever edge the click is nearest to
    let best = { index: 0, dist: Infinity, point: w }
    site.outline.forEach((p, i) => {
      const q = site.outline[(i + 1) % site.outline.length]
      const r = closestOnSegment(w, p, q)
      if (r.dist < best.dist) best = { index: i, dist: r.dist, point: r.point }
    })
    const snapped = snapTo(best.point).p
    store.getState().insertSitePoint(best.index, snapped.x, snapped.y)
  }

  /** Double-clicking a corner welds its two walls back into one. */
  const dissolveCorner = (id: ID) => (e: KonvaEventObject<MouseEvent>) => {
    if (tool !== 'select') return
    e.cancelBubble = true
    const ok = store.getState().dissolvePoint(id)
    if (!ok) {
      store.getState().flash('That corner joins more than two walls — delete a wall first.')
      window.setTimeout(() => store.getState().flash(null), 3000)
    }
  }

  /** Double-clicking a wall drops a corner on it, so the run can bend. */
  const splitWallAt = (id: ID) => (e: KonvaEventObject<MouseEvent>) => {
    if (tool !== 'select') return
    e.cancelBubble = true
    const w = pointer()
    if (!w) return
    store.getState().splitWall(id, snapTo(w).p)
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
          {site?.enabled ? (
            <SiteShape
              site={site}
              scale={view.scale}
              selected={selection?.kind === 'site'}
              onDown={startSiteDrag}
              onCornerDown={tool === 'select' ? startSiteCorner : undefined}
              onCornerDblClick={siteCornerDblClick}
              onEdgeDblClick={siteEdgeDblClick}
            />
          ) : null}

          {floor.rooms.map((room) => (
            <RoomShape
              key={room.id}
              floor={floor}
              room={room}
              scale={view.scale}
              showDims={showDims}
              basis={dimBasis}
              selected={selection?.kind === 'room' && selection.id === room.id}
              onDown={startEntity({ kind: 'room', id: room.id })}
              onDblClick={renameRoom(room.id)}
            />
          ))}

          {floor.walls.map((wall) => (
            <WallShape
              key={wall.id}
              floor={floor}
              wall={wall}
              scale={view.scale}
              showDims={showDims}
              basis={dimBasis}
              selected={selection?.kind === 'wall' && selection.id === wall.id}
              hovered={hoverWall?.id === wall.id}
              onDown={startEntity({ kind: 'wall', id: wall.id })}
              onDblClick={splitWallAt(wall.id)}
              onEditFace={editWallFace(wall.id)}
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

          {(floor.columns ?? []).map((c) => (
            <ColumnShape
              key={c.id}
              floor={floor}
              column={c}
              scale={view.scale}
              showLabel={showDims}
              selected={selection?.kind === 'column' && selection.id === c.id}
              onDown={startEntity({ kind: 'column', id: c.id })}
            />
          ))}

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
            <SelectionGrips
              floor={floor}
              selection={selection}
              scale={view.scale}
              basis={dimBasis}
              onItemResize={startItemResize}
              onRoomResize={startRoomResize}
              onColumnResize={startColumnResize}
              onEditSize={editSelectionSize}
            />
          ) : null}

          {tool === 'select' ? (
            <CornerHandles
              floor={floor}
              selection={selection}
              scale={view.scale}
              onDown={(id) => startEntity({ kind: 'point', id })}
              onDblClick={dissolveCorner}
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

          {drag?.kind === 'extrude' && Math.abs(drag.offset) > 0.001 ? (
            <ExtrudeDraft a={drag.a} b={drag.b} n={drag.n} offset={drag.offset} scale={view.scale} />
          ) : null}

          {(tool === 'poly' || tool === 'plot' || tool === 'wall') && path.length ? (
            <PathDraft
              pts={path}
              cursor={cursor}
              closed={tool !== 'wall' && path.length >= 3}
              scale={view.scale}
              thickness={floor.wallThickness}
            />
          ) : null}

          {tool === 'measure' && measureStart ? (
            <PathDraft pts={[measureStart]} cursor={cursor} closed={false} scale={view.scale} thickness={0.02} />
          ) : null}

          {tool === 'item' ? <ItemGhost kind={catalogKind} at={cursor} snapWalls={snapWalls} floor={floor} /> : null}

          {tool === 'column' ? <ColumnGhost at={cursor} snapWalls={snapWalls} floor={floor} /> : null}

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

      {editing ? (
        <div
          className="absolute z-30 flex items-center gap-1.5 rounded-lg border border-accent bg-ink-900/95 px-2 py-1.5 shadow-xl"
          style={{ left: Math.min(Math.max(editing.screen.x - 70, 8), size.w - 190), top: Math.max(8, editing.screen.y - 46) }}
        >
          <span className="text-[10px] tracking-wide text-mist-400 uppercase">{editing.label}</span>
          <input
            autoFocus
            className="w-24 rounded border border-ink-600 bg-ink-850 px-1.5 py-0.5 text-mist-200 outline-none"
            defaultValue={editing.kind === 'number' ? String(Number(editing.value.toFixed(3))) : editing.value}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(null)
              if (e.key !== 'Enter') return
              const raw = (e.target as HTMLInputElement).value
              if (editing.kind === 'number') {
                const n = Number(raw.replace(',', '.'))
                if (Number.isFinite(n) && n > 0) editing.apply(n)
              } else if (raw.trim()) {
                editing.apply(raw.trim())
              }
              setEditing(null)
            }}
            onBlur={() => setEditing(null)}
          />
          {editing.kind === 'number' ? <span className="text-[11px] text-mist-400">m</span> : null}
        </div>
      ) : null}
    </div>
  )
}
