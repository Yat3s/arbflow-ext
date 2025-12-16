import { useCallback, useEffect, useRef, useState } from 'react'
import { EXCHANGES } from '../../lib/config'
import { createLighterAuthToken, LIGHTER_WS_URL } from '../../lib/lighter-api'
import { decodeMsgpack } from '../../lib/msgpack'
import { parseMessage } from '../../lib/parsers'
import {
  ALL_SYMBOLS_DATA,
  MARKET_ID_TO_SYMBOL,
  SYMBOL_MARKET_ID_MAP,
} from '../../lib/symbols'
import type {
  ExchangeConfig,
  ExchangeMarketStats,
  ExchangeState,
  LighterConfig,
  OrderBook,
  Position,
  SymbolData,
  SymbolState,
} from '../../lib/types'

export interface LighterWsPosition {
  market_id: number
  symbol: string
  initial_margin_fraction?: string
  open_order_count: number
  pending_order_count: number
  position_tied_order_count: number
  sign: number
  position: string
  avg_entry_price: string
  position_value: string
  unrealized_pnl: string
  realized_pnl: string
  liquidation_price: string
  total_funding_paid_out?: string
  margin_mode: number
  allocated_margin: string
}

interface DirectWsConnection {
  ws: WebSocket
  exchangeId: string
  symbol?: string
  symbols?: string[]
  marketId?: number
  pingInterval?: ReturnType<typeof setInterval>
}

const INITIAL_EXCHANGES: ExchangeState[] = [
  {
    id: 'LG',
    name: 'Lighter',
    color: '#6366f1',
    baseUrl: 'https://app.lighter.xyz',
    enforceOpenTab: false,
    tabId: null,
    currentUrl: null,
    currentSymbol: null,
    wsConnected: false,
    accountInfo: null,
  },
  {
    id: 'OM',
    name: 'Omni',
    color: '#f59e0b',
    baseUrl: 'https://omni.variational.io',
    enforceOpenTab: true,
    tabId: null,
    currentUrl: null,
    currentSymbol: null,
    wsConnected: false,
    accountInfo: null,
  },
]

function extractSymbolFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/').filter(Boolean)
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1].toUpperCase()
    }
  } catch { }
  return null
}

function mergeOrderBookItems(
  existing: { price: number; quantity: number }[] | undefined,
  newItems: { price: number; quantity: number }[],
  isBids: boolean
): { price: number; quantity: number }[] {
  if (!newItems || newItems.length === 0) return existing || []
  if (!existing || existing.length === 0 || newItems.length > 10) {
    const result = newItems.filter((o) => o.quantity > 0)
    result.sort((a, b) => (isBids ? b.price - a.price : a.price - b.price))
    return result.slice(0, 20)
  }

  const orderMap = new Map<string, { price: number; quantity: number }>()
  for (const order of existing) {
    orderMap.set(order.price.toString(), order)
  }
  for (const newOrder of newItems) {
    if (newOrder.quantity === 0) {
      orderMap.delete(newOrder.price.toString())
    } else {
      orderMap.set(newOrder.price.toString(), newOrder)
    }
  }

  const result = Array.from(orderMap.values()).filter((o) => o.quantity > 0)
  result.sort((a, b) => (isBids ? b.price - a.price : a.price - b.price))
  return result.slice(0, 20)
}

const EXCHANGE_SHOULD_MERGE_ORDERBOOK: Record<string, boolean> = {
  LG: true,
  OM: false,
}

export function useExchanges(watchedSymbols: string[], lighterConfig?: LighterConfig) {
  const [exchanges, setExchanges] = useState<ExchangeState[]>(INITIAL_EXCHANGES)
  const [symbolStates, setSymbolStates] = useState<SymbolState[]>([])
  const [lighterWsMessages, setLighterWsMessages] = useState<string[]>([])
  const wsConnections = useRef<Map<string, DirectWsConnection>>(new Map())
  const lighterWsRef = useRef<WebSocket | null>(null)
  const lighterWsPingInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const getExchangeById = useCallback(
    (id: string) => exchanges.find((ex) => ex.id === id),
    [exchanges]
  )

  const getOrCreateSymbolState = useCallback(
    (symbol: string): SymbolState => {
      const existing = symbolStates.find((s) => s.symbol === symbol)
      if (existing) return existing
      return { symbol, positions: [], exchangeMarketStats: [] }
    },
    [symbolStates]
  )

  const updateExchangeMarketStats = useCallback(
    (symbol: string, exchangeId: string, newOrderBook: OrderBook) => {
      setSymbolStates((prev) => {
        const symbolIdx = prev.findIndex((s) => s.symbol === symbol)
        const symbolState = symbolIdx >= 0 ? { ...prev[symbolIdx] } : {
          symbol,
          positions: [],
          exchangeMarketStats: [],
        }

        const shouldMerge = EXCHANGE_SHOULD_MERGE_ORDERBOOK[exchangeId] ?? true
        const existingIdx = symbolState.exchangeMarketStats.findIndex(
          (s) => s.exchangeId === exchangeId
        )

        let finalOrderBook: OrderBook
        if (shouldMerge && existingIdx >= 0) {
          const existingOB = symbolState.exchangeMarketStats[existingIdx].orderBook
          finalOrderBook = {
            bids: mergeOrderBookItems(existingOB?.bids, newOrderBook.bids, true),
            asks: mergeOrderBookItems(existingOB?.asks, newOrderBook.asks, false),
          }
        } else if (shouldMerge) {
          finalOrderBook = {
            bids: mergeOrderBookItems(undefined, newOrderBook.bids, true),
            asks: mergeOrderBookItems(undefined, newOrderBook.asks, false),
          }
        } else {
          finalOrderBook = newOrderBook
        }

        const statsData: ExchangeMarketStats = {
          exchangeId,
          orderBook: finalOrderBook,
          lastUpdated: Date.now(),
        }

        const newStats = [...symbolState.exchangeMarketStats]
        if (existingIdx >= 0) {
          newStats[existingIdx] = statsData
        } else {
          newStats.push(statsData)
        }

        const newSymbolState = { ...symbolState, exchangeMarketStats: newStats }
        if (symbolIdx >= 0) {
          const newPrev = [...prev]
          newPrev[symbolIdx] = newSymbolState
          return newPrev
        }
        return [...prev, newSymbolState]
      })
    },
    []
  )

  const updateExchangePositions = useCallback(
    (exchangeId: string, positions: Position[], isFullUpdate: boolean, source: 'ui' | 'websocket' = 'ui', closedSymbols?: string[]) => {
      const exchangeConfig = EXCHANGES.find((e) => e.abbreviation === exchangeId)
      if (exchangeConfig?.positionUpdater && exchangeConfig.positionUpdater.source !== source) {
        return
      }

      setSymbolStates((prev) => {
        let newStates = [...prev]

        if (isFullUpdate) {
          newStates = newStates.map((s) => ({
            ...s,
            positions: s.positions.filter((p) => p.exchangeId !== exchangeId),
          }))
        }

        if (closedSymbols && closedSymbols.length > 0) {
          newStates = newStates.map((s) => {
            if (closedSymbols.includes(s.symbol)) {
              return {
                ...s,
                positions: s.positions.filter((p) => p.exchangeId !== exchangeId),
              }
            }
            return s
          })
        }

        const now = Date.now()
        for (const pos of positions) {
          const symbolIdx = newStates.findIndex((s) => s.symbol === pos.symbol)
          if (symbolIdx >= 0) {
            const symbolState = { ...newStates[symbolIdx] }
            const existingIdx = symbolState.positions.findIndex(
              (p) => p.exchangeId === exchangeId
            )
            const positionData = { ...pos, exchangeId, lastUpdated: now }

            if (existingIdx >= 0) {
              symbolState.positions = [...symbolState.positions]
              symbolState.positions[existingIdx] = positionData
            } else {
              symbolState.positions = [...symbolState.positions, positionData]
            }
            newStates[symbolIdx] = symbolState
          } else {
            newStates.push({
              symbol: pos.symbol,
              positions: [{ ...pos, exchangeId, lastUpdated: now }],
              exchangeMarketStats: [],
            })
          }
        }

        return newStates
      })
    },
    []
  )

  const handleLighterWsPositions = useCallback(
    (wsPositions: LighterWsPosition[], isFullUpdate: boolean) => {
      const closedSymbols: string[] = []
      const positions: Position[] = []

      for (const p of wsPositions) {
        const position = parseFloat(p.position)
        const avgEntryPrice = parseFloat(p.avg_entry_price)

        if (position === 0 && avgEntryPrice === 0) {
          closedSymbols.push(p.symbol)
          continue
        }

        const positionValue = parseFloat(p.position_value)
        const unrealizedPnl = parseFloat(p.unrealized_pnl)
        const markPrice = position !== 0 ? positionValue / position : 0
        const entryValue = position * avgEntryPrice
        const unrealizedPnlPercent = entryValue !== 0 ? (unrealizedPnl / entryValue) * 100 : 0

        positions.push({
          symbol: p.symbol,
          position: Math.abs(position),
          side: p.sign > 0 ? 'long' : 'short',
          leverage: p.initial_margin_fraction
            ? (100 / parseFloat(p.initial_margin_fraction)).toFixed(1) + 'x'
            : undefined,
          avgEntryPrice,
          markPrice,
          positionValue: Math.abs(positionValue),
          unrealizedPnl,
          unrealizedPnlPercent,
          funding: parseFloat(p.total_funding_paid_out || '0'),
          liquidationPrice: p.liquidation_price ? parseFloat(p.liquidation_price) : null,
        } as Position)
      }

      updateExchangePositions('LG', positions, isFullUpdate, 'websocket', closedSymbols)
    },
    [updateExchangePositions]
  )

  const fetchOmniAccountInfo = useCallback(async (tabId: number) => {
    console.log('[Arbflow] Fetching OM account info, tabId:', tabId)
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return fetch('https://omni.variational.io/api/settlement_pools/existing')
            .then((response) => {
              if (!response.ok) return null
              return response.json()
            })
            .then((data) => {
              console.log('[Arbflow] OM account info:', data)
              return data?.address_other || null
            })
            .catch(() => null)
        },
      })
      console.log('[Arbflow] OM script result:', result)
      const walletAddress = result?.[0]?.result
      if (walletAddress) {
        setExchanges((p) => {
          const current = p.find((ex) => ex.id === 'OM')
          if (current?.accountInfo?.walletAddress === walletAddress) {
            return p
          }
          return p.map((ex) =>
            ex.id === 'OM' ? { ...ex, accountInfo: { walletAddress } } : ex
          )
        })
      }
    } catch (e) {
      console.error('[Arbflow] Failed to fetch OM account info:', e)
    }
  }, [])

  const scanOpenExchanges = useCallback(async () => {
    const tabInfos: Record<string, { tabId: number | null; currentUrl: string | null; currentSymbol: string | null }> = {}

    for (const exchange of INITIAL_EXCHANGES) {
      const tabs = await chrome.tabs.query({ url: `${exchange.baseUrl}/*` })
      if (tabs.length > 0) {
        const tab = tabs[0]
        tabInfos[exchange.id] = {
          tabId: tab.id ?? null,
          currentUrl: tab.url ?? null,
          currentSymbol: tab.url ? extractSymbolFromUrl(tab.url) : null,
        }
      } else {
        tabInfos[exchange.id] = { tabId: null, currentUrl: null, currentSymbol: null }
      }
    }

    setExchanges((prev) =>
      prev.map((ex) => ({
        ...ex,
        ...tabInfos[ex.id],
      }))
    )

    const omTabId = tabInfos['OM']?.tabId
    if (omTabId) {
      fetchOmniAccountInfo(omTabId)
    }
  }, [fetchOmniAccountInfo])

  const createWsConnection = useCallback((
    exchange: ExchangeConfig,
    symbolsData: SymbolData[],
    wsId: string,
    symbol?: string,
    marketId?: number
  ) => {
    const { orderBookConfig } = exchange
    const abbr = exchange.abbreviation

    console.log(`[Arbflow] Connecting ${exchange.name} WebSocket${symbol ? ` for ${symbol}` : ''}`)

    try {
      const ws = new WebSocket(orderBookConfig.url)
      if (abbr === 'LG') {
        ws.binaryType = 'arraybuffer'
      }

      const conn: DirectWsConnection = {
        ws,
        exchangeId: abbr,
        symbol,
        symbols: symbolsData.map((s) => s.symbol),
        marketId,
      }
      wsConnections.current.set(wsId, conn)

      ws.onopen = () => {
        console.log(`[Arbflow] ${exchange.name} WebSocket connected${symbol ? ` for ${symbol}` : ''}`)
        setExchanges((prev) =>
          prev.map((ex) => (ex.id === abbr ? { ...ex, wsConnected: true } : ex))
        )

        if (orderBookConfig.getSubscribeMessages) {
          const messages = orderBookConfig.getSubscribeMessages(
            orderBookConfig.sendRequestPerSymbol ? symbolsData[0] : symbolsData
          )
          for (const msg of messages) {
            ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg))
          }
        }

        if (orderBookConfig.pingInterval) {
          conn.pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }))
            }
          }, orderBookConfig.pingInterval)
        }
      }

      ws.onmessage = (event) => {
        try {
          let data: Record<string, unknown>
          if (abbr === 'LG') {
            data = decodeMsgpack(event.data as ArrayBuffer) as Record<string, unknown>
          } else {
            data = JSON.parse(event.data as string) as Record<string, unknown>
          }

          if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }))
            return
          }

          const parsed = parseMessage(exchange.id, data)
          if (parsed?.type === 'orderBook' && parsed.orderBook) {
            let sym = parsed.symbol
            if (!sym && marketId !== undefined) {
              sym = MARKET_ID_TO_SYMBOL[marketId]
            }
            if (sym) {
              updateExchangeMarketStats(sym, abbr, parsed.orderBook)
            }
          }
        } catch (e) {
          console.error(`[Arbflow] Failed to parse ${exchange.name} message:`, e)
        }
      }

      ws.onclose = () => {
        console.log(`[Arbflow] ${exchange.name} WebSocket closed${symbol ? ` for ${symbol}` : ''}`)
        if (conn.pingInterval) clearInterval(conn.pingInterval)
        wsConnections.current.delete(wsId)

        const hasOtherConnections = Array.from(wsConnections.current.values()).some(
          (c) => c.exchangeId === abbr
        )
        if (!hasOtherConnections) {
          setExchanges((prev) =>
            prev.map((ex) => (ex.id === abbr ? { ...ex, wsConnected: false } : ex))
          )
        }
      }

      ws.onerror = (e) => {
        console.error(`[Arbflow] ${exchange.name} WebSocket error${symbol ? ` for ${symbol}` : ''}:`, e)
        if (conn.pingInterval) clearInterval(conn.pingInterval)
        wsConnections.current.delete(wsId)
      }
    } catch (e) {
      console.error(`[Arbflow] Failed to connect ${exchange.name} WebSocket:`, e)
    }
  }, [updateExchangeMarketStats])

  const connectAllExchangeOrderbookWs = useCallback((symbols: string[]) => {
    const symbolsData = symbols
      .map((s) => ALL_SYMBOLS_DATA.find((d) => d.symbol === s))
      .filter((s): s is SymbolData => s !== undefined)

    if (symbolsData.length === 0) return

    for (const exchange of EXCHANGES) {
      const { orderBookConfig, abbreviation } = exchange

      if (orderBookConfig.sendRequestPerSymbol) {
        for (const symbolData of symbolsData) {
          const marketId = SYMBOL_MARKET_ID_MAP[symbolData.symbol]
          if (marketId === undefined) continue

          const wsId = `${abbreviation}-${symbolData.symbol}`
          const existing = wsConnections.current.get(wsId)
          if (existing && existing.ws.readyState !== WebSocket.CLOSED) continue

          createWsConnection(exchange, [symbolData], wsId, symbolData.symbol, marketId)
        }
      } else {
        const wsId = `${abbreviation}-all`
        const existing = wsConnections.current.get(wsId)
        if (existing && existing.ws.readyState !== WebSocket.CLOSED) return

        createWsConnection(exchange, symbolsData, wsId)
      }
    }
  }, [createWsConnection])

  const fetchExchangeAccountInfo = useCallback(async () => {
    console.log('[Arbflow] Fetching exchange account info')
    console.log('[Arbflow] Lighter config:', lighterConfig)
    if (lighterConfig?.l1Address) {
      console.log('[Arbflow] Lighter l1Address:', lighterConfig.l1Address)
      setExchanges((prev) => {
        const lgExchange = prev.find((ex) => ex.id === 'LG')
        if (lgExchange?.accountInfo?.walletAddress === lighterConfig.l1Address) {
          return prev
        }
        return prev.map((ex) =>
          ex.id === 'LG' ? { ...ex, accountInfo: { walletAddress: lighterConfig.l1Address } } : ex
        )
      })
    }

    setExchanges((prev) => {
      const omExchange = prev.find((ex) => ex.id === 'OM')
      console.log('[Arbflow] OM exchange check:', omExchange?.tabId, omExchange?.accountInfo)
      if (omExchange?.tabId && !omExchange.accountInfo?.walletAddress) {
        fetchOmniAccountInfo(omExchange.tabId)
      }
      return prev
    })
  }, [lighterConfig?.l1Address, fetchOmniAccountInfo])

  const connectLighterWs = useCallback(async () => {
    if (!lighterConfig?.accountIndex || !lighterConfig?.apiPrivateKey) {
      console.log('[Arbflow] Lighter config incomplete, skipping ws connection')
      return
    }

    if (lighterWsRef.current && lighterWsRef.current.readyState !== WebSocket.CLOSED) {
      console.log('[Arbflow] Lighter ws already connected')
      return
    }

    const accountId = lighterConfig.accountIndex
    const apiKeyIndex = lighterConfig.apiKeyIndex
    console.log(`[Arbflow] Connecting Lighter WebSocket for account ${accountId}`)

    let authToken: string
    try {
      authToken = await createLighterAuthToken(
        lighterConfig.apiPrivateKey,
        apiKeyIndex,
        accountId
      )
      console.log('[Arbflow] Auth token created:', authToken ? `${authToken.slice(0, 20)}...` : 'EMPTY')
    } catch (e) {
      console.error('[Arbflow] Failed to create auth token:', e)
      return
    }

    try {
      const ws = new WebSocket(LIGHTER_WS_URL)
      lighterWsRef.current = ws

      ws.onopen = () => {
        console.log('[Arbflow] Lighter WebSocket connected')
        const subscribeMsgs = [
          { type: 'subscribe', channel: `account_all_positions/${accountId}` },
          { type: 'subscribe', channel: `account_all_orders/${accountId}`, auth: authToken },
          { type: 'subscribe', channel: `account_all_trades/${accountId}`, auth: authToken },
          { type: 'subscribe', channel: `account_tx/${accountId}`, auth: authToken },
        ]
        for (const msg of subscribeMsgs) {
          ws.send(JSON.stringify(msg))
        }
        console.log('[Arbflow] Subscribed to:', subscribeMsgs.map((m) => m.channel).join(', '))

        lighterWsPingInterval.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 5000)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string)

          if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }))
            return
          }

          const timestamp = new Date().toLocaleTimeString()
          const msgPreview = `[${timestamp}] ${data.type || 'unknown'}`
          setLighterWsMessages((prev) => [msgPreview, ...prev].slice(0, 50))

          if (data.type === 'subscribed/account_all_positions' && data.positions) {
            const positions: LighterWsPosition[] = []
            for (const [, pos] of Object.entries(data.positions)) {
              positions.push(pos as LighterWsPosition)
            }
            handleLighterWsPositions(positions, true)
          } else if (data.type === 'update/account_all_positions' && data.positions) {
            const deltaPositions: LighterWsPosition[] = []
            for (const [, pos] of Object.entries(data.positions)) {
              deltaPositions.push(pos as LighterWsPosition)
            }
            handleLighterWsPositions(deltaPositions, false)
          }
        } catch (e) {
          console.error('[Arbflow] Failed to parse Lighter ws message:', e)
        }
      }

      ws.onclose = () => {
        console.log('[Arbflow] Lighter WebSocket closed')
        lighterWsRef.current = null
        if (lighterWsPingInterval.current) {
          clearInterval(lighterWsPingInterval.current)
          lighterWsPingInterval.current = null
        }
      }

      ws.onerror = (e) => {
        console.error('[Arbflow] Lighter WebSocket error:', e)
        lighterWsRef.current = null
        if (lighterWsPingInterval.current) {
          clearInterval(lighterWsPingInterval.current)
          lighterWsPingInterval.current = null
        }
      }
    } catch (e) {
      console.error('[Arbflow] Failed to connect Lighter WebSocket:', e)
    }
  }, [lighterConfig?.accountIndex, lighterConfig?.apiPrivateKey, lighterConfig?.apiKeyIndex, handleLighterWsPositions])

  const disconnectLighterWs = useCallback(() => {
    if (lighterWsPingInterval.current) {
      clearInterval(lighterWsPingInterval.current)
      lighterWsPingInterval.current = null
    }
    if (lighterWsRef.current) {
      lighterWsRef.current.close()
      lighterWsRef.current = null
      setLighterWsMessages([])
    }
  }, [])

  useEffect(() => {
    const handleMessage = (message: Record<string, unknown>) => {
      if (message.target !== 'sidepanel') return

      switch (message.type) {
        case 'TAB_UPDATED':
        case 'TAB_CREATED':
        case 'TAB_REMOVED':
        case 'CONTENT_SCRIPT_READY':
          scanOpenExchanges()
          break

        case 'POSITIONS':
          updateExchangePositions(
            message.exchange as string,
            message.positions as Position[],
            message.isFullUpdate as boolean,
            'ui'
          )
          break
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    scanOpenExchanges()

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [scanOpenExchanges, updateExchangePositions])

  useEffect(() => {
    if (watchedSymbols.length > 0) {
      connectAllExchangeOrderbookWs(watchedSymbols)
      connectLighterWs()
      fetchExchangeAccountInfo()
    }
  }, [watchedSymbols, connectAllExchangeOrderbookWs, connectLighterWs, fetchExchangeAccountInfo])

  useEffect(() => {
    if (lighterConfig?.l1Address) {
      setExchanges((prev) => {
        const lgExchange = prev.find((ex) => ex.id === 'LG')
        if (lgExchange?.accountInfo?.walletAddress === lighterConfig.l1Address) {
          return prev
        }
        return prev.map((ex) =>
          ex.id === 'LG' ? { ...ex, accountInfo: { walletAddress: lighterConfig.l1Address } } : ex
        )
      })
    }
  }, [lighterConfig?.l1Address])

  const openExchange = useCallback(async (exchangeId: string) => {
    const exchange = INITIAL_EXCHANGES.find((ex) => ex.id === exchangeId)
    if (exchange) {
      await chrome.tabs.create({ url: exchange.baseUrl, active: true })
    }
  }, [])

  const focusTab = useCallback(async (tabId: number) => {
    await chrome.tabs.update(tabId, { active: true })
    const tab = await chrome.tabs.get(tabId)
    await chrome.windows.update(tab.windowId, { focused: true })
  }, [])

  const refreshTab = useCallback(async (tabId: number) => {
    await chrome.tabs.reload(tabId)
  }, [])

  const disconnectAllWs = useCallback(() => {
    wsConnections.current.forEach((conn) => {
      if (conn.pingInterval) {
        clearInterval(conn.pingInterval)
      }
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.close()
      }
    })
    wsConnections.current.clear()

    setExchanges((prev) =>
      prev.map((ex) => ({ ...ex, wsConnected: false }))
    )
  }, [])

  const refreshAllExchanges = useCallback(async () => {
    for (const exchange of exchanges) {
      if (!exchange.enforceOpenTab) continue

      if (exchange.tabId) {
        await chrome.tabs.reload(exchange.tabId)
      } else {
        await chrome.tabs.create({ url: exchange.baseUrl, active: false })
      }
    }

    await new Promise((r) => setTimeout(r, 2000))
    await scanOpenExchanges()

    disconnectAllWs()
    disconnectLighterWs()

    await new Promise((r) => setTimeout(r, 500))

    if (watchedSymbols.length > 0) {
      connectAllExchangeOrderbookWs(watchedSymbols)
      connectLighterWs()
    }
  }, [exchanges, scanOpenExchanges, watchedSymbols, connectAllExchangeOrderbookWs, disconnectAllWs, connectLighterWs, disconnectLighterWs])

  return {
    exchanges,
    symbolStates,
    lighterWsMessages,
    getExchangeById,
    getOrCreateSymbolState,
    openExchange,
    focusTab,
    refreshTab,
    refreshAllExchanges,
    scanOpenExchanges,
    connectLighterWs,
    disconnectLighterWs,
  }
}


