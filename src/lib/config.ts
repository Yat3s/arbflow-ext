import { ALL_SYMBOLS_DATA } from './symbols'
import type { ExchangeConfig, LighterConfig, OmniConfig, SymbolData } from './types'

export const LIGHTER_WS_URL =
  'wss://mainnet.zklighter.elliot.ai/stream?encoding=msgpack&readonly=true'
export const LIGHTER_BASE_URL = 'https://mainnet.zklighter.elliot.ai'
export const OMNI_WS_URL = 'wss://ws.geek4.fun/ws'

export const EXCHANGES: ExchangeConfig[] = [
  {
    id: 'lighter',
    name: 'Lighter',
    abbreviation: 'LG',
    color: '#6366f1',
    hostUrl: 'https://app.lighter.xyz',
    orderBookConfig: {
      url: LIGHTER_WS_URL,
      pingInterval: 3000,
      sendRequestPerSymbol: true,
      getSubscribeMessages: (symbol: SymbolData | SymbolData[]) => {
        const s = Array.isArray(symbol) ? symbol[0] : symbol
        return [{ type: 'subscribe', channel: `public_market_data/${s.lighterMarketId}` }]
      },
    },
    tradeExecutor: 'api',
    tradeSimulator: {
      getSteps: (symbol, direction, size, options = {}) => {
        const steps = []
        if (!options.skipSymbolSelection) {
          steps.push(
            {
              type: 'click' as const,
              selector: '[data-tourid="marketSelector"]',
              description: 'Open market selector',
              waitAfter: 300,
            },
            {
              type: 'click' as const,
              selector: `[data-testid="market-selector-table-cell-${symbol}"]`,
              description: `Select ${symbol} market`,
              waitAfter: 300,
            }
          )
        }
        if (!options.skipDirectionAndSize) {
          steps.push(
            {
              type: 'click' as const,
              selector:
                direction === 'long'
                  ? '.relative.flex.h-8 button:first-child'
                  : '.relative.flex.h-8 button:nth-child(2)',
              description: `Select ${direction === 'long' ? 'Buy/Long' : 'Sell/Short'} direction`,
              waitAfter: 200,
            },
            {
              type: 'clear_and_type' as const,
              selector: '[data-testid="place-order-size-input"]',
              value: String(size),
              description: `Input size: ${size}`,
              waitAfter: 100,
            }
          )
        }
        steps.push({
          type: 'click' as const,
          selector: '[data-testid="place-order-button"]',
          description: 'Place market order',
          waitAfter: 100,
        })
        return steps
      },
    },
  },
  {
    id: 'omni',
    name: 'Omni',
    abbreviation: 'OM',
    color: '#f59e0b',
    hostUrl: 'https://omni.variational.io',
    orderBookConfig: {
      url: OMNI_WS_URL,
      pingInterval: 30000,
      sendRequestPerSymbol: false,
      getSubscribeMessages: (symbols: SymbolData | SymbolData[]) => {
        const arr = Array.isArray(symbols) ? symbols : [symbols]
        return [JSON.stringify({ type: 'subscribe', symbols: arr.map((s) => s.symbol) })]
      },
    },
    tradeExecutor: 'api',
    tradeSimulator: {
      getSteps: (symbol, direction, size, options = {}) => {
        const steps = []
        if (!options.skipSymbolSelection) {
          steps.push(
            {
              type: 'click' as const,
              selector: '[data-testid="asset-summary-token-selector"]',
              description: 'Open token selector',
              waitAfter: 300,
            },
            {
              type: 'click' as const,
              selector: `a[href="/perpetual/${symbol}"] [data-testid="token-selector-table-row"]`,
              description: `Select ${symbol} market`,
              waitAfter: 500,
            }
          )
        }
        if (!options.skipDirectionAndSize) {
          steps.push(
            {
              type: 'click' as const,
              selector:
                direction === 'long'
                  ? 'span[role="switch"] button:first-child'
                  : 'span[role="switch"] button:nth-child(2)',
              description: `Select ${direction === 'long' ? 'Buy' : 'Sell'} direction`,
              waitAfter: 200,
            },
            {
              type: 'clear_and_type' as const,
              selector: '[data-testid="quantity-input"]',
              value: String(size),
              description: `Input size: ${size}`,
              waitAfter: 700,
            }
          )
        }
        steps.push({
          type: 'click' as const,
          selector: '[data-testid="submit-button"]',
          description: 'Submit order',
          waitAfter: 100,
        })
        return steps
      },
    },
  },
]

export function getExchangeByAbbr(abbr: string): ExchangeConfig | undefined {
  return EXCHANGES.find((ex) => ex.abbreviation === abbr)
}

export function getExchangeById(id: string): ExchangeConfig | undefined {
  return EXCHANGES.find((ex) => ex.id === id || ex.abbreviation === id)
}

export const DEFAULT_LIGHTER_CONFIG: LighterConfig = {
  l1Address: '',
  apiPrivateKey: '',
  apiKeyIndex: 4,
  accountType: 'main',
  accountIndex: null,
}

export const DEFAULT_OMNI_CONFIG: OmniConfig = {
  apiKey: '',
  apiSecret: '',
}

export { ALL_SYMBOLS_DATA }

