import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getExchangeByAbbr,
  LIGHTER_WS_URL
} from '../../lib/config'
import {
  ALL_SYMBOLS_DATA,
  MARKET_ID_TO_SYMBOL,
  SYMBOL_MARKET_ID_MAP,
} from '../../lib/symbols'
import type {
  ExchangeMarketStats,
  ExchangeState,
  OrderBook,
  Position,
  SymbolState,
  WsConnection,
} from '../../lib/types'

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
  const lighterWsConnections = useRef<Map<string, WsConnection>>(new Map())
  const omniWsConnections = useRef<Map<string, WsConnection>>(new Map())

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

  const setExchangeWsConnected = useCallback((exchangeId: string, connected: boolean) => {
    setExchanges((prev) =>
      prev.map((ex) => (ex.id === exchangeId ? { ...ex, wsConnected: connected } : ex))
    )
  }, [])

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

  const getAnyActiveTabId = useCallback(() => {
    const lighterEx = exchanges.find((ex) => ex.id === 'LG')
    if (lighterEx?.tabId) return lighterEx.tabId
    const omniEx = exchanges.find((ex) => ex.id === 'OM')
    if (omniEx?.tabId) return omniEx.tabId
    return null
  }, [exchanges])

  const connectAllLighterWs = useCallback(async () => {
    const lighterEx = exchanges.find((ex) => ex.id === 'LG')
    if (!lighterEx?.tabId) {
      console.log('[Arbflow] Cannot connect: Lighter tab not found')
      return
    }

    for (const symbol of watchedSymbols) {
      const marketId = SYMBOL_MARKET_ID_MAP[symbol]
      if (marketId === undefined) continue

      const wsId = `lighter-${symbol}`
      if (lighterWsConnections.current.has(wsId)) continue

      console.log(`[Arbflow] Connecting WebSocket for ${symbol} (marketId: ${marketId})`)

      try {
        await chrome.tabs.sendMessage(lighterEx.tabId, {
          type: 'WS_COMMAND',
          command: 'connect',
          url: LIGHTER_WS_URL,
          options: { id: wsId, symbol, marketId },
        })
        lighterWsConnections.current.set(wsId, { symbol, marketId, connected: false })
      } catch (e) {
        console.error(`[Arbflow] Failed to connect WS for ${symbol}:`, e)
      }
    }
  }, [exchanges, watchedSymbols])

  const connectOmniWs = useCallback(async () => {
    const omniConfig = getExchangeByAbbr('OM')
    const quotesInfo = omniConfig?.quotesInfo
    if (!quotesInfo || quotesInfo.type !== 'websocket') return

    const wsId = 'omni-quotes'
    if (omniWsConnections.current.has(wsId)) return

    const symbolsData = watchedSymbols
      .map((s) => ALL_SYMBOLS_DATA.find((d) => d.symbol === s))
      .filter(Boolean)

    if (symbolsData.length === 0) return

    const targetTabId = getAnyActiveTabId()
    if (!targetTabId) return

    console.log('[Arbflow] Connecting Omni WebSocket for symbols:', watchedSymbols)

    try {
      await chrome.tabs.sendMessage(targetTabId, {
        type: 'WS_COMMAND',
        command: 'connect',
        url: quotesInfo.url,
        options: {
          id: wsId,
          symbols: watchedSymbols,
          pingInterval: quotesInfo.pingInterval,
        },
      })
      omniWsConnections.current.set(wsId, { symbols: watchedSymbols, connected: false })
    } catch (e) {
      console.error('[Arbflow] Failed to connect Omni WebSocket:', e)
    }
  }, [watchedSymbols, getAnyActiveTabId])

  const sendWsCommand = useCallback(
    async (command: string, params: Record<string, unknown> = {}) => {
      const lighterEx = exchanges.find((ex) => ex.id === 'LG')
      if (!lighterEx?.tabId) return null

      try {
        await chrome.tabs.sendMessage(lighterEx.tabId, {
          type: 'WS_COMMAND',
          command,
          ...params,
        })
        return true
      } catch (e) {
        console.error('[Arbflow] Failed to send WS command:', e)
        return null
      }
    },
    [exchanges]
  )

  const subscribeLighterChannel = useCallback(
    async (wsId: string, marketId: number) => {
      const subscriptions = [
        { type: 'subscribe', channel: `public_market_data/${marketId}` },
        { type: 'subscribe', channel: `market_stats/${marketId}` },
      ]

      for (const sub of subscriptions) {
        await sendWsCommand('send', { id: wsId, data: sub })
      }
    },
    [sendWsCommand]
  )

  const subscribeOmniChannels = useCallback(
    async (wsId: string, symbols: string[]) => {
      const omniConfig = getExchangeByAbbr('OM')
      const quotesInfo = omniConfig?.quotesInfo
      if (!quotesInfo?.getSubscribeMessages) return

      const symbolsData = symbols
        .map((s) => ALL_SYMBOLS_DATA.find((d) => d.symbol === s))
        .filter(Boolean)

      const messages = quotesInfo.getSubscribeMessages(symbolsData as typeof ALL_SYMBOLS_DATA)

      const targetTabId = getAnyActiveTabId()
      if (!targetTabId) return

      for (const msg of messages) {
        try {
          await chrome.tabs.sendMessage(targetTabId, {
            type: 'WS_COMMAND',
            command: 'send',
            id: wsId,
            data: msg,
          })
        } catch (e) {
          console.error('[Arbflow] Failed to send Omni subscribe:', e)
        }
      }
    },
    [getAnyActiveTabId]
  )

  const handleLighterMarketData = useCallback(
    (marketId: number, parsed: { type: string; orderBook?: OrderBook }) => {
      const symbol = MARKET_ID_TO_SYMBOL[marketId]
      if (!symbol) return

      if (parsed.type === 'orderBook' && parsed.orderBook) {
        updateExchangeMarketStats(symbol, 'LG', parsed.orderBook)
      }
    },
    [updateExchangeMarketStats]
  )

  const handleOmniMarketData = useCallback(
    (symbol: string, parsed: { type: string; orderBook?: OrderBook }) => {
      if (!symbol) return

      if (parsed.type === 'orderBook' && parsed.orderBook) {
        updateExchangeMarketStats(symbol, 'OM', parsed.orderBook)
      }
    },
    [updateExchangeMarketStats]
  )

  useEffect(() => {
    const handleMessage = (message: Record<string, unknown>) => {
      if (message.target !== 'sidepanel') return

      switch (message.type) {
        case 'TAB_UPDATED':
        case 'TAB_CREATED':
        case 'TAB_REMOVED':
        case 'CONTENT_SCRIPT_READY':
          scanOpenExchanges().then((newExchanges) => {
            const lighterEx = newExchanges.find((ex) => ex.id === 'LG')
            if (lighterEx?.tabId && watchedSymbols.length > 0) {
              connectAllLighterWs()
              connectOmniWs()
            }
          })
          break

        case 'CUSTOM_WS_OPEN':
          if ((message.id as string)?.startsWith('lighter-')) {
            const conn = lighterWsConnections.current.get(message.id as string)
            if (conn) {
              conn.connected = true
              subscribeLighterChannel(message.id as string, conn.marketId!)
            }
          } else if ((message.id as string)?.startsWith('omni-')) {
            const conn = omniWsConnections.current.get(message.id as string)
            if (conn) {
              conn.connected = true
              subscribeOmniChannels(message.id as string, conn.symbols!)
            }
            setExchangeWsConnected('OM', true)
          }
          break

        case 'CUSTOM_WS_MESSAGE':
          if ((message.id as string)?.startsWith('lighter-')) {
            if (message.parsed && message.marketId !== undefined) {
              handleLighterMarketData(
                message.marketId as number,
                message.parsed as { type: string; orderBook?: OrderBook }
              )
            }
          } else if ((message.id as string)?.startsWith('omni-')) {
            const parsed = message.parsed as { type: string; orderBook?: OrderBook; symbol?: string }
            if (parsed?.symbol) {
              handleOmniMarketData(parsed.symbol, parsed)
            }
          }
          break

        case 'CUSTOM_WS_CLOSE':
        case 'CUSTOM_WS_ERROR':
          if ((message.id as string)?.startsWith('lighter-')) {
            lighterWsConnections.current.delete(message.id as string)
          } else if ((message.id as string)?.startsWith('omni-')) {
            omniWsConnections.current.delete(message.id as string)
            setExchangeWsConnected('OM', false)
          }
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
  }, [
    scanOpenExchanges,
    watchedSymbols,
    connectAllLighterWs,
    connectOmniWs,
    subscribeLighterChannel,
    subscribeOmniChannels,
    handleLighterMarketData,
    handleOmniMarketData,
    setExchangeWsConnected,
    updateExchangePositions,
  ])

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

    lighterWsConnections.current.clear()
    omniWsConnections.current.clear()

    await new Promise((r) => setTimeout(r, 1000))

    const lighterEx = exchanges.find((ex) => ex.id === 'LG')
    if (lighterEx?.tabId && watchedSymbols.length > 0) {
      await connectAllLighterWs()
      await connectOmniWs()
    }
  }, [exchanges, scanOpenExchanges, watchedSymbols, connectAllLighterWs, connectOmniWs])

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

