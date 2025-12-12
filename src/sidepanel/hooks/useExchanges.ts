import { useCallback, useEffect, useRef, useState } from 'react'
import { EXCHANGES } from '../../lib/config'
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
  OrderBook,
  Position,
  SymbolData,
  SymbolState,
} from '../../lib/types'

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
    tabId: null,
    currentUrl: null,
    currentSymbol: null,
    wsConnected: false,
  },
  {
    id: 'OM',
    name: 'Omni',
    color: '#f59e0b',
    baseUrl: 'https://omni.variational.io',
    tabId: null,
    currentUrl: null,
    currentSymbol: null,
    wsConnected: false,
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

export function useExchanges(watchedSymbols: string[]) {
  const [exchanges, setExchanges] = useState<ExchangeState[]>(INITIAL_EXCHANGES)
  const [symbolStates, setSymbolStates] = useState<SymbolState[]>([])
  const wsConnections = useRef<Map<string, DirectWsConnection>>(new Map())

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
    (exchangeId: string, positions: Position[], isFullUpdate: boolean) => {
      setSymbolStates((prev) => {
        let newStates = [...prev]

        if (isFullUpdate) {
          newStates = newStates.map((s) => ({
            ...s,
            positions: s.positions.filter((p) => p.exchangeId !== exchangeId),
          }))
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

  const scanOpenExchanges = useCallback(async () => {
    const newExchanges = [...INITIAL_EXCHANGES]

    for (const exchange of newExchanges) {
      const tabs = await chrome.tabs.query({ url: `${exchange.baseUrl}/*` })
      if (tabs.length > 0) {
        const tab = tabs[0]
        exchange.tabId = tab.id ?? null
        exchange.currentUrl = tab.url ?? null
        exchange.currentSymbol = tab.url ? extractSymbolFromUrl(tab.url) : null
      }
    }

    setExchanges(newExchanges)
    return newExchanges
  }, [])

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
            message.isFullUpdate as boolean
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
    }
  }, [watchedSymbols, connectAllExchangeOrderbookWs])

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
      if (exchange.tabId) {
        await chrome.tabs.reload(exchange.tabId)
      } else {
        await chrome.tabs.create({ url: exchange.baseUrl, active: false })
      }
    }

    await new Promise((r) => setTimeout(r, 2000))
    await scanOpenExchanges()

    disconnectAllWs()

    await new Promise((r) => setTimeout(r, 500))

    if (watchedSymbols.length > 0) {
      connectAllExchangeOrderbookWs(watchedSymbols)
    }
  }, [exchanges, scanOpenExchanges, watchedSymbols, connectAllExchangeOrderbookWs, disconnectAllWs])

  return {
    exchanges,
    symbolStates,
    getExchangeById,
    getOrCreateSymbolState,
    openExchange,
    focusTab,
    refreshTab,
    refreshAllExchanges,
    scanOpenExchanges,
  }
}


