import { useCallback, useEffect, useRef, useState } from 'react'
import { getAuthState, isAuthenticated, logout, refreshUserInfo, type AuthState } from '../lib/auth'
import { fetchLighterAccountIndex } from '../lib/lighter-api'
import { SYMBOL_MARKET_ID_MAP } from '../lib/symbols'
import { ExchangeCard, LoginPage, SettingsDialog, StatusToast, SymbolCard } from './components'
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
  const [authState, setAuthState] = useState<AuthState | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [accountDisabled, setAccountDisabled] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated()
      if (authenticated) {
        const state = await getAuthState()
        setAuthState(state)
        refreshUserInfo().then(async (user) => {
          if (user) {
            if (user.isActive === false) {
              await logout()
              setAuthState(null)
              setAccountDisabled(true)
            } else {
              setAuthState((prev) => (prev ? { ...prev, user } : null))
            }
          }
        })
      } else {
        setAuthState(null)
      }
      setAuthLoading(false)
    }
    checkAuth()

    const handleMessage = (message: { type: string }) => {
      if (message.type === 'AUTH_SUCCESS') {
        setAccountDisabled(false)
        checkAuth()
      }
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  const handleLogout = async () => {
    await logout()
    setAuthState(null)
  }

  const {
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
  } = useSettings()
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

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [status, setStatus] = useState<{ message: string; isSuccess: boolean } | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!authState) {
    return <LoginPage accountDisabled={accountDisabled} />
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Arbflow</h1>
          <span className="text-xs text-muted-foreground">
            {(() => {
              const lg = exchanges.find((e) => e.id === 'LG')?.accountInfo
              const om = exchanges.find((e) => e.id === 'OM')?.accountInfo
              const lgVal = lg?.portfolioValue
              const omVal = om?.portfolioValue
              const lgLev = lg?.leverage
              const omLev = om?.leverage

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
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="cursor-pointer rounded  px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            {isRefreshing ? '↻...' : '↻'}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="cursor-pointer rounded  px-3 py-1.5 text-sm hover:bg-muted"
          >
            ⚙
          </button>
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary/20 text-sm font-medium text-primary transition-colors hover:bg-primary/30"
            >
              {authState.user?.image ? (
                <img src={authState.user.image} alt="" className="h-full w-full object-cover" />
              ) : (
                authState.user?.email?.charAt(0).toUpperCase() || '?'
              )}
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-10 z-50 min-w-48 rounded-lg border border-border bg-background p-3 shadow-lg">
                <div className="mb-3 space-y-1">
                  <p className="text-sm font-medium">{authState.user?.email}</p>
                  {authState.user?.level != null && (
                    <p className="text-xs text-muted-foreground">
                      等级:{' '}
                      <span className="rounded bg-primary/20 px-1.5 py-0.5 text-primary">
                        Lv.{authState.user.level}
                      </span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    handleLogout()
                    setUserMenuOpen(false)
                  }}
                  className="w-full cursor-pointer rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                >
                  登出
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global settings */}
      <div className="flex flex-col gap-2 px-4 pb-2">
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
