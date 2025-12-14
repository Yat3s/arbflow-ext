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

  const {
    exchanges,
    symbolStates,
    lighterWsPositions,
    lighterWsRaw,
    openExchange,
    focusTab,
    refreshTab,
    refreshAllExchanges,
    connectLighterPositionWs,
    disconnectLighterPositionWs,
  } = useExchanges(watchedSymbols, lighterConfig)

  const { executeArbitrage, executeApiTrade } = useTrade({
    exchanges,
    symbolStates,
    lighterConfig,
    saveLighterConfig,
  })

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [status, setStatus] = useState<{ message: string; isSuccess: boolean } | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showWsDebug, setShowWsDebug] = useState(false)

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

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Lighter Position WS Debug</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={connectLighterPositionWs}
                className="cursor-pointer rounded bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20"
              >
                Connect
              </button>
              <button
                onClick={disconnectLighterPositionWs}
                className="cursor-pointer rounded bg-destructive/10 px-3 py-1 text-xs text-destructive hover:bg-destructive/20"
              >
                Disconnect
              </button>
              <button
                onClick={() => setShowWsDebug(!showWsDebug)}
                className="cursor-pointer rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                {showWsDebug ? '▼ Hide' : '▶ Show'}
              </button>
            </div>
          </div>
          {showWsDebug && (
            <div className="space-y-3">
              <div className="rounded-lg border p-3">
                <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                  Positions ({lighterWsPositions.length})
                </h3>
                {lighterWsPositions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No positions received</p>
                ) : (
                  <div className="space-y-2">
                    {lighterWsPositions.map((pos) => (
                      <div key={pos.market_id} className="rounded bg-muted/50 p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{pos.symbol}</span>
                          <span className={pos.sign > 0 ? 'text-green-500' : 'text-red-500'}>
                            {pos.sign > 0 ? 'Long' : 'Short'} {pos.position}
                          </span>
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-x-4 text-muted-foreground">
                          <span>Entry: ${pos.avg_entry_price}</span>
                          <span>Value: ${pos.position_value}</span>
                          <span>uPnL: ${pos.unrealized_pnl}</span>
                          <span>Liq: ${pos.liquidation_price}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-lg border p-3">
                <h3 className="mb-2 text-xs font-medium text-muted-foreground">Raw Message</h3>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">
                  {lighterWsRaw || 'No messages received'}
                </pre>
              </div>
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

      {isTooNarrow && <WidthOverlay />}
    </div>
  )
}

export default SidePanel
