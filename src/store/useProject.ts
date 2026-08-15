import { create } from 'zustand'
import { temporal } from 'zundo'
import { produce } from 'immer'
import type {
  Column,
  Floor,
  Site,
  ID,
  Item,
  Opening,
  OpeningKind,
  Project,
  Room,
  Selection,
  Tool,
  ViewMode,
  Wall,
} from '../types'
import {
  addColumn,
  addItem,
  addPoint,
  addRect,
  addRoomFromLoop,
  addWall,
  emptyFloor,
} from '../lib/build'
import { generateHome } from '../lib/templates'
import { readProjectData, newProjectId } from './storage'
import {
  angleOf,
  clamp,
  floorBounds,
  closestOnSegment,
  dist,
  findWallBetween,
  nearestPoint,
  pointMap,
  polygonBounds,
  roomPoints,
  snapToWallFace,
  spliceLoopEdge,
  uid,
  type Vec,
} from '../lib/geometry'


/* ------------------------------------------------------------------ */
/* store                                                               */
/* ------------------------------------------------------------------ */

export interface UiState {
  tool: Tool
  view: ViewMode
  selection: Selection | null
  snap: boolean
  snapWalls: boolean
  gridSize: number
  showGrid: boolean
  showDims: boolean
  showFurniture: boolean
  showCeiling: boolean
  showAllFloors: boolean
  catalogKind: string
  message: string | null
}

export interface ProjectState extends UiState {
  project: Project
  projectId: string
  activeFloorId: ID

  /* ui */
  setTool: (t: Tool) => void
  setView: (v: ViewMode) => void
  select: (s: Selection | null) => void
  toggleUi: (
    key: 'snap' | 'snapWalls' | 'showGrid' | 'showDims' | 'showFurniture' | 'showCeiling' | 'showAllFloors',
  ) => void
  setGridSize: (v: number) => void
  setCatalogKind: (k: string) => void
  flash: (msg: string | null) => void

  /* project */
  setProjectName: (name: string) => void
  setActiveFloor: (id: ID) => void
  addFloor: (copyCurrent?: boolean) => void
  updateFloor: (id: ID, patch: Partial<Floor>) => void
  removeFloor: (id: ID) => void

  /* drawing */
  createRect: (x: number, y: number, w: number, h: number) => void
  createPolyRoom: (pts: Vec[]) => void
  createWallPath: (pts: Vec[]) => void
  createOpening: (wallId: ID, kind: OpeningKind, offset: number) => void
  createItem: (kind: string, x: number, y: number) => void
  createColumn: (x: number, y: number) => void
  updateColumn: (id: ID, patch: Partial<Column>) => void
  createMeasure: (a: Vec, b: Vec) => void

  /* editing */
  movePoint: (id: ID, x: number, y: number, weld?: boolean) => void
  moveRoom: (id: ID, dx: number, dy: number) => void
  resizeRoom: (id: ID, w: number, h: number) => void
  setRoomBounds: (id: ID, box: { minX: number; minY: number; maxX: number; maxY: number }) => void
  splitWall: (id: ID, at: Vec) => void
  dissolvePoint: (id: ID) => boolean
  extrudeWall: (id: ID, offset: number) => void
  setWallLength: (id: ID, length: number) => void
  updateWall: (id: ID, patch: Partial<Wall>) => void
  updateRoom: (id: ID, patch: Partial<Room>) => void
  updateOpening: (id: ID, patch: Partial<Opening>) => void
  updateItem: (id: ID, patch: Partial<Item>) => void
  updateMeasure: (id: ID, patch: Partial<{ ax: number; ay: number; bx: number; by: number }>) => void
  remove: (sel: Selection) => void
  duplicate: (sel: Selection) => void

  /* history helpers + io */
  beginDrag: () => void
  endDrag: () => void
  loadProject: (p: Project, id?: string) => void
  setEyeHeight: (v: number) => void
  updateSite: (patch: Partial<Site>) => void
  setSiteOutline: (points: Vec[]) => void
  moveSitePoint: (index: number, x: number, y: number) => void
  insertSitePoint: (afterIndex: number, x: number, y: number) => void
  removeSitePoint: (index: number) => void
  fitSiteToPlan: () => void
}

export function bootProject(id: string | null): { id: string; project: Project } {
  const stored = id ? readProjectData(id) : null
  if (stored?.floors?.length && id) return { id, project: normalizeProject(stored) }
  return { id: id ?? newProjectId(), project: generateHome({ name: 'My home' }) }
}

/** Fills in anything an older / hand-edited file may be missing. */
export const DEFAULT_SITE: Site = {
  enabled: true,
  name: 'Plot',
  outline: [
    { x: -6, y: -6 },
    { x: 18, y: -6 },
    { x: 18, y: 16 },
    { x: -6, y: 16 },
  ],
  ground: 'grass',
}

/** Older files stored the plot as a rectangle. */
export function normalizeSite(raw: Site | Record<string, unknown>): Site {
  const site = raw as Partial<Site> & Record<string, unknown>
  if (Array.isArray(site.outline) && site.outline.length >= 3) {
    return { ...DEFAULT_SITE, ...site, outline: site.outline as Site['outline'] }
  }
  const x = Number(site.x ?? -6)
  const y = Number(site.y ?? -6)
  const w = Number(site.w ?? 24)
  const d = Number(site.d ?? 22)
  return {
    ...DEFAULT_SITE,
    ...site,
    outline: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + d },
      { x, y: y + d },
    ],
  }
}

export function normalizeProject(p: Project): Project {
  return {
    version: 3,
    name: p.name ?? 'Untitled',
    eyeHeight: p.eyeHeight ?? 1.65,
    site: p.site ? normalizeSite(p.site) : undefined,
    floors: (p.floors ?? []).map((f, i) => ({
      ...emptyFloor(f.name ?? `Floor ${i + 1}`, i),
      ...f,
      slab: f.slab ?? 0.3,
      points: f.points ?? [],
      walls: (f.walls ?? []).map((w) => ({
        ...w,
        thickness: w.thickness ?? 0.12,
        base: w.base ?? 0,
        height: w.height ?? null,
      })),
      columns: (f.columns ?? []).map((c) => ({
        ...c,
        base: c.base ?? 0,
        height: c.height ?? null,
        shape: c.shape ?? 'rect',
      })),
      rooms: (f.rooms ?? []).map((r) => ({ ...r, height: r.height ?? null, ceiling: r.ceiling ?? true })),
      openings: (f.openings ?? []).map((o) => ({
        ...o,
        flipSide: !!o.flipSide,
        flipHinge: !!o.flipHinge,
        doorType: o.doorType ?? 'hinged',
      })),
      items: (f.items ?? []).map((it) => ({ ...it, z: it.z ?? 0 })),
      measures: f.measures ?? [],
    })),
  }
}

const boot = bootProject(null)

let dragBase: Project | null = null

export const useProject = create<ProjectState>()(
  temporal(
    (set, get) => {
      const withFloor = (fn: (floor: Floor, state: ProjectState) => void) =>
        set(
          produce((state: ProjectState) => {
            const floor = state.project.floors.find((f) => f.id === state.activeFloorId)
            if (floor) fn(floor, state)
          }),
        )

      return {
        project: boot.project,
        projectId: boot.id,
        activeFloorId: boot.project.floors[0].id,

        tool: 'select',
        view: '2d',
        selection: null,
        snap: true,
        snapWalls: true,
        gridSize: 0.1,
        showGrid: true,
        showDims: true,
        showFurniture: true,
        showCeiling: false,
        showAllFloors: false,
        catalogKind: 'bed-double',
        message: null,

        /* ---------------- ui ---------------- */
        setTool: (tool) => set({ tool, selection: tool === 'select' ? get().selection : null }),
        setView: (view) => set({ view }),
        select: (selection) => set({ selection }),
        toggleUi: (key) => set({ [key]: !get()[key] } as Partial<ProjectState>),
        setGridSize: (gridSize) => set({ gridSize }),
        setCatalogKind: (catalogKind) => set({ catalogKind, tool: 'item' }),
        flash: (message) => set({ message }),

        /* ---------------- project ---------------- */
        setProjectName: (name) => set(produce((s: ProjectState) => void (s.project.name = name))),
        setActiveFloor: (id) => set({ activeFloorId: id, selection: null }),

        addFloor: (copyCurrent) =>
          set(
            produce((s: ProjectState) => {
              const index = s.project.floors.length
              const current = s.project.floors.find((f) => f.id === s.activeFloorId)
              let floor: Floor
              if (copyCurrent && current) {
                floor = JSON.parse(JSON.stringify(current)) as Floor
                floor.id = uid('f')
                floor.name = `Floor ${index + 1}`
                floor.elevation = current.elevation + current.height + floor.slab
                const remap = new Map<ID, ID>()
                floor.points = floor.points.map((p) => {
                  const nid = uid('p')
                  remap.set(p.id, nid)
                  return { ...p, id: nid }
                })
                const wallRemap = new Map<ID, ID>()
                floor.walls = floor.walls.map((w) => {
                  const nid = uid('w')
                  wallRemap.set(w.id, nid)
                  return { ...w, id: nid, a: remap.get(w.a)!, b: remap.get(w.b)! }
                })
                floor.rooms = floor.rooms.map((r) => ({ ...r, id: uid('r'), loop: r.loop.map((p) => remap.get(p)!) }))
                floor.openings = floor.openings.map((o) => ({ ...o, id: uid('o'), wallId: wallRemap.get(o.wallId)! }))
                floor.items = floor.items.map((it) => ({ ...it, id: uid('i') }))
                floor.measures = floor.measures.map((m) => ({ ...m, id: uid('m') }))
              } else {
                floor = emptyFloor(`Floor ${index + 1}`, index)
                if (current) floor.elevation = current.elevation + current.height + floor.slab
              }
              s.project.floors.push(floor)
              s.activeFloorId = floor.id
              s.selection = null
            }),
          ),

        updateFloor: (id, patch) =>
          set(
            produce((s: ProjectState) => {
              const f = s.project.floors.find((x) => x.id === id)
              if (f) Object.assign(f, patch)
            }),
          ),

        removeFloor: (id) =>
          set(
            produce((s: ProjectState) => {
              if (s.project.floors.length <= 1) return
              s.project.floors = s.project.floors.filter((f) => f.id !== id)
              if (s.activeFloorId === id) s.activeFloorId = s.project.floors[0].id
              s.selection = null
            }),
          ),

        /* ---------------- drawing ---------------- */
        createRect: (x, y, w, h) =>
          withFloor((floor, state) => {
            const room = addRect(floor, x, y, w, h)
            state.selection = { kind: 'room', id: room.id }
          }),

        createPolyRoom: (pts) =>
          withFloor((floor, state) => {
            if (pts.length < 3) return
            const loop = pts.map((p) => addPoint(floor, p.x, p.y))
            const unique = loop.filter((id, i) => loop.indexOf(id) === i)
            if (unique.length < 3) return
            const room = addRoomFromLoop(floor, unique)
            state.selection = { kind: 'room', id: room.id }
          }),

        createWallPath: (pts) =>
          withFloor((floor, state) => {
            if (pts.length < 2) return
            const ids = pts.map((p) => addPoint(floor, p.x, p.y))
            let last: Wall | null = null
            for (let i = 0; i < ids.length - 1; i++) {
              if (ids[i] === ids[i + 1]) continue
              last = addWall(floor, ids[i], ids[i + 1])
            }
            if (last) state.selection = { kind: 'wall', id: last.id }
          }),

        createOpening: (wallId, kind, offset) =>
          withFloor((floor, state) => {
            const wall = floor.walls.find((w) => w.id === wallId)
            if (!wall) return
            const pts = pointMap(floor)
            const len = dist(pts.get(wall.a)!, pts.get(wall.b)!)
            const width = kind === 'door' ? Math.min(0.8, len - 0.2) : Math.min(1.2, len - 0.2)
            if (width < 0.2) return
            const op: Opening = {
              id: uid('o'),
              wallId,
              kind,
              offset: clamp(offset, width / 2 + 0.05, len - width / 2 - 0.05),
              width,
              height: kind === 'door' ? 2.03 : 1.2,
              sill: kind === 'door' ? 0 : 1.0,
              flipSide: false,
              flipHinge: false,
              doorType: 'hinged',
            }
            floor.openings.push(op)
            state.selection = { kind: 'opening', id: op.id }
          }),

        createItem: (kind, x, y) =>
          withFloor((floor, state) => {
            const item = addItem(floor, kind, x, y)
            if (kind === 'stairs') {
              const above = state.project.floors
                .filter((f) => f.elevation > floor.elevation + 0.1)
                .sort((a, b) => a.elevation - b.elevation)[0]
              item.h = above ? above.elevation - floor.elevation : floor.height + 0.3
              item.d = Math.max(item.d, Math.ceil(item.h / 0.19) * 0.25)
            }
            if (state.snapWalls) {
              const placed = snapToWallFace(floor, { x: item.x, y: item.y, w: item.w, d: item.d, rot: item.rot })
              if (placed) {
                item.x = placed.x
                item.y = placed.y
                item.rot = placed.rot
              }
            }
            state.selection = { kind: 'item', id: item.id }
          }),

        createColumn: (x, y) =>
          withFloor((floor, state) => {
            const column = addColumn(floor, x, y)
            if (state.snapWalls) {
              const placed = snapToWallFace(floor, { x, y, w: column.w, d: column.d, rot: 0 })
              if (placed) {
                column.x = placed.x
                column.y = placed.y
                column.rot = placed.rot
              }
            }
            state.selection = { kind: 'column', id: column.id }
          }),

        updateColumn: (id, patch) =>
          withFloor((floor) => {
            const c = floor.columns.find((x) => x.id === id)
            if (c) Object.assign(c, patch)
          }),

        createMeasure: (a, b) =>
          withFloor((floor) => {
            floor.measures.push({ id: uid('m'), ax: a.x, ay: a.y, bx: b.x, by: b.y })
          }),

        /* ---------------- editing ---------------- */
        movePoint: (id, x, y, weld) =>
          withFloor((floor) => {
            const p = floor.points.find((q) => q.id === id)
            if (!p) return
            p.x = x
            p.y = y
            if (!weld) return
            const target = nearestPoint(floor, { x, y }, 0.16, [id])
            if (!target) return
            // merge `id` into `target`
            for (const w of floor.walls) {
              if (w.a === id) w.a = target.id
              if (w.b === id) w.b = target.id
            }
            floor.walls = floor.walls.filter((w) => w.a !== w.b)
            floor.walls = floor.walls.filter(
              (w, i) => floor.walls.findIndex((o) => (o.a === w.a && o.b === w.b) || (o.a === w.b && o.b === w.a)) === i,
            )
            for (const r of floor.rooms) {
              r.loop = r.loop.map((pid) => (pid === id ? target.id : pid)).filter((pid, i, arr) => arr[i - 1] !== pid)
            }
            floor.rooms = floor.rooms.filter((r) => new Set(r.loop).size >= 3)
            floor.points = floor.points.filter((q) => q.id !== id)
            const wallIds = new Set(floor.walls.map((w) => w.id))
            floor.openings = floor.openings.filter((o) => wallIds.has(o.wallId))
          }),

        moveRoom: (id, dx, dy) =>
          withFloor((floor) => {
            const room = floor.rooms.find((r) => r.id === id)
            if (!room) return
            const ids = new Set(room.loop)
            for (const p of floor.points) if (ids.has(p.id)) {
              p.x += dx
              p.y += dy
            }
          }),

        resizeRoom: (id, w, h) =>
          withFloor((floor) => {
            const room = floor.rooms.find((r) => r.id === id)
            if (!room) return
            const pts = roomPoints(floor, room)
            if (pts.length < 3) return
            const b = polygonBounds(pts)
            const curW = b.maxX - b.minX
            const curH = b.maxY - b.minY
            if (curW < 1e-6 || curH < 1e-6) return
            const sx = Math.max(0.2, w) / curW
            const sy = Math.max(0.2, h) / curH
            const ids = new Set(room.loop)
            for (const p of floor.points) if (ids.has(p.id)) {
              p.x = b.minX + (p.x - b.minX) * sx
              p.y = b.minY + (p.y - b.minY) * sy
            }
          }),

        setRoomBounds: (id, box) =>
          withFloor((floor) => {
            const room = floor.rooms.find((r) => r.id === id)
            if (!room) return
            const pts = roomPoints(floor, room)
            if (pts.length < 3) return
            const b = polygonBounds(pts)
            const curW = b.maxX - b.minX
            const curH = b.maxY - b.minY
            const nextW = Math.max(0.2, box.maxX - box.minX)
            const nextH = Math.max(0.2, box.maxY - box.minY)
            const sx = curW < 1e-6 ? 1 : nextW / curW
            const sy = curH < 1e-6 ? 1 : nextH / curH
            const ids = new Set(room.loop)
            for (const p of floor.points) if (ids.has(p.id)) {
              p.x = box.minX + (p.x - b.minX) * sx
              p.y = box.minY + (p.y - b.minY) * sy
            }
          }),

        /** Breaks a wall in two at `at`, so the run can bend around a column. */
        splitWall: (id, at) =>
          withFloor((floor, state) => {
            const wall = floor.walls.find((w) => w.id === id)
            if (!wall) return
            const pts = pointMap(floor)
            const a = pts.get(wall.a)
            const b = pts.get(wall.b)
            if (!a || !b) return
            const len = dist(a, b)
            if (len < 0.2) return
            const r = closestOnSegment(at, a, b)
            const cut = clamp(r.t * len, 0.05, len - 0.05)
            const ang = angleOf(a, b)
            const mid = { id: uid('p'), x: a.x + Math.cos(ang) * cut, y: a.y + Math.sin(ang) * cut }
            floor.points.push(mid)

            const first: Wall = { ...wall, id: uid('w'), a: wall.a, b: mid.id }
            const second: Wall = { ...wall, id: uid('w'), a: mid.id, b: wall.b }
            floor.walls = floor.walls.filter((w) => w.id !== wall.id)
            floor.walls.push(first, second)

            for (const o of floor.openings) {
              if (o.wallId !== wall.id) continue
              if (o.offset <= cut) {
                o.wallId = first.id
                o.width = Math.min(o.width, cut)
                o.offset = clamp(o.offset, o.width / 2, Math.max(o.width / 2, cut - o.width / 2))
              } else {
                o.wallId = second.id
                const rest = len - cut
                o.width = Math.min(o.width, rest)
                o.offset = clamp(o.offset - cut, o.width / 2, Math.max(o.width / 2, rest - o.width / 2))
              }
            }

            for (const room of floor.rooms) room.loop = spliceLoopEdge(room.loop, wall.a, wall.b, [mid.id])

            state.selection = { kind: 'point', id: mid.id }
          }),

        /**
         * Removes a corner and welds its two walls back into one — the inverse of
         * splitWall. Only works where exactly two walls meet.
         */
        dissolvePoint: (id) => {
          const floor = get().project.floors.find((f) => f.id === get().activeFloorId)
          const touching = floor?.walls.filter((w) => w.a === id || w.b === id) ?? []
          if (!floor || touching.length !== 2) return false

          set(
            produce((state: ProjectState) => {
              const f = state.project.floors.find((x) => x.id === state.activeFloorId)!
              const [w1, w2] = f.walls.filter((w) => w.a === id || w.b === id)
              const pts = pointMap(f)
              const farA = w1.a === id ? w1.b : w1.a
              const farB = w2.a === id ? w2.b : w2.a
              if (farA === farB) return
              const mid = pts.get(id)!
              const len1 = dist(pts.get(farA)!, mid)

              const merged: Wall = { ...w1, id: uid('w'), a: farA, b: farB }
              f.walls = f.walls.filter((w) => w.id !== w1.id && w.id !== w2.id)
              f.walls.push(merged)

              // offsets are measured from `a`, so the second wall's openings shift along
              for (const o of f.openings) {
                if (o.wallId === w1.id) {
                  o.wallId = merged.id
                  o.offset = w1.a === farA ? o.offset : len1 - o.offset
                } else if (o.wallId === w2.id) {
                  o.wallId = merged.id
                  o.offset = len1 + (w2.a === id ? o.offset : dist(mid, pts.get(farB)!) - o.offset)
                }
              }

              for (const room of f.rooms) room.loop = room.loop.filter((p) => p !== id)
              f.rooms = f.rooms.filter((r) => r.loop.length >= 3)
              f.points = f.points.filter((p) => p.id !== id)
              state.selection = { kind: 'wall', id: merged.id }
            }),
          )
          return true
        },

        /** Pushes a wall out (or in) along its normal, leaving a U of three walls. */
        extrudeWall: (id, offset) =>
          withFloor((floor, state) => {
            if (Math.abs(offset) < 0.02) return
            const wall = floor.walls.find((w) => w.id === id)
            if (!wall) return
            const pts = pointMap(floor)
            const a = pts.get(wall.a)
            const b = pts.get(wall.b)
            if (!a || !b) return
            const ang = angleOf(a, b)
            const n = { x: -Math.sin(ang), y: Math.cos(ang) }

            const a2 = { id: uid('p'), x: a.x + n.x * offset, y: a.y + n.y * offset }
            const b2 = { id: uid('p'), x: b.x + n.x * offset, y: b.y + n.y * offset }
            floor.points.push(a2, b2)

            const side1: Wall = { ...wall, id: uid('w'), a: wall.a, b: a2.id }
            const face: Wall = { ...wall, id: uid('w'), a: a2.id, b: b2.id }
            const side2: Wall = { ...wall, id: uid('w'), a: b2.id, b: wall.b }
            floor.walls = floor.walls.filter((w) => w.id !== wall.id)
            floor.walls.push(side1, face, side2)

            // openings travel with the face, which keeps the same direction
            for (const o of floor.openings) if (o.wallId === wall.id) o.wallId = face.id

            for (const room of floor.rooms) room.loop = spliceLoopEdge(room.loop, wall.a, wall.b, [a2.id, b2.id])

            state.selection = { kind: 'wall', id: face.id }
          }),

        setWallLength: (id, length) =>
          withFloor((floor) => {
            const wall = floor.walls.find((w) => w.id === id)
            if (!wall) return
            const a = floor.points.find((p) => p.id === wall.a)
            const b = floor.points.find((p) => p.id === wall.b)
            if (!a || !b) return
            const cur = dist(a, b)
            if (cur < 1e-6) return
            const k = Math.max(0.1, length) / cur
            b.x = a.x + (b.x - a.x) * k
            b.y = a.y + (b.y - a.y) * k
          }),

        updateWall: (id, patch) =>
          withFloor((floor) => {
            const w = floor.walls.find((x) => x.id === id)
            if (w) Object.assign(w, patch)
          }),

        updateRoom: (id, patch) =>
          withFloor((floor) => {
            const r = floor.rooms.find((x) => x.id === id)
            if (r) Object.assign(r, patch)
          }),

        updateOpening: (id, patch) =>
          withFloor((floor) => {
            const o = floor.openings.find((x) => x.id === id)
            if (!o) return
            Object.assign(o, patch)
            const wall = floor.walls.find((w) => w.id === o.wallId)
            if (wall) {
              const pts = pointMap(floor)
              const len = dist(pts.get(wall.a)!, pts.get(wall.b)!)
              o.width = clamp(o.width, 0.2, Math.max(0.2, len))
              o.offset = clamp(o.offset, o.width / 2, Math.max(o.width / 2, len - o.width / 2))
            }
          }),

        updateItem: (id, patch) =>
          withFloor((floor) => {
            const it = floor.items.find((x) => x.id === id)
            if (it) Object.assign(it, patch)
          }),

        updateMeasure: (id, patch) =>
          withFloor((floor) => {
            const m = floor.measures.find((x) => x.id === id)
            if (m) Object.assign(m, patch)
          }),

        remove: (sel) =>
          withFloor((floor, state) => {
            if (sel.kind === 'site') return // the plot is switched off, never deleted
            if (sel.kind === 'item') floor.items = floor.items.filter((i) => i.id !== sel.id)
            if (sel.kind === 'column') floor.columns = floor.columns.filter((c) => c.id !== sel.id)
            if (sel.kind === 'measure') floor.measures = floor.measures.filter((m) => m.id !== sel.id)
            if (sel.kind === 'opening') floor.openings = floor.openings.filter((o) => o.id !== sel.id)
            if (sel.kind === 'wall') {
              floor.walls = floor.walls.filter((w) => w.id !== sel.id)
              floor.openings = floor.openings.filter((o) => o.wallId !== sel.id)
            }
            if (sel.kind === 'room') {
              const room = floor.rooms.find((r) => r.id === sel.id)
              if (room) {
                floor.rooms = floor.rooms.filter((r) => r.id !== sel.id)
                const stillUsed = new Set<ID>()
                for (const r of floor.rooms) for (const p of r.loop) stillUsed.add(p)
                const loopEdges = room.loop.map((p, i) => [p, room.loop[(i + 1) % room.loop.length]] as const)
                for (const [a, b] of loopEdges) {
                  if (stillUsed.has(a) && stillUsed.has(b)) continue
                  const wall = findWallBetween(floor, a, b)
                  if (wall) {
                    floor.walls = floor.walls.filter((w) => w.id !== wall.id)
                    floor.openings = floor.openings.filter((o) => o.wallId !== wall.id)
                  }
                }
              }
            }
            if (sel.kind === 'point') {
              const gone = floor.walls.filter((w) => w.a === sel.id || w.b === sel.id).map((w) => w.id)
              floor.walls = floor.walls.filter((w) => !gone.includes(w.id))
              floor.openings = floor.openings.filter((o) => !gone.includes(o.wallId))
              for (const r of floor.rooms) r.loop = r.loop.filter((p) => p !== sel.id)
              floor.rooms = floor.rooms.filter((r) => r.loop.length >= 3)
            }
            // drop orphan corners
            const used = new Set<ID>()
            for (const w of floor.walls) {
              used.add(w.a)
              used.add(w.b)
            }
            for (const r of floor.rooms) for (const p of r.loop) used.add(p)
            floor.points = floor.points.filter((p) => used.has(p.id))
            state.selection = null
          }),

        duplicate: (sel) =>
          withFloor((floor, state) => {
            if (sel.kind === 'item') {
              const it = floor.items.find((i) => i.id === sel.id)
              if (!it) return
              const copy = { ...it, id: uid('i'), x: it.x + 0.3, y: it.y + 0.3 }
              floor.items.push(copy)
              state.selection = { kind: 'item', id: copy.id }
            }
            if (sel.kind === 'column') {
              const c = floor.columns.find((x) => x.id === sel.id)
              if (!c) return
              const copy = { ...c, id: uid('c'), x: c.x + 0.4, y: c.y + 0.4 }
              floor.columns.push(copy)
              state.selection = { kind: 'column', id: copy.id }
            }
            if (sel.kind === 'room') {
              const room = floor.rooms.find((r) => r.id === sel.id)
              if (!room) return
              const pts = roomPoints(floor, room)
              const b = polygonBounds(pts)
              const dx = b.maxX - b.minX + 0.4
              const loop = pts.map((p) => addPoint(floor, p.x + dx, p.y))
              const copy = addRoomFromLoop(floor, loop, `${room.name} copy`)
              copy.color = room.color
              state.selection = { kind: 'room', id: copy.id }
            }
          }),

        /* ---------------- history + io ---------------- */
        beginDrag: () => {
          dragBase = get().project
          useProject.temporal.getState().pause()
        },
        endDrag: () => {
          const temporalState = useProject.temporal.getState()
          if (!dragBase) {
            temporalState.resume()
            return
          }
          const final = get().project
          const base = dragBase
          dragBase = null
          if (base === final) {
            temporalState.resume()
            return
          }
          set({ project: base }) // silent rewind (still paused)
          temporalState.resume()
          set({ project: final }) // recorded: undo returns to `base`
        },

        loadProject: (p, id) => {
          const project = normalizeProject(p)
          if (!project.floors.length) project.floors.push(emptyFloor('Ground floor'))
          set({
            project,
            projectId: id ?? get().projectId,
            activeFloorId: project.floors[0].id,
            selection: null,
            view: '2d',
          })
          useProject.temporal.getState().clear()
        },

        setEyeHeight: (v) => set(produce((st: ProjectState) => void (st.project.eyeHeight = clamp(v, 0.6, 2.4)))),

        updateSite: (patch) =>
          set(
            produce((st: ProjectState) => {
              st.project.site = { ...(st.project.site ?? DEFAULT_SITE), ...patch }
            }),
          ),

        setSiteOutline: (points) =>
          set(
            produce((st: ProjectState) => {
              if (points.length < 3) return
              st.project.site = { ...(st.project.site ?? DEFAULT_SITE), enabled: true, outline: points.map((p) => ({ ...p })) }
              st.selection = { kind: 'site', id: 'site' }
            }),
          ),

        moveSitePoint: (index, x, y) =>
          set(
            produce((st: ProjectState) => {
              const site = st.project.site
              if (!site?.outline[index]) return
              site.outline[index] = { x, y }
            }),
          ),

        insertSitePoint: (afterIndex, x, y) =>
          set(
            produce((st: ProjectState) => {
              const site = st.project.site
              if (!site) return
              site.outline.splice(afterIndex + 1, 0, { x, y })
            }),
          ),

        removeSitePoint: (index) =>
          set(
            produce((st: ProjectState) => {
              const site = st.project.site
              if (!site || site.outline.length <= 3) return
              site.outline.splice(index, 1)
            }),
          ),

        /** Wraps the plot around everything drawn so far, with a garden margin. */
        fitSiteToPlan: () =>
          set(
            produce((st: ProjectState) => {
              const xs: number[] = []
              const ys: number[] = []
              for (const f of st.project.floors) {
                const b = floorBounds(f)
                xs.push(b.minX, b.maxX)
                ys.push(b.minY, b.maxY)
              }
              if (!xs.length) return
              const margin = 4
              const x0 = Math.min(...xs) - margin
              const x1 = Math.max(...xs) + margin
              const y0 = Math.min(...ys) - margin
              const y1 = Math.max(...ys) + margin
              st.project.site = {
                ...(st.project.site ?? DEFAULT_SITE),
                enabled: true,
                outline: [
                  { x: x0, y: y0 },
                  { x: x1, y: y0 },
                  { x: x1, y: y1 },
                  { x: x0, y: y1 },
                ],
              }
            }),
          ),
      }
    },
    {
      limit: 120,
      partialize: (state) => ({ project: state.project, activeFloorId: state.activeFloorId }),
      equality: (a, b) => a.project === b.project,
    },
  ),
)

/* selectors --------------------------------------------------------- */
export const useActiveFloor = (): Floor => {
  const floors = useProject((s) => s.project.floors)
  const id = useProject((s) => s.activeFloorId)
  return floors.find((f) => f.id === id) ?? floors[0]
}

export const undo = () => useProject.temporal.getState().undo()
export const redo = () => useProject.temporal.getState().redo()
