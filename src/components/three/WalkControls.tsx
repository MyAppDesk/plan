import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Floor } from '../../types'
import { blockingSolids, polygonArea, resolveCollisions, roomPoints, polygonCentroid } from '../../lib/geometry'

const EYE = 1.65
const CROUCH = 1.05
const SPEED = 2.6
const RUN = 5.2
const RADIUS = 0.26

/** First-person controller: mouse look, WASD, and walls you cannot walk through. */
export function WalkControls({ floor }: { floor: Floor }) {
  const camera = useThree((s) => s.camera)
  const keys = useRef<Record<string, boolean>>({})
  const forward = useRef(new THREE.Vector3())
  const right = useRef(new THREE.Vector3())

  const solids = useMemo(() => blockingSolids(floor, 0.05, EYE + 0.1), [floor])

  // drop the camera in the middle of the biggest room the first time we walk
  useEffect(() => {
    const rooms = floor.rooms
      .map((r) => {
        const pts = roomPoints(floor, r)
        return { c: polygonCentroid(pts), a: polygonArea(pts) }
      })
      .sort((x, y) => y.a - x.a)
    const start = rooms[0]?.c ?? { x: 0, y: 0 }
    camera.position.set(start.x, floor.elevation + EYE, start.y)
    camera.rotation.set(0, 0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor.id])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true
    }
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      keys.current = {}
    }
  }, [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const k = keys.current
    let fwd = 0
    let side = 0
    if (k.KeyW || k.ArrowUp) fwd += 1
    if (k.KeyS || k.ArrowDown) fwd -= 1
    if (k.KeyD || k.ArrowRight) side += 1
    if (k.KeyA || k.ArrowLeft) side -= 1

    const crouching = !!(k.ControlLeft || k.KeyC)
    const targetY = floor.elevation + (crouching ? CROUCH : EYE)
    camera.position.y += (targetY - camera.position.y) * Math.min(1, delta * 10)

    if (!fwd && !side) return

    camera.getWorldDirection(forward.current)
    forward.current.y = 0
    forward.current.normalize()
    right.current.crossVectors(forward.current, camera.up).normalize()

    const speed = (k.ShiftLeft || k.ShiftRight ? RUN : SPEED) * delta
    const next = {
      x: camera.position.x + (forward.current.x * fwd + right.current.x * side) * speed,
      y: camera.position.z + (forward.current.z * fwd + right.current.z * side) * speed,
    }
    const resolved = resolveCollisions(next, RADIUS, solids)
    camera.position.x = resolved.x
    camera.position.z = resolved.y
  })

  return <PointerLockControls makeDefault />
}
