import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import type { ColumnDef } from '@tanstack/react-table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchLighterOrders, LIGHTER_MARKETS } from '../lib/lighter-api'
import { fetchOmOrders } from '../lib/omni'
import { ALL_SYMBOLS, SYMBOL_ICON_MAP } from '../lib/symbols'
import type { ExchangeConfigs, TradeOrder } from '../lib/types'

const STORAGE_KEYS = {
  EXCHANGE_CONFIGS: 'arbflow_exchange_configs',
}

type DateRange = '30m' | '1h' | '4h' | '1d' | '7d' | '30d' | 'custom'

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '30m', label: '30 Min' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'custom', label: 'Custom' },
]

interface TradePair {
  id: string
  symbol: string
  qty: string
  pnl: number
  time: number
  lgOrder?: TradeOrder
  omOrder?: TradeOrder
  lgOrder2?: TradeOrder
  omOrder2?: TradeOrder
  timeGap?: number
  isDelayedMatch?: boolean
  isRevertTrade?: boolean
}

const TIME_TOLERANCE_MS = 800

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const ms = date.getMilliseconds().toString().padStart(3, '0')
  return `${date.toLocaleString()}.${ms}`
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? '+' : ''
  return `${sign}${pnl.toFixed(4)}u`
}

function PnlDisplay({ pnl, qty, isPair }: { pnl: number; qty: string; isPair: boolean }) {
  const colorClass = pnl >= 0 ? 'text-green-500' : 'text-red-500'

  if (!isPair) {
    return <span className={colorClass}>{formatPnl(pnl)}</span>
  }

  const qtyNum = parseFloat(qty)
  const perUnit = qtyNum > 0 ? pnl / qtyNum : 0
  const perUnitSign = perUnit >= 0 ? '+' : ''

  return (
    <span className={colorClass}>
      {formatPnl(pnl)}
      <span className="text-muted-foreground">
        ({perUnitSign}
        {perUnit.toFixed(4)}u)
      </span>
    </span>
  )
}

function PairDisplay({
  lgOrder,
  omOrder,
  lgOrder2,
  omOrder2,
  isRevertTrade,
}: {
  lgOrder?: TradeOrder
  omOrder?: TradeOrder
  lgOrder2?: TradeOrder
  omOrder2?: TradeOrder
  isRevertTrade?: boolean
}) {
  return (
    <span className="flex flex-col gap-1 text-xs">
      <span className="flex items-center gap-2">
        {lgOrder && (
          <span className="text-lg">
            {lgOrder.side === 'sell' ? '-' : '+'}
            <span className="font-bold ">LG</span>
            <span className="text-muted-foreground text-sm">({lgOrder.price}u)</span>
          </span>
        )}
        {lgOrder2 && (
          <span className="text-lg">
            {lgOrder2.side === 'sell' ? '-' : '+'}
            <span className="font-bold ">LG</span>
            <span className="text-muted-foreground text-sm">({lgOrder2.price}u)</span>
          </span>
        )}
        {omOrder && (
          <span className="text-lg">
            {omOrder.side === 'sell' ? '-' : '+'}
            <span className="font-bold">OM</span>
            <span className="text-muted-foreground text-sm">({omOrder.price}u)</span>
          </span>
        )}
        {omOrder2 && (
          <span className="text-lg">
            {omOrder2.side === 'sell' ? '-' : '+'}
            <span className="font-bold">OM</span>
            <span className="text-muted-foreground text-sm">({omOrder2.price}u)</span>
          </span>
        )}
        {isRevertTrade && (
          <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-xs text-orange-600">
            撤回交易
          </span>
        )}
      </span>
    </span>
  )
}

function calculatePnl(
  lgOrder?: TradeOrder,
  omOrder?: TradeOrder,
  lgOrder2?: TradeOrder,
  omOrder2?: TradeOrder,
): number {
  let pnl = 0

  if (lgOrder) {
    const value = parseFloat(lgOrder.qty) * parseFloat(lgOrder.price)
    pnl += lgOrder.side === 'sell' ? value : -value
  }

  if (lgOrder2) {
    const value = parseFloat(lgOrder2.qty) * parseFloat(lgOrder2.price)
    pnl += lgOrder2.side === 'sell' ? value : -value
  }

  if (omOrder) {
    const value = parseFloat(omOrder.qty) * parseFloat(omOrder.price)
    pnl += omOrder.side === 'sell' ? value : -value
  }

  if (omOrder2) {
    const value = parseFloat(omOrder2.qty) * parseFloat(omOrder2.price)
    pnl += omOrder2.side === 'sell' ? value : -value
  }

  return pnl
}

function formatTimeGap(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }
  if (seconds > 0) {
    return `${seconds}s`
  }
  return `${ms}ms`
}

function matchOrders(lgOrders: TradeOrder[], omOrders: TradeOrder[]): TradePair[] {
  const pairs: TradePair[] = []
  const usedLgIndices = new Set<number>()
  const usedOmIndices = new Set<number>()

  for (let i = 0; i < lgOrders.length; i++) {
    const lg = lgOrders[i]

    for (let j = 0; j < omOrders.length; j++) {
      if (usedOmIndices.has(j)) continue

      const om = omOrders[j]

      if (lg.symbol !== om.symbol) continue
      if (Math.abs(lg.createdAt - om.createdAt) > TIME_TOLERANCE_MS) continue
      if (lg.side === om.side) continue

      usedLgIndices.add(i)
      usedOmIndices.add(j)

      pairs.push({
        id: `${lg.orderId}-${om.orderId}`,
        symbol: lg.symbol,
        qty: lg.qty,
        pnl: calculatePnl(lg, om),
        time: Math.min(lg.createdAt, om.createdAt),
        lgOrder: lg,
        omOrder: om,
      })
      break
    }
  }

  const unmatchedLg: { order: TradeOrder; index: number }[] = []
  const unmatchedOm: { order: TradeOrder; index: number }[] = []

  for (let i = 0; i < lgOrders.length; i++) {
    if (!usedLgIndices.has(i)) {
      unmatchedLg.push({ order: lgOrders[i], index: i })
    }
  }

  for (let j = 0; j < omOrders.length; j++) {
    if (!usedOmIndices.has(j)) {
      unmatchedOm.push({ order: omOrders[j], index: j })
    }
  }

  const delayedMatchedLg = new Set<number>()
  const delayedMatchedOm = new Set<number>()

  for (const lgItem of unmatchedLg) {
    const lg = lgItem.order
    let bestMatch: { om: TradeOrder; omIdx: number; timeGap: number } | null = null

    for (const omItem of unmatchedOm) {
      if (delayedMatchedOm.has(omItem.index)) continue

      const om = omItem.order
      if (lg.symbol !== om.symbol) continue
      if (lg.side === om.side) continue

      const timeGap = Math.abs(lg.createdAt - om.createdAt)
      if (!bestMatch || timeGap < bestMatch.timeGap) {
        bestMatch = { om, omIdx: omItem.index, timeGap }
      }
    }

    if (bestMatch) {
      delayedMatchedLg.add(lgItem.index)
      delayedMatchedOm.add(bestMatch.omIdx)

      pairs.push({
        id: `${lg.orderId}-${bestMatch.om.orderId}`,
        symbol: lg.symbol,
        qty: lg.qty,
        pnl: calculatePnl(lg, bestMatch.om),
        time: Math.min(lg.createdAt, bestMatch.om.createdAt),
        lgOrder: lg,
        omOrder: bestMatch.om,
        timeGap: bestMatch.timeGap,
        isDelayedMatch: true,
      })
    }
  }

  const stillUnmatchedLg: { order: TradeOrder; index: number }[] = []
  const stillUnmatchedOm: { order: TradeOrder; index: number }[] = []

  for (const lgItem of unmatchedLg) {
    if (!delayedMatchedLg.has(lgItem.index)) {
      stillUnmatchedLg.push(lgItem)
    }
  }

  for (const omItem of unmatchedOm) {
    if (!delayedMatchedOm.has(omItem.index)) {
      stillUnmatchedOm.push(omItem)
    }
  }

  const revertMatchedLg = new Set<number>()
  const revertMatchedOm = new Set<number>()

  for (let i = 0; i < stillUnmatchedLg.length; i++) {
    if (revertMatchedLg.has(stillUnmatchedLg[i].index)) continue
    const lg1 = stillUnmatchedLg[i].order

    let bestMatch: { lg2: TradeOrder; idx: number; timeGap: number } | null = null

    for (let j = i + 1; j < stillUnmatchedLg.length; j++) {
      if (revertMatchedLg.has(stillUnmatchedLg[j].index)) continue
      const lg2 = stillUnmatchedLg[j].order

      if (lg1.symbol !== lg2.symbol) continue
      if (lg1.side === lg2.side) continue
      if (lg1.qty !== lg2.qty) continue

      const timeGap = Math.abs(lg1.createdAt - lg2.createdAt)
      if (!bestMatch || timeGap < bestMatch.timeGap) {
        bestMatch = { lg2, idx: stillUnmatchedLg[j].index, timeGap }
      }
    }

    if (bestMatch) {
      revertMatchedLg.add(stillUnmatchedLg[i].index)
      revertMatchedLg.add(bestMatch.idx)

      pairs.push({
        id: `${lg1.orderId}-${bestMatch.lg2.orderId}`,
        symbol: lg1.symbol,
        qty: lg1.qty,
        pnl: calculatePnl(lg1, undefined, bestMatch.lg2, undefined),
        time: Math.min(lg1.createdAt, bestMatch.lg2.createdAt),
        lgOrder: lg1,
        lgOrder2: bestMatch.lg2,
        timeGap: bestMatch.timeGap,
        isRevertTrade: true,
      })
    }
  }

  for (let i = 0; i < stillUnmatchedOm.length; i++) {
    if (revertMatchedOm.has(stillUnmatchedOm[i].index)) continue
    const om1 = stillUnmatchedOm[i].order

    let bestMatch: { om2: TradeOrder; idx: number; timeGap: number } | null = null

    for (let j = i + 1; j < stillUnmatchedOm.length; j++) {
      if (revertMatchedOm.has(stillUnmatchedOm[j].index)) continue
      const om2 = stillUnmatchedOm[j].order

      if (om1.symbol !== om2.symbol) continue
      if (om1.side === om2.side) continue
      if (om1.qty !== om2.qty) continue

      const timeGap = Math.abs(om1.createdAt - om2.createdAt)
      if (!bestMatch || timeGap < bestMatch.timeGap) {
        bestMatch = { om2, idx: stillUnmatchedOm[j].index, timeGap }
      }
    }

    if (bestMatch) {
      revertMatchedOm.add(stillUnmatchedOm[i].index)
      revertMatchedOm.add(bestMatch.idx)

      pairs.push({
        id: `${om1.orderId}-${bestMatch.om2.orderId}`,
        symbol: om1.symbol,
        qty: om1.qty,
        pnl: calculatePnl(undefined, om1, undefined, bestMatch.om2),
        time: Math.min(om1.createdAt, bestMatch.om2.createdAt),
        omOrder: om1,
        omOrder2: bestMatch.om2,
        timeGap: bestMatch.timeGap,
        isRevertTrade: true,
      })
    }
  }

  for (const lgItem of stillUnmatchedLg) {
    if (revertMatchedLg.has(lgItem.index)) continue
    const lg = lgItem.order
    pairs.push({
      id: lg.orderId,
      symbol: lg.symbol,
      qty: lg.qty,
      pnl: calculatePnl(lg, undefined),
      time: lg.createdAt,
      lgOrder: lg,
    })
  }

  for (const omItem of stillUnmatchedOm) {
    if (revertMatchedOm.has(omItem.index)) continue
    const om = omItem.order
    pairs.push({
      id: om.orderId,
      symbol: om.symbol,
      qty: om.qty,
      pnl: calculatePnl(undefined, om),
      time: om.createdAt,
      omOrder: om,
    })
  }

  pairs.sort((a, b) => b.time - a.time)

  return pairs
}

function getDateRangeValues(range: DateRange, customStart?: string, customEnd?: string) {
  const now = new Date()
  const end = new Date(now)
  let start = new Date(now)

  switch (range) {
    case '30m':
      start.setMinutes(start.getMinutes() - 30)
      break
    case '1h':
      start.setHours(start.getHours() - 1)
      break
    case '4h':
      start.setHours(start.getHours() - 4)
      break
    case '1d':
      start.setDate(start.getDate() - 1)
      break
    case '7d':
      start.setDate(start.getDate() - 7)
      break
    case '30d':
      start.setDate(start.getDate() - 30)
      break
    case 'custom':
      if (customStart) start = new Date(customStart)
      if (customEnd) {
        const endDate = new Date(customEnd)
        endDate.setHours(23, 59, 59, 999)
        return { start, end: endDate }
      }
      end.setHours(23, 59, 59, 999)
      break
  }

  return { start, end }
}

const pairColumns: ColumnDef<TradePair>[] = [
  {
    accessorKey: 'symbol',
    header: 'Symbol',
    cell: ({ row }) => {
      const icon = SYMBOL_ICON_MAP[row.original.symbol]
      return (
        <span className="flex items-center gap-2 font-medium">
          {icon && <img src={icon} alt={row.original.symbol} className="h-5 w-5 rounded-full" />}
          {row.original.symbol}
        </span>
      )
    },
  },
  {
    accessorKey: 'pair',
    header: 'Hedge Pair',
    cell: ({ row }) => (
      <PairDisplay
        lgOrder={row.original.lgOrder}
        omOrder={row.original.omOrder}
        lgOrder2={row.original.lgOrder2}
        omOrder2={row.original.omOrder2}
        isRevertTrade={row.original.isRevertTrade}
      />
    ),
  },
  {
    accessorKey: 'qty',
    header: 'Qty',
    cell: ({ row }) => parseFloat(row.original.qty).toFixed(2),
  },
  {
    accessorKey: 'pnl',
    header: ({ column }) => (
      <button
        type="button"
        className="flex items-center gap-1 hover:text-foreground"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        PNL
        {column.getIsSorted() === 'asc' ? ' ↑' : column.getIsSorted() === 'desc' ? ' ↓' : ''}
      </button>
    ),
    cell: ({ row }) => {
      const isPair =
        !!(row.original.lgOrder && row.original.omOrder) ||
        !!(row.original.lgOrder && row.original.lgOrder2) ||
        !!(row.original.omOrder && row.original.omOrder2)
      return <PnlDisplay pnl={row.original.pnl} qty={row.original.qty} isPair={isPair} />
    },
  },
  {
    accessorKey: 'time',
    header: 'Time',
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatTime(row.original.time)}
        {(row.original.isDelayedMatch || row.original.isRevertTrade) && row.original.timeGap && (
          <span className="ml-2 rounded bg-yellow-500/20 px-1.5 py-0.5 text-xs text-yellow-600">
            ⏱ {formatTimeGap(row.original.timeGap)}
          </span>
        )}
      </span>
    ),
  },
]

export const Portfolio = () => {
  const [tradePairs, setTradePairs] = useState<TradePair[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedSymbol, setSelectedSymbol] = useState<string>('')
  const [dateRange, setDateRange] = useState<DateRange>('4h')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const columns = useMemo(() => pairColumns, [])

  const totalPnl = useMemo(() => {
    return tradePairs.reduce((sum, pair) => sum + pair.pnl, 0)
  }, [tradePairs])

  const handleCalculatePnl = useCallback(async () => {
    setLoading(true)
    setError(null)
    setTradePairs([])

    try {
      const savedConfigs = localStorage.getItem(STORAGE_KEYS.EXCHANGE_CONFIGS)
      if (!savedConfigs) {
        throw new Error('No config found, please configure in Settings first')
      }
      const configs: ExchangeConfigs = JSON.parse(savedConfigs)
      const { accountIndex, apiPrivateKey, apiKeyIndex } = configs.lighter || {}
      if (!accountIndex || !apiPrivateKey) {
        throw new Error('Lighter config incomplete, please configure in Settings first')
      }

      const tabs = await chrome.tabs.query({ url: 'https://omni.variational.io/*' })
      if (tabs.length === 0 || !tabs[0].id) {
        throw new Error('Please open Omni website first')
      }

      const { start, end } = getDateRangeValues(dateRange, customStartDate, customEndDate)
      const marketId = selectedSymbol ? LIGHTER_MARKETS[selectedSymbol]?.id : undefined

      const [lgResult, omResult] = await Promise.all([
        fetchLighterOrders({
          accountIndex,
          apiPrivateKey,
          apiKeyIndex: apiKeyIndex ?? 4,
          marketId,
          startTime: start.getTime(),
          endTime: end.getTime(),
        }),
        fetchOmOrders(tabs[0].id, {
          symbol: selectedSymbol || undefined,
          startDate: start,
          endDate: end,
        }),
      ])

      const lgOrders = lgResult?.orders || []
      const omOrders = omResult?.orders || []

      console.log('[Portfolio] LG orders:', lgOrders.length, 'OM orders:', omOrders.length)

      const pairs = matchOrders(lgOrders, omOrders)
      setTradePairs(pairs)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [dateRange, customStartDate, customEndDate, selectedSymbol])

  useEffect(() => {
    handleCalculatePnl()
  }, [])

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Portfolio</h1>

      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-40">
            <label className="mb-1.5 block text-sm text-muted-foreground">Symbol</label>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">All Symbols</option>
              {[...ALL_SYMBOLS].sort().map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </div>

          <div className="w-32">
            <label className="mb-1.5 block text-sm text-muted-foreground">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {DATE_RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {dateRange === 'custom' && (
            <>
              <div className="w-40">
                <label className="mb-1.5 block text-sm text-muted-foreground">Start Date</label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div className="w-40">
                <label className="mb-1.5 block text-sm text-muted-foreground">End Date</label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </>
          )}

          <Button onClick={handleCalculatePnl} disabled={loading}>
            {loading ? 'Calculating...' : 'Calculate PNL'}
          </Button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {tradePairs.length > 0 && (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">Trade Pairs ({tradePairs.length})</h2>
            <div className="text-lg font-semibold">
              Total PNL:{' '}
              <span className={totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                {formatPnl(totalPnl)}
              </span>
            </div>
          </div>
          <DataTable columns={columns} data={tradePairs} />
        </div>
      )}
    </main>
  )
}

export default Portfolio
