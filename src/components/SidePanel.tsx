import { useState } from 'react'
import { PropertiesPanel } from './panels/PropertiesPanel'
import { OutlinePanel } from './panels/OutlinePanel'
import { CatalogPanel } from './panels/CatalogPanel'
import { SettingsPanel } from './panels/SettingsPanel'

const TABS = [
  { id: 'props', label: 'Properties' },
  { id: 'outline', label: 'Outline' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'settings', label: 'Settings' },
] as const

type TabId = (typeof TABS)[number]['id']

export function SidePanel() {
  const [tab, setTab] = useState<TabId>('props')

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-ink-700 bg-ink-850 lg:w-80">
      <div className="flex shrink-0 border-b border-ink-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 border-b-2 px-1 py-2.5 text-[11px] font-medium transition-colors ${
              tab === t.id
                ? 'border-accent text-mist-200'
                : 'border-transparent text-mist-400 hover:bg-ink-800 hover:text-mist-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'props' ? <PropertiesPanel /> : null}
        {tab === 'outline' ? <OutlinePanel /> : null}
        {tab === 'catalog' ? <CatalogPanel /> : null}
        {tab === 'settings' ? <SettingsPanel /> : null}
      </div>
    </aside>
  )
}
