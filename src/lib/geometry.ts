import type { Column, Floor, ID, Item, Opening, Pt, Room, Wall } from '../types'
import { isStair, stairProgressAt, stairWellLocal } from './stairs'

export interface Vec {
  x: number
  y: number
}

let counter = 0
export function uid(prefix = 'e'): ID {
  counter += 1
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const round = (v: number, step = 0.001) => Math.round(v / step) * step
export const dist = (a: Vec, b: Vec) => Math.hypot(b.x - a.x, b.y - a.y)
export const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
export const angleOf = (a: Vec, b: Vec) => Math.atan2(b.y - a.y, b.x - a.x)

export function formatLen(m: number): string {
  if (Math.abs(m) < 1) return `${Math.round(m * 100)} cm`
  return `${m.toFixed(2)} m`
}

export function formatArea(m2: number): string {
  return `${m2.toFixed(2)} m²`
}

/** Closest point to `p` on segment ab, plus the parametric position t ∈ [0,1]. */
export function closestOnSegment(p: Vec, a: Vec, b: Vec): { point: Vec; t: number; dist: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1)
  const point = { x: a.x + dx * t, y: a.y + dy * t }
  return { point, t, dist: dist(p, point) }
}

export function polygonArea(pts: Vec[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

export function polygonCentroid(pts: Vec[]): Vec {
  let s = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const cross = a.x * b.y - b.x * a.y
    s += cross
    cx += (a.x + b.x) * cross
    cy += (a.y + b.y) * cross
  }
  if (Math.abs(s) < 1e-9) {
    const avg = pts.reduce((acc, p) => ({ x: acc.x + p.x / pts.length, y: acc.y + p.y / pts.length }), { x: 0, y: 0 })
    return avg
  }
  s *= 3
  return { x: cx / s, y: cy / s }
}

export function pointInPolygon(p: Vec, pts: Vec[]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]
    const b = pts[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function polygonBounds(pts: Vec[]) {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

/* ------------------------------------------------------------------ */
/* floor helpers                                                       */
/* ------------------------------------------------------------------ */

export function pointMap(floor: Floor): Map<ID, Pt> {
  const m = new Map<ID, Pt>()
  for (const p of floor.points) m.set(p.id, p)
  return m
}

export function wallEnds(floor: Floor, wall: Wall, pts = pointMap(floor)): { a: Pt; b: Pt } | null {
  const a = pts.get(wall.a)
  const b = pts.get(wall.b)
  if (!a || !b) return null
  return { a, b }
}

export function wallLength(floor: Floor, wall: Wall, pts = pointMap(floor)): number {
  const e = wallEnds(floor, wall, pts)
  return e ? dist(e.a, e.b) : 0
}

export function roomPoints(floor: Floor, room: Room, pts = pointMap(floor)): Pt[] {
  return room.loop.map((id) => pts.get(id)).filter((p): p is Pt => !!p)
}

export function roomArea(floor: Floor, room: Room, pts = pointMap(floor)): number {
  return polygonArea(roomPoints(floor, room, pts))
}

export function roomPerimeter(floor: Floor, room: Room, pts = pointMap(floor)): number {
  const p = roomPoints(floor, room, pts)
  let total = 0
  for (let i = 0; i < p.length; i++) total += dist(p[i], p[(i + 1) % p.length])
  return total
}

/** Height of the top of a wall above the floor slab. */
export function wallTopOf(floor: Floor, wall: Wall): number {
  const base = wall.base ?? 0
  return wall.height === null || wall.height === undefined ? floor.height : base + wall.height
}

export function wallBaseOf(wall: Wall): number {
  return wall.base ?? 0
}

/** True for a wall that neither starts on the floor nor reaches the ceiling. */
export function isPartialWall(floor: Floor, wall: Wall): boolean {
  return wallBaseOf(wall) > 1e-6 || wallTopOf(floor, wall) < floor.height - 1e-6
}

export function findWallBetween(floor: Floor, a: ID, b: ID): Wall | undefined {
  return floor.walls.find((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a))
}

/** Walls that touch a given point. */
export function wallsAtPoint(floor: Floor, pointId: ID): Wall[] {
  return floor.walls.filter((w) => w.a === pointId || w.b === pointId)
}

export function openingsOfWall(floor: Floor, wallId: ID): Opening[] {
  return floor.openings.filter((o) => o.wallId === wallId).sort((x, y) => x.offset - y.offset)
}

/** Nearest wall to a plan position, within `maxDist` metres. */
export function nearestWall(
  floor: Floor,
  p: Vec,
  maxDist = 0.6,
): { wall: Wall; t: number; point: Vec; dist: number; length: number } | null {
  const pts = pointMap(floor)
  let best: { wall: Wall; t: number; point: Vec; dist: number; length: number } | null = null
  for (const wall of floor.walls) {
    const e = wallEnds(floor, wall, pts)
    if (!e) continue
    const r = closestOnSegment(p, e.a, e.b)
    const halfT = wall.thickness / 2
    if (r.dist - halfT > maxDist) continue
    if (!best || r.dist < best.dist) best = { wall, t: r.t, point: r.point, dist: r.dist, length: dist(e.a, e.b) }
  }
  return best
}

/** Nearest existing corner, for welding / snapping. */
export function nearestPoint(floor: Floor, p: Vec, maxDist: number, exclude: ID[] = []): Pt | null {
  let best: Pt | null = null
  let bestD = maxDist
  for (const pt of floor.points) {
    if (exclude.includes(pt.id)) continue
    const d = dist(p, pt)
    if (d <= bestD) {
      best = pt
      bestD = d
    }
  }
  return best
}

/**
 * Inserts corners into a room outline along the edge a→b, keeping the winding:
 * the ids go in as given when the loop walks a→b, and reversed when it walks
 * b→a. Returns the same array when the edge is not part of this loop.
 */
export function spliceLoopEdge(loop: ID[], a: ID, b: ID, ids: ID[]): ID[] {
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i]
    const q = loop[(i + 1) % loop.length]
    if (p === a && q === b) return [...loop.slice(0, i + 1), ...ids, ...loop.slice(i + 1)]
    if (p === b && q === a) return [...loop.slice(0, i + 1), ...[...ids].reverse(), ...loop.slice(i + 1)]
  }
  return loop
}

/* ------------------------------------------------------------------ */
/* finding the spaces a set of walls encloses                          */
/* ------------------------------------------------------------------ */

/** Signed area — negative and positive tell the two winding directions apart. */
export function signedArea(pts: Vec[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    s += a.x * b.y - b.x * a.y
  }
  return s / 2
}

/**
 * Walks the wall graph and returns every enclosed space, as a loop of corner
 * ids. This is what turns "I drew some walls" into "these are rooms": at each
 * corner the walk always takes the next edge clockwise, which traces out each
 * face of the graph exactly once. The outline around the outside of a group of
 * walls comes out wound the other way, so it drops out on its own.
 */
export function enclosedLoops(floor: Floor): ID[][] {
  const pts = pointMap(floor)
  const neighbours = new Map<ID, ID[]>()
  for (const w of floor.walls) {
    if (w.a === w.b) continue
    if (!neighbours.has(w.a)) neighbours.set(w.a, [])
    if (!neighbours.has(w.b)) neighbours.set(w.b, [])
    neighbours.get(w.a)!.push(w.b)
    neighbours.get(w.b)!.push(w.a)
  }
  // sorted anticlockwise around each corner
  for (const [id, list] of neighbours) {
    const here = pts.get(id)
    if (!here) continue
    list.sort((p, q) => {
      const a = pts.get(p)!
      const b = pts.get(q)!
      return Math.atan2(a.y - here.y, a.x - here.x) - Math.atan2(b.y - here.y, b.x - here.x)
    })
  }

  const visited = new Set<string>()
  const loops: ID[][] = []
  for (const w of floor.walls) {
    for (const [from, to] of [
      [w.a, w.b],
      [w.b, w.a],
    ] as const) {
      if (visited.has(`${from}|${to}`)) continue
      const loop: ID[] = []
      let u = from
      let v = to
      for (let guard = 0; guard < 4096; guard++) {
        visited.add(`${u}|${v}`)
        loop.push(u)
        const list = neighbours.get(v)
        if (!list?.length) break
        const i = list.indexOf(u)
        if (i < 0) break
        const next = list[(i - 1 + list.length) % list.length]
        u = v
        v = next
        if (u === from && v === to) break
      }
      if (loop.length >= 3) loops.push(loop)
    }
  }

  return loops.filter((loop) => {
    const poly = loop.map((id) => pts.get(id)).filter((p): p is Pt => !!p)
    if (poly.length < 3) return false
    // enclosed faces wind one way, the outline around a group winds the other
    return signedArea(poly) > 0.05
  })
}

/** Loops that no room covers yet. */
export function newEnclosedLoops(floor: Floor, minArea = 0.6): ID[][] {
  const known = new Set(floor.rooms.map((r) => [...r.loop].sort().join('|')))
  const pts = pointMap(floor)
  return enclosedLoops(floor).filter((loop) => {
    if (known.has([...loop].sort().join('|'))) return false
    const poly = loop.map((id) => pts.get(id)).filter((p): p is Pt => !!p)
    if (polygonArea(poly) < minArea) return false
    // ignore a loop that just re-traces a room we already have
    const centre = polygonCentroid(poly)
    return !floor.rooms.some((r) => {
      const rp = roomPoints(floor, r, pts)
      return rp.length >= 3 && pointInPolygon(centre, rp) && Math.abs(polygonArea(rp) - polygonArea(poly)) < 0.05
    })
  })
}

/* ------------------------------------------------------------------ */
/* wall geometry used by both the 2D plan and the 3D build             */
/* ------------------------------------------------------------------ */

export interface WallSolid {
  /** centre of the box in plan coordinates */
  cx: number
  cy: number
  /** length along the wall */
  len: number
  thickness: number
  /** bottom / top of the box relative to the floor slab */
  bottom: number
  top: number
  angle: number
}

/**
 * Splits a wall into solid boxes, leaving holes where doors and windows are.
 * Doors leave a full-height hole (plus a lintel above), windows leave a hole
 * with a solid piece below the sill and above the head.
 */
export function wallSolids(floor: Floor, wall: Wall, pts = pointMap(floor)): WallSolid[] {
  const e = wallEnds(floor, wall, pts)
  if (!e) return []
  const len = dist(e.a, e.b)
  if (len < 1e-4) return []
  const angle = angleOf(e.a, e.b)
  const base = wallBaseOf(wall)
  const height = wallTopOf(floor, wall)
  const thickness = wall.thickness
  const out: WallSolid[] = []
  if (height - base <= 1e-4) return []

  const at = (t: number) => ({ x: e.a.x + Math.cos(angle) * t, y: e.a.y + Math.sin(angle) * t })
  const push = (from: number, to: number, rawBottom: number, rawTop: number) => {
    // a wall only ever exists between its own base and top
    const bottom = Math.max(rawBottom, base)
    const top = Math.min(rawTop, height)
    const l = to - from
    if (l <= 1e-4 || top - bottom <= 1e-4) return
    const c = at((from + to) / 2)
    out.push({ cx: c.x, cy: c.y, len: l, thickness, bottom, top, angle })
  }

  const holes = openingsOfWall(floor, wall.id)
    .map((o) => {
      const half = o.width / 2
      const from = clamp(o.offset - half, 0, len)
      const to = clamp(o.offset + half, 0, len)
      const sill = o.kind === 'door' ? 0 : o.sill
      const head = Math.min(height, sill + o.height)
      return { from, to, sill, head }
    })
    .filter((h) => h.to - h.from > 1e-3)
    .sort((x, y) => x.from - y.from)

  let cursor = 0
  for (const h of holes) {
    if (h.from > cursor) push(cursor, h.from, 0, height)
    // under the opening (window sill wall)
    push(Math.max(h.from, cursor), h.to, 0, h.sill)
    // lintel above the opening
    push(Math.max(h.from, cursor), h.to, h.head, height)
    cursor = Math.max(cursor, h.to)
  }
  if (cursor < len) push(cursor, len, 0, height)

  return out
}

export function columnTopOf(floor: Floor, column: Column): number {
  return column.height === null || column.height === undefined ? floor.height : column.base + column.height
}

export function columnSolid(floor: Floor, column: Column): WallSolid {
  return {
    cx: column.x,
    cy: column.y,
    len: column.w,
    thickness: column.d,
    bottom: column.base,
    top: columnTopOf(floor, column),
    angle: column.rot,
  }
}

/** A closed door leaf, as a solid you cannot walk through. */
export function doorBlockers(floor: Floor, openIds: Set<ID>): WallSolid[] {
  const pts = pointMap(floor)
  const out: WallSolid[] = []
  for (const o of floor.openings) {
    // a cased opening never has anything to block you
    if (o.kind !== 'door' || o.doorType === 'open' || openIds.has(o.id)) continue
    const wall = floor.walls.find((w) => w.id === o.wallId)
    if (!wall) continue
    const e = wallEnds(floor, wall, pts)
    if (!e) continue
    const angle = angleOf(e.a, e.b)
    out.push({
      cx: e.a.x + Math.cos(angle) * o.offset,
      cy: e.a.y + Math.sin(angle) * o.offset,
      len: o.width,
      thickness: wall.thickness,
      bottom: wallBaseOf(wall),
      top: Math.min(wallTopOf(floor, wall), o.height),
      angle,
    })
  }
  return out
}

/** Solids that a walking person at [feet, head] would bump into. */
export function blockingSolids(floor: Floor, feet = 0.05, head = 1.75, openDoors?: Set<ID>): WallSolid[] {
  const pts = pointMap(floor)
  const out: WallSolid[] = []
  for (const wall of floor.walls) {
    for (const s of wallSolids(floor, wall, pts)) {
      if (s.top > feet && s.bottom < head) out.push(s)
    }
  }
  for (const column of floor.columns ?? []) {
    const s = columnSolid(floor, column)
    if (s.top > feet && s.bottom < head) out.push(s)
  }
  if (openDoors) {
    for (const s of doorBlockers(floor, openDoors)) if (s.top > feet && s.bottom < head) out.push(s)
  }
  return out
}

/** The door nearest to a position, for the "press E to open" prompt. */
export function nearestDoor(floor: Floor, p: Vec, maxDist = 1.6): { opening: Opening; dist: number } | null {
  const pts = pointMap(floor)
  let best: { opening: Opening; dist: number } | null = null
  for (const o of floor.openings) {
    if (o.kind !== 'door' || o.doorType === 'open') continue
    const wall = floor.walls.find((w) => w.id === o.wallId)
    if (!wall) continue
    const e = wallEnds(floor, wall, pts)
    if (!e) continue
    const angle = angleOf(e.a, e.b)
    const c = { x: e.a.x + Math.cos(angle) * o.offset, y: e.a.y + Math.sin(angle) * o.offset }
    const d = dist(p, c)
    if (d <= maxDist && (!best || d < best.dist)) best = { opening: o, dist: d }
  }
  return best
}

/** Pushes a circle of `radius` out of every solid box it overlaps. */
export function resolveCollisions(pos: Vec, radius: number, solids: WallSolid[]): Vec {
  let { x, y } = pos
  for (let pass = 0; pass < 3; pass++) {
    let moved = false
    for (const s of solids) {
      const cos = Math.cos(s.angle)
      const sin = Math.sin(s.angle)
      const dx = x - s.cx
      const dy = y - s.cy
      // into wall-local space
      const lx = dx * cos + dy * sin
      const ly = -dx * sin + dy * cos
      const hx = s.len / 2
      const hy = s.thickness / 2
      const cx = clamp(lx, -hx, hx)
      const cy = clamp(ly, -hy, hy)
      const ddx = lx - cx
      const ddy = ly - cy
      const d2 = ddx * ddx + ddy * ddy
      if (d2 > radius * radius) continue
      let nx: number
      let ny: number
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2)
        nx = (ddx / d) * (radius - d)
        ny = (ddy / d) * (radius - d)
      } else {
        // centre is inside the box: push out along the shallowest axis
        const ox = hx + radius - Math.abs(lx)
        const oy = hy + radius - Math.abs(ly)
        if (ox < oy) {
          nx = Math.sign(lx || 1) * ox
          ny = 0
        } else {
          nx = 0
          ny = Math.sign(ly || 1) * oy
        }
      }
      x += nx * cos - ny * sin
      y += nx * sin + ny * cos
      moved = true
    }
    if (!moved) break
  }
  return { x, y }
}

/* ------------------------------------------------------------------ */
/* snapping furniture to the face of a wall                            */
/* ------------------------------------------------------------------ */

export interface Placed {
  x: number
  y: number
  w: number
  d: number
  rot: number
}

/** Half-extent of a rotated footprint measured along the direction `n`. */
function halfExtentAlong(item: { w: number; d: number; rot: number }, n: Vec): number {
  const ux = Math.cos(item.rot)
  const uy = Math.sin(item.rot)
  return Math.abs((item.w / 2) * (ux * n.x + uy * n.y)) + Math.abs((item.d / 2) * (-uy * n.x + ux * n.y))
}

/**
 * Pushes an item against the *face* of the nearest wall — never inside it —
 * and lines it up with the wall when it is already roughly parallel.
 * Returns null when no wall is close enough.
 */
export function snapToWallFace(floor: Floor, item: Placed, maxDist = 0.35): Placed | null {
  const pts = pointMap(floor)
  let best: { placed: Placed; delta: number } | null = null

  for (const wall of floor.walls) {
    const e = wallEnds(floor, wall, pts)
    if (!e) continue
    const len = dist(e.a, e.b)
    if (len < 1e-4) continue
    const ang = angleOf(e.a, e.b)
    const dir = { x: Math.cos(ang), y: Math.sin(ang) }
    const n = { x: -dir.y, y: dir.x }
    const rel = { x: item.x - e.a.x, y: item.y - e.a.y }
    const along = rel.x * dir.x + rel.y * dir.y
    const lateral = rel.x * n.x + rel.y * n.y
    // only walls the item actually sits next to
    if (along < -item.w / 2 || along > len + item.w / 2) continue

    // line the item up with the wall when it is within ~25° of parallel
    let rot = item.rot
    const quarter = Math.PI / 2
    const candidate = ang + Math.round((rot - ang) / quarter) * quarter
    if (Math.abs(((rot - candidate + Math.PI) % (Math.PI * 2)) - Math.PI) < 0.44) rot = candidate

    const side = lateral >= 0 ? 1 : -1
    const he = halfExtentAlong({ w: item.w, d: item.d, rot }, n)
    const clear = wall.thickness / 2 + he
    const target = side * clear
    const delta = target - lateral
    // snap when close enough, and always when the footprint runs into the wall —
    // furniture is pushed against the face, never left inside it
    const overlapping = Math.abs(lateral) < clear
    if (!overlapping && Math.abs(delta) > maxDist) continue
    if (best && Math.abs(delta) >= Math.abs(best.delta)) continue

    best = {
      delta,
      placed: { ...item, rot, x: item.x + n.x * delta, y: item.y + n.y * delta },
    }
  }

  return best?.placed ?? null
}

/* ------------------------------------------------------------------ */
/* stairs                                                              */
/* ------------------------------------------------------------------ */

/** The four corners of a rotated footprint, in plan coordinates. */
export function footprintCorners(it: { x: number; y: number; w: number; d: number; rot: number }, grow = 0): Vec[] {
  const cos = Math.cos(it.rot)
  const sin = Math.sin(it.rot)
  const hw = it.w / 2 + grow
  const hd = it.d / 2 + grow
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([lx, ly]) => ({ x: it.x + lx * cos - ly * sin, y: it.y + lx * sin + ly * cos }))
}

/** Footprint outline in local space, taking any notch into account. */
export function itemOutlineLocal(item: { w: number; d: number; notch?: { depth: number; left: number; right: number } }): Vec[] {
  const hw = item.w / 2
  const hd = item.d / 2
  const n = item.notch
  if (!n || n.depth <= 0.01 || (n.left <= 0.01 && n.right <= 0.01)) {
    return [
      { x: -hw, y: -hd },
      { x: hw, y: -hd },
      { x: hw, y: hd },
      { x: -hw, y: hd },
    ]
  }
  const depth = Math.min(n.depth, item.d)
  const left = Math.min(n.left, item.w)
  const right = Math.min(n.right, item.w - left)
  return [
    { x: -hw + left, y: -hd },
    { x: hw - right, y: -hd },
    { x: hw - right, y: -hd + depth },
    { x: hw, y: -hd + depth },
    { x: hw, y: hd },
    { x: -hw, y: hd },
    { x: -hw, y: -hd + depth },
    { x: -hw + left, y: -hd + depth },
  ]
}

export function stairsOf(floor: Floor): Item[] {
  return floor.items.filter((i) => isStair(i.kind))
}

/** Puts a local point into plan coordinates for an item. */
export function toWorld(it: { x: number; y: number; rot: number }, lx: number, ly: number): Vec {
  const cos = Math.cos(it.rot)
  const sin = Math.sin(it.rot)
  return { x: it.x + lx * cos - ly * sin, y: it.y + lx * sin + ly * cos }
}

/** Puts a plan point into an item's local space. */
export function toLocal(it: { x: number; y: number; rot: number }, p: Vec): Vec {
  const cos = Math.cos(it.rot)
  const sin = Math.sin(it.rot)
  const dx = p.x - it.x
  const dy = p.y - it.y
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos }
}

/** Openings a flight of stairs needs in the slab of the floor above. */
export function stairWells(floor: Floor): Vec[][] {
  return stairsOf(floor).map((s) => stairWellLocal(s.kind, s).map((p) => toWorld(s, p.x, p.y)))
}

/** Height above the floor slab when standing on a flight, or null when off it. */
export function stairRampHeight(floor: Floor, p: Vec): number | null {
  let best: number | null = null
  for (const s of stairsOf(floor)) {
    const l = toLocal(s, p)
    const progress = stairProgressAt(s.kind, s, l.x, l.y)
    if (progress === null) continue
    const h = s.z + progress * s.h
    if (best === null || h > best) best = h
  }
  return best
}

/** Slab (or step) the walker is standing on, allowing a normal step up. */
export function groundHeightAt(floors: Floor[], p: Vec, currentY: number, stepUp = 0.42): number {
  let best = -Infinity
  for (const f of floors) {
    const ramp = stairRampHeight(f, p)
    if (ramp !== null) {
      const h = f.elevation + ramp
      if (h <= currentY + stepUp && h > best) best = h
    }
    if (f.elevation <= currentY + stepUp && f.elevation > best) {
      // the stairwell coming up from below is a hole, not floor
      const below = floors
        .filter((x) => x.elevation < f.elevation - 0.1)
        .sort((a, b) => b.elevation - a.elevation)[0]
      if (below && stairWells(below).some((hole) => pointInPolygon(p, hole))) continue
      const pts = pointMap(f)
      if (f.rooms.some((r) => pointInPolygon(p, roomPoints(f, r, pts)))) best = f.elevation
    }
  }
  return best === -Infinity ? 0 : best
}

/** Every solid of a floor, lifted to its real height above the ground. */
export function absoluteSolids(floor: Floor, openDoors: Set<ID>): WallSolid[] {
  return blockingSolids(floor, -Infinity, Infinity, openDoors).map((s) => ({
    ...s,
    bottom: s.bottom + floor.elevation,
    top: s.top + floor.elevation,
  }))
}

/* ------------------------------------------------------------------ */
/* bounds                                                              */
/* ------------------------------------------------------------------ */

export function floorBounds(floor: Floor) {
  const xs: number[] = []
  const ys: number[] = []
  for (const p of floor.points) {
    xs.push(p.x)
    ys.push(p.y)
  }
  for (const it of [...floor.items, ...(floor.columns ?? [])]) {
    const r = Math.max(it.w, it.d) / 2
    xs.push(it.x - r, it.x + r)
    ys.push(it.y - r, it.y + r)
  }
  if (!xs.length) return { minX: -5, maxX: 5, minY: -4, maxY: 4 }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}
