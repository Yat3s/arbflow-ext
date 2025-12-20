import type { ExchangeMarketStats, PriceDiff } from './types'

/**
 * Calculate volume-weighted average price for a given target size
 * Simulates filling orders from the order book until target size is reached
 */
export function calculateWeightedPrice(
  orders: { price: number; quantity: number }[],
  targetSize: number
): number | null {
  if (!orders || orders.length === 0) return null
  if (targetSize <= 0) return orders[0]?.price ?? null

  let remainingSize = targetSize
  let totalValue = 0
  let totalQuantity = 0

  for (const order of orders) {
    const fillQuantity = Math.min(remainingSize, order.quantity)
    totalValue += fillQuantity * order.price
    totalQuantity += fillQuantity
    remainingSize -= fillQuantity

    if (remainingSize <= 0) break
  }

  if (totalQuantity === 0) return null
  return totalValue / totalQuantity
}

/**
 * Calculate price difference between two exchanges for arbitrage opportunities
 * Returns spread in both directions: platform1 -> platform2 and platform2 -> platform1
 */
export function calculatePriceDiff(
  stats: ExchangeMarketStats[],
  exchanges: { id: string; name: string; color: string }[],
  tradeSize: number
): PriceDiff | null {
  if (stats.length < 2) return null

  const stat1 = stats[0]
  const stat2 = stats[1]

  const platform1Ask = calculateWeightedPrice(stat1?.orderBook?.asks || [], tradeSize)
  const platform1Bid = calculateWeightedPrice(stat1?.orderBook?.bids || [], tradeSize)
  const platform2Ask = calculateWeightedPrice(stat2?.orderBook?.asks || [], tradeSize)
  const platform2Bid = calculateWeightedPrice(stat2?.orderBook?.bids || [], tradeSize)

  if (!platform1Ask || !platform1Bid || !platform2Ask || !platform2Bid) {
    return null
  }

  const exchange1 = exchanges.find((e) => e.id === stat1.exchangeId)
  const exchange2 = exchanges.find((e) => e.id === stat2.exchangeId)

  return {
    platform1Id: stat1.exchangeId,
    platform2Id: stat2.exchangeId,
    platform1Name: exchange1?.name || stat1.exchangeId,
    platform2Name: exchange2?.name || stat2.exchangeId,
    platform1Color: exchange1?.color || '#6366f1',
    platform2Color: exchange2?.color || '#f59e0b',
    // spread1to2: sell on platform1 (bid), buy on platform2 (ask) => profit = p2_bid - p1_ask
    spread1to2: platform2Bid - platform1Ask,
    // spread2to1: sell on platform2 (bid), buy on platform1 (ask) => profit = p1_bid - p2_ask
    spread2to1: platform1Bid - platform2Ask,
    platform1Ask,
    platform2Ask,
    platform1Bid,
    platform2Bid,
    platform1LastUpdated: stat1.lastUpdated,
    platform2LastUpdated: stat2.lastUpdated,
  }
}

