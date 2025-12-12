import { useCallback, useEffect, useState } from 'react'
import { fetchLighterAccountIndex } from '../lib/lighter-api'
import { SYMBOL_MARKET_ID_MAP } from '../lib/symbols'
import { ExchangeCard, PositionGroup, SettingsDialog, StatusToast } from './components'
import { useExchanges, useSettings, useTrade } from './hooks'

const MIN_WIDTH = 500

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth)

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return width
}

function WidthOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-4 text-muted-foreground">
        <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-muted">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </div>
        <span className="text-lg font-medium">向左拖动扩展视图</span>
      </div>
    </div>
  )
}

export function SidePanel() {
  const windowWidth = useWindowWidth()
  const isTooNarrow = windowWidth < MIN_WIDTH
  const { watchedSymbols, saveWatchedSymbols, lighterConfig, saveLighterConfig } = useSettings()

  const { exchanges, symbolStates, openExchange, focusTab, refreshTab, refreshAllExchanges } =
    useExchanges(watchedSymbols)

  const { executeArbitrage, executeApiTrade } = useTrade({
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

  const handleExecuteArbitrage = async (
    symbol: string,
    direction: '1to2' | '2to1',
    size: number,
  ) => {
    try {
      showStatus(`Executing arbitrage...`, true)
      await executeArbitrage(symbol, direction, size)
      showStatus(`✓ Arbitrage completed`, true)
    } catch (e) {
      showStatus(`Arbitrage failed: ${(e as Error).message}`, false)
      throw e
    }
  }

  const handleExecuteSingleTrade = async (
    exchangeId: string,
    symbol: string,
    direction: 'long' | 'short',
    size: number,
  ) => {
    try {
      showStatus(`Executing single trade...`, true)
      await executeApiTrade(exchangeId, symbol, direction, size)
      showStatus(`✓ Trade completed`, true)
    } catch (e) {
      showStatus(`Trade failed: ${(e as Error).message}`, false)
      throw e
    }
  }

  const handleSaveLighterConfig = async (
    config: Partial<typeof lighterConfig>,
  ): Promise<{ success: boolean; accountIndex?: number; error?: string }> => {
    try {
      const accountIndex = await fetchLighterAccountIndex(
        config.l1Address || lighterConfig.l1Address,
        config.accountType || lighterConfig.accountType,
      )
      saveLighterConfig({ ...config, accountIndex })
      return { success: true, accountIndex }
    } catch (e) {
      saveLighterConfig(config)
      return { success: false, error: (e as Error).message }
    }
  }

  const sortedSymbols = [...watchedSymbols].sort(
    (a, b) => (SYMBOL_MARKET_ID_MAP[a] ?? 999) - (SYMBOL_MARKET_ID_MAP[b] ?? 999),
  )

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-semibold">Arbflow</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="cursor-pointer rounded  px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            {isRefreshing ? '↻...' : '↻ Refresh All'}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="cursor-pointer rounded  px-3 py-1.5 text-sm hover:bg-muted"
          >
            ⚙ Settings
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <section>
          {sortedSymbols.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              No symbols selected. Click Settings to add symbols.
            </div>
          ) : (
            <div className="space-y-4">
              {sortedSymbols.map((symbol) => (
                <PositionGroup
                  key={symbol}
                  symbol={symbol}
                  symbolState={symbolStates.find((s) => s.symbol === symbol)}
                  exchanges={exchanges}
                  onExecuteArbitrage={handleExecuteArbitrage}
                  onExecuteSingleTrade={handleExecuteSingleTrade}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-6">
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

      {isTooNarrow && <WidthOverlay />}
    </div>
  )
}

export default SidePanel
