/** All distances are in metres. Plan coordinates use x → right, y → down. */

export type ID = string

export interface Pt {
  id: ID
  x: number
  y: number
}

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
}

export type OpeningKind = 'door' | 'window'

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
  points: Pt[]
  walls: Wall[]
  rooms: Room[]
  columns: Column[]
  openings: Opening[]
  items: Item[]
  measures: Measure[]
}

export interface Project {
  version: number
  name: string
  floors: Floor[]
}

export type EntityKind = 'point' | 'wall' | 'room' | 'opening' | 'item' | 'measure' | 'column'

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
  | 'measure'
  | 'delete'

export type ViewMode = '2d' | '3d' | 'walk'
