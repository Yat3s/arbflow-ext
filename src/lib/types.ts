export interface SymbolData {
  symbol: string
  lighterMarketId: number
}

export interface MarketInfo {
  id: number
  sizeDecimals: number
  priceDecimals: number
  minBaseAmount?: number
}

export interface OrderBookItem {
  price: number
  quantity: number
}

export interface OrderBook {
  bids: OrderBookItem[]
  asks: OrderBookItem[]
}

export interface MarketStats {
  indexPrice?: number
  markPrice?: number
  fundingRate?: number
}

export interface ParsedMessage {
  type: 'orderBook' | 'marketStats'
  orderBook?: OrderBook
  marketStats?: MarketStats
  channel?: string
  symbol?: string
}

export interface Position {
  symbol: string
  position: number
  side: 'long' | 'short'
  leverage?: string
  avgEntryPrice: number
  markPrice: number
  positionValue: number
  unrealizedPnl: number
  unrealizedPnlPercent: number
  margin?: number
  funding: number
  liquidationPrice: number | null
  exchangeId?: string
  lastUpdated?: number
}

export interface ExchangeState {
  id: string
  name: string
  color: string
  baseUrl: string
  tabId: number | null
  currentUrl: string | null
  currentSymbol: string | null
  wsConnected: boolean
}

export interface SymbolState {
  symbol: string
  positions: Position[]
  exchangeMarketStats: ExchangeMarketStats[]
}

export interface ExchangeMarketStats {
  exchangeId: string
  orderBook: OrderBook
  lastUpdated: number
}

export interface TradeStep {
  type: 'click' | 'type' | 'clear_and_type'
  selector: string
  value?: string
  description?: string
  waitAfter?: number
}

export interface QuotesInfo {
  type: 'websocket' | 'http'
  url: string
  pingInterval?: number
  getSubscribeMessages?: (symbols: SymbolData | SymbolData[]) => unknown[]
}

export interface TradeSimulator {
  getSteps: (
    symbol: string,
    direction: 'long' | 'short',
    size: number,
    options?: { skipSymbolSelection?: boolean; skipDirectionAndSize?: boolean }
  ) => TradeStep[]
}

export interface ExchangeConfig {
  id: string
  name: string
  abbreviation: string
  color: string
  hostUrl: string
  quotesInfo: QuotesInfo
  tradeExecutor: 'api' | 'simulate'
  tradeSimulator: TradeSimulator
}

export interface LighterConfig {
  l1Address: string
  apiPrivateKey: string
  apiKeyIndex: number
  accountType: 'main' | 'sub'
  accountIndex: number | null
}

export interface OmniConfig {
  apiKey: string
  apiSecret: string
}

export interface ExchangeConfigs {
  lighter: LighterConfig
  omni: OmniConfig
}

export type SiteType = 'lighter' | 'omni' | null

export interface ElementInfo {
  exists: boolean
  selector: string
  tagName?: string
  text?: string
  disabled?: boolean
  visible?: boolean
  className?: string
}

export interface ChromeMessage {
  type: string
  target?: string
  tabId?: number
  site?: SiteType
  [key: string]: unknown
}

export interface WsConnection {
  symbol?: string
  symbols?: string[]
  marketId?: number
  connected: boolean
}

export interface PriceDiff {
  platform1Id: string
  platform2Id: string
  platform1Name: string
  platform2Name: string
  platform1Color: string
  platform2Color: string
  spread1to2: number
  spread2to1: number
  platform1Ask: number
  platform2Ask: number
  platform1Bid: number
  platform2Bid: number
}

