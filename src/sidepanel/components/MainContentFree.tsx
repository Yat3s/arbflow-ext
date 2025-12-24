import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchOmWalletAddress } from '../../lib/omni'
import { getLgInjectionEnabled, setLgInjectionEnabled } from '../../lib/storage'
import type { Position } from '../../lib/types'

interface OMTrade {
  symbol: string
  direction: 'long' | 'short'
  size: number
}

interface OMAccountInfo {
  portfolioValue: number | null
  leverage: number | null
}

interface LGAccountInfo {
  portfolioValue: number | null
  leverage: number | null
}

export function MainContentFree() {
  const [lgTabId, setLgTabId] = useState<number | null>(null)
  const [omTabId, setOmTabId] = useState<number | null>(null)
  const [tradeStatus, setTradeStatus] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [omPositions, setOmPositions] = useState<Position[]>([])
  const [omWalletAddress, setOmWalletAddress] = useState<string | null>(null)
  const [omAccountInfo, setOmAccountInfo] = useState<OMAccountInfo | null>(null)
  const [lgAccountInfo, setLgAccountInfo] = useState<LGAccountInfo | null>(null)
  const [lgInjectionEnabled, setLgInjectionEnabledState] = useState(true)
  const isExecutingRef = useRef(false)
  const lastTradeTimestampRef = useRef<number>(0)

  useEffect(() => {
    getLgInjectionEnabled().then(setLgInjectionEnabledState)
  }, [])

  const fetchLgAccountInfo = useCallback(async (tabId: number) => {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const perpsEquityRow = document.querySelector(
            '[data-testid="account-overview-perps-equity"]',
          )
          let portfolioValue: number | null = null
          if (perpsEquityRow) {
            const valueSpan = perpsEquityRow.querySelector('.tabular-nums span')
            if (valueSpan?.textContent) {
              const match = valueSpan.textContent.match(/\$?([\d,]+\.?\d*)/)
              if (match) {
                portfolioValue = parseFloat(match[1].replace(/,/g, ''))
              }
            }
          }

          let leverage: number | null = null
          const allRows = document.querySelectorAll('.flex.w-full.justify-between')
          for (const row of allRows) {
            const label = row.querySelector('p')?.textContent?.trim()
            if (label === 'Cross Leverage') {
              const valueSpan = row.querySelector('.tabular-nums span')
              if (valueSpan?.textContent) {
                const match = valueSpan.textContent.match(/([\d.]+)x/)
                if (match) {
                  leverage = parseFloat(match[1])
                }
              }
              break
            }
          }

          return { portfolioValue, leverage }
        },
      })
      const info = result?.[0]?.result
      if (info) {
        setLgAccountInfo(info)
      }
    } catch (e) {
      console.log('[Arbflow Free] Failed to fetch LG account info:', e)
    }
  }, [])

  const findTabs = useCallback(async () => {
    const lgTabs = await chrome.tabs.query({ url: 'https://app.lighter.xyz/*' })
    if (lgTabs.length > 0 && lgTabs[0].id) {
      setLgTabId(lgTabs[0].id)
      fetchLgAccountInfo(lgTabs[0].id)
    } else {
      setLgTabId(null)
      setLgAccountInfo(null)
    }

    const omTabs = await chrome.tabs.query({ url: 'https://omni.variational.io/*' })
    if (omTabs.length > 0 && omTabs[0].id) {
      setOmTabId(omTabs[0].id)
      const address = await fetchOmWalletAddress(omTabs[0].id)
      setOmWalletAddress(address)
    } else {
      setOmTabId(null)
      setOmWalletAddress(null)
    }
  }, [fetchLgAccountInfo])

  const sendPositionsToLG = useCallback(
    async (positions: Position[]) => {
      if (!lgTabId) return

      try {
        await chrome.tabs.sendMessage(lgTabId, {
          type: 'UPDATE_OM_POSITIONS',
          positions,
        })
      } catch (e) {
        console.log('[Arbflow Free] Failed to send positions to LG:', e)
      }
    },
    [lgTabId],
  )

  const handleRefreshTabs = useCallback(async () => {
    setIsRefreshing(true)
    setTradeStatus('Refreshing tabs...')

    try {
      let lgTabs = await chrome.tabs.query({ url: 'https://app.lighter.xyz/*' })
      let omTabs = await chrome.tabs.query({ url: 'https://omni.variational.io/*' })

      if (omTabs.length === 0) {
        await chrome.tabs.create({ url: 'https://omni.variational.io/', active: false })
      } else if (omTabs[0].id) {
        await chrome.tabs.reload(omTabs[0].id)
      }

      if (lgTabs.length === 0) {
        await chrome.tabs.create({ url: 'https://app.lighter.xyz/', active: false })
      } else if (lgTabs[0].id) {
        await chrome.tabs.reload(lgTabs[0].id)
      }

      await new Promise((r) => setTimeout(r, 2000))

      await findTabs()

      lgTabs = await chrome.tabs.query({ url: 'https://app.lighter.xyz/*' })
      if (lgTabs.length > 0 && lgTabs[0].id) {
        await chrome.tabs.update(lgTabs[0].id, { active: true })
        const tab = await chrome.tabs.get(lgTabs[0].id)
        if (tab.windowId) {
          await chrome.windows.update(tab.windowId, { focused: true })
        }
      }

      setTradeStatus('✓ Tabs refreshed')
    } catch (e) {
      setTradeStatus(`✗ Refresh failed: ${(e as Error).message}`)
    } finally {
      setIsRefreshing(false)
    }
  }, [findTabs])

  const executeOMTrade = useCallback(
    async (trade: OMTrade, timestamp: number) => {
      if (isExecutingRef.current) {
        console.log('[Arbflow Free] Already executing, skipping')
        return
      }

      if (timestamp <= lastTradeTimestampRef.current) {
        console.log('[Arbflow Free] Duplicate trade request, skipping')
        return
      }

      if (!omTabId) {
        setTradeStatus('✗ OM tab not found')
        return
      }

      isExecutingRef.current = true
      lastTradeTimestampRef.current = timestamp

      const side = trade.direction === 'long' ? 'buy' : 'sell'
      setTradeStatus(`Executing OM ${side} ${trade.size} ${trade.symbol}...`)

      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('OM trade timeout'))
          }, 30000)

          const handleMessage = (message: Record<string, unknown>) => {
            if (message.target !== 'sidepanel') return

            if (message.type === 'TRADE_ORDER') {
              clearTimeout(timeout)
              chrome.runtime.onMessage.removeListener(handleMessage)
              resolve(message.orderData)
            } else if (message.type === 'TRADE_ERROR') {
              clearTimeout(timeout)
              chrome.runtime.onMessage.removeListener(handleMessage)
              reject(new Error(message.error as string))
            }
          }

          chrome.runtime.onMessage.addListener(handleMessage)

          chrome.tabs
            .sendMessage(omTabId, {
              type: 'TRADE',
              exchangeId: 'OM',
              params: {
                underlying: trade.symbol,
                size: trade.size,
                side,
                maxSlippage: 0.005,
                walletAddress: omWalletAddress,
              },
            })
            .catch((e) => {
              clearTimeout(timeout)
              chrome.runtime.onMessage.removeListener(handleMessage)
              reject(e)
            })
        })

        setTradeStatus(`✓ OM ${side} completed`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setTradeStatus(`✗ OM trade failed: ${msg}`)
      } finally {
        isExecutingRef.current = false
      }
    },
    [omTabId],
  )

  useEffect(() => {
    findTabs()

    const handleTabUpdate = () => {
      findTabs()
    }

    chrome.tabs.onUpdated.addListener(handleTabUpdate)
    chrome.tabs.onRemoved.addListener(handleTabUpdate)
    chrome.tabs.onCreated.addListener(handleTabUpdate)

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdate)
      chrome.tabs.onRemoved.removeListener(handleTabUpdate)
      chrome.tabs.onCreated.removeListener(handleTabUpdate)
    }
  }, [findTabs])

  useEffect(() => {
    if (omPositions.length > 0 && lgTabId && lgInjectionEnabled) {
      sendPositionsToLG(omPositions)
    }
  }, [omPositions, lgTabId, sendPositionsToLG, lgInjectionEnabled])

  useEffect(() => {
    const handleMessage = (message: {
      type: string
      target?: string
      omTrade?: OMTrade
      timestamp?: number
      exchange?: string
      positions?: Position[]
      portfolioValue?: number | null
      leverage?: number | null
    }) => {
      if (message.target !== 'sidepanel') return

      if (message.type === 'ARBFLOW_TRADE_BUTTON_CLICK' && message.omTrade && message.timestamp) {
        console.log('[Arbflow Free] Trade button clicked, executing OM trade:', message.omTrade)
        executeOMTrade(message.omTrade, message.timestamp)
      }

      if (message.type === 'POSITIONS' && message.exchange === 'OM' && message.positions) {
        console.log('[Arbflow Free] Received OM positions:', message.positions)
        setOmPositions(message.positions)
      }

      if (message.type === 'ACCOUNT_INFO' && message.exchange === 'OM') {
        console.log('[Arbflow Free] Received OM account info:', message)
        setOmAccountInfo({
          portfolioValue: message.portfolioValue ?? null,
          leverage: message.leverage ?? null,
        })
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [executeOMTrade])

  return (
    <main className="flex min-h-full flex-1 flex-col items-center p-8">
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${lgTabId ? 'bg-green-500' : 'bg-muted-foreground'}`}
            />
            <span className="text-muted-foreground">LG</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${omTabId ? 'bg-green-500' : 'bg-muted-foreground'}`}
            />
            <span className="text-muted-foreground">OM</span>
          </div>
          <button
            onClick={handleRefreshTabs}
            disabled={isRefreshing}
            className="cursor-pointer rounded px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
          >
            {isRefreshing ? '↻...' : '↻ 刷新'}
          </button>
        </div>

        {tradeStatus && (
          <div
            className={`mt-4 rounded p-2 text-xs ${
              tradeStatus.startsWith('✓')
                ? 'bg-green-500/10 text-green-500'
                : tradeStatus.startsWith('✗')
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-primary/10 text-primary'
            }`}
          >
            {tradeStatus}
          </div>
        )}

        {omWalletAddress && (
          <div className="mt-4 rounded bg-muted/50 px-3 py-2 text-xs">
            <span className="text-muted-foreground">OM Wallet: </span>
            <span className="font-mono">
              {omWalletAddress.slice(0, 6)}...{omWalletAddress.slice(-4)}
            </span>
          </div>
        )}

        <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-2 text-xs font-semibold text-primary">LG</div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Portfolio</span>
                  <span className="font-mono tabular-nums">
                    ${lgAccountInfo?.portfolioValue?.toFixed(2) ?? '-'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Leverage</span>
                  <span className="font-mono tabular-nums">
                    {lgAccountInfo?.leverage?.toFixed(2) ?? '-'}x
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
              <div className="mb-2 text-xs font-semibold text-orange-500">OM</div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Portfolio</span>
                  <span className="font-mono tabular-nums text-orange-500">
                    ${omAccountInfo?.portfolioValue?.toFixed(2) ?? '-'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Leverage</span>
                  <span className="font-mono tabular-nums text-orange-500">
                    {omAccountInfo?.leverage?.toFixed(2) ?? '-'}x
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-emerald-500">Total Portfolio</span>
              <span className="font-mono font-bold tabular-nums text-emerald-500">
                $
                {(
                  (lgAccountInfo?.portfolioValue ?? 0) + (omAccountInfo?.portfolioValue ?? 0)
                ).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            onClick={async () => {
              const newValue = !lgInjectionEnabled
              setLgInjectionEnabledState(newValue)
              await setLgInjectionEnabled(newValue)
              if (lgTabId) {
                await chrome.tabs.reload(lgTabId)
              }
            }}
            className={`group relative h-10 w-20 cursor-pointer overflow-hidden rounded-full border-2 transition-all duration-300 ${
              lgInjectionEnabled
                ? 'border-emerald-500/50 bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                : 'border-zinc-600/50 bg-zinc-800/50'
            }`}
          >
            <div
              className={`absolute inset-0 transition-opacity duration-300 ${
                lgInjectionEnabled ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(16,185,129,0.15) 0%, transparent 70%)',
              }}
            />
            <span
              className={`absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full transition-all duration-300 ${
                lgInjectionEnabled
                  ? 'left-[calc(100%-32px)] bg-gradient-to-br from-emerald-400 to-cyan-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]'
                  : 'left-1 bg-zinc-500'
              }`}
            >
              <span
                className={`absolute inset-1 rounded-full transition-colors ${
                  lgInjectionEnabled ? 'bg-emerald-300/30' : 'bg-zinc-400/20'
                }`}
              />
            </span>
            <span
              className={`absolute inset-0 rounded-full transition-opacity duration-300 ${
                lgInjectionEnabled ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
              }`}
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.1) 50%, transparent 100%)',
                animation: lgInjectionEnabled ? 'shimmer 2s infinite' : 'none',
              }}
            />
          </button>
          <style>{`
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
          `}</style>
        </div>

        <div className="mt-2 text-center text-xs text-muted-foreground">
          使用说明：请确保 OM 和 LG 页面都在同一个浏览器，请使用 LG 页面进行交易。
          出现异常请点击"刷新"按钮。
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Arfblow v{chrome.runtime.getManifest().version}
      </div>
    </main>
  )
}
