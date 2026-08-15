/**
 * Where a measurement is taken from.
 *
 * The model stores wall *centrelines* — a wall is a line with a thickness
 * hung around it — because that is what makes corners, openings and the 3D
 * build work. But nobody measures a room down the middle of its walls: a tape
 * measure runs from plaster to plaster. This module turns the centreline model
 * into the three figures people actually quote.
 *
 *   inner  — face to face inside the room, the clear (usable) size
 *   centre — centreline to centreline, the raw model
 *   outer  — outside face to outside face, the footprint the walls occupy
 */

import type { Floor, ID, Room, Wall } from '../types'
import type { Vec } from './geometry'
import {
  dist,
  findWallBetween,
  pointMap,
  polygonArea,
  polygonBounds,
  roomPoints,
  signedArea,
  wallFaces,
  wallLength,
} from './geometry'

export type Basis = 'inner' | 'centre' | 'outer'

export const BASIS_LABEL: Record<Basis, string> = {
  inner: 'interior',
  centre: 'centreline',
  outer: 'exterior',
}

export const BASIS_OPTIONS = [
  { value: 'inner', label: 'Interior — face to face inside' },
  { value: 'centre', label: 'Centreline — middle of the walls' },
  { value: 'outer', label: 'Exterior — outside faces' },
] as const

/** +1 to move a face inwards, -1 outwards, 0 to stay on the centreline. */
const towards = (basis: Basis) => (basis === 'inner' ? 1 : basis === 'outer' ? -1 : 0)

/** Thickness of the wall drawn along a room edge, or the floor default. */
export function edgeThickness(floor: Floor, a: ID, b: ID): number {
  return findWallBetween(floor, a, b)?.thickness ?? floor.wallThickness
}

/** Where two lines (point + direction) cross; null when they are parallel. */
function intersect(p: Vec, u: Vec, q: Vec, v: Vec): Vec | null {
  const den = u.x * v.y - u.y * v.x
  if (Math.abs(den) < 1e-9) return null
  const t = ((q.x - p.x) * v.y - (q.y - p.y) * v.x) / den
  return { x: p.x + u.x * t, y: p.y + u.y * t }
}

/**
 * The outline of a room measured on a given basis: every edge is pushed in (or
 * out) by half the thickness of the wall that sits on it, and the corners are
 * mitred, so two walls of different thickness still meet cleanly.
 */
export function roomOutline(floor: Floor, room: Room, basis: Basis, pts = pointMap(floor)): Vec[] {
  const poly = roomPoints(floor, room, pts)
  if (poly.length < 3 || basis === 'centre') return poly
  const dir = towards(basis) * (signedArea(poly) > 0 ? 1 : -1)

  const n = poly.length
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n]
    const len = dist(a, b)
    if (len < 1e-9) return null
    const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len }
    // interior of a positively wound loop lies to the left of each edge
    const off = (dir * edgeThickness(floor, poly[i].id, poly[(i + 1) % n].id)) / 2
    return { p: { x: a.x - u.y * off, y: a.y + u.x * off }, u }
  })

  return poly.map((corner, i) => {
    const prev = lines[(i - 1 + n) % n]
    const here = lines[i]
    if (!prev || !here) return corner
    return intersect(prev.p, prev.u, here.p, here.u) ?? here.p
  })
}

export function roomAreaOn(floor: Floor, room: Room, basis: Basis, pts = pointMap(floor)): number {
  return polygonArea(roomOutline(floor, room, basis, pts))
}

export function roomPerimeterOn(floor: Floor, room: Room, basis: Basis, pts = pointMap(floor)): number {
  const p = roomOutline(floor, room, basis, pts)
  let total = 0
  for (let i = 0; i < p.length; i++) total += dist(p[i], p[(i + 1) % p.length])
  return total
}

export function roomBoundsOn(floor: Floor, room: Room, basis: Basis, pts = pointMap(floor)) {
  const p = roomOutline(floor, room, basis, pts)
  return polygonBounds(p.length >= 3 ? p : roomPoints(floor, room, pts))
}

/** Floor area of a whole storey, measured the same way everywhere. */
export function floorAreaOn(floor: Floor, basis: Basis): number {
  const pts = pointMap(floor)
  return floor.rooms.reduce((sum, r) => sum + roomAreaOn(floor, r, basis, pts), 0)
}

/* ------------------------------------------------------------------ */
/* walls                                                               */
/* ------------------------------------------------------------------ */

/**
 * The three lengths of a wall, straight off the faces it is built with: the
 * short face (cut back where it meets its neighbours), the centreline, and the
 * long face (carried on past the centreline into the corner).
 */
export function wallLengths(floor: Floor, wall: Wall, pts = pointMap(floor)) {
  const centre = wallLength(floor, wall, pts)
  const faces = wallFaces(floor, wall, pts)
  if (!faces) return { inner: centre, centre, outer: centre }
  const left = dist(faces.left[0], faces.left[1])
  const right = dist(faces.right[0], faces.right[1])
  return { inner: Math.min(left, right), centre, outer: Math.max(left, right) }
}

/** Length of a wall on a given basis. */
export function wallLengthOn(floor: Floor, wall: Wall, basis: Basis, pts = pointMap(floor)): number {
  return wallLengths(floor, wall, pts)[basis === 'inner' ? 'inner' : basis === 'outer' ? 'outer' : 'centre']
}

/**
 * Turns a length typed on `basis` back into the centreline the model stores.
 * Moving the far corner does not change what the neighbours cut off the ends,
 * so the two lengths shift by the same amount.
 */
export function centreLengthFrom(floor: Floor, wall: Wall, basis: Basis, typed: number, pts = pointMap(floor)): number {
  const runs = wallLengths(floor, wall, pts)
  const shown = basis === 'inner' ? runs.inner : basis === 'outer' ? runs.outer : runs.centre
  return Math.max(0.05, runs.centre + (typed - shown))
}
