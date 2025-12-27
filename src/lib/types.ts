export interface SymbolData {
  symbol: string
  lighterMarketId: number
  icon?: string
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
  enforceOpenTab: boolean
  tabId: number | null
  currentUrl: string | null
  currentSymbol: string | null
  wsConnected: boolean
  accountInfo: AccountInfo | null
}

export interface AccountInfo {
  walletAddress: string
  portfolioValue?: number
  leverage?: number
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

export interface OrderBookConfig {
  url: string
  pingInterval?: number
  sendRequestPerSymbol: boolean // if true, send a request for each symbol separately
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

export interface PositionUiParserConfig {
  tableSelector: string
  rowSelector: string
}

export type PositionUpdaterConfig =
  | { source: 'websocket' }
  | { source: 'ui'; uiParser: PositionUiParserConfig }

export interface ExchangeConfig {
  id: string
  name: string
  abbreviation: string
  color: string
  hostUrl: string
  orderBookConfig: OrderBookConfig
  tradeExecutor: 'api' | 'simulate'
  tradeSimulator: TradeSimulator
  positionUpdater: PositionUpdaterConfig
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

export interface TradeOrder {
  orderId: string
  exchange: SiteType
  symbol: string
  side: 'buy' | 'sell'
  orderType: 'market' | 'limit'
  qty: string
  price: string
  status: 'filled' | 'cleared' | 'cancelled' | 'pending' | 'partial'
  createdAt: number
  executedAt?: number
  reduceOnly: boolean
  filledQty?: string
  filledValue?: string
}

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
  platform1LastUpdated?: number
  platform2LastUpdated?: number
}

