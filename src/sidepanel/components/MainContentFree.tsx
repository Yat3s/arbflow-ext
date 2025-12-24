import { useCallback, useEffect, useRef, useState } from 'react'
import type { Position } from '../../lib/types'

interface OMTrade {
  symbol: string
  direction: 'long' | 'short'
  size: number
}

export function MainContentFree() {
  const [lgTabId, setLgTabId] = useState<number | null>(null)
  const [omTabId, setOmTabId] = useState<number | null>(null)
  const [tradeStatus, setTradeStatus] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [omPositions, setOmPositions] = useState<Position[]>([])
  const isExecutingRef = useRef(false)
  const lastTradeTimestampRef = useRef<number>(0)

  const findTabs = useCallback(async () => {
    const lgTabs = await chrome.tabs.query({ url: 'https://app.lighter.xyz/*' })
    if (lgTabs.length > 0 && lgTabs[0].id) {
      setLgTabId(lgTabs[0].id)
    } else {
      setLgTabId(null)
    }

    const omTabs = await chrome.tabs.query({ url: 'https://omni.variational.io/*' })
    if (omTabs.length > 0 && omTabs[0].id) {
      setOmTabId(omTabs[0].id)
    } else {
      setOmTabId(null)
    }
  }, [])

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
    if (omPositions.length > 0 && lgTabId) {
      sendPositionsToLG(omPositions)
    }
  }, [omPositions, lgTabId, sendPositionsToLG])

  useEffect(() => {
    const handleMessage = (message: {
      type: string
      target?: string
      omTrade?: OMTrade
      timestamp?: number
      exchange?: string
      positions?: Position[]
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
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [executeOMTrade])

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
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
          {isRefreshing ? '↻...' : '↻'}
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

      <div className="mt-auto pt-8 text-xs text-muted-foreground">
        v{chrome.runtime.getManifest().version}
      </div>
    </main>
  )
}
