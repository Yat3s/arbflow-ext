import type { ParsedMessage, OrderBookItem } from './types'

function toOrderBookItems(levels: unknown[]): OrderBookItem[] {
  if (!Array.isArray(levels)) return []
  return levels.map((level) => {
    if (Array.isArray(level)) {
      return {
        price: Number(level[0]) || 0,
        quantity: Number(level[1]) || 0,
      }
    }
    if (level && typeof level === 'object') {
      const l = level as Record<string, unknown>
      return {
        price: Number(l.price ?? l.p) || 0,
        quantity: Number(l.size ?? l.quantity ?? l.q) || 0,
      }
    }
    return { price: 0, quantity: 0 }
  })
}

function extractMarketIdFromChannel(channel?: string): number | null {
  if (!channel) return null
  const match = channel.match(/[\/:](\d+)$/)
  return match ? parseInt(match[1], 10) : null
}

export const lighterParser = {
  parse(data: Record<string, unknown>): ParsedMessage | null {
    if (!data || typeof data !== 'object') return null

    if (data.order_book) {
      const orderBook = data.order_book as Record<string, unknown>
      const bids = toOrderBookItems(orderBook.bids as unknown[])
      const asks = toOrderBookItems(orderBook.asks as unknown[])
      return {
        type: 'orderBook',
        orderBook: { bids, asks },
        channel: data.channel as string,
      }
    }

    if (data.market_stats) {
      const stats = data.market_stats as Record<string, unknown>
      return {
        type: 'marketStats',
        marketStats: {
          indexPrice: Number(stats.index_price) || 0,
          markPrice: Number(stats.mark_price) || 0,
          fundingRate: Number(stats.current_funding_rate) || 0,
        },
        channel: data.channel as string,
      }
    }

    return null
  },

  extractMarketIdFromChannel,
}

export const omniParser = {
  parse(data: Record<string, unknown>): ParsedMessage | null {
    if (!data || typeof data !== 'object') return null

    if (data.type === 'quote' && data.data) {
      const quoteData = data.data as Record<string, unknown>
      const bidPrice = Number(quoteData.bid) || 0
      const askPrice = Number(quoteData.ask) || 0
      const instrument = quoteData.instrument as Record<string, unknown> | undefined

      return {
        type: 'orderBook',
        orderBook: {
          bids: [{ price: bidPrice, quantity: 1 }],
          asks: [{ price: askPrice, quantity: 1 }],
        },
        marketStats: {
          markPrice: Number(quoteData.mark_price) || 0,
          indexPrice: Number(quoteData.index_price) || 0,
        },
        symbol: (data.symbol as string) || (instrument?.underlying as string),
      }
    }

    if (data.bid !== undefined && data.ask !== undefined) {
      const bidPrice = Number(data.bid) || 0
      const askPrice = Number(data.ask) || 0
      const instrument = data.instrument as Record<string, unknown> | undefined

      return {
        type: 'orderBook',
        orderBook: {
          bids: [{ price: bidPrice, quantity: 1 }],
          asks: [{ price: askPrice, quantity: 1 }],
        },
        marketStats: {
          markPrice: Number(data.mark_price) || 0,
          indexPrice: Number(data.index_price) || 0,
        },
        symbol: instrument?.underlying as string,
      }
    }

    return null
  },
}

export function parseMessage(exchangeId: string, data: unknown): ParsedMessage | null {
  if (!data || typeof data !== 'object') return null
  const parser = exchangeId?.toLowerCase() === 'omni' ? omniParser : lighterParser
  return parser.parse(data as Record<string, unknown>)
}

export function extractMarketId(exchangeId: string, channel?: string): number | null {
  if (exchangeId?.toLowerCase() === 'lighter') {
    return extractMarketIdFromChannel(channel)
  }
  return null
}

