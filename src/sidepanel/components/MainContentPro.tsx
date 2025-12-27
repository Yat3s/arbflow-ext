import { useCallback, useRef, useState } from 'react'
import { fetchLighterAccountIndex } from '../../lib/lighter-api'
import { SYMBOL_MARKET_ID_MAP } from '../../lib/symbols'
import type { LighterConfig } from '../../lib/types'
import { useExchanges, useTrade } from '../hooks'
import { ExchangeCard } from './ExchangeCard'
import { StatusToast } from './StatusToast'
import { SymbolCard } from './SymbolCard'

interface MainContentProProps {
  watchedSymbols: string[]
  saveWatchedSymbols: (symbols: string[]) => void
  lighterConfig: LighterConfig
  saveLighterConfig: (config: Partial<LighterConfig>) => void
  globalTradeInterval: number
  saveGlobalTradeInterval: (interval: number) => void
  consecutiveTriggerCount: number
  saveConsecutiveTriggerCount: (count: number) => void
  autoRebalanceEnabled: boolean
  saveAutoRebalanceEnabled: (enabled: boolean) => void
  soundEnabled: boolean
  saveSoundEnabled: (enabled: boolean) => void
}

export function MainContentPro({
  watchedSymbols,
  saveWatchedSymbols,
  lighterConfig,
  saveLighterConfig,
  globalTradeInterval,
  saveGlobalTradeInterval,
  consecutiveTriggerCount,
  saveConsecutiveTriggerCount,
  autoRebalanceEnabled,
  saveAutoRebalanceEnabled,
  soundEnabled,
  saveSoundEnabled,
}: MainContentProProps) {
  const globalLastTradeTimeRef = useRef<number>(0)
  const globalLastRefreshTimeRef = useRef<number>(0)

  const { exchanges, symbolStates, openExchange, focusTab, refreshTab, refreshAllExchanges } =
    useExchanges(watchedSymbols, lighterConfig)

  const { doTrades } = useTrade({
    exchanges,
    symbolStates,
    lighterConfig,
    saveLighterConfig,
  })

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

  const handleDoTrades = async (
    trades: { symbol: string; direction: 'long' | 'short'; size: number; platform: string }[],
  ) => {
    try {
      const desc =
        trades.length === 1
          ? `${trades[0].platform} ${trades[0].direction}`
          : trades.map((t) => `${t.direction === 'long' ? '+' : '-'}${t.platform}`).join('')
      showStatus(`Executing ${desc}...`, true)
      await doTrades(trades)
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
    <>
      <div className="flex items-center justify-between gap-4 px-4 pb-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">全局交易间隔:</span>
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
            <span className="text-xs text-muted-foreground">ms</span>
            <span className="ml-4 text-xs text-muted-foreground">连续触发次数阈值:</span>
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
              <span className="text-xs text-muted-foreground">提示音</span>
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
              <span className="text-xs text-muted-foreground">自动补齐</span>
              <button
                onClick={() => saveAutoRebalanceEnabled(!autoRebalanceEnabled)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  autoRebalanceEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    autoRebalanceEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="cursor-pointer rounded px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            {isRefreshing ? '↻...' : '↻'}
          </button>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="cursor-pointer rounded px-3 py-1.5 text-sm hover:bg-muted"
          >
            ⚙
          </button>
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
                <SymbolCard
                  key={symbol}
                  symbol={symbol}
                  symbolState={symbolStates.find((s) => s.symbol === symbol)}
                  exchanges={exchanges}
                  onDoTrades={handleDoTrades}
                  globalTradeInterval={globalTradeInterval}
                  globalLastTradeTimeRef={globalLastTradeTimeRef}
                  globalLastRefreshTimeRef={globalLastRefreshTimeRef}
                  consecutiveTriggerCount={consecutiveTriggerCount}
                  onRefreshAllExchanges={refreshAllExchanges}
                  autoRebalanceEnabled={autoRebalanceEnabled}
                  soundEnabled={soundEnabled}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Exchanges</h2>
          <span className="text-xs text-muted-foreground">
            {(() => {
              const lg = exchanges.find((e) => e.id === 'LG')?.accountInfo
              const om = exchanges.find((e) => e.id === 'OM')?.accountInfo
              const lgVal = lg?.portfolioValue
              const omVal = om?.portfolioValue

              if (lgVal == null && omVal == null) return null

              const parts: string[] = []
              if (lgVal != null) {
                parts.push(`LG(${lgVal.toFixed(1)})`)
              }
              if (omVal != null) {
                parts.push(`OM(${omVal.toFixed(1)})`)
              }

              const total = (lgVal ?? 0) + (omVal ?? 0)
              return (
                <>
                  {parts.join(' + ')} = <span className="font-semibold">{total.toFixed(1)}</span>
                </>
              )
            })()}
          </span>
          <div className="mt-2 space-y-2">
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

      <StatusToast message={status?.message || null} isSuccess={status?.isSuccess ?? true} />
    </>
  )
}
