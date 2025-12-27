import type { MarketInfo, TradeOrder } from './types'

export const LIGHTER_BASE_URL = 'https://mainnet.zklighter.elliot.ai'
export const LIGHTER_WS_URL = 'wss://mainnet.zklighter.elliot.ai/stream'

export const LIGHTER_CONSTANTS = {
  ORDER_TYPE_LIMIT: 0,
  ORDER_TYPE_MARKET: 1,
  ORDER_TIME_IN_FORCE_IMMEDIATE_OR_CANCEL: 0,
  ORDER_TIME_IN_FORCE_GOOD_TILL_TIME: 1,
  ORDER_TIME_IN_FORCE_POST_ONLY: 2,
  NIL_TRIGGER_PRICE: 0,
  DEFAULT_28_DAY_ORDER_EXPIRY: -1,
  DEFAULT_IOC_EXPIRY: 0,
}

export const LIGHTER_MARKETS: Record<string, MarketInfo> = {
  ETH: { id: 0, sizeDecimals: 4, priceDecimals: 2 },
  BTC: { id: 1, sizeDecimals: 5, priceDecimals: 1 },
  SOL: { id: 2, sizeDecimals: 3, priceDecimals: 3 },
  DOGE: { id: 3, sizeDecimals: 0, priceDecimals: 6 },
  '1000PEPE': { id: 4, sizeDecimals: 0, priceDecimals: 6 },
  WIF: { id: 5, sizeDecimals: 1, priceDecimals: 5 },
  WLD: { id: 6, sizeDecimals: 1, priceDecimals: 5 },
  XRP: { id: 7, sizeDecimals: 0, priceDecimals: 6 },
  LINK: { id: 8, sizeDecimals: 1, priceDecimals: 5 },
  AVAX: { id: 9, sizeDecimals: 2, priceDecimals: 4 },
  NEAR: { id: 10, sizeDecimals: 1, priceDecimals: 5 },
  DOT: { id: 11, sizeDecimals: 1, priceDecimals: 5 },
  TON: { id: 12, sizeDecimals: 1, priceDecimals: 5 },
  TAO: { id: 13, sizeDecimals: 3, priceDecimals: 3 },
  POL: { id: 14, sizeDecimals: 0, priceDecimals: 6 },
  TRUMP: { id: 15, sizeDecimals: 2, priceDecimals: 4 },
  SUI: { id: 16, sizeDecimals: 1, priceDecimals: 5 },
  '1000SHIB': { id: 17, sizeDecimals: 0, priceDecimals: 6 },
  '1000BONK': { id: 18, sizeDecimals: 0, priceDecimals: 6 },
  '1000FLOKI': { id: 19, sizeDecimals: 0, priceDecimals: 6 },
  BERA: { id: 20, sizeDecimals: 1, priceDecimals: 5 },
  FARTCOIN: { id: 21, sizeDecimals: 1, priceDecimals: 5 },
  AI16Z: { id: 22, sizeDecimals: 1, priceDecimals: 5 },
  POPCAT: { id: 23, sizeDecimals: 1, priceDecimals: 5 },
  HYPE: { id: 24, sizeDecimals: 2, priceDecimals: 4 },
  BNB: { id: 25, sizeDecimals: 2, priceDecimals: 4 },
  JUP: { id: 26, sizeDecimals: 1, priceDecimals: 5 },
  AAVE: { id: 27, sizeDecimals: 3, priceDecimals: 3 },
  MKR: { id: 28, sizeDecimals: 4, priceDecimals: 2 },
  ENA: { id: 29, sizeDecimals: 1, priceDecimals: 5 },
  UNI: { id: 30, sizeDecimals: 2, priceDecimals: 4 },
  APT: { id: 31, sizeDecimals: 2, priceDecimals: 4 },
  SEI: { id: 32, sizeDecimals: 1, priceDecimals: 5 },
  KAITO: { id: 33, sizeDecimals: 1, priceDecimals: 5 },
  IP: { id: 34, sizeDecimals: 2, priceDecimals: 4 },
  LTC: { id: 35, sizeDecimals: 3, priceDecimals: 3 },
  CRV: { id: 36, sizeDecimals: 1, priceDecimals: 5 },
  PENDLE: { id: 37, sizeDecimals: 2, priceDecimals: 4 },
  ONDO: { id: 38, sizeDecimals: 1, priceDecimals: 5 },
  ADA: { id: 39, sizeDecimals: 1, priceDecimals: 5 },
  S: { id: 40, sizeDecimals: 1, priceDecimals: 5 },
  VIRTUAL: { id: 41, sizeDecimals: 1, priceDecimals: 5 },
  SPX: { id: 42, sizeDecimals: 1, priceDecimals: 5 },
  TRX: { id: 43, sizeDecimals: 1, priceDecimals: 5 },
  ARB: { id: 50, sizeDecimals: 1, priceDecimals: 5 },
  OP: { id: 55, sizeDecimals: 1, priceDecimals: 5 },
  BCH: { id: 58, sizeDecimals: 3, priceDecimals: 3 },
  HBAR: { id: 59, sizeDecimals: 1, priceDecimals: 5 },
  TIA: { id: 67, sizeDecimals: 1, priceDecimals: 5 },
  XMR: { id: 77, sizeDecimals: 3, priceDecimals: 3 },
  PYTH: { id: 78, sizeDecimals: 1, priceDecimals: 5 },
  ZEC: { id: 90, sizeDecimals: 3, priceDecimals: 3 },
  XAU: { id: 92, sizeDecimals: 4, priceDecimals: 2 },
  XAG: { id: 93, sizeDecimals: 2, priceDecimals: 4 },
  ICP: { id: 102, sizeDecimals: 2, priceDecimals: 4 },
  FIL: { id: 103, sizeDecimals: 1, priceDecimals: 5 },
  STRK: { id: 104, sizeDecimals: 1, priceDecimals: 5 },
  NVDA: { id: 110, sizeDecimals: 3, priceDecimals: 3 },
  TSLA: { id: 112, sizeDecimals: 4, priceDecimals: 2 },
  AAPL: { id: 113, sizeDecimals: 3, priceDecimals: 3 },
  AMZN: { id: 114, sizeDecimals: 3, priceDecimals: 3 },
  MSFT: { id: 115, sizeDecimals: 4, priceDecimals: 2 },
  GOOGL: { id: 116, sizeDecimals: 4, priceDecimals: 2 },
  META: { id: 117, sizeDecimals: 4, priceDecimals: 2 },
}

declare global {
  interface Window {
    Go: new () => {
      run: (instance: WebAssembly.Instance) => void
      importObject: WebAssembly.Imports
    }
    CreateClient: (
      url: string,
      privateKey: string,
      chainId: number,
      apiKeyIndex: number,
      accountIndex: number
    ) => { err?: string; error?: string; Error?: string; message?: string } | string | null
    SignCreateOrder: (
      marketIndex: number,
      clientOrderIndex: number,
      baseAmount: number,
      price: number,
      isAsk: number,
      orderType: number,
      timeInForce: number,
      reduceOnly: number,
      triggerPrice: number,
      orderExpiry: number,
      nonce: number,
      apiKeyIndex: number,
      accountIndex: number
    ) => { txType?: number; txInfo?: string; txHash?: string; err?: string; error?: string }
    SignCancelOrder: (
      marketIndex: number,
      orderIndex: number,
      nonce: number,
      apiKeyIndex: number,
      accountIndex: number
    ) => { txType: number; txInfo: string; txHash: string; err?: string }
    CreateAuthToken: (
      deadline: number,
      apiKeyIndex: number,
      accountIndex: number
    ) => { str?: string; err?: string }
  }
}

let globalWasmInitialized = false
let globalWasmInitPromise: Promise<void> | null = null

function loadWasmExecScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.Go !== 'undefined') {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = chrome.runtime.getURL('wasm_exec.js')
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load wasm_exec.js'))
    document.head.appendChild(script)
  })
}

async function initializeGlobalWasm(): Promise<void> {
  if (globalWasmInitialized) return
  if (globalWasmInitPromise) return globalWasmInitPromise

  globalWasmInitPromise = (async () => {
    await loadWasmExecScript()

    if (typeof window.Go === 'undefined') {
      throw new Error('wasm_exec.js loaded but Go is not defined')
    }

    const go = new window.Go()
    const wasmUrl = chrome.runtime.getURL('lighter-signer.wasm')
    const response = await fetch(wasmUrl)
    const wasmBytes = await response.arrayBuffer()
    const result = await WebAssembly.instantiate(wasmBytes, go.importObject)

    go.run(result.instance)
    await new Promise((resolve) => setTimeout(resolve, 200))

    const availableFunctions = [
      'CreateClient',
      'SignCreateOrder',
      'SignCancelOrder',
      'SignCancelAllOrders',
      'GenerateAPIKey',
      'CreateAuthToken',
    ].filter((fn) => typeof (window as unknown as Record<string, unknown>)[fn] === 'function')

    console.log('[LighterAPI] Available WASM functions:', availableFunctions)

    if (availableFunctions.length === 0) {
      throw new Error('No WASM functions registered after initialization')
    }

    globalWasmInitialized = true
    console.log('[LighterAPI] WASM signer initialized (global)')
  })()

  return globalWasmInitPromise
}

interface SignerConfig {
  url: string
  privateKey: string
  accountIndex: number
  apiKeyIndex: number
}

interface SignOrderParams {
  marketIndex: number
  clientOrderIndex: number
  baseAmount: number
  price: number
  isAsk: boolean
  orderType: number
  timeInForce: number
  reduceOnly?: boolean
  triggerPrice?: number
  orderExpiry?: number
  nonce: number
  apiKeyIndex: number
  accountIndex: number
}

class LighterWasmSigner {
  private clientCreated = false
  private config: SignerConfig | null = null

  async initialize(): Promise<void> {
    await initializeGlobalWasm()
  }

  async createClient(config: SignerConfig): Promise<void> {
    await this.initialize()

    const { url, privateKey, accountIndex, apiKeyIndex } = config
    const chainId = url.includes('mainnet') ? 304 : 300

    if (typeof window.CreateClient !== 'function') {
      throw new Error('WASM CreateClient function not available')
    }

    console.log('[LighterAPI] Creating client with:', { url, chainId, apiKeyIndex, accountIndex })
    const result = window.CreateClient(url, privateKey, chainId, apiKeyIndex, accountIndex)
    console.log('[LighterAPI] CreateClient result:', JSON.stringify(result), typeof result)

    if (result) {
      if (typeof result === 'object') {
        const errorMsg = result.err || result.error || result.Error || result.message
        if (errorMsg) {
          throw new Error(`Failed to create client: ${errorMsg}`)
        }
      } else if (typeof result === 'string' && result !== '') {
        throw new Error(`Failed to create client: ${result}`)
      }
    }

    this.clientCreated = true
    this.config = config
    console.log('[LighterAPI] Client created for account:', accountIndex)
  }

  signCreateOrder(params: SignOrderParams): { txType: number; txInfo: string; txHash: string } {
    if (!this.clientCreated) {
      throw new Error('Client not created. Call createClient first.')
    }

    if (typeof window.SignCreateOrder !== 'function') {
      throw new Error('WASM SignCreateOrder function not available')
    }

    const {
      marketIndex,
      clientOrderIndex,
      baseAmount,
      price,
      isAsk,
      orderType,
      timeInForce,
      reduceOnly = false,
      triggerPrice = 0,
      orderExpiry = -1,
      nonce,
      apiKeyIndex,
      accountIndex,
    } = params

    const wasmArgs = [
      marketIndex,
      clientOrderIndex,
      baseAmount,
      price,
      isAsk ? 1 : 0,
      orderType,
      timeInForce,
      reduceOnly ? 1 : 0,
      triggerPrice,
      orderExpiry,
      nonce,
      apiKeyIndex,
      accountIndex,
    ] as const

    console.log(
      '[LighterAPI] SignCreateOrder args:',
      wasmArgs.map((v, i) => `${i}: ${v} (${typeof v})`)
    )

    const result = window.SignCreateOrder(...wasmArgs)
    console.log('[LighterAPI] SignCreateOrder raw result:', JSON.stringify(result))

    if (result.err || result.error) {
      throw new Error(result.err || result.error)
    }

    return {
      txType: result.txType ?? 14,
      txInfo: result.txInfo ?? '',
      txHash: result.txHash ?? '',
    }
  }

  signCancelOrder(params: {
    marketIndex: number
    orderIndex: number
    nonce: number
    apiKeyIndex: number
    accountIndex: number
  }): { txType: number; txInfo: string; txHash: string } {
    if (!this.clientCreated) {
      throw new Error('Client not created. Call createClient first.')
    }

    if (typeof window.SignCancelOrder !== 'function') {
      throw new Error('WASM SignCancelOrder function not available')
    }

    const { marketIndex, orderIndex, nonce, apiKeyIndex, accountIndex } = params
    const result = window.SignCancelOrder(marketIndex, orderIndex, nonce, apiKeyIndex, accountIndex)

    if (result.err) {
      throw new Error(result.err)
    }

    return {
      txType: result.txType,
      txInfo: result.txInfo,
      txHash: result.txHash,
    }
  }

  createAuthToken(deadline: number, apiKeyIndex: number, accountIndex: number): string {
    if (typeof window.CreateAuthToken !== 'function') {
      throw new Error('WASM CreateAuthToken function not available')
    }

    const result = window.CreateAuthToken(deadline, apiKeyIndex, accountIndex)
    if (result.err) {
      throw new Error(result.err)
    }
    return result.str || ''
  }
}

interface LighterAPIConfig {
  l1Address: string
  apiPrivateKey: string
  apiKeyIndex: number
  accountIndex?: number | null
}

export class LighterAPI {
  private signer = new LighterWasmSigner()
  private config: LighterAPIConfig | null = null
  private accountIndex: number | null = null
  private marketsCache: Record<string, MarketInfo> | null = null
  private cachedNonce: number | null = null
  private lastNonceTime = 0

  async initialize(config: LighterAPIConfig): Promise<number> {
    this.config = config

    if (config.accountIndex === null || config.accountIndex === undefined) {
      this.accountIndex = await this.getAccountIndexByL1Address(config.l1Address)
    } else {
      this.accountIndex = config.accountIndex
    }

    await this.signer.initialize()
    await this.signer.createClient({
      url: LIGHTER_BASE_URL,
      privateKey: config.apiPrivateKey,
      accountIndex: this.accountIndex,
      apiKeyIndex: config.apiKeyIndex,
    })

    return this.accountIndex
  }

  async getAccountIndexByL1Address(l1Address: string): Promise<number> {
    const response = await fetch(
      `${LIGHTER_BASE_URL}/api/v1/accountsByL1Address?l1_address=${l1Address}`
    )
    const data = await response.json()

    if (data.code !== 200) {
      throw new Error(`API error: ${data.message || 'Unknown error'}`)
    }

    const accounts = data.sub_accounts || data.accounts || []
    if (accounts.length === 0) {
      throw new Error(`No account found for wallet: ${l1Address}`)
    }

    const mainAccount = accounts.find((a: { account_type: number }) => a.account_type === 0) || accounts[0]
    return mainAccount.index || mainAccount.account_index
  }

  async getMarkets(): Promise<Record<string, MarketInfo>> {
    if (this.marketsCache) return this.marketsCache

    const response = await fetch(`${LIGHTER_BASE_URL}/api/v1/orderBooks`)
    const data = await response.json()

    this.marketsCache = {}
    for (const ob of data.order_books || []) {
      this.marketsCache[ob.symbol] = {
        id: ob.market_id,
        sizeDecimals: ob.supported_size_decimals,
        priceDecimals: ob.supported_price_decimals,
        minBaseAmount: ob.min_base_amount,
      }
    }
    return this.marketsCache
  }

  async getOrderbook(symbol: string): Promise<unknown> {
    const markets = await this.getMarkets()
    const market = markets[symbol.toUpperCase()]
    if (!market) throw new Error(`Unknown symbol: ${symbol}`)

    const response = await fetch(
      `${LIGHTER_BASE_URL}/api/v1/orderBookOrders?market_id=${market.id}&limit=10`
    )
    return response.json()
  }

  async getNextNonce(forceRefresh = false): Promise<number> {
    const now = Date.now()
    if (!forceRefresh && this.cachedNonce !== null && now - this.lastNonceTime < 30000) {
      return this.cachedNonce
    }

    const response = await fetch(
      `${LIGHTER_BASE_URL}/api/v1/nextNonce?account_index=${this.accountIndex}&api_key_index=${this.config?.apiKeyIndex}`
    )
    const data = await response.json()
    this.cachedNonce = data.nonce
    this.lastNonceTime = now
    return data.nonce
  }

  incrementNonce(): void {
    if (this.cachedNonce !== null) {
      this.cachedNonce++
    }
  }

  async getAccountInfo(): Promise<unknown> {
    const response = await fetch(
      `${LIGHTER_BASE_URL}/api/v1/account?by=index&value=${this.accountIndex}`
    )
    const data = await response.json()
    return data.accounts?.[0] || data
  }

  async sendTransaction(txType: number, txInfo: string): Promise<{ code: number; tx_hash?: string; message?: string }> {
    console.log('[LighterAPI] Sending tx:', { txType, txInfoLength: txInfo?.length })
    const response = await fetch(`${LIGHTER_BASE_URL}/api/v1/sendTx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `tx_type=${txType}&tx_info=${encodeURIComponent(txInfo)}`,
    })
    const result = await response.json()
    console.log('[LighterAPI] SendTx response:', JSON.stringify(result))
    return result
  }

  async waitForTransaction(
    txHash: string,
    maxWaitMs = 10000,
    pollIntervalMs = 200
  ): Promise<{ status: number; block_height?: number }> {
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const response = await fetch(`${LIGHTER_BASE_URL}/api/v1/tx?by=hash&value=${txHash}`)
        const data = await response.json()

        if (data.code === 200 && data.txs?.length > 0) {
          const tx = data.txs[0]
          if (tx.status >= 2) {
            return tx
          }
        }
      } catch (e) {
        console.log('[LighterAPI] Poll error:', (e as Error).message)
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }

    throw new Error('Transaction timeout')
  }

  async createMarketOrder(
    symbol: string,
    side: 'buy' | 'sell',
    size: number,
    options: { fast?: boolean } = {}
  ): Promise<{ success: boolean; txHash: string; status: string; blockHeight: number | null }> {
    const t0 = performance.now()
    const { fast = true } = options

    const market = LIGHTER_MARKETS[symbol.toUpperCase()]
    if (!market) throw new Error(`Unknown symbol: ${symbol}`)

    const isAsk = side.toLowerCase() === 'sell'
    const baseAmount = Math.floor(size * Math.pow(10, market.sizeDecimals))

    let price: number
    let nonce: number
    let t1: number

    if (fast) {
      nonce = await this.getNextNonce()
      t1 = performance.now()
      console.log(`[LighterAPI] getNonce: ${(t1 - t0).toFixed(0)}ms`)
      price = isAsk ? 1 : Math.pow(10, market.priceDecimals + 7)
      console.log(`[LighterAPI] Fast ${side} order: ${size} ${symbol}`)
    } else {
      const [orderbook, fetchedNonce] = await Promise.all([this.getOrderbook(symbol), this.getNextNonce()])
      nonce = fetchedNonce
      t1 = performance.now()
      console.log(`[LighterAPI] getOrderbook + getNonce: ${(t1 - t0).toFixed(0)}ms`)

      const ob = orderbook as { bids?: { price: string }[]; asks?: { price: string }[] }
      const bestPrice = isAsk ? ob.bids?.[0]?.price : ob.asks?.[0]?.price
      if (!bestPrice) throw new Error(`No ${isAsk ? 'bids' : 'asks'} in orderbook`)

      const priceFloat = parseFloat(bestPrice)
      const slippageMultiplier = isAsk ? 0.995 : 1.005
      price = Math.floor(priceFloat * slippageMultiplier * Math.pow(10, market.priceDecimals))
      console.log(`[LighterAPI] Creating ${side} order: ${size} ${symbol} @ ~$${priceFloat}`)
    }

    const signed = this.signer.signCreateOrder({
      marketIndex: market.id,
      clientOrderIndex: Date.now(),
      baseAmount,
      price,
      isAsk,
      orderType: LIGHTER_CONSTANTS.ORDER_TYPE_MARKET,
      timeInForce: LIGHTER_CONSTANTS.ORDER_TIME_IN_FORCE_IMMEDIATE_OR_CANCEL,
      reduceOnly: false,
      triggerPrice: LIGHTER_CONSTANTS.NIL_TRIGGER_PRICE,
      orderExpiry: LIGHTER_CONSTANTS.DEFAULT_IOC_EXPIRY,
      nonce,
      apiKeyIndex: this.config!.apiKeyIndex,
      accountIndex: this.accountIndex!,
    })
    const t2 = performance.now()
    console.log(`[LighterAPI] signOrder: ${(t2 - t1).toFixed(0)}ms`)

    const result = await this.sendTransaction(signed.txType, signed.txInfo)
    const t3 = performance.now()
    console.log(`[LighterAPI] sendTransaction: ${(t3 - t2).toFixed(0)}ms`)
    console.log(`[LighterAPI] Total: ${(t3 - t0).toFixed(0)}ms`)

    if (result.code !== 200) {
      throw new Error(result.message || 'Transaction failed')
    }

    this.incrementNonce()

    return {
      success: true,
      txHash: result.tx_hash || 'submitted',
      status: 'submitted',
      blockHeight: null,
    }
  }

  async createLimitOrder(
    symbol: string,
    side: 'buy' | 'sell',
    size: number,
    price: number
  ): Promise<{ success: boolean; txHash: string; status: number; blockHeight?: number }> {
    const markets = await this.getMarkets()
    const market = markets[symbol.toUpperCase()]
    if (!market) throw new Error(`Unknown symbol: ${symbol}`)

    const isAsk = side.toLowerCase() === 'sell'
    const priceInt = Math.floor(price * Math.pow(10, market.priceDecimals))
    const baseAmount = Math.floor(size * Math.pow(10, market.sizeDecimals))
    const nonce = await this.getNextNonce()

    console.log(`[LighterAPI] Creating limit ${side} order: ${size} ${symbol} @ $${price}`)

    const signed = this.signer.signCreateOrder({
      marketIndex: market.id,
      clientOrderIndex: Date.now(),
      baseAmount,
      price: priceInt,
      isAsk,
      orderType: LIGHTER_CONSTANTS.ORDER_TYPE_LIMIT,
      timeInForce: LIGHTER_CONSTANTS.ORDER_TIME_IN_FORCE_GOOD_TILL_TIME,
      reduceOnly: false,
      triggerPrice: LIGHTER_CONSTANTS.NIL_TRIGGER_PRICE,
      orderExpiry: LIGHTER_CONSTANTS.DEFAULT_28_DAY_ORDER_EXPIRY,
      nonce,
      apiKeyIndex: this.config!.apiKeyIndex,
      accountIndex: this.accountIndex!,
    })

    const result = await this.sendTransaction(signed.txType, signed.txInfo)

    if (result.code !== 200) {
      throw new Error(result.message || 'Transaction failed')
    }

    const tx = await this.waitForTransaction(result.tx_hash!)

    return {
      success: true,
      txHash: result.tx_hash!,
      status: tx.status,
      blockHeight: tx.block_height,
    }
  }
}

export async function fetchLighterAccountIndex(
  l1Address: string,
  accountType: 'main' | 'sub' = 'main'
): Promise<number> {
  const response = await fetch(
    `${LIGHTER_BASE_URL}/api/v1/accountsByL1Address?l1_address=${l1Address}`
  )
  const data = await response.json()

  if (data.code !== 200) {
    throw new Error(data.message || 'API error')
  }

  const accounts = data.sub_accounts || data.accounts || []
  if (accounts.length === 0) {
    throw new Error('No accounts found for wallet')
  }

  console.log('[Lighter] Account list:')
  accounts.forEach((acc: { account_type: number; index?: number; account_index?: number }, i: number) => {
    const type = acc.account_type === 0 ? 'Main' : 'Sub'
    const idx = acc.index ?? acc.account_index
    console.log(`  ${i + 1}. ${type} - Account Index: ${idx}`)
  })

  if (accountType === 'sub') {
    const subAccount = accounts.find((a: { account_type: number }) => a.account_type !== 0)
    if (!subAccount) {
      throw new Error('No sub-account found')
    }
    return subAccount.index ?? subAccount.account_index
  }

  const mainAccount = accounts.find((a: { account_type: number }) => a.account_type === 0) || accounts[0]
  return mainAccount.index ?? mainAccount.account_index
}

export async function createLighterAuthToken(
  apiPrivateKey: string,
  apiKeyIndex: number,
  accountIndex: number
): Promise<string> {
  await initializeGlobalWasm()

  if (typeof window.CreateClient !== 'function') {
    throw new Error('WASM CreateClient not available')
  }

  const chainId = 304
  const result = window.CreateClient(LIGHTER_BASE_URL, apiPrivateKey, chainId, apiKeyIndex, accountIndex)
  if (result && typeof result === 'object' && (result.err || result.error)) {
    throw new Error(result.err || result.error || 'Failed to create client')
  }

  if (typeof window.CreateAuthToken !== 'function') {
    throw new Error('WASM CreateAuthToken not available')
  }

  const deadline = Math.floor(Date.now() / 1000) + 3600
  const tokenResult = window.CreateAuthToken(deadline, apiKeyIndex, accountIndex) as {
    authToken?: string
    str?: string
    err?: string
  }

  if (tokenResult.err) {
    throw new Error(tokenResult.err)
  }

  const token = tokenResult.authToken || tokenResult.str
  if (!token) {
    throw new Error('CreateAuthToken returned empty token')
  }

  return token
}

export interface LighterOrdersResponse {
  code: number
  next_cursor?: string
  orders: LighterRawOrder[]
}

export interface LighterRawOrder {
  order_id: string
  order_index: number
  client_order_id: string
  market_index: number
  owner_account_index: number
  initial_base_amount: string
  price: string
  is_ask: boolean
  side: string
  type: 'market' | 'limit'
  time_in_force: string
  reduce_only: boolean
  trigger_price: string
  status: string
  filled_base_amount: string
  filled_quote_amount: string
  remaining_base_amount: string
  timestamp: number
  created_at: number
  updated_at: number
  block_height: number
}

function getSymbolByMarketIndex(marketIndex: number): string {
  for (const [symbol, info] of Object.entries(LIGHTER_MARKETS)) {
    if (info.id === marketIndex) return symbol
  }
  return `MARKET_${marketIndex}`
}

function mapLighterOrderStatus(status: string): TradeOrder['status'] {
  switch (status) {
    case 'filled':
      return 'filled'
    case 'cancelled':
    case 'canceled':
      return 'cancelled'
    case 'partial':
    case 'partially_filled':
      return 'partial'
    case 'open':
    case 'pending':
      return 'pending'
    default:
      return 'pending'
  }
}

function parseLighterOrder(order: LighterRawOrder): TradeOrder {
  const symbol = getSymbolByMarketIndex(order.market_index)
  const market = LIGHTER_MARKETS[symbol]
  const priceDecimals = market?.priceDecimals ?? 4
  const sizeDecimals = market?.sizeDecimals ?? 2

  const price = parseFloat(order.filled_quote_amount) / parseFloat(order.filled_base_amount || '1')

  return {
    orderId: order.order_id,
    exchange: 'lighter',
    symbol,
    side: order.is_ask ? 'sell' : 'buy',
    orderType: order.type,
    qty: order.initial_base_amount,
    price: price.toFixed(priceDecimals),
    status: mapLighterOrderStatus(order.status),
    createdAt: order.created_at * 1000,
    executedAt: order.updated_at ? order.updated_at * 1000 : undefined,
    reduceOnly: order.reduce_only,
    filledQty: order.filled_base_amount,
    filledValue: order.filled_quote_amount,
  }
}

export interface FetchLighterOrdersOptions {
  accountIndex: number
  apiPrivateKey: string
  apiKeyIndex: number
  limit?: number
  cursor?: string
  askFilter?: -1 | 0 | 1
  marketId?: number
  startTime?: number
  endTime?: number
  status?: 'filled' | 'cancelled' | 'pending' | 'partial'
}

async function fetchLighterOrdersPage(
  authToken: string,
  accountIndex: number,
  limit: number,
  cursor?: string,
  askFilter: number = -1,
  marketId?: number
): Promise<LighterOrdersResponse | null> {
  const url = new URL(`${LIGHTER_BASE_URL}/api/v1/accountInactiveOrders`)
  url.searchParams.set('account_index', accountIndex.toString())
  url.searchParams.set('ask_filter', askFilter.toString())
  url.searchParams.set('limit', limit.toString())

  if (cursor) {
    url.searchParams.set('cursor', cursor)
  }
  if (marketId !== undefined) {
    url.searchParams.set('market_id', marketId.toString())
  }

  const response = await fetch(url.toString(), {
    headers: { authorization: authToken },
  })
  if (!response.ok) return null

  const data: LighterOrdersResponse = await response.json()
  if (data.code !== 200) return null

  return data
}

export async function fetchLighterOrders(
  options: FetchLighterOrdersOptions
): Promise<{ orders: TradeOrder[]; nextCursor?: string } | null> {
  const {
    accountIndex,
    apiPrivateKey,
    apiKeyIndex,
    limit,
    cursor,
    askFilter = -1,
    marketId,
    startTime,
    endTime,
    status = 'filled',
  } = options

  try {
    const authToken = await createLighterAuthToken(apiPrivateKey, apiKeyIndex, accountIndex)

    if (!startTime && !endTime) {
      const data = await fetchLighterOrdersPage(authToken, accountIndex, limit ?? 20, cursor, askFilter, marketId)
      if (!data) return null

      let orders = data.orders.map(parseLighterOrder)
      if (status) {
        orders = orders.filter((o) => o.status === status)
      }

      return {
        orders,
        nextCursor: data.next_cursor,
      }
    }

    const allOrders: LighterRawOrder[] = []
    let currentCursor: string | undefined = cursor
    let reachedEnd = false
    const maxPages = 100

    for (let page = 0; page < maxPages && !reachedEnd; page++) {
      const data = await fetchLighterOrdersPage(authToken, accountIndex, 100, currentCursor, askFilter, marketId)
      if (!data || data.orders.length === 0) break

      for (const order of data.orders) {
        const orderTime = order.created_at * 1000

        if (endTime && orderTime > endTime) {
          continue
        }

        if (startTime && orderTime < startTime) {
          reachedEnd = true
          break
        }

        allOrders.push(order)
      }

      if (!data.next_cursor) break
      currentCursor = data.next_cursor
    }

    let orders = allOrders.map(parseLighterOrder)
    if (status) {
      orders = orders.filter((o) => o.status === status)
    }

    return {
      orders,
      nextCursor: currentCursor,
    }
  } catch (e) {
    console.error('[Arbflow] Failed to fetch Lighter orders:', e)
    return null
  }
}

