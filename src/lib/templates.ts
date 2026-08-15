import type { Floor, Project } from '../types'
import {
  addColumn,
  addItem,
  addPoint,
  addRect,
  addWall,
  emptyFloor,
  placeOpening,
  styleWall,
  tidyWalls,
} from './build'

/**
 * Ready-made starting points. Everything here is ordinary plan data — once a
 * template is generated it can be edited like anything you draw by hand.
 */

export interface HomeOptions {
  name: string
  bedrooms: number
  bathrooms: number
  /** ceiling height in metres */
  ceiling: number
  wallThickness: number
  /** the person walking through it, in metres */
  personHeight: number
  separateKitchen: boolean
  terrace: boolean
  roofTerrace: boolean
}

export const DEFAULT_OPTIONS: HomeOptions = {
  name: 'My home',
  bedrooms: 2,
  bathrooms: 1,
  ceiling: 2.6,
  wallThickness: 0.12,
  personHeight: 1.75,
  separateKitchen: false,
  terrace: false,
  roofTerrace: false,
}

export function starterProject(): Project {
  /* ----------------------------- ground floor ----------------------------- */
  const g = emptyFloor('Ground floor')
  addRect(g, 0, 0, 5.2, 4.2, 'Living / kitchen')
  addRect(g, 5.2, 0, 3.6, 4.2, 'Bedroom')
  addRect(g, 5.2, 4.2, 3.6, 2.4, 'Bathroom')
  addRect(g, 0, 4.2, 5.2, 2.4, 'Hallway')
  const terrace = addRect(g, 0, -3, 5.2, 3, 'Terrace')
  terrace.color = '#2f4a3a'
  for (const [from, to] of [
    [{ x: 0, y: -3 }, { x: 5.2, y: -3 }],
    [{ x: 5.2, y: -3 }, { x: 5.2, y: 0 }],
    [{ x: 0, y: 0 }, { x: 0, y: -3 }],
  ] as const)
    styleWall(g, from, to, { height: 1.1, thickness: 0.1 })

  // doors: each one swings into free floor, not into the fittings
  placeOpening(g, { x: 5.2, y: 0 }, { x: 5.2, y: 4.2 }, 'door', 3.4, 0.8)
  placeOpening(g, { x: 5.2, y: 4.2 }, { x: 5.2, y: 6.6 }, 'door', 0.7, 0.75, { flipHinge: true })
  placeOpening(g, { x: 0, y: 4.2 }, { x: 5.2, y: 4.2 }, 'door', 3.9, 0.9)
  placeOpening(g, { x: 0, y: 6.6 }, { x: 5.2, y: 6.6 }, 'door', 4.6, 0.9)
  placeOpening(g, { x: 0, y: 0 }, { x: 5.2, y: 0 }, 'door', 2.6, 1.8, { height: 2.2, doorType: 'sliding' })
  placeOpening(g, { x: 5.2, y: 0 }, { x: 8.8, y: 0 }, 'window', 1.8, 1.2)
  placeOpening(g, { x: 8.8, y: 0 }, { x: 8.8, y: 4.2 }, 'window', 2.0, 1.2)
  placeOpening(g, { x: 8.8, y: 4.2 }, { x: 8.8, y: 6.6 }, 'window', 1.2, 0.6, { height: 0.8, sill: 1.4 })

  // living room along the west wall, kitchen along the north wall
  addItem(g, 'sofa-3', 0.6, 2.0, Math.PI / 2)
  addItem(g, 'coffee-table', 1.75, 2.0, Math.PI / 2)
  addItem(g, 'tv-unit', 2.8, 2.0, -Math.PI / 2)
  addItem(g, 'dining-table', 3.85, 2.6)
  addItem(g, 'chair', 3.6, 1.85, Math.PI)
  addItem(g, 'chair', 4.9, 2.6, -Math.PI / 2)
  addItem(g, 'counter', 4.15, 0.42)
  addItem(g, 'stove', 2.9, 0.42)
  addItem(g, 'sink', 2.25, 0.42)
  addItem(g, 'fridge', 4.8, 1.55, Math.PI / 2)

  // bedroom
  addItem(g, 'bed-double', 7.1, 1.35)
  addItem(g, 'nightstand', 6.05, 0.6)
  addItem(g, 'nightstand', 8.15, 0.6)
  addItem(g, 'wardrobe', 7.2, 3.78, Math.PI)
  addItem(g, 'desk', 8.35, 2.4, -Math.PI / 2)

  // bathroom: shower in the corner behind a half wall, nothing in the door swing
  addItem(g, 'shower', 5.75, 6.05)
  addItem(g, 'basin', 7.05, 4.62)
  addItem(g, 'toilet', 8.3, 5.3, Math.PI / 2)
  addItem(g, 'washer', 6.9, 6.15)
  const halfWall = addWall(g, addPoint(g, 6.4, 6.6), addPoint(g, 6.4, 5.35), 0.1)
  halfWall.height = 1.2

  // hallway: the stair up to the roof, clear of both door swings
  const stair = addItem(g, 'stairs', 2.125, 5.85, -Math.PI / 2)
  stair.w = 1.0
  stair.d = 3.75
  stair.h = 2.9
  addItem(g, 'dresser', 0.85, 4.6)
  addItem(g, 'plant', 4.8, 4.7)

  // a beam crossing the living room: hangs from the ceiling, you walk under it
  const beam = addWall(g, addPoint(g, 0, 2.3), addPoint(g, 5.2, 2.3), 0.25)
  beam.base = 2.25

  // structure
  addColumn(g, 0.45, -2.55, { shape: 'round', w: 0.32, d: 0.32, name: 'Terrace column' })
  addColumn(g, 4.75, -2.55, { shape: 'round', w: 0.32, d: 0.32, name: 'Terrace column' })
  addColumn(g, 8.55, 4.5, { w: 0.35, d: 0.35, name: 'Service duct' })

  /* ------------------------------ roof terrace ---------------------------- */
  const r = emptyFloor('Roof terrace', 1)
  r.height = 2.6
  const roof = addRect(r, 0, 0, 8.8, 6.6, 'Roof terrace')
  roof.color = '#2f4a3a'
  for (const [from, to] of [
    [{ x: 0, y: 0 }, { x: 8.8, y: 0 }],
    [{ x: 8.8, y: 0 }, { x: 8.8, y: 6.6 }],
    [{ x: 8.8, y: 6.6 }, { x: 0, y: 6.6 }],
    [{ x: 0, y: 6.6 }, { x: 0, y: 0 }],
  ] as const)
    styleWall(r, from, to, { height: 1.1, thickness: 0.15 })

  // guard rail around the stairwell — you arrive from the east end
  const rail = addWall(r, addPoint(r, 0.2, 5.3), addPoint(r, 4.05, 5.3), 0.1)
  rail.height = 0.95
  const railEnd = addWall(r, addPoint(r, 0.2, 5.3), addPoint(r, 0.2, 6.4), 0.1)
  railEnd.height = 0.95

  // barbecue corner along the north parapet
  addItem(r, 'bbq', 7.8, 0.75, Math.PI)
  addItem(r, 'counter', 6.2, 0.6)
  addItem(r, 'sink', 4.9, 0.6)

  // shaded dining under a pergola
  addItem(r, 'pergola', 6.4, 3.6)
  addItem(r, 'dining-table', 6.4, 3.6)
  addItem(r, 'chair', 5.4, 3.6, Math.PI / 2)
  addItem(r, 'chair', 7.4, 3.6, -Math.PI / 2)
  addItem(r, 'chair', 6.4, 2.85, Math.PI)
  addItem(r, 'chair', 6.4, 4.35)

  // sun loungers and greenery
  addItem(r, 'lounger', 1.2, 1.6)
  addItem(r, 'lounger', 2.3, 1.6)
  addItem(r, 'plant', 0.55, 3.6)
  addItem(r, 'plant', 8.25, 6.1)
  addItem(r, 'plant', 3.4, 0.55)

  return { version: 3, name: 'My place', floors: [g, r] }
}

/* ------------------------------------------------------------------ */
/* generated homes                                                     */
/* ------------------------------------------------------------------ */

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const mid = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

function furnishKitchenRun(f: Floor, r: Rect, fromX: number, toX: number) {
  const y = r.y + 0.35
  // half the counter plus a hand's width clear of the wall it starts at
  let x = fromX + 0.9 + 0.14
  if (x + 0.9 <= toX) {
    addItem(f, 'counter', x, y)
    x += 1.25
  }
  if (x + 0.3 <= toX) {
    addItem(f, 'stove', x, y)
    x += 0.65
  }
  if (x + 0.3 <= toX) {
    addItem(f, 'sink', x, y)
    x += 0.7
  }
  if (x + 0.35 <= toX) addItem(f, 'fridge', x + 0.05, r.y + 0.4)
}

function furnishLiving(f: Floor, r: Rect, openKitchen: boolean) {
  const cy = r.y + r.h / 2
  addItem(f, 'sofa-3', r.x + 0.55, cy, Math.PI / 2)
  addItem(f, 'coffee-table', r.x + 1.75, cy, Math.PI / 2)
  addItem(f, 'tv-unit', r.x + r.w - 0.3, cy, -Math.PI / 2)
  if (openKitchen) furnishKitchenRun(f, r, r.x + 1.2, r.x + r.w - 0.7)
  if (r.h > 3.6) {
    addItem(f, 'dining-table', r.x + r.w * 0.62, r.y + r.h - 0.9)
    addItem(f, 'chair', r.x + r.w * 0.62, r.y + r.h - 1.75, Math.PI)
  }
}

function furnishKitchen(f: Floor, r: Rect) {
  furnishKitchenRun(f, r, r.x, r.x + r.w - 0.4)
  if (r.h > 3.2) {
    addItem(f, 'dining-table', r.x + r.w / 2, r.y + r.h - 1.0)
    addItem(f, 'chair', r.x + r.w / 2, r.y + r.h - 1.85, Math.PI)
  }
}

function furnishBedroom(f: Floor, r: Rect, main: boolean) {
  const c = mid(r)
  addItem(f, main ? 'bed-double' : 'bed-single', c.x, r.y + 1.2)
  addItem(f, 'wardrobe', c.x, r.y + r.h - 0.4, Math.PI)
  const bedHalf = (main ? 1.5 : 0.95) / 2
  if (r.w / 2 - bedHalf > 0.55) addItem(f, 'nightstand', c.x - bedHalf - 0.28, r.y + 0.35)
}

function furnishBathroom(f: Floor, r: Rect) {
  addItem(f, 'toilet', r.x + r.w - 0.4, r.y + 0.55, Math.PI / 2)
  addItem(f, 'basin', r.x + 0.45, r.y + 0.3)
  addItem(f, 'shower', r.x + 0.55, r.y + r.h - 0.55)
}

function parapets(f: Floor, r: Rect, height = 1.1, thickness = 0.12, skip?: 'north') {
  const edges: [{ x: number; y: number }, { x: number; y: number }][] = [
    [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }],
    [{ x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }],
    [{ x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }],
    [{ x: r.x, y: r.y + r.h }, { x: r.x, y: r.y }],
  ]
  edges.forEach(([a, b], i) => {
    if (skip === 'north' && i === 0) return
    styleWall(f, a, b, { height, thickness })
  })
}

/** Builds a home from the answers given during onboarding. */
export function generateHome(opts: Partial<HomeOptions> = {}): Project {
  const o = { ...DEFAULT_OPTIONS, ...opts }
  const bedrooms = Math.max(0, Math.min(4, Math.round(o.bedrooms)))
  const bathrooms = Math.max(1, Math.min(2, Math.round(o.bathrooms)))

  const g = emptyFloor('Ground floor')
  g.height = o.ceiling
  g.wallThickness = o.wallThickness

  if (bedrooms === 0) return studio(g, o, bathrooms)

  const HALL = o.roofTerrace ? 3.0 : 1.6
  const NORTH = 4.2
  const SOUTH = 3.4
  const livingW = o.separateKitchen ? 4.4 : 5.4
  const kitchenW = o.separateKitchen ? 3.0 : 0
  const northTotal = livingW + kitchenW
  const southTotal = bedrooms * 3.3 + bathrooms * 2.3
  const W = Math.max(northTotal, southTotal, 5.4)
  const kn = W / northTotal
  const ks = W / southTotal

  const living: Rect = { x: 0, y: 0, w: livingW * kn, h: NORTH }
  addRect(g, living.x, living.y, living.w, living.h, o.separateKitchen ? 'Living room' : 'Living / kitchen')
  let kitchen: Rect | null = null
  if (o.separateKitchen) {
    kitchen = { x: living.w, y: 0, w: kitchenW * kn, h: NORTH }
    addRect(g, kitchen.x, kitchen.y, kitchen.w, kitchen.h, 'Kitchen')
  }

  const hall: Rect = { x: 0, y: NORTH, w: W, h: HALL }
  addRect(g, hall.x, hall.y, hall.w, hall.h, 'Hallway')

  const south: { rect: Rect; kind: 'bed' | 'bath' }[] = []
  let cursor = 0
  for (let i = 0; i < bedrooms; i++) {
    const w = 3.3 * ks
    south.push({ rect: { x: cursor, y: NORTH + HALL, w, h: SOUTH }, kind: 'bed' })
    cursor += w
  }
  for (let i = 0; i < bathrooms; i++) {
    const w = 2.3 * ks
    south.push({ rect: { x: cursor, y: NORTH + HALL, w, h: SOUTH }, kind: 'bath' })
    cursor += w
  }
  south.forEach((r, i) => {
    const beds = south.filter((x) => x.kind === 'bed').length
    const baths = south.filter((x) => x.kind === 'bath').length
    const name =
      r.kind === 'bed'
        ? i === 0
          ? 'Main bedroom'
          : `Bedroom ${i + 1}`
        : baths > 1
          ? `Bathroom ${i - beds + 1}`
          : 'Bathroom'
    addRect(g, r.rect.x, r.rect.y, r.rect.w, r.rect.h, name)
  })

  let terrace: Rect | null = null
  if (o.terrace) {
    terrace = { x: 0, y: -3, w: living.w, h: 3 }
    const t = addRect(g, terrace.x, terrace.y, terrace.w, terrace.h, 'Terrace')
    t.color = '#2f4a3a'
  }

  // every room now shares its walls with its neighbours
  tidyWalls(g)
  if (terrace) parapets(g, terrace, 1.1, 0.1, 'north')

  /* ------------------------------- openings ------------------------------ */
  const doorInto = (r: Rect, wallY: number, width = 0.85) =>
    placeOpening(g, { x: r.x, y: wallY }, { x: r.x + r.w, y: wallY }, 'door', r.w / 2, Math.min(width, r.w - 0.6))

  doorInto(living, NORTH, 0.95)
  if (kitchen) doorInto(kitchen, NORTH, 0.85)
  for (const r of south) doorInto(r.rect, NORTH + HALL, r.kind === 'bath' ? 0.75 : 0.85)

  // front door on the outer end of the hallway
  placeOpening(g, { x: W, y: NORTH }, { x: W, y: NORTH + HALL }, 'door', HALL / 2, 0.95)

  if (terrace) {
    placeOpening(g, { x: 0, y: 0 }, { x: living.w, y: 0 }, 'door', living.w / 2, Math.min(1.8, living.w - 1), {
      height: 2.2,
      doorType: 'sliding',
    })
  } else {
    placeOpening(g, { x: 0, y: 0 }, { x: living.w, y: 0 }, 'window', living.w / 2, Math.min(1.8, living.w - 1))
  }
  if (kitchen) placeOpening(g, { x: kitchen.x, y: 0 }, { x: kitchen.x + kitchen.w, y: 0 }, 'window', kitchen.w / 2, 1.0)
  for (const r of south) {
    const wallY = NORTH + HALL + SOUTH
    placeOpening(
      g,
      { x: r.rect.x, y: wallY },
      { x: r.rect.x + r.rect.w, y: wallY },
      'window',
      r.rect.w / 2,
      r.kind === 'bath' ? 0.6 : 1.2,
      r.kind === 'bath' ? { height: 0.8, sill: 1.4 } : {},
    )
  }

  /* ------------------------------ furniture ------------------------------ */
  furnishLiving(g, living, !o.separateKitchen)
  if (kitchen) furnishKitchen(g, kitchen)
  let bedIndex = 0
  for (const r of south) {
    if (r.kind === 'bed') furnishBedroom(g, r.rect, bedIndex++ === 0)
    else furnishBathroom(g, r.rect)
  }

  const floors: Floor[] = [g]

  /* ---------------------------- roof terrace ----------------------------- */
  if (o.roofTerrace) {
    const stair = addItem(g, 'stairs-u', 1.45, NORTH + HALL / 2)
    stair.w = 2.4
    stair.d = Math.min(2.8, HALL - 0.2)
    stair.h = o.ceiling + 0.3
    addItem(g, 'plant', W - 0.55, NORTH + 0.5)

    const r = emptyFloor('Roof terrace', 1)
    r.elevation = o.ceiling + 0.3
    r.height = o.ceiling
    r.wallThickness = o.wallThickness
    const roofRect: Rect = { x: 0, y: 0, w: W, h: NORTH + HALL + SOUTH }
    const roof = addRect(r, roofRect.x, roofRect.y, roofRect.w, roofRect.h, 'Roof terrace')
    roof.color = '#2f4a3a'
    tidyWalls(r)
    parapets(r, roofRect, 1.1, 0.15)

    // guard rail along the open side of the stairwell
    const rail = addWall(
      r,
      addPoint(r, 0.15, NORTH + HALL / 2 + stair.d / 2 + 0.1),
      addPoint(r, 2.75, NORTH + HALL / 2 + stair.d / 2 + 0.1),
      0.1,
    )
    rail.height = 0.95

    addItem(r, 'bbq', W - 1.0, 0.75, Math.PI)
    addItem(r, 'counter', W - 2.6, 0.6)
    addItem(r, 'pergola', W * 0.62, 3.4)
    addItem(r, 'dining-table', W * 0.62, 3.4)
    addItem(r, 'chair', W * 0.62 - 1.0, 3.4, Math.PI / 2)
    addItem(r, 'chair', W * 0.62 + 1.0, 3.4, -Math.PI / 2)
    addItem(r, 'lounger', 1.0, 1.5)
    addItem(r, 'lounger', 2.1, 1.5)
    addItem(r, 'plant', W - 0.6, roofRect.h - 0.6)
    floors.push(r)
  }

  return { version: 3, name: o.name, eyeHeight: Math.max(1.2, o.personHeight - 0.1), floors }
}

/** One-room flat: everything in a single space, plus a bathroom. */
function studio(g: Floor, o: HomeOptions, bathrooms: number): Project {
  const main: Rect = { x: 0, y: 0, w: 5.4, h: 4.8 }
  addRect(g, main.x, main.y, main.w, main.h, 'Studio')
  const bath: Rect = { x: main.w, y: 0, w: 2.3, h: 2.6 }
  addRect(g, bath.x, bath.y, bath.w, bath.h, 'Bathroom')
  const hall: Rect = { x: main.w, y: bath.h, w: 2.3, h: main.h - bath.h }
  addRect(g, hall.x, hall.y, hall.w, hall.h, 'Entrance')
  tidyWalls(g)

  placeOpening(g, { x: main.w, y: bath.h }, { x: main.w, y: main.h }, 'door', hall.h / 2, 0.9)
  placeOpening(g, { x: bath.x, y: bath.h }, { x: bath.x + bath.w, y: bath.h }, 'door', bath.w / 2, 0.75)
  placeOpening(g, { x: main.w + hall.w, y: bath.h }, { x: main.w + hall.w, y: main.h }, 'door', hall.h / 2, 0.95)
  placeOpening(g, { x: 0, y: 0 }, { x: main.w, y: 0 }, 'window', main.w / 2, 2.0)
  placeOpening(g, { x: 0, y: main.h }, { x: main.w, y: main.h }, 'window', 1.6, 1.2)

  addItem(g, 'bed-double', 1.15, 1.25)
  addItem(g, 'nightstand', 2.2, 0.4)
  addItem(g, 'wardrobe', 1.1, main.h - 0.4, Math.PI)
  addItem(g, 'sofa-3', 4.0, 2.0, Math.PI / 2)
  addItem(g, 'coffee-table', 3.0, 2.0, Math.PI / 2)
  furnishKitchenRun(g, main, 2.6, main.w - 0.3)
  furnishBathroom(g, bath)
  if (bathrooms > 1) addItem(g, 'washer', hall.x + hall.w / 2, hall.y + hall.h - 0.45)

  return {
    version: 3,
    name: o.name,
    eyeHeight: Math.max(1.2, o.personHeight - 0.1),
    floors: [g],
  }
}

/* ------------------------------------------------------------------ */
/* the picker                                                          */
/* ------------------------------------------------------------------ */

export interface Template {
  id: string
  name: string
  blurb: string
  build: (o?: Partial<HomeOptions>) => Project
}

export const TEMPLATES: Template[] = [
  {
    id: 'studio',
    name: 'Studio flat',
    blurb: 'One open room with a kitchen run, plus a bathroom and an entrance.',
    build: (o) => generateHome({ ...o, bedrooms: 0, bathrooms: 1 }),
  },
  {
    id: 'one-bed',
    name: 'One-bedroom flat',
    blurb: 'Living room with an open kitchen, a bedroom and a bathroom off a hallway.',
    build: (o) => generateHome({ ...o, bedrooms: 1, bathrooms: 1 }),
  },
  {
    id: 'two-bed',
    name: 'Two-bedroom flat',
    blurb: 'Two bedrooms, a bathroom and a living room with an open kitchen.',
    build: (o) => generateHome({ ...o, bedrooms: 2, bathrooms: 1 }),
  },
  {
    id: 'family',
    name: 'Family home + roof terrace',
    blurb: 'Three bedrooms, two bathrooms, a separate kitchen and stairs up to a roof terrace.',
    build: (o) =>
      generateHome({ ...o, bedrooms: 3, bathrooms: 2, separateKitchen: true, roofTerrace: true, terrace: true }),
  },
  {
    id: 'sample',
    name: 'Demo flat',
    blurb: 'The worked example: terrace, half wall, beam, columns and a roof terrace with a barbecue.',
    build: () => starterProject(),
  },
  {
    id: 'empty',
    name: 'Empty canvas',
    blurb: 'Nothing at all — draw your own rooms from scratch.',
    build: (o) => ({
      version: 3,
      name: o?.name ?? 'Untitled plan',
      eyeHeight: Math.max(1.2, (o?.personHeight ?? 1.75) - 0.1),
      floors: [
        {
          ...emptyFloor('Ground floor'),
          height: o?.ceiling ?? 2.6,
          wallThickness: o?.wallThickness ?? 0.12,
        },
      ],
    }),
  },
]

export function templateById(id: string): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[2]
}
