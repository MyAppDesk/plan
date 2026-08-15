import type { ReactNode } from 'react'
import { stairLayout } from './stairs'

/**
 * Furniture is procedural: every item is built from primitives that follow the
 * width / depth / height you set, so any size stays consistent in 2D and 3D and
 * nothing has to be downloaded.
 *
 * Local space: x → width, z → depth, y → height (0 = item base).
 */

export interface GlyphRect {
  type: 'rect'
  /** normalised 0..1 inside the footprint */
  x: number
  y: number
  w: number
  h: number
  fill?: boolean
  radius?: number
}
export interface GlyphLine {
  type: 'line'
  points: number[] // normalised x,y pairs
}
export interface GlyphCircle {
  type: 'circle'
  x: number
  y: number
  r: number
  fill?: boolean
}
export type Glyph = GlyphRect | GlyphLine | GlyphCircle

export interface CatalogItem {
  kind: string
  name: string
  group: string
  w: number
  d: number
  h: number
  color: string
  /** default distance from the floor (wall units, shelves…) */
  z?: number
  glyph: Glyph[]
  build: (p: { w: number; d: number; h: number; color: string }) => ReactNode
}

function B({
  p,
  s,
  color,
  rot,
  metal,
  rough = 0.75,
  opacity,
}: {
  p: [number, number, number]
  s: [number, number, number]
  color: string
  rot?: [number, number, number]
  metal?: number
  rough?: number
  opacity?: number
}) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={color}
        roughness={rough}
        metalness={metal ?? 0.05}
        transparent={opacity !== undefined}
        opacity={opacity ?? 1}
      />
    </mesh>
  )
}

function Cyl({
  p,
  r,
  h,
  color,
  rot,
  seg = 16,
  metal = 0.05,
  rough = 0.6,
}: {
  p: [number, number, number]
  r: number
  h: number
  color: string
  rot?: [number, number, number]
  seg?: number
  metal?: number
  rough?: number
}) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, h, seg]} />
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} />
    </mesh>
  )
}

const DARK = '#3a3f4b'
const WOOD = '#8b6a45'
const WHITE = '#e6e9ef'

const outline = (inset = 0.08): Glyph[] => [{ type: 'rect', x: inset, y: inset, w: 1 - inset * 2, h: 1 - inset * 2 }]

/** Steps follow the flight's own path, so every shape builds the same way. */
function buildStairs(kind: string) {
  return ({ w, d, h, color }: { w: number; d: number; h: number; color: string }) => {
    const layout = stairLayout(kind, { w, d, h })
    return (
      <group>
        {layout.steps.map((s, i) => (
          <B
            key={i}
            p={[s.x, Math.max(0.01, s.top - layout.riser / 2), s.z]}
            s={[s.width, layout.riser, s.going * 1.02]}
            rot={[0, Math.PI / 2 - s.rot, 0]}
            color={i % 2 ? color : '#8b95a5'}
          />
        ))}
        {layout.shape === 'spiral' ? (
          <Cyl p={[0, h / 2, 0]} r={Math.min(w, d) * 0.07} h={h} color="#8d95a5" metal={0.6} />
        ) : null}
      </group>
    )
  }
}

const stairGlyph = (kind: string, w: number, d: number, h: number): Glyph[] => {
  const layout = stairLayout(kind, { w, d, h })
  const nx = (v: number) => v / w + 0.5
  const ny = (v: number) => v / d + 0.5
  return [
    ...layout.steps.map((s) => {
      const c = Math.cos(s.rot)
      const si = Math.sin(s.rot)
      // a line across the tread, perpendicular to the direction of travel
      const hx = (-si * s.width) / 2
      const hz = (c * s.width) / 2
      return { type: 'line' as const, points: [nx(s.x - hx), ny(s.z - hz), nx(s.x + hx), ny(s.z + hz)] }
    }),
    { type: 'line', points: [nx(layout.steps[0].x), ny(layout.steps[0].z), nx(layout.steps[layout.steps.length - 1].x), ny(layout.steps[layout.steps.length - 1].z)] },
  ]
}

export const CATALOG: CatalogItem[] = [
  /* ------------------------------ structure ------------------------------ */
  {
    kind: 'stairs',
    name: 'Straight stairs',
    group: 'Structure',
    w: 1.0,
    d: 3.8,
    h: 2.9,
    color: '#9aa3b2',
    glyph: stairGlyph('stairs', 1.0, 3.8, 2.9),
    build: buildStairs('stairs'),
  },
  {
    kind: 'stairs-l',
    name: 'Quarter-turn stairs',
    group: 'Structure',
    w: 2.6,
    d: 3.0,
    h: 2.9,
    color: '#9aa3b2',
    glyph: stairGlyph('stairs-l', 2.6, 3.0, 2.9),
    build: buildStairs('stairs-l'),
  },
  {
    kind: 'stairs-u',
    name: 'Half-turn stairs',
    group: 'Structure',
    w: 2.4,
    d: 2.8,
    h: 2.9,
    color: '#9aa3b2',
    glyph: stairGlyph('stairs-u', 2.4, 2.8, 2.9),
    build: buildStairs('stairs-u'),
  },
  {
    kind: 'stairs-spiral',
    name: 'Spiral stairs',
    group: 'Structure',
    w: 1.8,
    d: 1.8,
    h: 2.9,
    color: '#9aa3b2',
    glyph: stairGlyph('stairs-spiral', 1.8, 1.8, 2.9),
    build: buildStairs('stairs-spiral'),
  },
  /* ------------------------------- bedroom ------------------------------- */
  {
    kind: 'loft-box',
    name: 'Storage loft (closed)',
    group: 'Structure',
    w: 2.4,
    d: 1.2,
    h: 0.55,
    z: 2.05,
    color: '#b7a181',
    glyph: [
      ...outline(0.03),
      { type: 'line', points: [0.5, 0.03, 0.5, 0.97] },
      { type: 'line', points: [0.03, 0.03, 0.97, 0.97] },
      { type: 'line', points: [0.03, 0.97, 0.97, 0.03] },
    ],
    build: ({ w, d, h, color }) => (
      <group>
        {/* the box itself: a cupboard tucked up near the ceiling */}
        <B p={[0, h / 2, 0]} s={[w, h, d]} color={color} />
        {/* two doors on the open face */}
        {[-1, 1].map((sx) => (
          <B key={sx} p={[(sx * w) / 4, h / 2, d / 2 + 0.012]} s={[w / 2 - 0.03, h - 0.05, 0.02]} color="#9c8464" />
        ))}
        {[-1, 1].map((sx) => (
          <B key={`h${sx}`} p={[sx * 0.04, h / 2, d / 2 + 0.03]} s={[0.02, 0.14, 0.02]} color="#cfd4de" metal={0.8} rough={0.3} />
        ))}
      </group>
    ),
  },
  {
    kind: 'loft',
    name: 'Loft deck (open)',
    group: 'Structure',
    w: 2.4,
    d: 1.2,
    h: 0.28,
    z: 2.1,
    color: '#a98c63',
    glyph: [
      ...outline(0.04),
      { type: 'line', points: [0.04, 0.04, 0.96, 0.96] },
      { type: 'line', points: [0.04, 0.96, 0.96, 0.04] },
    ],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h / 2, 0]} s={[w, h, d]} color={color} />
        {/* fascia along the open edge */}
        <B p={[0, h + 0.06, d / 2 - 0.02]} s={[w, 0.12, 0.04]} color="#8d7350" />
      </group>
    ),
  },
  {
    kind: 'bed-double',
    name: 'Double bed',
    group: 'Bedroom',
    w: 1.5,
    d: 2.0,
    h: 0.55,
    color: '#6f7c93',
    glyph: [
      { type: 'rect', x: 0.06, y: 0.0, w: 0.88, h: 0.22 },
      { type: 'rect', x: 0.1, y: 0.03, w: 0.35, h: 0.15, radius: 0.4 },
      { type: 'rect', x: 0.55, y: 0.03, w: 0.35, h: 0.15, radius: 0.4 },
      { type: 'line', points: [0, 0.28, 1, 0.28] },
    ],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h * 0.35, 0]} s={[w, h * 0.7, d]} color={WOOD} />
        <B p={[0, h * 0.85, 0.03]} s={[w * 0.98, h * 0.35, d * 0.96]} color={color} />
        <B p={[0, h * 1.0, -d / 2 + d * 0.12]} s={[w * 0.9, h * 0.14, d * 0.16]} color={WHITE} />
        <B p={[0, h * 1.2, -d / 2 - 0.03]} s={[w, h * 1.1, 0.06]} color={WOOD} />
      </group>
    ),
  },
  {
    kind: 'bed-single',
    name: 'Single bed',
    group: 'Bedroom',
    w: 0.95,
    d: 2.0,
    h: 0.55,
    color: '#6f7c93',
    glyph: [
      { type: 'rect', x: 0.1, y: 0.03, w: 0.8, h: 0.16, radius: 0.4 },
      { type: 'line', points: [0, 0.26, 1, 0.26] },
    ],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h * 0.35, 0]} s={[w, h * 0.7, d]} color={WOOD} />
        <B p={[0, h * 0.85, 0.03]} s={[w * 0.98, h * 0.35, d * 0.96]} color={color} />
        <B p={[0, h * 1.0, -d / 2 + d * 0.12]} s={[w * 0.7, h * 0.14, d * 0.14]} color={WHITE} />
        <B p={[0, h * 1.2, -d / 2 - 0.03]} s={[w, h * 1.1, 0.06]} color={WOOD} />
      </group>
    ),
  },
  {
    kind: 'wardrobe',
    name: 'Wardrobe',
    group: 'Bedroom',
    w: 1.8,
    d: 0.6,
    h: 2.2,
    color: '#9a7f5f',
    glyph: [...outline(0.04), { type: 'line', points: [0.5, 0.04, 0.5, 0.96] }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h / 2, 0]} s={[w, h, d]} color={color} />
        <B p={[-w / 4, h / 2, d / 2 + 0.005]} s={[w / 2 - 0.02, h - 0.04, 0.02]} color="#00000022" opacity={0.25} />
        <B p={[w / 4, h / 2, d / 2 + 0.005]} s={[w / 2 - 0.02, h - 0.04, 0.02]} color="#00000022" opacity={0.25} />
        <B p={[-0.04, h * 0.5, d / 2 + 0.02]} s={[0.02, 0.24, 0.02]} color="#cfd4de" metal={0.8} rough={0.3} />
        <B p={[0.04, h * 0.5, d / 2 + 0.02]} s={[0.02, 0.24, 0.02]} color="#cfd4de" metal={0.8} rough={0.3} />
      </group>
    ),
  },
  {
    kind: 'nightstand',
    name: 'Nightstand',
    group: 'Bedroom',
    w: 0.45,
    d: 0.4,
    h: 0.55,
    color: '#9a7f5f',
    glyph: [...outline(0.1), { type: 'line', points: [0.1, 0.5, 0.9, 0.5] }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h / 2, 0]} s={[w, h, d]} color={color} />
        <B p={[0, h * 0.7, d / 2 + 0.01]} s={[w * 0.8, 0.02, 0.02]} color="#cfd4de" metal={0.8} rough={0.3} />
        <B p={[0, h * 0.3, d / 2 + 0.01]} s={[w * 0.8, 0.02, 0.02]} color="#cfd4de" metal={0.8} rough={0.3} />
      </group>
    ),
  },
  {
    kind: 'dresser',
    name: 'Chest of drawers',
    group: 'Bedroom',
    w: 1.1,
    d: 0.5,
    h: 0.85,
    color: '#9a7f5f',
    glyph: [...outline(0.06), { type: 'line', points: [0.06, 0.4, 0.94, 0.4] }, { type: 'line', points: [0.06, 0.7, 0.94, 0.7] }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h / 2, 0]} s={[w, h, d]} color={color} />
        {[0.22, 0.5, 0.78].map((f) => (
          <B key={f} p={[0, h * f, d / 2 + 0.012]} s={[w * 0.9, h * 0.22, 0.02]} color="#00000022" opacity={0.25} />
        ))}
      </group>
    ),
  },

  /* -------------------------------- living ------------------------------- */
  {
    kind: 'sofa-3',
    name: 'Sofa (3 seats)',
    group: 'Living',
    w: 2.1,
    d: 0.9,
    h: 0.82,
    color: '#5d6778',
    glyph: [
      ...outline(0.04),
      { type: 'line', points: [0.04, 0.72, 0.96, 0.72] },
      { type: 'line', points: [0.36, 0.04, 0.36, 0.72] },
      { type: 'line', points: [0.66, 0.04, 0.66, 0.72] },
    ],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h * 0.22, 0]} s={[w, h * 0.44, d]} color={color} />
        <B p={[0, h * 0.62, -d / 2 + d * 0.12]} s={[w, h * 0.76, d * 0.24]} color={color} />
        <B p={[-w / 2 + 0.09, h * 0.5, 0]} s={[0.18, h * 0.55, d]} color={color} />
        <B p={[w / 2 - 0.09, h * 0.5, 0]} s={[0.18, h * 0.55, d]} color={color} />
        <B p={[0, h * 0.48, d * 0.1]} s={[w * 0.62, h * 0.12, d * 0.6]} color={color} rough={0.9} />
      </group>
    ),
  },
  {
    kind: 'armchair',
    name: 'Armchair',
    group: 'Living',
    w: 0.85,
    d: 0.85,
    h: 0.8,
    color: '#6d7789',
    glyph: [...outline(0.06), { type: 'line', points: [0.06, 0.7, 0.94, 0.7] }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h * 0.24, 0]} s={[w, h * 0.48, d]} color={color} />
        <B p={[0, h * 0.66, -d / 2 + d * 0.12]} s={[w, h * 0.7, d * 0.24]} color={color} />
        <B p={[-w / 2 + 0.08, h * 0.52, 0]} s={[0.16, h * 0.5, d]} color={color} />
        <B p={[w / 2 - 0.08, h * 0.52, 0]} s={[0.16, h * 0.5, d]} color={color} />
      </group>
    ),
  },
  {
    kind: 'coffee-table',
    name: 'Coffee table',
    group: 'Living',
    w: 1.1,
    d: 0.6,
    h: 0.42,
    color: '#8b6a45',
    glyph: outline(0.08),
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h - 0.03, 0]} s={[w, 0.06, d]} color={color} />
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz], i) => (
          <B
            key={i}
            p={[(sx * (w / 2 - 0.07)) as number, (h - 0.06) / 2, (sz * (d / 2 - 0.07)) as number]}
            s={[0.05, h - 0.06, 0.05]}
            color={DARK}
          />
        ))}
      </group>
    ),
  },
  {
    kind: 'tv-unit',
    name: 'TV unit',
    group: 'Living',
    w: 1.6,
    d: 0.4,
    h: 0.45,
    color: '#3f4550',
    glyph: [...outline(0.06), { type: 'line', points: [0.5, 0.06, 0.5, 0.94] }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h / 2, 0]} s={[w, h, d]} color={color} />
        <B p={[0, h + 0.36, 0]} s={[w * 0.75, 0.6, 0.05]} color="#101318" rough={0.25} metal={0.4} />
        <B p={[0, h + 0.05, 0]} s={[0.22, 0.1, 0.16]} color={DARK} />
      </group>
    ),
  },
  {
    kind: 'bookshelf',
    name: 'Bookshelf',
    group: 'Living',
    w: 0.9,
    d: 0.32,
    h: 1.9,
    color: '#8b6a45',
    glyph: [...outline(0.05), { type: 'line', points: [0.05, 0.5, 0.95, 0.5] }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h / 2, -d / 2 + 0.01]} s={[w, h, 0.03]} color={color} />
        <B p={[-w / 2 + 0.01, h / 2, 0]} s={[0.03, h, d]} color={color} />
        <B p={[w / 2 - 0.01, h / 2, 0]} s={[0.03, h, d]} color={color} />
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <B key={f} p={[0, Math.max(0.015, h * f - 0.015), 0]} s={[w, 0.03, d]} color={color} />
        ))}
        {[0.13, 0.38, 0.63, 0.88].map((f, i) => (
          <B key={f} p={[-w * 0.15 + i * 0.02, h * f, 0]} s={[w * 0.5, h * 0.2, d * 0.7]} color={i % 2 ? '#5f6b80' : '#7d6b8f'} />
        ))}
      </group>
    ),
  },
  {
    kind: 'rug',
    name: 'Rug',
    group: 'Living',
    w: 2.0,
    d: 1.4,
    h: 0.02,
    color: '#5b4b63',
    glyph: [...outline(0.02), ...outline(0.1)],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h / 2, 0]} s={[w, h, d]} color={color} rough={1} />
        <B p={[0, h, 0]} s={[w * 0.82, 0.002, d * 0.76]} color="#00000033" opacity={0.35} />
      </group>
    ),
  },

  /* ------------------------------- kitchen ------------------------------- */
  {
    kind: 'dining-table',
    name: 'Dining table',
    group: 'Kitchen',
    w: 1.6,
    d: 0.9,
    h: 0.75,
    color: '#8b6a45',
    glyph: outline(0.06),
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h - 0.02, 0]} s={[w, 0.04, d]} color={color} />
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz], i) => (
          <B
            key={i}
            p={[(sx * (w / 2 - 0.08)) as number, (h - 0.04) / 2, (sz * (d / 2 - 0.08)) as number]}
            s={[0.06, h - 0.04, 0.06]}
            color={DARK}
          />
        ))}
      </group>
    ),
  },
  {
    kind: 'chair',
    name: 'Chair',
    group: 'Kitchen',
    w: 0.45,
    d: 0.45,
    h: 0.9,
    color: '#6b7180',
    glyph: [...outline(0.12), { type: 'line', points: [0.12, 0.18, 0.88, 0.18] }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h * 0.48, 0]} s={[w, 0.05, d]} color={color} />
        <B p={[0, h * 0.75, -d / 2 + 0.03]} s={[w, h * 0.5, 0.05]} color={color} />
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz], i) => (
          <B
            key={i}
            p={[(sx * (w / 2 - 0.04)) as number, h * 0.24, (sz * (d / 2 - 0.04)) as number]}
            s={[0.04, h * 0.48, 0.04]}
            color={DARK}
          />
        ))}
      </group>
    ),
  },
  {
    kind: 'counter',
    name: 'Kitchen counter',
    group: 'Kitchen',
    w: 1.8,
    d: 0.6,
    h: 0.9,
    color: '#cfd4de',
    glyph: [...outline(0.04), { type: 'line', points: [0.04, 0.75, 0.96, 0.75] }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, (h - 0.04) / 2, 0]} s={[w, h - 0.04, d]} color={color} />
        <B p={[0, h - 0.02, 0]} s={[w + 0.02, 0.04, d + 0.02]} color="#2f3540" rough={0.35} />
        {[-1, 1].map((s) => (
          <B key={s} p={[(s * w) / 4, h * 0.55, d / 2 + 0.01]} s={[w / 2 - 0.03, h * 0.8, 0.02]} color="#00000022" opacity={0.25} />
        ))}
      </group>
    ),
  },
  {
    kind: 'fridge',
    name: 'Fridge',
    group: 'Kitchen',
    w: 0.7,
    d: 0.68,
    h: 1.85,
    color: '#c6ccd8',
    glyph: [...outline(0.05), { type: 'line', points: [0.05, 0.35, 0.95, 0.35] }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h / 2, 0]} s={[w, h, d]} color={color} metal={0.5} rough={0.35} />
        <B p={[0, h * 0.68, d / 2 + 0.005]} s={[w * 0.96, h * 0.6, 0.02]} color="#00000022" opacity={0.2} />
        <B p={[w * 0.3, h * 0.55, d / 2 + 0.03]} s={[0.03, 0.35, 0.03]} color="#8d95a5" metal={0.8} rough={0.25} />
        <B p={[w * 0.3, h * 0.24, d / 2 + 0.03]} s={[0.03, 0.3, 0.03]} color="#8d95a5" metal={0.8} rough={0.25} />
      </group>
    ),
  },
  {
    kind: 'stove',
    name: 'Cooker',
    group: 'Kitchen',
    w: 0.6,
    d: 0.6,
    h: 0.9,
    color: '#43485a',
    glyph: [
      ...outline(0.06),
      { type: 'circle', x: 0.3, y: 0.3, r: 0.11 },
      { type: 'circle', x: 0.7, y: 0.3, r: 0.11 },
      { type: 'circle', x: 0.3, y: 0.7, r: 0.11 },
      { type: 'circle', x: 0.7, y: 0.7, r: 0.11 },
    ],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h / 2, 0]} s={[w, h, d]} color={color} metal={0.4} rough={0.4} />
        <B p={[0, h + 0.005, 0]} s={[w, 0.02, d]} color="#15181f" rough={0.2} />
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz], i) => (
          <Cyl key={i} p={[(sx * w) / 4, h + 0.02, (sz * d) / 4]} r={Math.min(w, d) * 0.16} h={0.01} color="#2a2f3a" />
        ))}
      </group>
    ),
  },
  {
    kind: 'sink',
    name: 'Sink',
    group: 'Kitchen',
    w: 0.6,
    d: 0.55,
    h: 0.9,
    color: '#cfd4de',
    glyph: [...outline(0.06), { type: 'rect', x: 0.18, y: 0.22, w: 0.64, h: 0.5, radius: 0.15 }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, (h - 0.05) / 2, 0]} s={[w, h - 0.05, d]} color={color} />
        <B p={[0, h - 0.02, 0]} s={[w + 0.02, 0.04, d + 0.02]} color="#9aa3b2" metal={0.7} rough={0.3} />
        <B p={[0, h - 0.05, 0.02]} s={[w * 0.7, 0.06, d * 0.6]} color="#7f8899" metal={0.8} rough={0.2} />
        <Cyl p={[0, h + 0.12, -d / 2 + 0.08]} r={0.02} h={0.24} color="#aeb6c4" />
      </group>
    ),
  },

  /* ------------------------------- bathroom ------------------------------ */
  {
    kind: 'toilet',
    name: 'Toilet',
    group: 'Bathroom',
    w: 0.4,
    d: 0.7,
    h: 0.78,
    color: '#e9ecf2',
    glyph: [
      { type: 'rect', x: 0.1, y: 0.0, w: 0.8, h: 0.22 },
      { type: 'circle', x: 0.5, y: 0.58, r: 0.32 },
    ],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h * 0.28, -d / 2 + d * 0.12]} s={[w * 0.85, h * 0.56, d * 0.24]} color={color} />
        <B p={[0, h * 0.75, -d / 2 + d * 0.14]} s={[w * 0.95, h * 0.45, d * 0.2]} color={color} />
        <Cyl p={[0, h * 0.45, d * 0.12]} r={w * 0.42} h={h * 0.12} color={color} />
        <Cyl p={[0, h * 0.35, d * 0.12]} r={w * 0.3} h={h * 0.6} color={color} />
      </group>
    ),
  },
  {
    kind: 'basin',
    name: 'Wash basin',
    group: 'Bathroom',
    w: 0.6,
    d: 0.45,
    h: 0.85,
    color: '#e9ecf2',
    glyph: [...outline(0.06), { type: 'circle', x: 0.5, y: 0.5, r: 0.26 }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h - 0.06, 0]} s={[w, 0.12, d]} color={color} />
        <B p={[0, h - 0.3, -d / 2 + 0.06]} s={[w * 0.5, 0.5, 0.1]} color={color} />
        <Cyl p={[0, h - 0.16, 0]} r={Math.min(w, d) * 0.3} h={0.16} color="#dfe3ea" />
        <Cyl p={[0, h + 0.1, -d / 2 + 0.07]} r={0.018} h={0.2} color="#aeb6c4" />
      </group>
    ),
  },
  {
    kind: 'bathtub',
    name: 'Bathtub',
    group: 'Bathroom',
    w: 1.7,
    d: 0.75,
    h: 0.6,
    color: '#e9ecf2',
    glyph: [...outline(0.02), { type: 'rect', x: 0.08, y: 0.12, w: 0.84, h: 0.76, radius: 0.2 }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h / 2, 0]} s={[w, h, d]} color={color} />
        <B p={[0, h * 0.75, 0]} s={[w - 0.16, h * 0.6, d - 0.16]} color="#cfd7e2" />
        <Cyl p={[-w / 2 + 0.12, h + 0.1, 0]} r={0.02} h={0.2} color="#aeb6c4" />
      </group>
    ),
  },
  {
    kind: 'shower',
    name: 'Shower',
    group: 'Bathroom',
    w: 0.9,
    d: 0.9,
    h: 2.0,
    color: '#cfd9e6',
    glyph: [...outline(0.02), { type: 'line', points: [0.02, 0.02, 0.98, 0.98] }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, 0.05, 0]} s={[w, 0.1, d]} color="#e9ecf2" />
        <B p={[0, h / 2, d / 2]} s={[w, h, 0.02]} color={color} opacity={0.25} rough={0.05} />
        <B p={[w / 2, h / 2, 0]} s={[0.02, h, d]} color={color} opacity={0.25} rough={0.05} />
        <Cyl p={[0, h - 0.15, -d / 2 + 0.12]} r={0.06} h={0.03} color="#aeb6c4" />
      </group>
    ),
  },
  {
    kind: 'washer',
    name: 'Washing machine',
    group: 'Bathroom',
    w: 0.6,
    d: 0.6,
    h: 0.85,
    color: '#dfe3ea',
    glyph: [...outline(0.06), { type: 'circle', x: 0.5, y: 0.55, r: 0.26 }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h / 2, 0]} s={[w, h, d]} color={color} />
        <Cyl p={[0, h * 0.5, d / 2]} r={Math.min(w, h) * 0.3} h={0.04} color="#4a5260" rot={[Math.PI / 2, 0, 0]} />
        <B p={[0, h * 0.9, d / 2 + 0.01]} s={[w * 0.9, 0.08, 0.02]} color="#9aa3b2" />
      </group>
    ),
  },

  /* -------------------------------- office ------------------------------- */
  {
    kind: 'desk',
    name: 'Desk',
    group: 'Office',
    w: 1.4,
    d: 0.7,
    h: 0.75,
    color: '#8b6a45',
    glyph: [...outline(0.04), { type: 'rect', x: 0.6, y: 0.12, w: 0.34, h: 0.76 }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h - 0.02, 0]} s={[w, 0.04, d]} color={color} />
        <B p={[-w / 2 + 0.03, (h - 0.04) / 2, 0]} s={[0.05, h - 0.04, d]} color={DARK} />
        <B p={[w / 2 - 0.03, (h - 0.04) / 2, 0]} s={[0.05, h - 0.04, d]} color={DARK} />
        <B p={[0, h + 0.18, -d / 2 + 0.12]} s={[0.5, 0.3, 0.02]} color="#12151c" rough={0.2} />
        <B p={[0, h + 0.03, -d / 2 + 0.12]} s={[0.12, 0.06, 0.1]} color={DARK} />
      </group>
    ),
  },
  {
    kind: 'office-chair',
    name: 'Office chair',
    group: 'Office',
    w: 0.6,
    d: 0.6,
    h: 1.1,
    color: '#3d434f',
    glyph: [{ type: 'circle', x: 0.5, y: 0.5, r: 0.42 }, { type: 'line', points: [0.15, 0.85, 0.85, 0.85] }],
    build: ({ w, d, h, color }) => (
      <group>
        <Cyl p={[0, 0.03, 0]} r={Math.min(w, d) * 0.45} h={0.06} color={color} />
        <Cyl p={[0, h * 0.25, 0]} r={0.035} h={h * 0.45} color="#9aa3b2" metal={0.6} />
        <B p={[0, h * 0.46, 0]} s={[w, 0.1, d]} color={color} />
        <B p={[0, h * 0.75, -d / 2 + 0.05]} s={[w * 0.9, h * 0.5, 0.08]} color={color} />
      </group>
    ),
  },
  {
    kind: 'plant',
    name: 'Plant',
    group: 'Other',
    w: 0.5,
    d: 0.5,
    h: 1.2,
    color: '#4c7a4c',
    glyph: [{ type: 'circle', x: 0.5, y: 0.5, r: 0.45 }, { type: 'circle', x: 0.5, y: 0.5, r: 0.18 }],
    build: ({ w, d, h, color }) => (
      <group>
        <Cyl p={[0, h * 0.12, 0]} r={Math.min(w, d) * 0.32} h={h * 0.24} color="#a9764f" />
        <Cyl p={[0, h * 0.45, 0]} r={0.025} h={h * 0.45} color="#5c4a35" />
        <mesh position={[0, h * 0.78, 0]} castShadow>
          <icosahedronGeometry args={[Math.min(w, d) * 0.5, 1]} />
          <meshStandardMaterial color={color} roughness={0.9} flatShading />
        </mesh>
      </group>
    ),
  },
  /* ------------------------------- outdoor ------------------------------- */
  {
    kind: 'bbq',
    name: 'Barbecue',
    group: 'Outdoor',
    w: 1.2,
    d: 0.65,
    h: 1.1,
    color: '#3f4550',
    glyph: [
      ...outline(0.05),
      { type: 'rect', x: 0.1, y: 0.15, w: 0.55, h: 0.7 },
      ...Array.from({ length: 4 }, (_, i) => ({ type: 'line' as const, points: [0.12 + i * 0.14, 0.18, 0.12 + i * 0.14, 0.82] })),
    ],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h * 0.35, 0]} s={[w, h * 0.7, d]} color={color} metal={0.4} rough={0.45} />
        <B p={[0, h * 0.72, 0]} s={[w, 0.05, d]} color="#20242c" rough={0.35} />
        {/* grill bars */}
        {Array.from({ length: 7 }, (_, i) => (
          <B key={i} p={[-w * 0.3 + i * (w * 0.1), h * 0.75, 0]} s={[0.02, 0.02, d * 0.7]} color="#8d95a5" metal={0.9} rough={0.3} />
        ))}
        {/* hood, tipped back */}
        <B p={[0, h * 0.95, -d * 0.32]} s={[w, h * 0.42, 0.06]} color="#4a515e" metal={0.5} rough={0.4} />
        <Cyl p={[0, h * 0.4, d / 2 + 0.06]} r={0.05} h={w * 0.7} color="#9aa3b2" rot={[0, 0, Math.PI / 2]} metal={0.8} />
      </group>
    ),
  },
  {
    kind: 'lounger',
    name: 'Sun lounger',
    group: 'Outdoor',
    w: 0.7,
    d: 1.95,
    h: 0.6,
    color: '#7f8b9c',
    glyph: [
      { type: 'rect', x: 0.08, y: 0.02, w: 0.84, h: 0.34, radius: 0.3 },
      { type: 'rect', x: 0.08, y: 0.38, w: 0.84, h: 0.6, radius: 0.1 },
    ],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h * 0.42, d * 0.08]} s={[w, 0.1, d * 0.82]} color={color} />
        <B p={[0, h * 0.62, -d * 0.36]} s={[w, 0.08, d * 0.34]} color={color} rot={[-0.6, 0, 0]} />
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <B key={`${sx}${sz}`} p={[(sx * w) / 2.6, h * 0.19, (sz * d) / 2.8]} s={[0.05, h * 0.38, 0.05]} color="#cfd4de" metal={0.6} />
          )),
        )}
      </group>
    ),
  },
  {
    kind: 'pergola',
    name: 'Pergola',
    group: 'Outdoor',
    w: 3.2,
    d: 3.2,
    h: 2.4,
    color: '#8b6a45',
    glyph: [
      ...outline(0.02),
      ...Array.from({ length: 7 }, (_, i) => ({ type: 'line' as const, points: [0.02, 0.1 + i * 0.13, 0.98, 0.1 + i * 0.13] })),
    ],
    build: ({ w, d, h, color }) => (
      <group>
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz], i) => (
          <B key={i} p={[(sx * (w / 2 - 0.06)) as number, h / 2, (sz * (d / 2 - 0.06)) as number]} s={[0.12, h, 0.12]} color={color} />
        ))}
        <B p={[0, h - 0.06, -d / 2 + 0.06]} s={[w, 0.12, 0.12]} color={color} />
        <B p={[0, h - 0.06, d / 2 - 0.06]} s={[w, 0.12, 0.12]} color={color} />
        {Array.from({ length: 9 }, (_, i) => (
          <B key={i} p={[0, h + 0.02, -d / 2 + (d / 8) * i]} s={[w, 0.08, 0.06]} color="#9a7f5f" />
        ))}
      </group>
    ),
  },
  /* -------------------------------- site --------------------------------- */
  {
    kind: 'pool',
    name: 'Swimming pool',
    group: 'Site',
    w: 4.0,
    d: 8.0,
    h: 1.4,
    color: '#2f7fa8',
    glyph: [...outline(0.02), ...outline(0.09)],
    build: ({ w, d, h, color }) => (
      <group>
        {/* coping around the edge */}
        {[
          [0, -d / 2 + 0.15, w + 0.6, 0.3],
          [0, d / 2 - 0.15, w + 0.6, 0.3],
        ].map(([x, z, sw, sd], i) => (
          <B key={i} p={[x, 0.03, z + (z < 0 ? -0.15 : 0.15)]} s={[sw, 0.06, sd]} color="#d9dde4" />
        ))}
        {[-1, 1].map((sx) => (
          <B key={sx} p={[(sx * (w + 0.3)) / 2, 0.03, 0]} s={[0.3, 0.06, d]} color="#d9dde4" />
        ))}
        {/* basin, sunk into the ground */}
        <B p={[0, -h / 2, 0]} s={[w, h, d]} color="#7fb6cf" rough={0.3} />
        <B p={[0, -0.12, 0]} s={[w - 0.06, 0.2, d - 0.06]} color={color} rough={0.08} metal={0.15} opacity={0.85} />
        {/* ladder */}
        {[-1, 1].map((sx) => (
          <Cyl key={sx} p={[sx * 0.18, 0.18, d / 2 - 0.45]} r={0.025} h={0.6} color="#cfd4de" metal={0.8} rough={0.2} />
        ))}
      </group>
    ),
  },
  {
    kind: 'hot-tub',
    name: 'Hot tub',
    group: 'Site',
    w: 2.0,
    d: 2.0,
    h: 0.9,
    color: '#2f7fa8',
    glyph: [{ type: 'circle', x: 0.5, y: 0.5, r: 0.48 }, { type: 'circle', x: 0.5, y: 0.5, r: 0.4 }],
    build: ({ w, d, h, color }) => (
      <group>
        <Cyl p={[0, h / 2, 0]} r={Math.min(w, d) / 2} h={h} color="#8a7f72" seg={28} />
        <Cyl p={[0, h - 0.08, 0]} r={Math.min(w, d) / 2 - 0.18} h={0.14} color={color} seg={28} />
      </group>
    ),
  },
  {
    kind: 'car',
    name: 'Car',
    group: 'Site',
    w: 1.85,
    d: 4.5,
    h: 1.5,
    color: '#4a5568',
    glyph: [
      { type: 'rect', x: 0.06, y: 0.02, w: 0.88, h: 0.96, radius: 0.2 },
      { type: 'rect', x: 0.16, y: 0.26, w: 0.68, h: 0.34, radius: 0.15 },
    ],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h * 0.33, 0]} s={[w, h * 0.42, d]} color={color} rough={0.35} metal={0.3} />
        <B p={[0, h * 0.68, -d * 0.05]} s={[w * 0.86, h * 0.34, d * 0.46]} color="#20242c" rough={0.15} metal={0.2} />
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz], i) => (
          <Cyl
            key={i}
            p={[(sx * w) / 2.15, h * 0.16, (sz * d) / 3.1]}
            r={h * 0.16}
            h={0.2}
            color="#15181f"
            rot={[0, 0, Math.PI / 2]}
          />
        ))}
      </group>
    ),
  },
  {
    kind: 'tree',
    name: 'Tree',
    group: 'Site',
    w: 3.0,
    d: 3.0,
    h: 4.5,
    color: '#4f7d4a',
    glyph: [{ type: 'circle', x: 0.5, y: 0.5, r: 0.46 }, { type: 'circle', x: 0.5, y: 0.5, r: 0.1 }],
    build: ({ w, d, h, color }) => (
      <group>
        <Cyl p={[0, h * 0.28, 0]} r={Math.min(w, d) * 0.06} h={h * 0.56} color="#6b4f36" seg={10} />
        <mesh position={[0, h * 0.72, 0]} castShadow>
          <icosahedronGeometry args={[Math.min(w, d) * 0.45, 1]} />
          <meshStandardMaterial color={color} roughness={0.95} flatShading />
        </mesh>
        <mesh position={[Math.min(w, d) * 0.14, h * 0.55, 0]} castShadow>
          <icosahedronGeometry args={[Math.min(w, d) * 0.28, 1]} />
          <meshStandardMaterial color="#456f42" roughness={0.95} flatShading />
        </mesh>
      </group>
    ),
  },
  {
    kind: 'hedge-block',
    name: 'Hedge block',
    group: 'Site',
    w: 2.0,
    d: 0.7,
    h: 1.2,
    color: '#3f6b3c',
    glyph: [...outline(0.04)],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h / 2, 0]} s={[w, h, d]} color={color} rough={1} />
        <B p={[0, h + 0.02, 0]} s={[w * 0.96, 0.06, d * 0.96]} color="#4c7d48" rough={1} />
      </group>
    ),
  },
  {
    kind: 'planter',
    name: 'Planter',
    group: 'Site',
    w: 1.2,
    d: 0.45,
    h: 0.5,
    color: '#8a7f72',
    glyph: [...outline(0.06), ...outline(0.16)],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h / 2, 0]} s={[w, h, d]} color={color} />
        <B p={[0, h + 0.08, 0]} s={[w * 0.86, 0.2, d * 0.7]} color="#4c7d48" rough={1} />
      </group>
    ),
  },
  {
    kind: 'bench',
    name: 'Garden bench',
    group: 'Site',
    w: 1.6,
    d: 0.6,
    h: 0.85,
    color: '#8b6a45',
    glyph: [...outline(0.08), { type: 'line', points: [0.08, 0.3, 0.92, 0.3] }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h * 0.5, 0]} s={[w, 0.06, d]} color={color} />
        <B p={[0, h * 0.78, -d / 2 + 0.05]} s={[w, h * 0.45, 0.06]} color={color} />
        {[-1, 1].map((sx) => (
          <B key={sx} p={[(sx * (w - 0.16)) / 2, h * 0.25, 0]} s={[0.08, h * 0.5, d * 0.9]} color="#3f4550" />
        ))}
      </group>
    ),
  },
  {
    kind: 'shed',
    name: 'Garden shed',
    group: 'Site',
    w: 2.4,
    d: 1.8,
    h: 2.2,
    color: '#8a7f72',
    glyph: [...outline(0.03), { type: 'line', points: [0.5, 0.03, 0.5, 0.97] }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h * 0.42, 0]} s={[w, h * 0.84, d]} color={color} />
        <B p={[0, h * 0.9, -d * 0.24]} s={[w + 0.12, 0.08, d * 0.62]} color="#5c6472" rot={[0.32, 0, 0]} />
        <B p={[0, h * 0.9, d * 0.24]} s={[w + 0.12, 0.08, d * 0.62]} color="#5c6472" rot={[-0.32, 0, 0]} />
        <B p={[0, h * 0.36, d / 2 + 0.01]} s={[w * 0.4, h * 0.66, 0.03]} color="#6b7383" />
      </group>
    ),
  },
  {
    kind: 'paving',
    name: 'Paving / driveway',
    group: 'Site',
    w: 3.0,
    d: 6.0,
    h: 0.04,
    color: '#7d838f',
    glyph: [...outline(0.02), { type: 'line', points: [0.5, 0.02, 0.5, 0.98] }],
    build: ({ w, d, h, color }) => (
      <group>
        <B p={[0, h / 2, 0]} s={[w, h, d]} color={color} rough={1} />
      </group>
    ),
  },
  {
    kind: 'box',
    name: 'Blank box',
    group: 'Other',
    w: 0.8,
    d: 0.8,
    h: 0.8,
    color: '#7d879b',
    glyph: outline(0.05),
    build: ({ w, d, h, color }) => <B p={[0, h / 2, 0]} s={[w, h, d]} color={color} />,
  },
]

export const CATALOG_BY_KIND = new Map(CATALOG.map((c) => [c.kind, c]))

export const CATALOG_GROUPS = [...new Set(CATALOG.map((c) => c.group))]

export function catalogItem(kind: string): CatalogItem {
  return CATALOG_BY_KIND.get(kind) ?? CATALOG_BY_KIND.get('box')!
}
