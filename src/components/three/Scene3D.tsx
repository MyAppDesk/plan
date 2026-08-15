import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Floor, Opening } from '../../types'
import { useActiveFloor, useProject } from '../../store/useProject'
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
} from '../../lib/geometry'
import { WalkControls } from './WalkControls'

const WALL_COLOR = '#dfe4ee'
const FLOOR_COLOR = '#8c8378'

/* ------------------------------------------------------------------ */
/* rooms                                                               */
/* ------------------------------------------------------------------ */

function RoomSlabs({ floor, ceiling }: { floor: Floor; ceiling: boolean }) {
  const slabs = useMemo(() => {
    const pts = pointMap(floor)
    return floor.rooms
      .map((room) => {
        const poly = roomPoints(floor, room, pts)
        if (poly.length < 3) return null
        const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, p.y)))
        const geo = new THREE.ShapeGeometry(shape)
        geo.rotateX(Math.PI / 2)
        return { room, geo }
      })
      .filter((s): s is { room: (typeof floor.rooms)[number]; geo: THREE.ShapeGeometry } => !!s)
  }, [floor])

  return (
    <group>
      {slabs.map(({ room, geo }) => {
        const h = room.height ?? floor.height
        return (
          <group key={room.id}>
            <mesh geometry={geo} position={[0, floor.elevation + 0.005, 0]} receiveShadow>
              <meshStandardMaterial color={FLOOR_COLOR} roughness={0.95} side={THREE.DoubleSide} />
            </mesh>
            {ceiling ? (
              <mesh geometry={geo} position={[0, floor.elevation + h - 0.01, 0]}>
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
/* walls                                                               */
/* ------------------------------------------------------------------ */

function Walls({ floor }: { floor: Floor }) {
  const pts = pointMap(floor)
  const solids = useMemo(
    () => floor.walls.flatMap((w) => wallSolids(floor, w, pts).map((s) => ({ s, id: w.id, color: w.color }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [floor],
  )
  return (
    <group>
      {solids.map(({ s, id, color }, i) => (
        <mesh
          key={`${id}-${i}`}
          position={[s.cx, floor.elevation + (s.bottom + s.top) / 2, s.cy]}
          rotation={[0, -s.angle, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[s.len, s.top - s.bottom, s.thickness]} />
          <meshStandardMaterial color={color ?? WALL_COLOR} roughness={0.92} />
        </mesh>
      ))}
    </group>
  )
}

function Columns({ floor }: { floor: Floor }) {
  return (
    <group>
      {(floor.columns ?? []).map((c) => {
        const top = columnTopOf(floor, c)
        const h = Math.max(0.02, top - c.base)
        return (
          <mesh
            key={c.id}
            position={[c.x, floor.elevation + c.base + h / 2, c.y]}
            rotation={[0, -c.rot, 0]}
            castShadow
            receiveShadow
          >
            {c.shape === 'round' ? (
              <cylinderGeometry args={[Math.max(c.w, c.d) / 2, Math.max(c.w, c.d) / 2, h, 24]} />
            ) : (
              <boxGeometry args={[c.w, h, c.d]} />
            )}
            <meshStandardMaterial color={c.color} roughness={0.9} />
          </mesh>
        )
      })}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* doors + windows                                                     */
/* ------------------------------------------------------------------ */

function OpeningDetail({ floor, opening }: { floor: Floor; opening: Opening }) {
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

  if (opening.kind === 'door') {
    const hinge = opening.flipHinge ? -1 : 1
    const swing = (opening.flipSide ? -1 : 1) * (Math.PI / 2.4)
    return (
      <group position={[cx, y0, cy]} rotation={[0, -ang, 0]}>
        {/* casing */}
        <mesh position={[-w / 2 - 0.03, height / 2, 0]}>
          <boxGeometry args={[0.06, height, t + 0.04]} />
          <meshStandardMaterial color="#c9cedb" roughness={0.8} />
        </mesh>
        <mesh position={[w / 2 + 0.03, height / 2, 0]}>
          <boxGeometry args={[0.06, height, t + 0.04]} />
          <meshStandardMaterial color="#c9cedb" roughness={0.8} />
        </mesh>
        <mesh position={[0, height + 0.03, 0]}>
          <boxGeometry args={[w + 0.12, 0.06, t + 0.04]} />
          <meshStandardMaterial color="#c9cedb" roughness={0.8} />
        </mesh>
        {/* leaf, hinged on one side and left ajar */}
        <group position={[(hinge * w) / 2, 0, 0]} rotation={[0, hinge * swing, 0]}>
          <mesh position={[(-hinge * w) / 2, height / 2, 0]} castShadow>
            <boxGeometry args={[w - 0.02, height - 0.02, 0.04]} />
            <meshStandardMaterial color="#b98d5f" roughness={0.7} />
          </mesh>
          <mesh position={[-hinge * (w - 0.12), height * 0.45, 0.045]}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshStandardMaterial color="#cfd4de" metalness={0.8} roughness={0.25} />
          </mesh>
        </group>
      </group>
    )
  }

  return (
    <group position={[cx, y0 + sill, cy]} rotation={[0, -ang, 0]}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[w - 0.06, height - 0.06, 0.02]} />
        <meshPhysicalMaterial
          color="#bcdcf5"
          transparent
          opacity={0.28}
          roughness={0.05}
          metalness={0}
          transmission={0.6}
        />
      </mesh>
      {/* frame */}
      {[
        [0, -height / 2 + 0.03, w, 0.06],
        [0, height / 2 - 0.03, w, 0.06],
      ].map(([x, y, sw, sh], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <boxGeometry args={[sw, sh, t + 0.02]} />
          <meshStandardMaterial color="#e7ebf2" roughness={0.7} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (w - 0.06)) / 2, height / 2, 0]}>
          <boxGeometry args={[0.06, height, t + 0.02]} />
          <meshStandardMaterial color="#e7ebf2" roughness={0.7} />
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

function Items({ floor }: { floor: Floor }) {
  return (
    <group>
      {floor.items.map((item) => (
        <group key={item.id} position={[item.x, floor.elevation + item.z, item.y]} rotation={[0, -item.rot, 0]}>
          {catalogItem(item.kind).build({ w: item.w, d: item.d, h: item.h, color: item.color })}
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* scene                                                               */
/* ------------------------------------------------------------------ */

function FloorGroup({ floor, furniture, ceiling }: { floor: Floor; furniture: boolean; ceiling: boolean }) {
  return (
    <group>
      <RoomSlabs floor={floor} ceiling={ceiling} />
      <Walls floor={floor} />
      <Columns floor={floor} />
      {floor.openings.map((o) => (
        <OpeningDetail key={o.id} floor={floor} opening={o} />
      ))}
      {furniture ? <Items floor={floor} /> : null}
    </group>
  )
}

export function Scene3D({ active }: { active: boolean }) {
  const floors = useProject((s) => s.project.floors)
  const view = useProject((s) => s.view)
  const showFurniture = useProject((s) => s.showFurniture)
  const showCeiling = useProject((s) => s.showCeiling)
  const showAllFloors = useProject((s) => s.showAllFloors)
  const floor = useActiveFloor()

  const b = floorBounds(floor)
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minY + b.maxY) / 2
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY, 6)
  const visible = showAllFloors || view === 'walk' ? floors : [floor]
  const walking = view === 'walk'

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [cx + span * 0.9, span * 0.85, cz + span * 1.1], fov: 55, near: 0.05, far: 500 }}
      frameloop={active ? 'always' : 'demand'}
      gl={{ antialias: true }}
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
          <FloorGroup key={f.id} floor={f} furniture={showFurniture} ceiling={showCeiling} />
        ))}
      </Suspense>

      {walking ? (
        <WalkControls floor={floor} />
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
