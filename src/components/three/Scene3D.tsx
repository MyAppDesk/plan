import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Edges, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Floor, Opening, Selection } from '../../types'
import { useActiveFloor, useProject } from '../../store/useProject'
import { useDoors } from '../../store/useDoors'
import { catalogItem } from '../../lib/catalog'
import {
  angleOf,
  columnTopOf,
  floorBounds,
  pointMap,
  roomPoints,
  wallEnds,
  wallTopOf,
  wallSolids,
  stairWells,
  pointInPolygon,
  type Vec,
} from '../../lib/geometry'
import { WalkControls } from './WalkControls'

const WALL_COLOR = '#dfe4ee'
const FLOOR_COLOR = '#8c8378'
const SELECTED = '#4f8cff'

type Pick = (sel: Selection) => ((e: ThreeEvent<PointerEvent>) => void) | undefined

/** Blue outline around whatever is selected. */
function Highlight({ on }: { on: boolean }) {
  if (!on) return null
  return <Edges color={SELECTED} lineWidth={2} scale={1.004} />
}

/* ------------------------------------------------------------------ */
/* rooms                                                               */
/* ------------------------------------------------------------------ */

function RoomSlabs({
  floor,
  ceiling,
  pick,
  selection,
  holes,
  slabAbove,
}: {
  floor: Floor
  ceiling: boolean
  pick: Pick
  selection: Selection | null
  holes: Vec[][]
  /** underside of the floor above, so a room is not given two ceilings */
  slabAbove: number
}) {
  const slabs = useMemo(() => {
    const pts = pointMap(floor)
    const thickness = Math.max(0.04, floor.slab ?? 0.3)
    return floor.rooms
      .map((room) => {
        const poly = roomPoints(floor, room, pts)
        if (poly.length < 3) return null
        const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, p.y)))
        // stairwells coming up from the floor below are cut out of the slab
        for (const hole of holes) {
          const centre = hole.reduce((a, h) => ({ x: a.x + h.x / hole.length, y: a.y + h.y / hole.length }), { x: 0, y: 0 })
          if (!pointInPolygon(centre, poly)) continue
          shape.holes.push(new THREE.Path(hole.map((h) => new THREE.Vector2(h.x, h.y))))
        }
        // a real slab with a visible edge, hanging under the floor level
        const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
        geo.rotateX(Math.PI / 2)
        const flat = new THREE.ShapeGeometry(shape)
        flat.rotateX(Math.PI / 2)
        return { room, geo, flat }
      })
      .filter(
        (s): s is { room: (typeof floor.rooms)[number]; geo: THREE.ExtrudeGeometry; flat: THREE.ShapeGeometry } => !!s,
      )
  }, [floor, holes])

  return (
    <group>
      {slabs.map(({ room, geo, flat }) => {
        const h = room.height ?? floor.height
        const top = floor.elevation + h
        const selected = selection?.kind === 'room' && selection.id === room.id
        // no ceiling on a terrace, and none where the floor above already is one
        const drawCeiling = ceiling && room.ceiling !== false && top < slabAbove - 0.06
        return (
          <group key={room.id}>
            <mesh
              geometry={geo}
              position={[0, floor.elevation, 0]}
              receiveShadow
              castShadow
              onPointerDown={pick({ kind: 'room', id: room.id })}
            >
              <meshStandardMaterial color={selected ? '#a2957f' : FLOOR_COLOR} roughness={0.95} />
              <Highlight on={selected} />
            </mesh>
            {drawCeiling ? (
              <mesh geometry={flat} position={[0, top - 0.01, 0]}>
                <meshStandardMaterial color="#f2f4f8" roughness={1} side={THREE.DoubleSide} />
              </mesh>
            ) : null}
          </group>
        )
      })}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* walls + columns                                                     */
/* ------------------------------------------------------------------ */

function Walls({ floor, pick, selection }: { floor: Floor; pick: Pick; selection: Selection | null }) {
  const solids = useMemo(() => {
    const pts = pointMap(floor)
    return floor.walls.flatMap((w) => wallSolids(floor, w, pts).map((s) => ({ s, id: w.id, color: w.color })))
  }, [floor])

  return (
    <group>
      {solids.map(({ s, id, color }, i) => {
        const selected = selection?.kind === 'wall' && selection.id === id
        return (
          <mesh
            key={`${id}-${i}`}
            position={[s.cx, floor.elevation + (s.bottom + s.top) / 2, s.cy]}
            rotation={[0, -s.angle, 0]}
            castShadow
            receiveShadow
            onPointerDown={pick({ kind: 'wall', id })}
          >
            <boxGeometry args={[s.len, s.top - s.bottom, s.thickness]} />
            <meshStandardMaterial color={selected ? '#cfe0ff' : (color ?? WALL_COLOR)} roughness={0.92} />
            <Highlight on={selected} />
          </mesh>
        )
      })}
    </group>
  )
}

function Columns({ floor, pick, selection }: { floor: Floor; pick: Pick; selection: Selection | null }) {
  return (
    <group>
      {(floor.columns ?? []).map((c) => {
        const top = columnTopOf(floor, c)
        const h = Math.max(0.02, top - c.base)
        const selected = selection?.kind === 'column' && selection.id === c.id
        return (
          <mesh
            key={c.id}
            position={[c.x, floor.elevation + c.base + h / 2, c.y]}
            rotation={[0, -c.rot, 0]}
            castShadow
            receiveShadow
            onPointerDown={pick({ kind: 'column', id: c.id })}
          >
            {c.shape === 'round' ? (
              <cylinderGeometry args={[Math.max(c.w, c.d) / 2, Math.max(c.w, c.d) / 2, h, 24]} />
            ) : (
              <boxGeometry args={[c.w, h, c.d]} />
            )}
            <meshStandardMaterial color={selected ? '#cfe0ff' : c.color} roughness={0.9} />
            <Highlight on={selected} />
          </mesh>
        )
      })}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* doors + windows                                                     */
/* ------------------------------------------------------------------ */

function HingedLeaf({
  width,
  height,
  open,
  hinge,
  side,
}: {
  width: number
  height: number
  open: boolean
  hinge: number
  side: number
}) {
  const target = open ? hinge * side * (Math.PI / 2.2) : 0
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    const k = 1 - Math.pow(0.0008, Math.min(dt, 0.05))
    g.rotation.y += (target - g.rotation.y) * k
  })
  return (
    <group ref={ref} position={[(hinge * width) / 2, 0, 0]}>
      <mesh position={[(-hinge * width) / 2, height / 2, 0]} castShadow>
        <boxGeometry args={[width - 0.02, height - 0.02, 0.04]} />
        <meshStandardMaterial color="#b98d5f" roughness={0.7} />
      </mesh>
      <mesh position={[-hinge * (width - 0.12), height * 0.45, 0.045]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshStandardMaterial color="#cfd4de" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  )
}

function SlidingLeaf({
  width,
  height,
  thickness,
  open,
  side,
}: {
  width: number
  height: number
  thickness: number
  open: boolean
  side: number
}) {
  const target = open ? side * width * 0.96 : 0
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    const k = 1 - Math.pow(0.0008, Math.min(dt, 0.05))
    g.position.x += (target - g.position.x) * k
  })
  return (
    <group>
      {/* the rail it hangs from */}
      <mesh position={[0, height + 0.04, 0]}>
        <boxGeometry args={[width * 2.05, 0.06, thickness + 0.06]} />
        <meshStandardMaterial color="#aeb6c4" metalness={0.6} roughness={0.35} />
      </mesh>
      <group ref={ref} position={[0, 0, thickness / 2 + 0.03]}>
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width - 0.04, height - 0.06, 0.03]} />
          <meshPhysicalMaterial color="#bcdcf5" transparent opacity={0.3} roughness={0.05} transmission={0.6} />
        </mesh>
        {[
          [0, 0.03, width, 0.06],
          [0, height - 0.03, width, 0.06],
        ].map(([x, y, fw, fh], i) => (
          <mesh key={i} position={[x, y, 0]}>
            <boxGeometry args={[fw, fh, 0.05]} />
            <meshStandardMaterial color="#9aa3b2" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[(s * (width - 0.05)) / 2, height / 2, 0]}>
            <boxGeometry args={[0.05, height, 0.05]} />
            <meshStandardMaterial color="#9aa3b2" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function OpeningDetail({
  floor,
  opening,
  pick,
  selection,
}: {
  floor: Floor
  opening: Opening
  pick: Pick
  selection: Selection | null
}) {
  const open = useDoors((s) => !!s.open[opening.id])
  const wall = floor.walls.find((w) => w.id === opening.wallId)
  if (!wall) return null
  const e = wallEnds(floor, wall)
  if (!e) return null
  const ang = angleOf(e.a, e.b)
  const cx = e.a.x + Math.cos(ang) * opening.offset
  const cy = e.a.y + Math.sin(ang) * opening.offset
  const t = wall.thickness
  const y0 = floor.elevation
  const wallH = wallTopOf(floor, wall)
  const sill = opening.kind === 'door' ? 0 : opening.sill
  const height = Math.min(opening.height, wallH - sill)
  const w = opening.width
  const selected = selection?.kind === 'opening' && selection.id === opening.id
  const onDown = pick({ kind: 'opening', id: opening.id })

  if (opening.kind === 'door') {
    const hinge = opening.flipHinge ? -1 : 1
    const side = opening.flipSide ? -1 : 1
    return (
      <group position={[cx, y0, cy]} rotation={[0, -ang, 0]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[(s * (w + 0.06)) / 2, height / 2, 0]} onPointerDown={onDown}>
            <boxGeometry args={[0.06, height, t + 0.04]} />
            <meshStandardMaterial color={selected ? '#cfe0ff' : '#c9cedb'} roughness={0.8} />
            <Highlight on={selected} />
          </mesh>
        ))}
        <mesh position={[0, height + 0.03, 0]} onPointerDown={onDown}>
          <boxGeometry args={[w + 0.12, 0.06, t + 0.04]} />
          <meshStandardMaterial color={selected ? '#cfe0ff' : '#c9cedb'} roughness={0.8} />
          <Highlight on={selected} />
        </mesh>

        {opening.doorType === 'sliding' ? (
          <SlidingLeaf width={w} height={height} thickness={t} open={open} side={hinge} />
        ) : (
          <HingedLeaf width={w} height={height} open={open} hinge={hinge} side={side} />
        )}
      </group>
    )
  }

  return (
    <group position={[cx, y0 + sill, cy]} rotation={[0, -ang, 0]}>
      <mesh position={[0, height / 2, 0]} onPointerDown={onDown}>
        <boxGeometry args={[w - 0.06, height - 0.06, 0.02]} />
        <meshPhysicalMaterial color="#bcdcf5" transparent opacity={0.28} roughness={0.05} transmission={0.6} />
        <Highlight on={selected} />
      </mesh>
      {[
        [0, -height / 2 + 0.03, w, 0.06],
        [0, height / 2 - 0.03, w, 0.06],
      ].map(([x, y, fw, fh], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <boxGeometry args={[fw, fh, t + 0.02]} />
          <meshStandardMaterial color={selected ? '#cfe0ff' : '#e7ebf2'} roughness={0.7} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (w - 0.06)) / 2, height / 2, 0]}>
          <boxGeometry args={[0.06, height, t + 0.02]} />
          <meshStandardMaterial color={selected ? '#cfe0ff' : '#e7ebf2'} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[w + 0.08, 0.04, t + 0.08]} />
        <meshStandardMaterial color="#e7ebf2" roughness={0.7} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* furniture                                                           */
/* ------------------------------------------------------------------ */

function Items({ floor, pick, selection }: { floor: Floor; pick: Pick; selection: Selection | null }) {
  return (
    <group>
      {floor.items.map((item) => {
        const selected = selection?.kind === 'item' && selection.id === item.id
        return (
          <group
            key={item.id}
            position={[item.x, floor.elevation + item.z, item.y]}
            rotation={[0, -item.rot, 0]}
            onPointerDown={pick({ kind: 'item', id: item.id })}
          >
            {catalogItem(item.kind).build({ w: item.w, d: item.d, h: item.h, color: item.color })}
            {selected ? (
              <mesh position={[0, item.h / 2, 0]}>
                <boxGeometry args={[item.w * 1.03, item.h * 1.03, item.d * 1.03]} />
                <meshBasicMaterial color={SELECTED} transparent opacity={0.12} depthWrite={false} />
                <Edges color={SELECTED} lineWidth={2} />
              </mesh>
            ) : null}
          </group>
        )
      })}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* scene                                                               */
/* ------------------------------------------------------------------ */

function FloorGroup({
  floor,
  furniture,
  ceiling,
  pick,
  selection,
  holes,
  slabAbove,
}: {
  floor: Floor
  furniture: boolean
  ceiling: boolean
  pick: Pick
  selection: Selection | null
  holes: Vec[][]
  slabAbove: number
}) {
  return (
    <group>
      <RoomSlabs
        floor={floor}
        ceiling={ceiling}
        pick={pick}
        selection={selection}
        holes={holes}
        slabAbove={slabAbove}
      />
      <Walls floor={floor} pick={pick} selection={selection} />
      <Columns floor={floor} pick={pick} selection={selection} />
      {floor.openings.map((o) => (
        <OpeningDetail key={o.id} floor={floor} opening={o} pick={pick} selection={selection} />
      ))}
      {furniture ? <Items floor={floor} pick={pick} selection={selection} /> : null}
    </group>
  )
}

export function Scene3D({ active }: { active: boolean }) {
  const floors = useProject((s) => s.project.floors)
  const view = useProject((s) => s.view)
  const showFurniture = useProject((s) => s.showFurniture)
  const showCeiling = useProject((s) => s.showCeiling)
  const showAllFloors = useProject((s) => s.showAllFloors)
  const selection = useProject((s) => s.selection)
  const select = useProject((s) => s.select)
  const eyeHeight = useProject((s) => s.project.eyeHeight ?? 1.65)
  const floor = useActiveFloor()

  const b = floorBounds(floor)
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minY + b.maxY) / 2
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY, 6)
  const visible = showAllFloors || view === 'walk' ? floors : [floor]
  const walking = view === 'walk'

  /** Underside of the next floor up, or the sky. */
  const undersideAbove = (f: Floor): number => {
    const above = floors
      .filter((x) => x.elevation > f.elevation + 0.1)
      .sort((a, b) => a.elevation - b.elevation)[0]
    return above ? above.elevation - Math.max(0.04, above.slab ?? 0.3) : Infinity
  }

  /** A flight of stairs on the floor below needs a hole in this slab. */
  const wellsBelow = (f: Floor): Vec[][] => {
    const below = floors
      .filter((x) => x.elevation < f.elevation - 0.1)
      .sort((a, b) => b.elevation - a.elevation)[0]
    return below ? stairWells(below) : []
  }

  /** Clicking a piece of the model selects it — but never while walking. */
  const pickFor =
    (target: Floor): Pick =>
    (sel) => {
      if (walking || target.id !== floor.id) return undefined
      return (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        select(sel)
      }
    }

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [cx + span * 0.9, span * 0.85, cz + span * 1.1], fov: 55, near: 0.05, far: 500 }}
      frameloop={active ? 'always' : 'demand'}
      gl={{ antialias: true }}
      onPointerMissed={() => {
        if (!walking) select(null)
      }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color('#0d1119')
        scene.fog = new THREE.Fog('#0d1119', span * 3, span * 9)
      }}
    >
      <hemisphereLight args={['#eaf1ff', '#3a3730', 1.1]} />
      <directionalLight
        position={[cx + span, span * 1.6, cz - span]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-span * 1.4}
        shadow-camera-right={span * 1.4}
        shadow-camera-top={span * 1.4}
        shadow-camera-bottom={-span * 1.4}
        shadow-camera-far={span * 6}
        shadow-bias={-0.0006}
      />
      <ambientLight intensity={0.35} />

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.02, cz]} receiveShadow>
        <planeGeometry args={[span * 12, span * 12]} />
        <meshStandardMaterial color="#171c26" roughness={1} />
      </mesh>
      <gridHelper args={[span * 12, Math.round(span * 12), '#1e2534', '#161b26']} position={[cx, -0.015, cz]} />

      <Suspense fallback={null}>
        {visible.map((f) => (
          <FloorGroup
            key={f.id}
            floor={f}
            furniture={showFurniture}
            ceiling={showCeiling}
            pick={pickFor(f)}
            selection={f.id === floor.id ? selection : null}
            holes={wellsBelow(f)}
            slabAbove={undersideAbove(f)}
          />
        ))}
      </Suspense>

      {walking ? (
        <WalkControls floor={floor} floors={floors} eyeHeight={eyeHeight} />
      ) : (
        <OrbitControls
          makeDefault
          target={[cx, 1, cz]}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={1}
          maxDistance={span * 6}
          enableDamping
          dampingFactor={0.08}
        />
      )}
    </Canvas>
  )
}
