import type { Floor, ID, Opening, Pt, Room, Wall } from '../types'

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

export function wallHeightOf(floor: Floor, wall: Wall): number {
  return wall.height ?? floor.height
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
  const height = wallHeightOf(floor, wall)
  const thickness = wall.thickness
  const out: WallSolid[] = []

  const at = (t: number) => ({ x: e.a.x + Math.cos(angle) * t, y: e.a.y + Math.sin(angle) * t })
  const push = (from: number, to: number, bottom: number, top: number) => {
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

/** Solids that a walking person at [feet, head] would bump into. */
export function blockingSolids(floor: Floor, feet = 0.05, head = 1.75): WallSolid[] {
  const pts = pointMap(floor)
  const out: WallSolid[] = []
  for (const wall of floor.walls) {
    for (const s of wallSolids(floor, wall, pts)) {
      if (s.top > feet && s.bottom < head) out.push(s)
    }
  }
  return out
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
/* bounds                                                              */
/* ------------------------------------------------------------------ */

export function floorBounds(floor: Floor) {
  const xs: number[] = []
  const ys: number[] = []
  for (const p of floor.points) {
    xs.push(p.x)
    ys.push(p.y)
  }
  for (const it of floor.items) {
    const r = Math.max(it.w, it.d) / 2
    xs.push(it.x - r, it.x + r)
    ys.push(it.y - r, it.y + r)
  }
  if (!xs.length) return { minX: -5, maxX: 5, minY: -4, maxY: 4 }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}
