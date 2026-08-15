import type { Vec } from './geometry'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Stairs are described as a centre-line path through the footprint. Everything
 * else — the steps, the plan symbol, the height you are at while walking up and
 * the well that has to be cut in the slab above — is derived from that one path,
 * so a straight flight, a quarter turn, a half turn and a spiral all behave the
 * same way.
 *
 * Local space: x right, z depth (the flight starts at -z), origin at the centre.
 */

export type StairShape = 'straight' | 'quarter' | 'half' | 'spiral'

export const STAIR_KINDS: Record<string, StairShape> = {
  stairs: 'straight',
  'stairs-l': 'quarter',
  'stairs-u': 'half',
  'stairs-spiral': 'spiral',
}

export const isStair = (kind: string) => kind in STAIR_KINDS
export const stairShapeOf = (kind: string): StairShape => STAIR_KINDS[kind] ?? 'straight'

export interface Size {
  w: number
  d: number
  h: number
}

type Seg =
  | { kind: 'line'; ax: number; az: number; bx: number; bz: number; width: number }
  | { kind: 'arc'; cx: number; cz: number; radius: number; width: number; a0: number; a1: number }

const segLength = (s: Seg) =>
  s.kind === 'line' ? Math.hypot(s.bx - s.ax, s.bz - s.az) : Math.abs(s.a1 - s.a0) * s.radius

/** Width of the flight itself inside the footprint. */
export function flightWidth(shape: StairShape, { w, d }: Size): number {
  if (shape === 'straight') return w
  if (shape === 'spiral') return Math.min(w, d) / 2
  return Math.min(w, d) * 0.45
}

function path(shape: StairShape, size: Size): Seg[] {
  const { w, d } = size
  const sw = flightWidth(shape, size)

  if (shape === 'straight') {
    return [{ kind: 'line', ax: 0, az: -d / 2, bx: 0, bz: d / 2, width: w }]
  }

  if (shape === 'quarter') {
    // up the left-hand side, quarter landing, then off to the right
    const x0 = -w / 2 + sw / 2
    const z1 = d / 2 - sw / 2
    return [
      { kind: 'line', ax: x0, az: -d / 2, bx: x0, bz: z1, width: sw },
      { kind: 'line', ax: x0, az: z1, bx: w / 2, bz: z1, width: sw },
    ]
  }

  if (shape === 'half') {
    // up one side, landing across the end, back down the other side
    const xl = -w / 2 + sw / 2
    const xr = w / 2 - sw / 2
    const z1 = d / 2 - sw / 2
    return [
      { kind: 'line', ax: xl, az: -d / 2, bx: xl, bz: z1, width: sw },
      { kind: 'line', ax: xl, az: z1, bx: xr, bz: z1, width: sw },
      { kind: 'line', ax: xr, az: z1, bx: xr, bz: -d / 2, width: sw },
    ]
  }

  // spiral: 1.25 turns around the newel post
  const radius = Math.min(w, d) / 2
  return [
    {
      kind: 'arc',
      cx: 0,
      cz: 0,
      radius: radius * 0.62,
      width: radius * 0.76,
      a0: -Math.PI / 2,
      a1: -Math.PI / 2 + Math.PI * 2.5,
    },
  ]
}

export interface StairStep {
  /** centre of the tread in local space */
  x: number
  z: number
  /** rotation of the tread about the vertical axis */
  rot: number
  width: number
  going: number
  /** top of this step above the base of the flight */
  top: number
}

export interface StairLayout {
  shape: StairShape
  steps: StairStep[]
  count: number
  riser: number
  going: number
  /** total travelled length of the flight */
  run: number
  width: number
}

function pointAt(segs: Seg[], s: number): { x: number; z: number; rot: number } {
  let acc = 0
  for (const seg of segs) {
    const len = segLength(seg)
    if (s <= acc + len || seg === segs[segs.length - 1]) {
      const t = len === 0 ? 0 : clamp((s - acc) / len, 0, 1)
      if (seg.kind === 'line') {
        const ang = Math.atan2(seg.bz - seg.az, seg.bx - seg.ax)
        return { x: seg.ax + (seg.bx - seg.ax) * t, z: seg.az + (seg.bz - seg.az) * t, rot: ang }
      }
      const a = seg.a0 + (seg.a1 - seg.a0) * t
      return {
        x: seg.cx + Math.cos(a) * seg.radius,
        z: seg.cz + Math.sin(a) * seg.radius,
        rot: a + (seg.a1 > seg.a0 ? Math.PI / 2 : -Math.PI / 2),
      }
    }
    acc += len
  }
  return { x: 0, z: 0, rot: 0 }
}

/** Steps, riser and going that follow from the footprint and the rise. */
export function stairLayout(kind: string, size: Size, maxRiser = 0.19): StairLayout {
  const shape = stairShapeOf(kind)
  const segs = path(shape, size)
  const run = segs.reduce((a, s) => a + segLength(s), 0)
  const count = Math.max(2, Math.ceil(Math.max(0.1, size.h) / maxRiser))
  const riser = size.h / count
  const going = run / count
  const width = flightWidth(shape, size)

  const steps: StairStep[] = []
  for (let i = 0; i < count; i++) {
    const p = pointAt(segs, going * (i + 0.5))
    steps.push({ x: p.x, z: p.z, rot: p.rot, width, going, top: riser * (i + 1) })
  }
  return { shape, steps, count, riser, going, run, width }
}

/**
 * How far up the flight a point is, 0…1, or null when it is not on the stair.
 * Used to work out the height you are at while walking up.
 */
export function stairProgressAt(kind: string, size: Size, lx: number, lz: number): number | null {
  const shape = stairShapeOf(kind)
  const segs = path(shape, size)
  const run = segs.reduce((a, s) => a + segLength(s), 0)
  if (run <= 0) return null

  let acc = 0
  let best: number | null = null
  for (const seg of segs) {
    const len = segLength(seg)
    if (seg.kind === 'line') {
      const dx = seg.bx - seg.ax
      const dz = seg.bz - seg.az
      const l2 = dx * dx + dz * dz
      if (l2 > 0) {
        const t = clamp(((lx - seg.ax) * dx + (lz - seg.az) * dz) / l2, 0, 1)
        const px = seg.ax + dx * t
        const pz = seg.az + dz * t
        if (Math.hypot(lx - px, lz - pz) <= seg.width / 2 + 0.05) {
          const p = (acc + t * len) / run
          if (best === null || p > best) best = p
        }
      }
    } else {
      const r = Math.hypot(lx - seg.cx, lz - seg.cz)
      if (Math.abs(r - seg.radius) <= seg.width / 2 + 0.05) {
        let a = Math.atan2(lz - seg.cz, lx - seg.cx)
        // unwrap into the sweep of the arc
        while (a < Math.min(seg.a0, seg.a1)) a += Math.PI * 2
        while (a > Math.max(seg.a0, seg.a1)) a -= Math.PI * 2
        if (a >= Math.min(seg.a0, seg.a1) && a <= Math.max(seg.a0, seg.a1)) {
          const t = (a - seg.a0) / (seg.a1 - seg.a0)
          const p = (acc + t * len) / run
          if (best === null || p > best) best = p
        }
      }
    }
    acc += len
  }
  return best
}

/** Outline of the hole this flight needs in the slab above, in local space. */
export function stairWellLocal(kind: string, size: Size, grow = 0.06): Vec[] {
  const shape = stairShapeOf(kind)
  const { w, d } = size
  const sw = flightWidth(shape, size)
  const g = grow

  if (shape === 'straight') {
    return [
      { x: -w / 2 - g, y: -d / 2 - g },
      { x: w / 2 + g, y: -d / 2 - g },
      { x: w / 2 + g, y: d / 2 + g },
      { x: -w / 2 - g, y: d / 2 + g },
    ]
  }

  if (shape === 'spiral') {
    const r = Math.min(w, d) / 2 + g
    return Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * Math.PI * 2
      return { x: Math.cos(a) * r, y: Math.sin(a) * r }
    })
  }

  if (shape === 'quarter') {
    const x0 = -w / 2 - g
    const x1 = -w / 2 + sw + g
    const z0 = -d / 2 - g
    const z1 = d / 2 - sw - g
    return [
      { x: x0, y: z0 },
      { x: x1, y: z0 },
      { x: x1, y: z1 },
      { x: w / 2 + g, y: z1 },
      { x: w / 2 + g, y: d / 2 + g },
      { x: x0, y: d / 2 + g },
    ]
  }

  // half turn: a U opening back towards -z
  const xl0 = -w / 2 - g
  const xl1 = -w / 2 + sw + g
  const xr0 = w / 2 - sw - g
  const xr1 = w / 2 + g
  const z0 = -d / 2 - g
  const z1 = d / 2 - sw - g
  const z2 = d / 2 + g
  return [
    { x: xl0, y: z0 },
    { x: xl1, y: z0 },
    { x: xl1, y: z1 },
    { x: xr0, y: z1 },
    { x: xr0, y: z0 },
    { x: xr1, y: z0 },
    { x: xr1, y: z2 },
    { x: xl0, y: z2 },
  ]
}
