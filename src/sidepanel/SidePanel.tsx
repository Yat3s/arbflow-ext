import { useCallback, useEffect, useRef, useState } from 'react'
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
  const {
    watchedSymbols,
    saveWatchedSymbols,
    lighterConfig,
    saveLighterConfig,
    globalTradeInterval,
    saveGlobalTradeInterval,
    consecutiveTriggerCount,
    saveConsecutiveTriggerCount,
    autoRestartOnUnbalanced,
    saveAutoRestartOnUnbalanced,
    soundEnabled,
    saveSoundEnabled,
    autoRebalanceSingleSize,
    saveAutoRebalanceSingleSize,
  } = useSettings()
  const globalLastTradeTimeRef = useRef<number>(0)
  const globalLastRefreshTimeRef = useRef<number>(0)
  const globalLastAutoRebalanceTimeRef = useRef<number>(0)

  const {
    exchanges,
    symbolStates,
    lighterWsMessages,
    openExchange,
    focusTab,
    refreshTab,
    refreshAllExchanges,
    connectLighterWs,
    disconnectLighterWs,
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

      {/* Global settings */}
      <div className="flex flex-col gap-2 px-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">全局交易间隔:</span>
          <input
            type="number"
            value={globalTradeInterval}
            onChange={(e) =>
              saveGlobalTradeInterval(Math.max(100, parseInt(e.target.value, 10) || 1000))
            }
            className="w-12 border-b border-muted-foreground/40 bg-transparent px-1 py-0.5 text-xs outline-none focus:border-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            min={100}
            step={100}
          />
          <span className="text-sm text-muted-foreground">ms</span>
          <span className="ml-4 text-sm text-muted-foreground">连续触发次数阈值:</span>
          <input
            type="number"
            value={consecutiveTriggerCount}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10)
              saveConsecutiveTriggerCount(isNaN(parsed) ? 1 : Math.max(1, parsed))
            }}
            className="w-12 border-b border-muted-foreground/40 bg-transparent px-1 py-0.5 text-xs outline-none focus:border-muted-foreground [appearance:textfield] "
            min={1}
            step={1}
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <span className="text-sm text-muted-foreground">提示音</span>
            <button
              onClick={() => saveSoundEnabled(!soundEnabled)}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                soundEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  soundEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <span className="text-sm text-muted-foreground">仓位异常自重启</span>
            <button
              onClick={() => saveAutoRestartOnUnbalanced(!autoRestartOnUnbalanced)}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                autoRestartOnUnbalanced ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  autoRestartOnUnbalanced ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <span className="text-sm text-muted-foreground">仓位自补齐(单size)</span>
            <button
              onClick={() => saveAutoRebalanceSingleSize(!autoRebalanceSingleSize)}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                autoRebalanceSingleSize ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  autoRebalanceSingleSize ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

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
                  globalTradeInterval={globalTradeInterval}
                  globalLastTradeTimeRef={globalLastTradeTimeRef}
                  globalLastRefreshTimeRef={globalLastRefreshTimeRef}
                  consecutiveTriggerCount={consecutiveTriggerCount}
                  onRefreshAllExchanges={refreshAllExchanges}
                  autoRestartOnUnbalanced={autoRestartOnUnbalanced}
                  soundEnabled={soundEnabled}
                  autoRebalanceSingleSize={autoRebalanceSingleSize}
                  globalLastAutoRebalanceTimeRef={globalLastAutoRebalanceTimeRef}
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
            <h2 className="text-sm font-medium text-muted-foreground">Lighter WS Debug</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={connectLighterWs}
                className="cursor-pointer rounded bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20"
              >
                Connect
              </button>
              <button
                onClick={disconnectLighterWs}
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
            <div className="rounded-lg border p-3">
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                Messages ({lighterWsMessages.length})
              </h3>
              {lighterWsMessages.length === 0 ? (
                <p className="text-xs text-muted-foreground">No messages received</p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-auto">
                  {lighterWsMessages.map((msg, idx) => (
                    <div key={idx} className="font-mono text-xs text-muted-foreground">
                      {msg}
                    </div>
                  ))}
                </div>
              )}
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
