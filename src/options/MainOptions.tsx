import { cn } from '@/lib/utils'
import { useState } from 'react'
import Portfolio from './Portfolio'
import Settings from './Settings'

type Tab = 'portfolio' | 'settings'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'portfolio', label: 'Portfolio', icon: '📊' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export const MainOptions = () => {
  const [activeTab, setActiveTab] = useState<Tab>('portfolio')

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-40 flex-col border-r border-border bg-sidebar">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <img src="/img/logo-32.png" alt="Arbflow" className="h-6 w-6" />
          <span className="text-lg font-semibold">Arbflow</span>
        </div>

        <nav className="flex-1 p-3">
          <ul className="space-y-1">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    activeTab === tab.id
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                  )}
                >
                  <span className="text-base">{tab.icon}</span>
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          v{chrome.runtime.getManifest().version}
        </div>
      </aside>

      <main className="flex-1 bg-background">
        {activeTab === 'portfolio' && <Portfolio />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  )
}

export default MainOptions
