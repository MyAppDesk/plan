import { Columns3 } from 'lucide-react'
import { CATALOG, CATALOG_GROUPS } from '../../lib/catalog'
import { useProject } from '../../store/useProject'
import { Section } from '../ui/fields'

/** Miniature top-down preview drawn from the same glyph the plan uses. */
function Thumb({ kind }: { kind: string }) {
  const def = CATALOG.find((c) => c.kind === kind)!
  const size = 44
  const scale = Math.min(size / def.w, size / def.d) * 0.78
  const w = def.w * scale
  const h = def.d * scale
  const x0 = (size - w) / 2
  const y0 = (size - h) / 2
  const gx = (v: number) => x0 + v * w
  const gy = (v: number) => y0 + v * h
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <rect x={x0} y={y0} width={w} height={h} fill="rgba(125,135,155,0.18)" stroke="#8b95a8" strokeWidth="1" rx="1.5" />
      {def.glyph.map((g, i) => {
        if (g.type === 'rect')
          return (
            <rect
              key={i}
              x={gx(g.x)}
              y={gy(g.y)}
              width={g.w * w}
              height={g.h * h}
              fill="none"
              stroke="#8b95a8"
              strokeWidth="0.8"
              rx={(g.radius ?? 0) * Math.min(w, h) * 0.5}
            />
          )
        if (g.type === 'circle')
          return <circle key={i} cx={gx(g.x)} cy={gy(g.y)} r={g.r * Math.min(w, h)} fill="none" stroke="#8b95a8" strokeWidth="0.8" />
        return (
          <polyline
            key={i}
            points={g.points.map((v, idx) => (idx % 2 === 0 ? gx(v) : gy(v))).join(' ')}
            fill="none"
            stroke="#8b95a8"
            strokeWidth="0.8"
          />
        )
      })}
    </svg>
  )
}

export function CatalogPanel() {
  const catalogKind = useProject((s) => s.catalogKind)
  const setCatalogKind = useProject((s) => s.setCatalogKind)
  const setTool = useProject((s) => s.setTool)
  const tool = useProject((s) => s.tool)

  return (
    <>
      <div className="border-b border-ink-700 px-3 py-2.5 text-[11px] leading-relaxed text-mist-400">
        Pick an item, then click on the plan to place it. Every piece is generated from its dimensions, so any size you
        type stays correct in 2D and in 3D.
      </div>
      <div className="border-b border-ink-700 px-3 py-2.5">
        <button
          className={`btn w-full ${tool === 'column' ? 'border-accent text-accent' : ''}`}
          onClick={() => setTool('column')}
        >
          <Columns3 size={14} /> Column or pier (K)
        </button>
        <p className="mt-1.5 text-[11px] leading-relaxed text-mist-400">
          Columns are their own thing rather than furniture: square or round, with a base height so they can also hang
          from the ceiling.
        </p>
      </div>
      {CATALOG_GROUPS.map((group) => (
        <Section key={group} title={group}>
          <div className="grid grid-cols-2 gap-1.5">
            {CATALOG.filter((c) => c.group === group).map((c) => (
              <button
                key={c.kind}
                onClick={() => setCatalogKind(c.kind)}
                className={`flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 transition-colors ${
                  catalogKind === c.kind
                    ? 'border-accent bg-accent-soft/30 text-mist-200'
                    : 'border-ink-700 bg-ink-850 text-mist-300 hover:border-ink-500 hover:bg-ink-800'
                }`}
                title={`${c.name} — ${c.w}×${c.d}×${c.h} m`}
              >
                <Thumb kind={c.kind} />
                <span className="w-full truncate text-center text-[11px]">{c.name}</span>
                <span className="text-[10px] text-mist-400">
                  {c.w}×{c.d} m
                </span>
              </button>
            ))}
          </div>
        </Section>
      ))}
    </>
  )
}
