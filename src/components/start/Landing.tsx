import {
  Box,
  DoorOpen,
  Footprints,
  HardDriveDownload,
  Layers,
  Ruler,
  ShieldCheck,
  Sofa,
  SquareDashed,
} from 'lucide-react'
import { useLibrary } from '../../store/useLibrary'
import { starterProject } from '../../lib/templates'

const FEATURES = [
  { icon: SquareDashed, title: 'Draw rooms to scale', text: 'Rectangles or free polygons, with snapping, alignment guides and live areas.' },
  { icon: Ruler, title: 'Real measurements', text: 'Type an exact wall length, thickness or ceiling height. Areas and volumes follow.' },
  { icon: DoorOpen, title: 'Doors and windows', text: 'Hinged or sliding doors, sill heights, and openings cut properly out of the walls.' },
  { icon: Sofa, title: 'Furniture that fits', text: 'A catalogue built from dimensions — set any size and it stays right in 2D and 3D.' },
  { icon: Layers, title: 'Floors and stairs', text: 'Several storeys, straight, quarter-turn, half-turn or spiral stairs between them.' },
  { icon: Box, title: '3D preview', text: 'Orbit the model with shadows, glazing and optional ceilings. Click anything to edit it.' },
  { icon: Footprints, title: 'Walk through it', text: 'Eye-height first person at your own height, with doors you open and stairs you climb.' },
  { icon: HardDriveDownload, title: 'Yours to keep', text: 'Export the plan as JSON or PNG at any time and import it back on another machine.' },
]

export function Landing() {
  const setScreen = useLibrary((s) => s.setScreen)
  const entries = useLibrary((s) => s.entries)
  const open = useLibrary((s) => s.open)
  const create = useLibrary((s) => s.create)

  return (
    <div className="h-full overflow-y-auto bg-ink-900">
      <div className="mx-auto max-w-4xl px-6 py-14">
        <header className="mb-12">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Ruler size={19} />
            </span>
            <span className="text-lg font-semibold text-mist-200">Measure</span>
          </div>
          <h1 className="mb-4 text-4xl leading-tight font-semibold text-mist-200 sm:text-5xl">
            Draw your place to scale,
            <br />
            then walk through it.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-mist-300">
            A floor plan editor for the rooms you actually live in: measure them, set wall thicknesses and ceiling
            heights, hang doors and windows, drop in furniture at its real size, and step inside in 3D.
          </p>

          <div className="mt-7 flex flex-wrap gap-2.5">
            <button
              className="rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition-colors hover:bg-accent/85"
              onClick={() => setScreen('onboarding')}
            >
              Start a new plan
            </button>
            <button
              className="btn px-4 py-2.5"
              onClick={() => create({ ...starterProject(), name: 'Demo flat' })}
            >
              Open the demo flat
            </button>
            {entries.length ? (
              <button className="btn px-4 py-2.5" onClick={() => open(entries[0].id)}>
                Continue “{entries[0].name}”
              </button>
            ) : null}
          </div>
        </header>

        {entries.length ? (
          <section className="mb-12">
            <h2 className="mb-3 text-[11px] font-semibold tracking-widest text-mist-400 uppercase">Your plans</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {entries.map((e) => (
                <button
                  key={e.id}
                  onClick={() => open(e.id)}
                  className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 text-left transition-colors hover:border-ink-500 hover:bg-ink-800"
                >
                  <span className="truncate font-medium text-mist-200">{e.name}</span>
                  <span className="text-[11px] text-mist-400">
                    {e.floors} floor{e.floors === 1 ? '' : 's'} · {new Date(e.updatedAt).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mb-12 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div key={f.title} className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink-800 text-accent">
                  <Icon size={16} />
                </span>
                <div>
                  <h3 className="mb-0.5 font-medium text-mist-200">{f.title}</h3>
                  <p className="text-[13px] leading-relaxed text-mist-400">{f.text}</p>
                </div>
              </div>
            )
          })}
        </section>

        <section className="rounded-xl border border-ink-700 bg-ink-850 p-5">
          <div className="mb-2 flex items-center gap-2 text-mist-200">
            <ShieldCheck size={17} className="text-accent" />
            <h2 className="font-medium">Everything stays on this device</h2>
          </div>
          <p className="text-[13px] leading-relaxed text-mist-300">
            There is no account, no server and no tracking. Your plans are written to this browser's local storage and
            never leave it — which also means clearing your browser data deletes them, so export anything you want to
            keep. The app itself is static files served from GitHub Pages.
          </p>
        </section>

        <footer className="mt-10 text-[11px] text-mist-500">
          Built with React, Konva and three.js · open the help dialog in the editor for the full shortcut list.
        </footer>
      </div>
    </div>
  )
}
