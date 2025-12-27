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

      <main className="relative flex-1 bg-background">
        <button
          onClick={() => window.close()}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
        {activeTab === 'portfolio' && <Portfolio />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  )
}

export default MainOptions
