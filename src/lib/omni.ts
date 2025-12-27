import type { Position, TradeOrder } from './types'

export async function fetchOmWalletAddress(tabId: number): Promise<string | null> {
    try {
        const result = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                return fetch('https://omni.variational.io/api/settlement_pools/existing')
                    .then((response) => {
                        if (!response.ok) return null
                        return response.json()
                    })
                    .then((data) => data?.address_other || null)
                    .catch(() => null)
            },
        })
        return result?.[0]?.result || null
    } catch (e) {
        console.error('[Arbflow] Failed to fetch OM wallet address:', e)
        return null
    }
}

interface OmPositionResponse {
    position_info: {
        instrument: {
            instrument_type: string
            underlying: string
            funding_interval_s: number
            settlement_asset: string
        }
        qty: string
        avg_entry_price: string
    }
    price_info: {
        price: string
    }
    value: string
    upnl: string
    cum_funding: string
    estimated_liquidation_price: string
}

export async function fetchOmPositions(tabId: number): Promise<Position[]> {
    try {
        const result = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                return fetch('https://omni.variational.io/api/positions')
                    .then((response) => {
                        if (!response.ok) return null
                        return response.json()
                    })
                    .catch(() => null)
            },
        })

        const positions = result?.[0]?.result as OmPositionResponse[] | null
        if (!positions) return []

        return positions
            .filter((p) => parseFloat(p.position_info.qty) !== 0)
            .map((p) => {
                const qty = parseFloat(p.position_info.qty)
                const side: 'long' | 'short' = qty > 0 ? 'long' : 'short'
                const positionSize = Math.abs(qty)
                const avgEntryPrice = parseFloat(p.position_info.avg_entry_price)
                const markPrice = parseFloat(p.price_info.price)
                const positionValue = parseFloat(p.value)
                const unrealizedPnl = parseFloat(p.upnl)
                const liqPrice = parseFloat(p.estimated_liquidation_price)
                const funding = parseFloat(p.cum_funding)

                return {
                    symbol: p.position_info.instrument.underlying,
                    position: positionSize,
                    side,
                    avgEntryPrice,
                    markPrice,
                    positionValue,
                    unrealizedPnl,
                    unrealizedPnlPercent: avgEntryPrice > 0 ? (unrealizedPnl / (positionValue - unrealizedPnl)) * 100 : 0,
                    funding,
                    liquidationPrice: liqPrice > 0 ? liqPrice : null,
                    exchangeId: 'omni',
                    lastUpdated: Date.now(),
                }
            })
    } catch (e) {
        console.error('[Arbflow] Failed to fetch OM positions:', e)
        return []
    }
}

export interface OmOrdersResponse {
    pagination: {
        last_page: { limit: string; offset: string }
        next_page: { limit: string; offset: string }
        object_count: number
    }
    result: OmRawOrder[]
}

export interface OmRawOrder {
    order_id: string
    side: 'buy' | 'sell'
    order_type: 'market' | 'limit'
    qty: string
    price: string | null
    status: string
    clearing_status: string
    created_at: string
    execution_timestamp: string | null
    is_reduce_only: boolean
    instrument: {
        underlying: string
        settlement_asset: string
        instrument_type: string
        funding_interval_s: number
    }
    mark_price: string
    limit_price: string | null
    slippage_limit: string
    tif: string
    cancel_reason: string | null
}

function mapOmOrderStatus(status: string, clearingStatus: string): TradeOrder['status'] {
    if (status === 'cleared' && clearingStatus === 'success_trades_booked_into_pool') return 'filled'
    if (status === 'cleared') return 'cleared'
    if (status === 'cancelled') return 'cancelled'
    if (status === 'partial') return 'partial'
    return 'pending'
}

function parseOmOrder(order: OmRawOrder): TradeOrder {
    return {
        orderId: order.order_id,
        exchange: 'omni',
        symbol: order.instrument.underlying,
        side: order.side,
        orderType: order.order_type,
        qty: order.qty,
        price: order.price || order.mark_price,
        status: mapOmOrderStatus(order.status, order.clearing_status),
        createdAt: new Date(order.created_at).getTime(),
        executedAt: order.execution_timestamp ? new Date(order.execution_timestamp).getTime() : undefined,
        reduceOnly: order.is_reduce_only,
        filledQty: order.qty,
        filledValue: order.price ? (parseFloat(order.qty) * parseFloat(order.price)).toFixed(6) : undefined,
    }
}

export interface FetchOmOrdersOptions {
    limit?: number
    offset?: number
    startDate?: Date
    endDate?: Date
    symbol?: string
    status?: 'cleared' | 'cancelled' | 'pending'
}

export function getOmInstrument(symbol: string): string {
    return `P-${symbol.toUpperCase()}-USDC-3600`
}

async function fetchOmOrdersPage(
    tabId: number,
    limit: number,
    offset: number,
    startIso: string,
    endIso: string,
    instrument: string,
    status: string
): Promise<OmOrdersResponse | null> {
    const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: (limit: number, offset: number, startIso: string, endIso: string, instrument: string, status: string) => {
            const url = new URL('https://omni.variational.io/api/orders/v2')
            url.searchParams.set('limit', limit.toString())
            url.searchParams.set('offset', offset.toString())
            url.searchParams.set('order_by', 'created_at')
            url.searchParams.set('order', 'desc')
            url.searchParams.set('created_at_gte', startIso)
            url.searchParams.set('created_at_lte', endIso)
            if (instrument) {
                url.searchParams.set('instrument', instrument)
            }
            if (status) {
                url.searchParams.set('status', status)
            }

            return fetch(url.toString())
                .then((response) => {
                    if (!response.ok) return null
                    return response.json()
                })
                .catch(() => null)
        },
        args: [limit, offset, startIso, endIso, instrument, status],
    })

    return result?.[0]?.result as OmOrdersResponse | null
}

export async function fetchOmOrders(
    tabId: number,
    options: FetchOmOrdersOptions = {}
): Promise<{ orders: TradeOrder[]; totalCount: number } | null> {
    const { limit, startDate, endDate, symbol, status = 'cleared' } = options

    const now = new Date()
    const defaultStart = new Date(now)
    defaultStart.setDate(defaultStart.getDate() - 30)

    const start = startDate || defaultStart
    const end = endDate || now
    const instrument = symbol ? getOmInstrument(symbol) : ''
    const startIso = start.toISOString()
    const endIso = end.toISOString()

    try {
        if (limit) {
            const data = await fetchOmOrdersPage(tabId, limit, 0, startIso, endIso, instrument, status)
            if (!data) return null

            return {
                orders: data.result.map(parseOmOrder),
                totalCount: data.pagination.object_count,
            }
        }

        const allOrders: OmRawOrder[] = []
        let currentOffset = 0
        const pageSize = 100
        const maxPages = 100
        let totalCount = 0

        for (let page = 0; page < maxPages; page++) {
            const data = await fetchOmOrdersPage(tabId, pageSize, currentOffset, startIso, endIso, instrument, status)
            if (!data) break

            totalCount = data.pagination.object_count
            allOrders.push(...data.result)

            if (data.result.length < pageSize || allOrders.length >= totalCount) {
                break
            }

            currentOffset += pageSize
        }

        return {
            orders: allOrders.map(parseOmOrder),
            totalCount,
        }
    } catch (e) {
        console.error('[Arbflow] Failed to fetch OM orders:', e)
        return null
    }
}

