/** All distances are in metres. Plan coordinates use x → right, y → down. */

export type ID = string

export interface Pt {
  id: ID
  x: number
  y: number
}

export type WallStyle = 'solid' | 'fence' | 'railing' | 'hedge'

export interface Wall {
  id: ID
  a: ID
  b: ID
  /** metres; overrides the floor default when set */
  thickness: number
  /** distance from the floor slab to the bottom of the wall — > 0 hangs it from
   *  above, for a beam or a partial partition */
  base: number
  /** metres of wall above `base`; null → carry on up to the ceiling */
  height: number | null
  /** solid masonry, or an open boundary like a fence, a railing or a hedge */
  style?: WallStyle
  color?: string
}

/** A free-standing pillar, pier or stub of structure. */
export interface Column {
  id: ID
  name: string
  x: number
  y: number
  /** footprint; `w` runs along the local x axis */
  w: number
  d: number
  rot: number
  /** distance from the floor slab to the bottom */
  base: number
  /** metres above `base`; null → up to the ceiling */
  height: number | null
  shape: 'rect' | 'round'
  color: string
}

export interface Room {
  id: ID
  name: string
  /** ordered, closed loop of point ids */
  loop: ID[]
  color: string
  /** metres; null → inherit the floor height */
  height: number | null
  /** false for a terrace, a patio or anything else open to the sky */
  ceiling: boolean
}

export type OpeningKind = 'door' | 'window'
export type DoorType = 'hinged' | 'sliding'

export interface Opening {
  id: ID
  wallId: ID
  kind: OpeningKind
  /** distance of the opening centre from wall.a, along the wall */
  offset: number
  width: number
  height: number
  /** distance from the floor to the bottom of the opening (0 for doors) */
  sill: number
  /** which side the door swings to */
  flipSide: boolean
  /** which end the hinge is on */
  flipHinge: boolean
  /** doors only: swings on hinges or slides along the wall */
  doorType: DoorType
}

export interface Item {
  id: ID
  /** catalog key */
  kind: string
  name: string
  x: number
  y: number
  /** radians, clockwise on the plan */
  rot: number
  /** width (along local x), depth (along local y), height */
  w: number
  d: number
  h: number
  /** distance from the floor to the item base */
  z: number
  color: string
}

export interface Measure {
  id: ID
  ax: number
  ay: number
  bx: number
  by: number
}

export interface Floor {
  id: ID
  name: string
  /** height of the floor slab above ground */
  elevation: number
  /** default wall height */
  height: number
  /** default wall thickness */
  wallThickness: number
  /** thickness of the floor slab, drawn below the floor level */
  slab: number
  points: Pt[]
  walls: Wall[]
  rooms: Room[]
  columns: Column[]
  openings: Opening[]
  items: Item[]
  measures: Measure[]
}

export type GroundKind = 'grass' | 'gravel' | 'sand' | 'paving' | 'earth'

/** An optional plot of land the buildings sit on — any shape, not just a box. */
export interface Site {
  enabled: boolean
  name: string
  /** closed outline in plan coordinates */
  outline: { x: number; y: number }[]
  ground: GroundKind
}

export interface Project {
  version: number
  name: string
  /** camera height used in walk mode, derived from the person's height */
  eyeHeight?: number
  site?: Site
  floors: Floor[]
}

export type EntityKind = 'point' | 'wall' | 'room' | 'opening' | 'item' | 'measure' | 'column' | 'site'

export interface Selection {
  kind: EntityKind
  id: ID
}

export type Tool =
  | 'select'
  | 'room'
  | 'poly'
  | 'wall'
  | 'door'
  | 'window'
  | 'column'
  | 'item'
  | 'plot'
  | 'measure'
  | 'delete'

export type ViewMode = '2d' | '3d' | 'walk'
