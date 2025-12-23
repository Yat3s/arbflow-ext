import { ALL_SYMBOLS_DATA } from "/src/lib/symbols.ts.js";
export const LIGHTER_WS_URL = "wss://mainnet.zklighter.elliot.ai/stream?encoding=msgpack&readonly=true";
export const LIGHTER_BASE_URL = "https://mainnet.zklighter.elliot.ai";
export const OMNI_WS_URL = "wss://ws.geek4.fun/ws";
export const EXCHANGES = [
  {
    id: "lighter",
    name: "Lighter",
    abbreviation: "LG",
    color: "#6366f1",
    hostUrl: "https://app.lighter.xyz",
    positionUpdater: { source: "websocket" },
    orderBookConfig: {
      url: LIGHTER_WS_URL,
      pingInterval: 3e3,
      sendRequestPerSymbol: true,
      getSubscribeMessages: (symbol) => {
        const s = Array.isArray(symbol) ? symbol[0] : symbol;
        return [{ type: "subscribe", channel: `public_market_data/${s.lighterMarketId}` }];
      }
    },
    tradeExecutor: "api",
    tradeSimulator: {
      getSteps: (symbol, direction, size, options = {}) => {
        const steps = [];
        if (!options.skipSymbolSelection) {
          steps.push(
            {
              type: "click",
              selector: '[data-tourid="marketSelector"]',
              description: "Open market selector",
              waitAfter: 300
            },
            {
              type: "click",
              selector: `[data-testid="market-selector-table-cell-${symbol}"]`,
              description: `Select ${symbol} market`,
              waitAfter: 300
            }
          );
        }
        if (!options.skipDirectionAndSize) {
          steps.push(
            {
              type: "click",
              selector: direction === "long" ? ".relative.flex.h-8 button:first-child" : ".relative.flex.h-8 button:nth-child(2)",
              description: `Select ${direction === "long" ? "Buy/Long" : "Sell/Short"} direction`,
              waitAfter: 200
            },
            {
              type: "clear_and_type",
              selector: '[data-testid="place-order-size-input"]',
              value: String(size),
              description: `Input size: ${size}`,
              waitAfter: 100
            }
          );
        }
        steps.push({
          type: "click",
          selector: '[data-testid="place-order-button"]',
          description: "Place market order",
          waitAfter: 100
        });
        return steps;
      }
    }
  },
  {
    id: "omni",
    name: "Omni",
    abbreviation: "OM",
    color: "#f59e0b",
    hostUrl: "https://omni.variational.io",
    positionUpdater: {
      source: "ui",
      uiParser: {
        tableSelector: "svelte-virtual-list-contents",
        rowSelector: 'div[data-testid="positions-table-row"]'
      }
    },
    orderBookConfig: {
      url: OMNI_WS_URL,
      pingInterval: 3e4,
      sendRequestPerSymbol: false,
      getSubscribeMessages: (symbols) => {
        const arr = Array.isArray(symbols) ? symbols : [symbols];
        return [JSON.stringify({ type: "subscribe", symbols: arr.map((s) => s.symbol) })];
      }
    },
    tradeExecutor: "api",
    tradeSimulator: {
      getSteps: (symbol, direction, size, options = {}) => {
        const steps = [];
        if (!options.skipSymbolSelection) {
          steps.push(
            {
              type: "click",
              selector: '[data-testid="asset-summary-token-selector"]',
              description: "Open token selector",
              waitAfter: 300
            },
            {
              type: "click",
              selector: `a[href="/perpetual/${symbol}"] [data-testid="token-selector-table-row"]`,
              description: `Select ${symbol} market`,
              waitAfter: 500
            }
          );
        }
        if (!options.skipDirectionAndSize) {
          steps.push(
            {
              type: "click",
              selector: direction === "long" ? 'span[role="switch"] button:first-child' : 'span[role="switch"] button:nth-child(2)',
              description: `Select ${direction === "long" ? "Buy" : "Sell"} direction`,
              waitAfter: 200
            },
            {
              type: "clear_and_type",
              selector: '[data-testid="quantity-input"]',
              value: String(size),
              description: `Input size: ${size}`,
              waitAfter: 700
            }
          );
        }
        steps.push({
          type: "click",
          selector: '[data-testid="submit-button"]',
          description: "Submit order",
          waitAfter: 100
        });
        return steps;
      }
    }
  }
];
export function getExchangeByAbbr(abbr) {
  return EXCHANGES.find((ex) => ex.abbreviation === abbr);
}
export function getExchangeById(id) {
  return EXCHANGES.find((ex) => ex.id === id || ex.abbreviation === id);
}
export const DEFAULT_LIGHTER_CONFIG = {
  l1Address: "",
  apiPrivateKey: "",
  apiKeyIndex: 4,
  accountType: "main",
  accountIndex: null
};
export const DEFAULT_OMNI_CONFIG = {
  apiKey: "",
  apiSecret: ""
};
export { ALL_SYMBOLS_DATA };
