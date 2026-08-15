import type { Column, Floor, ID, Item, Opening, OpeningKind, Room, Wall } from '../types'
import { catalogItem } from './catalog'
import {
  closestOnSegment,
  dist,
  findWallBetween,
  nearestPoint,
  pointMap,
  newEnclosedLoops,
  spliceLoopEdge,
  uid,
  type Vec,
} from './geometry'

/**
 * The primitives every plan is built from — used by the editor's actions and by
 * the templates that generate a starting home.
 */

const WELD_TOLERANCE = 0.08

export const ROOM_COLORS = ['#22304a', '#26404a', '#33304f', '#3d3550', '#2f4a3a', '#4a3f2c', '#4a2f39', '#243a4a']

export function emptyFloor(name: string, index = 0): Floor {
  return {
    id: uid('f'),
    name,
    elevation: index * 2.9,
    height: 2.6,
    wallThickness: 0.12,
    slab: 0.3,
    points: [],
    walls: [],
    rooms: [],
    columns: [],
    openings: [],
    items: [],
    measures: [],
  }
}

export function addPoint(floor: Floor, x: number, y: number, tol = WELD_TOLERANCE): ID {
  const existing = nearestPoint(floor, { x, y }, tol)
  if (existing) return existing.id
  const p = { id: uid('p'), x, y }
  floor.points.push(p)
  return p.id
}

export function addWall(floor: Floor, a: ID, b: ID, thickness?: number): Wall {
  if (a === b) throw new Error('degenerate wall')
  const existing = findWallBetween(floor, a, b)
  if (existing) return existing
  const wall: Wall = { id: uid('w'), a, b, thickness: thickness ?? floor.wallThickness, base: 0, height: null }
  floor.walls.push(wall)
  return wall
}

export function addRoomFromLoop(floor: Floor, loop: ID[], name?: string): Room {
  const room: Room = {
    id: uid('r'),
    name: name ?? `Room ${floor.rooms.length + 1}`,
    loop,
    color: ROOM_COLORS[floor.rooms.length % ROOM_COLORS.length],
    height: null,
    ceiling: true,
  }
  floor.rooms.push(room)
  for (let i = 0; i < loop.length; i++) addWall(floor, loop[i], loop[(i + 1) % loop.length])
  return room
}

export function addRect(floor: Floor, x: number, y: number, w: number, h: number, name?: string): Room {
  const loop = [
    addPoint(floor, x, y),
    addPoint(floor, x + w, y),
    addPoint(floor, x + w, y + h),
    addPoint(floor, x, y + h),
  ]
  return addRoomFromLoop(floor, loop, name)
}

/** Finds the wall that runs between two corner positions. */
export function wallBetweenAt(floor: Floor, from: Vec, to: Vec): Wall | undefined {
  const pts = pointMap(floor)
  return floor.walls.find((w) => {
    const a = pts.get(w.a)!
    const b = pts.get(w.b)!
    return (dist(a, from) < 0.2 && dist(b, to) < 0.2) || (dist(a, to) < 0.2 && dist(b, from) < 0.2)
  })
}

export function styleWall(floor: Floor, from: Vec, to: Vec, patch: Partial<Wall>) {
  const wall = wallBetweenAt(floor, from, to)
  if (wall) Object.assign(wall, patch)
}

/** Places an opening on the wall that runs between two corner positions. */
export function placeOpening(
  floor: Floor,
  from: Vec,
  to: Vec,
  kind: OpeningKind,
  offset: number,
  width: number,
  extra: Partial<Opening> = {},
) {
  const pts = pointMap(floor)
  const wall = wallBetweenAt(floor, from, to)
  if (!wall) return
  const a = pts.get(wall.a)!
  const flipped = dist(a, from) > 0.2
  const len = dist(pts.get(wall.a)!, pts.get(wall.b)!)
  floor.openings.push({
    id: uid('o'),
    wallId: wall.id,
    kind,
    offset: flipped ? len - offset : offset,
    width,
    height: kind === 'door' ? 2.03 : 1.2,
    sill: kind === 'door' ? 0 : 1.0,
    flipSide: false,
    flipHinge: false,
    doorType: 'hinged',
    ...extra,
  })
}

export function addItem(floor: Floor, kind: string, x: number, y: number, rot = 0): Item {
  const def = catalogItem(kind)
  const item: Item = {
    id: uid('i'),
    kind,
    name: def.name,
    x,
    y,
    rot,
    w: def.w,
    d: def.d,
    h: def.h,
    z: def.z ?? 0,
    color: def.color,
  }
  floor.items.push(item)
  return item
}

export function addColumn(floor: Floor, x: number, y: number, patch: Partial<Column> = {}): Column {
  const column: Column = {
    id: uid('c'),
    name: patch.shape === 'round' ? 'Round column' : 'Column',
    x,
    y,
    w: 0.3,
    d: 0.3,
    rot: 0,
    base: 0,
    height: null,
    shape: 'rect',
    color: '#b9c0cd',
    ...patch,
  }
  floor.columns.push(column)
  return column
}

/**
 * Splits walls wherever another corner lands in the middle of them and drops
 * duplicates, so a room built against a longer wall shares one wall with it
 * instead of drawing a second one on top.
 */
export function tidyWalls(floor: Floor, tolerance = 0.012) {
  for (let pass = 0; pass < 200; pass++) {
    const pts = pointMap(floor)
    let split = false
    for (const wall of floor.walls) {
      const a = pts.get(wall.a)
      const b = pts.get(wall.b)
      if (!a || !b) continue
      const len = dist(a, b)
      for (const p of floor.points) {
        if (p.id === wall.a || p.id === wall.b) continue
        const r = closestOnSegment(p, a, b)
        if (r.dist > tolerance) continue
        const cut = r.t * len
        if (cut < 0.05 || cut > len - 0.05) continue

        const first: Wall = { ...wall, id: uid('w'), a: wall.a, b: p.id }
        const second: Wall = { ...wall, id: uid('w'), a: p.id, b: wall.b }
        floor.walls = floor.walls.filter((w) => w.id !== wall.id)
        floor.walls.push(first, second)
        for (const o of floor.openings) {
          if (o.wallId !== wall.id) continue
          if (o.offset <= cut) o.wallId = first.id
          else {
            o.wallId = second.id
            o.offset -= cut
          }
        }
        for (const room of floor.rooms) room.loop = spliceLoopEdge(room.loop, wall.a, wall.b, [p.id])
        split = true
        break
      }
      if (split) break
    }
    if (!split) break
  }

  // two walls between the same pair of corners are one wall
  const seen = new Map<string, Wall>()
  const remap = new Map<ID, ID>()
  for (const w of floor.walls) {
    const key = [w.a, w.b].sort().join('|')
    const kept = seen.get(key)
    if (kept) remap.set(w.id, kept.id)
    else seen.set(key, w)
  }
  floor.walls = [...seen.values()]
  for (const o of floor.openings) {
    const to = remap.get(o.wallId)
    if (to) o.wallId = to
  }
}

/**
 * Turns every space the walls enclose into a room. This is the bridge between
 * "I drew some walls" and "these are rooms I can name and measure".
 */
export function adoptEnclosedRooms(floor: Floor): Room[] {
  tidyWalls(floor)
  const added: Room[] = []
  for (const loop of newEnclosedLoops(floor)) {
    const room = addRoomFromLoop(floor, loop)
    added.push(room)
  }
  return added
}

/** Takes out the wall between two corner positions — for an open passage. */
export function removeWallBetween(floor: Floor, from: Vec, to: Vec) {
  const wall = wallBetweenAt(floor, from, to)
  if (!wall) return
  floor.walls = floor.walls.filter((w) => w.id !== wall.id)
  floor.openings = floor.openings.filter((o) => o.wallId !== wall.id)
}
