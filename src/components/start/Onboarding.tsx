import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Ruler } from 'lucide-react'
import { useLibrary } from '../../store/useLibrary'
import { DEFAULT_OPTIONS, TEMPLATES, templateById, type HomeOptions } from '../../lib/templates'
import { NumberField, Row, TextField, Toggle } from '../ui/fields'

const COUNTS = [0, 1, 2, 3, 4]

export function Onboarding() {
  const create = useLibrary((s) => s.create)
  const setScreen = useLibrary((s) => s.setScreen)
  const entries = useLibrary((s) => s.entries)

  const [step, setStep] = useState(0)
  const [templateId, setTemplateId] = useState('two-bed')
  const [o, setO] = useState<HomeOptions>({ ...DEFAULT_OPTIONS })
  const template = templateById(templateId)
  const generated = templateId !== 'sample' && templateId !== 'empty'

  const patch = (p: Partial<HomeOptions>) => setO((prev) => ({ ...prev, ...p }))

  const build = () => {
    const project = template.build(o)
    create({ ...project, name: o.name || project.name })
  }

  return (
    <div className="h-full overflow-y-auto bg-ink-900">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Ruler size={19} />
          </span>
          <div>
            <div className="font-semibold text-mist-200">Let's set up your plan</div>
            <div className="text-[11px] text-mist-400">
              Step {step + 1} of 2 · everything here can be changed afterwards
            </div>
          </div>
          <span className="flex-1" />
          {entries.length ? (
            <button className="btn" onClick={() => setScreen('editor')}>
              Cancel
            </button>
          ) : (
            <button className="btn" onClick={() => setScreen('landing')}>
              Back to the intro
            </button>
          )}
        </div>

        {step === 0 ? (
          <>
            <h2 className="mb-1 text-xl font-semibold text-mist-200">What are you drawing?</h2>
            <p className="mb-5 text-[13px] text-mist-400">
              Pick a starting point. It generates real rooms, walls, doors and furniture that you then edit.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    templateId === t.id
                      ? 'border-accent bg-accent-soft/25'
                      : 'border-ink-700 bg-ink-850 hover:border-ink-500 hover:bg-ink-800'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-mist-200">{t.name}</span>
                    {templateId === t.id ? <Check size={15} className="text-accent" /> : null}
                  </div>
                  <p className="text-[12px] leading-relaxed text-mist-400">{t.blurb}</p>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition-colors hover:bg-accent/85"
                onClick={() => setStep(1)}
              >
                Next <ArrowRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-1 text-xl font-semibold text-mist-200">A few measurements</h2>
            <p className="mb-5 text-[13px] text-mist-400">
              These set the rooms up so the plan already matches your place roughly.
            </p>

            <div className="space-y-5 rounded-xl border border-ink-700 bg-ink-850 p-5">
              <TextField label="Name of this plan" value={o.name} onChange={(name) => patch({ name })} />

              {generated ? (
                <>
                  <div>
                    <span className="field-label">Bedrooms</span>
                    <div className="flex gap-1.5">
                      {COUNTS.map((n) => (
                        <button
                          key={n}
                          onClick={() => patch({ bedrooms: n })}
                          className={`flex-1 rounded-md border py-1.5 transition-colors ${
                            o.bedrooms === n
                              ? 'border-accent bg-accent-soft/40 text-mist-200'
                              : 'border-ink-600 bg-ink-800 text-mist-400 hover:text-mist-200'
                          }`}
                        >
                          {n === 0 ? 'Studio' : n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="field-label">Bathrooms</span>
                    <div className="flex gap-1.5">
                      {[1, 2].map((n) => (
                        <button
                          key={n}
                          onClick={() => patch({ bathrooms: n })}
                          className={`flex-1 rounded-md border py-1.5 transition-colors ${
                            o.bathrooms === n
                              ? 'border-accent bg-accent-soft/40 text-mist-200'
                              : 'border-ink-600 bg-ink-800 text-mist-400 hover:text-mist-200'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              <Row>
                <NumberField
                  label="Ceiling height"
                  value={o.ceiling}
                  step={0.05}
                  min={1.9}
                  max={6}
                  onChange={(ceiling) => patch({ ceiling })}
                />
                <NumberField
                  label="Wall thickness"
                  value={o.wallThickness}
                  step={0.01}
                  min={0.05}
                  max={0.6}
                  onChange={(wallThickness) => patch({ wallThickness })}
                />
              </Row>

              <div>
                <NumberField
                  label="Your height"
                  value={o.personHeight}
                  step={0.01}
                  min={1.0}
                  max={2.3}
                  onChange={(personHeight) => patch({ personHeight })}
                />
                <p className="mt-1 text-[11px] text-mist-400">
                  Used for the walkthrough camera — you will see the place from{' '}
                  {(o.personHeight - 0.1).toFixed(2)} m, about eye level.
                </p>
              </div>

              {generated ? (
                <div className="space-y-1 border-t border-ink-700 pt-3">
                  <Toggle
                    label="Separate kitchen"
                    checked={o.separateKitchen}
                    onChange={() => patch({ separateKitchen: !o.separateKitchen })}
                  />
                  <Toggle label="Balcony / terrace" checked={o.terrace} onChange={() => patch({ terrace: !o.terrace })} />
                  <Toggle
                    label="Roof terrace with stairs"
                    checked={o.roofTerrace}
                    onChange={() => patch({ roofTerrace: !o.roofTerrace })}
                  />
                  <Toggle
                    label="Plot of land (garden, fence, driveway)"
                    checked={o.plot}
                    onChange={() => patch({ plot: !o.plot, pool: o.plot ? false : o.pool })}
                  />
                  {o.plot ? (
                    <Toggle label="Swimming pool" checked={o.pool} onChange={() => patch({ pool: !o.pool })} />
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button className="btn flex items-center gap-1.5 px-3 py-2" onClick={() => setStep(0)}>
                <ArrowLeft size={15} /> Back
              </button>
              <button
                className="rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition-colors hover:bg-accent/85"
                onClick={build}
              >
                Create my plan
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
