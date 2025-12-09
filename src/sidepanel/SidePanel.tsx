import { useState, useCallback } from 'react'
import { useSettings, useExchanges, useTrade } from './hooks'
import { ExchangeCard, PositionGroup, SettingsDialog, StatusToast } from './components'
import { fetchLighterAccountIndex } from '../lib/lighter-api'

export function SidePanel() {
  const { watchedSymbols, saveWatchedSymbols, lighterConfig, saveLighterConfig } = useSettings()

  const { exchanges, symbolStates, openExchange, focusTab, refreshTab, refreshAllExchanges } =
    useExchanges(watchedSymbols)

  const { executeArbitrage } = useTrade({
    exchanges,
    symbolStates,
    lighterConfig,
    saveLighterConfig,
  })

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [status, setStatus] = useState<{ message: string; isSuccess: boolean } | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const showStatus = useCallback((message: string, isSuccess: boolean) => {
    setStatus({ message, isSuccess })
  }, [])

  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    showStatus('Refreshing exchanges...', true)
    try {
      await refreshAllExchanges()
      showStatus('✓ Exchanges refreshed', true)
    } catch (e) {
      showStatus(`Refresh failed: ${(e as Error).message}`, false)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleExecuteArbitrage = async (symbol: string, direction: '1to2' | '2to1', size: number) => {
    try {
      showStatus(`Executing arbitrage...`, true)
      await executeArbitrage(symbol, direction, size)
      showStatus(`✓ Arbitrage completed`, true)
    } catch (e) {
      showStatus(`Arbitrage failed: ${(e as Error).message}`, false)
    }
  }

  const handleSaveLighterConfig = async (
    config: Partial<typeof lighterConfig>
  ): Promise<{ success: boolean; accountIndex?: number; error?: string }> => {
    try {
      const accountIndex = await fetchLighterAccountIndex(
        config.l1Address || lighterConfig.l1Address,
        config.accountType || lighterConfig.accountType
      )
      saveLighterConfig({ ...config, accountIndex })
      return { success: true, accountIndex }
    } catch (e) {
      saveLighterConfig(config)
      return { success: false, error: (e as Error).message }
    }
  }

  const sortedSymbols = [...watchedSymbols].sort((a, b) => a.localeCompare(b))

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Arbflow</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            {isRefreshing ? '↻...' : '↻ Refresh All'}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
          >
            ⚙ Settings
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Exchanges</h2>
          <div className="space-y-2">
            {exchanges.map((exchange) => (
              <ExchangeCard
                key={exchange.id}
                exchange={exchange}
                symbolStates={symbolStates}
                onOpen={() => openExchange(exchange.id)}
                onFocus={() => exchange.tabId && focusTab(exchange.tabId)}
                onRefresh={() => exchange.tabId && refreshTab(exchange.tabId)}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Positions & Market Data ({sortedSymbols.length})
          </h2>
          {sortedSymbols.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              No symbols selected. Click Settings to add symbols.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedSymbols.map((symbol) => (
                <PositionGroup
                  key={symbol}
                  symbol={symbol}
                  symbolState={symbolStates.find((s) => s.symbol === symbol)}
                  exchanges={exchanges}
                  onExecuteArbitrage={handleExecuteArbitrage}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        watchedSymbols={watchedSymbols}
        onSaveSymbols={saveWatchedSymbols}
        lighterConfig={lighterConfig}
        onSaveLighterConfig={handleSaveLighterConfig}
      />

      <StatusToast message={status?.message || null} isSuccess={status?.isSuccess ?? true} />
    </div>
  )
}

export default SidePanel
