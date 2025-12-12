import { useCallback, useRef } from 'react'
import { EXCHANGES } from '../../lib/config'
import { LighterAPI, fetchLighterAccountIndex } from '../../lib/lighter-api'
import type { ExchangeState, LighterConfig, SymbolState, TradeStep } from '../../lib/types'

interface UseTradeProps {
  exchanges: ExchangeState[]
  symbolStates: SymbolState[]
  lighterConfig: LighterConfig
  saveLighterConfig: (config: Partial<LighterConfig>) => void
}

export function useTrade({
  exchanges,
  symbolStates,
  lighterConfig,
  saveLighterConfig,
}: UseTradeProps) {
  const lighterApiRef = useRef<LighterAPI | null>(null)

  const getExchangeById = useCallback(
    (id: string) => exchanges.find((ex) => ex.id === id),
    [exchanges]
  )

  const initializeLighterApi = useCallback(async (): Promise<boolean> => {
    if (!lighterConfig.l1Address || !lighterConfig.apiPrivateKey) {
      return false
    }

    try {
      lighterApiRef.current = new LighterAPI()
      const accountIndex = await lighterApiRef.current.initialize({
        l1Address: lighterConfig.l1Address,
        apiPrivateKey: lighterConfig.apiPrivateKey,
        apiKeyIndex: lighterConfig.apiKeyIndex,
        accountIndex: lighterConfig.accountIndex,
      })

      saveLighterConfig({ accountIndex })
      console.log('[LighterAPI] Initialized with account index:', accountIndex)
      return true
    } catch (e) {
      console.error('[LighterAPI] Init failed:', e)
      lighterApiRef.current = null
      return false
    }
  }, [lighterConfig, saveLighterConfig])

  const executeTradeStep = useCallback(
    async (tabId: number, step: TradeStep): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { type: 'EXECUTE_TRADE_STEP', step }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message })
          } else if (response?.success) {
            resolve({ success: true })
          } else {
            resolve({ success: false, error: response?.error || 'Unknown error' })
          }
        })
      })
    },
    []
  )

  const getTradeState = useCallback(
    async (
      tabId: number,
      platform: string
    ): Promise<{ direction: 'long' | 'short' | null; size: string }> => {
      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { type: 'GET_TRADE_STATE', platform }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ direction: null, size: '' })
          } else {
            resolve(response || { direction: null, size: '' })
          }
        })
      })
    },
    []
  )

  const prepareTradeSteps = useCallback(
    async (
      exchangeId: string,
      symbol: string,
      direction: 'long' | 'short',
      size: number
    ): Promise<{ exchange: ExchangeState; steps: TradeStep[] }> => {
      const exchange = getExchangeById(exchangeId)
      if (!exchange?.tabId) {
        throw new Error(`${exchangeId} page not open`)
      }

      const exchangeConfig = EXCHANGES.find((e) => e.abbreviation === exchangeId)
      if (!exchangeConfig?.tradeSimulator?.getSteps) {
        throw new Error(`${exchangeId} tradeSimulator not configured`)
      }

      const currentSymbol = exchange.currentSymbol
      const skipSymbolSelection =
        currentSymbol?.toUpperCase() === symbol.toUpperCase()

      const tradeState = await getTradeState(exchange.tabId, exchangeId)
      const skipDirectionAndSize =
        skipSymbolSelection &&
        tradeState.direction === direction &&
        tradeState.size === String(size)

      const steps = exchangeConfig.tradeSimulator.getSteps(symbol, direction, size, {
        skipSymbolSelection,
        skipDirectionAndSize,
      })

      return { exchange, steps }
    },
    [getExchangeById, getTradeState]
  )

  const executeTradeByAPI = useCallback(
    async (
      exchangeId: string,
      symbol: string,
      direction: 'long' | 'short',
      size: number
    ): Promise<unknown> => {
      const side = direction === 'long' ? 'buy' : 'sell'

      if (exchangeId === 'LG') {
        if (!lighterApiRef.current) {
          if (
            !lighterConfig.l1Address ||
            !lighterConfig.apiPrivateKey ||
            !lighterConfig.accountIndex
          ) {
            throw new Error('Please configure Lighter API first')
          }
          const success = await initializeLighterApi()
          if (!success) {
            throw new Error('Lighter API initialization failed')
          }
        }
        return lighterApiRef.current!.createMarketOrder(symbol, side, size)
      }

      if (exchangeId === 'OM') {
        const exchange = getExchangeById(exchangeId)
        if (!exchange?.tabId) {
          throw new Error(`${exchangeId} page not open`)
        }

        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('API trade timeout'))
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
            .sendMessage(exchange.tabId!, {
              type: 'TRADE',
              exchangeId,
              params: {
                underlying: symbol,
                size,
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
      }

      throw new Error(`Unsupported exchange: ${exchangeId}`)
    },
    [lighterConfig, initializeLighterApi, getExchangeById]
  )

  const executeTradeByUI = useCallback(
    async (
      exchangeId: string,
      symbol: string,
      direction: 'long' | 'short',
      size: number
    ): Promise<void> => {
      const { exchange, steps } = await prepareTradeSteps(exchangeId, symbol, direction, size)

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        console.log(`[Arbflow] ${exchangeId} step ${i + 1}/${steps.length}: ${step.description}`)
        const result = await executeTradeStep(exchange.tabId!, step)
        if (!result.success) {
          throw new Error(result.error)
        }
      }
    },
    [prepareTradeSteps, executeTradeStep]
  )

  const executeArbitrage = useCallback(
    async (symbol: string, direction: '1to2' | '2to1', size: number): Promise<void> => {
      const symbolData = symbolStates.find((s) => s.symbol === symbol)
      const stats = symbolData?.exchangeMarketStats || []
      if (stats.length < 2) {
        throw new Error('Need data from two exchanges')
      }

      const sortedStats = [...stats].sort((a, b) => a.exchangeId.localeCompare(b.exchangeId))
      const platform1Id = sortedStats[0].exchangeId
      const platform2Id = sortedStats[1].exchangeId

      let platform1Direction: 'long' | 'short'
      let platform2Direction: 'long' | 'short'

      if (direction === '2to1') {
        platform1Direction = 'short'
        platform2Direction = 'long'
      } else {
        platform1Direction = 'long'
        platform2Direction = 'short'
      }

      const platform1Config = EXCHANGES.find((e) => e.abbreviation === platform1Id)
      const platform2Config = EXCHANGES.find((e) => e.abbreviation === platform2Id)

      const platform1Executor = platform1Config?.tradeExecutor || 'simulate'
      const platform2Executor = platform2Config?.tradeExecutor || 'simulate'

      console.log(
        `[Arbflow] Executing arbitrage: ${symbol} ${size}`,
        `${platform1Id}(${platform1Executor})=${platform1Direction}`,
        `${platform2Id}(${platform2Executor})=${platform2Direction}`
      )

      const simulatePlatformId =
        platform1Executor === 'simulate'
          ? platform1Id
          : platform2Executor === 'simulate'
            ? platform2Id
            : null

      if (simulatePlatformId) {
        const simulateExchange = getExchangeById(simulatePlatformId)
        if (simulateExchange?.tabId) {
          await chrome.tabs.update(simulateExchange.tabId, { active: true })
          await new Promise((r) => setTimeout(r, 200))
        }
      }

      const executeOne = async (platformId: string, platformDirection: 'long' | 'short', executor: string) => {
        if (executor === 'api') {
          return executeTradeByAPI(platformId, symbol, platformDirection, size)
        } else {
          return executeTradeByUI(platformId, symbol, platformDirection, size)
        }
      }

      await Promise.all([
        executeOne(platform1Id, platform1Direction, platform1Executor),
        executeOne(platform2Id, platform2Direction, platform2Executor),
      ])

      console.log('[Arbflow] Arbitrage completed')
    },
    [symbolStates, getExchangeById, executeTradeByAPI, executeTradeByUI]
  )

  return {
    executeApiTrade: executeTradeByAPI,
    executeSimulateTrade: executeTradeByUI,
    executeArbitrage,
    initializeLighterApi,
    fetchLighterAccountIndex,
  }
}

