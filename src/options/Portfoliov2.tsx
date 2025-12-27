import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
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

interface ArbCycle {
  id: string
  symbol: string
  startTime: number
  endTime: number
  duration: number
  pnl: number
  lgOrders: TradeOrder[]
  omOrders: TradeOrder[]
  totalQty: number
  peakLgPosition: number
  peakOmPosition: number
  orderCount: number
  isComplete: boolean
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const ms = date.getMilliseconds().toString().padStart(3, '0')
  return `${date.toLocaleString()}.${ms}`
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? '+' : ''
  return `${sign}${pnl.toFixed(4)}u`
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    const remainingHours = hours % 24
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }
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

function PnlDisplay({ pnl, totalQty }: { pnl: number; totalQty: number }) {
  const colorClass = pnl >= 0 ? 'text-green-500' : 'text-red-500'
  const perUnit = totalQty > 0 ? pnl / totalQty : 0
  const perUnitSign = perUnit >= 0 ? '+' : ''

  return (
    <span className={colorClass}>
      {formatPnl(pnl)}
      {totalQty > 0 && (
        <span className="text-muted-foreground ml-1">
          ({perUnitSign}
          {perUnit.toFixed(4)}u/unit)
        </span>
      )}
    </span>
  )
}

function OrdersBreakdown({
  lgOrders,
  omOrders,
}: {
  lgOrders: TradeOrder[]
  omOrders: TradeOrder[]
}) {
  const lgBuys = lgOrders.filter((o) => o.side === 'buy')
  const lgSells = lgOrders.filter((o) => o.side === 'sell')
  const omBuys = omOrders.filter((o) => o.side === 'buy')
  const omSells = omOrders.filter((o) => o.side === 'sell')

  return (
    <div className="flex gap-4 text-xs">
      <div className="flex flex-col">
        <span className="font-bold">LG</span>
        <span className="text-green-500">+{lgBuys.length} buy</span>
        <span className="text-red-500">-{lgSells.length} sell</span>
      </div>
      <div className="flex flex-col">
        <span className="font-bold">OM</span>
        <span className="text-green-500">+{omBuys.length} buy</span>
        <span className="text-red-500">-{omSells.length} sell</span>
      </div>
    </div>
  )
}

function PositionPeaks({ lgPeak, omPeak }: { lgPeak: number; omPeak: number }) {
  return (
    <div className="flex gap-3 text-xs">
      <span>
        <span className="font-bold">LG:</span>{' '}
        <span className={lgPeak >= 0 ? 'text-green-500' : 'text-red-500'}>
          {lgPeak >= 0 ? '+' : ''}
          {lgPeak.toFixed(2)}
        </span>
      </span>
      <span>
        <span className="font-bold">OM:</span>{' '}
        <span className={omPeak >= 0 ? 'text-green-500' : 'text-red-500'}>
          {omPeak >= 0 ? '+' : ''}
          {omPeak.toFixed(2)}
        </span>
      </span>
    </div>
  )
}

interface TradePair {
  id: string
  lgOrder?: TradeOrder
  omOrder?: TradeOrder
  pnl: number
  time: number
  timeGap?: number
}

const TIME_TOLERANCE_MS = 800

function matchOrdersInCycle(lgOrders: TradeOrder[], omOrders: TradeOrder[]): TradePair[] {
  const pairs: TradePair[] = []
  const usedLgIndices = new Set<number>()
  const usedOmIndices = new Set<number>()

  for (let i = 0; i < lgOrders.length; i++) {
    const lg = lgOrders[i]
    for (let j = 0; j < omOrders.length; j++) {
      if (usedOmIndices.has(j)) continue
      const om = omOrders[j]
      if (Math.abs(lg.createdAt - om.createdAt) > TIME_TOLERANCE_MS) continue
      if (lg.side === om.side) continue

      usedLgIndices.add(i)
      usedOmIndices.add(j)

      const lgValue = parseFloat(lg.qty) * parseFloat(lg.price)
      const omValue = parseFloat(om.qty) * parseFloat(om.price)
      const pnl =
        (lg.side === 'sell' ? lgValue : -lgValue) + (om.side === 'sell' ? omValue : -omValue)

      pairs.push({
        id: `${lg.orderId}-${om.orderId}`,
        lgOrder: lg,
        omOrder: om,
        pnl,
        time: Math.min(lg.createdAt, om.createdAt),
      })
      break
    }
  }

  const unmatchedLg: TradeOrder[] = []
  const unmatchedOm: TradeOrder[] = []

  lgOrders.forEach((o, i) => {
    if (!usedLgIndices.has(i)) unmatchedLg.push(o)
  })
  omOrders.forEach((o, j) => {
    if (!usedOmIndices.has(j)) unmatchedOm.push(o)
  })

  for (const lg of unmatchedLg) {
    let bestMatch: { om: TradeOrder; timeGap: number } | null = null
    for (const om of unmatchedOm) {
      if (lg.side === om.side) continue
      const gap = Math.abs(lg.createdAt - om.createdAt)
      if (!bestMatch || gap < bestMatch.timeGap) {
        bestMatch = { om, timeGap: gap }
      }
    }
    if (bestMatch) {
      const idx = unmatchedOm.indexOf(bestMatch.om)
      if (idx > -1) unmatchedOm.splice(idx, 1)

      const lgValue = parseFloat(lg.qty) * parseFloat(lg.price)
      const omValue = parseFloat(bestMatch.om.qty) * parseFloat(bestMatch.om.price)
      const pnl =
        (lg.side === 'sell' ? lgValue : -lgValue) +
        (bestMatch.om.side === 'sell' ? omValue : -omValue)

      pairs.push({
        id: `${lg.orderId}-${bestMatch.om.orderId}`,
        lgOrder: lg,
        omOrder: bestMatch.om,
        pnl,
        time: Math.min(lg.createdAt, bestMatch.om.createdAt),
        timeGap: bestMatch.timeGap,
      })
    } else {
      const lgValue = parseFloat(lg.qty) * parseFloat(lg.price)
      pairs.push({
        id: lg.orderId,
        lgOrder: lg,
        pnl: lg.side === 'sell' ? lgValue : -lgValue,
        time: lg.createdAt,
      })
    }
  }

  for (const om of unmatchedOm) {
    const omValue = parseFloat(om.qty) * parseFloat(om.price)
    pairs.push({
      id: om.orderId,
      omOrder: om,
      pnl: om.side === 'sell' ? omValue : -omValue,
      time: om.createdAt,
    })
  }

  pairs.sort((a, b) => a.time - b.time)
  return pairs
}

function CycleDetailDrawer({
  cycle,
  open,
  onClose,
}: {
  cycle: ArbCycle | null
  open: boolean
  onClose: () => void
}) {
  if (!cycle) return null

  const pairs = matchOrdersInCycle(cycle.lgOrders, cycle.omOrders)
  const icon = SYMBOL_ICON_MAP[cycle.symbol]

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} direction="right">
      <DrawerContent className="w-[1000px] sm:max-w-4xl">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {icon && <img src={icon} alt={cycle.symbol} className="h-8 w-8 rounded-full" />}
              <div>
                <DrawerTitle className="text-xl">{cycle.symbol} Cycle</DrawerTitle>
                <DrawerDescription>
                  {formatTime(cycle.startTime)} → {formatTime(cycle.endTime)}
                </DrawerDescription>
              </div>
            </div>
            <DrawerClose className="rounded-md p-2 hover:bg-muted">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 grid grid-cols-3 gap-3 rounded-lg border bg-card p-3">
            <div>
              <div className="text-xs text-muted-foreground">Total PNL</div>
              <div
                className={`text-lg font-semibold ${cycle.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}
              >
                {formatPnl(cycle.pnl)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Duration</div>
              <div className="text-lg font-semibold">{formatDuration(cycle.duration)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Orders</div>
              <div className="text-lg font-semibold">{cycle.orderCount}</div>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium">Trade Pairs ({pairs.length})</h3>
            {!cycle.isComplete && (
              <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-600">
                In Progress
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Hedge Pair
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Qty</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">PNL</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pairs.map((pair, idx) => (
                  <tr key={pair.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-muted-foreground">{idx + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {pair.lgOrder && (
                          <span className="text-base">
                            <span
                              className={
                                pair.lgOrder.side === 'sell' ? 'text-red-500' : 'text-green-500'
                              }
                            >
                              {pair.lgOrder.side === 'sell' ? '-' : '+'}
                            </span>
                            <span className="font-bold">LG</span>
                            <span className="ml-1 text-muted-foreground">
                              ({parseFloat(pair.lgOrder.price).toFixed(2)}u)
                            </span>
                          </span>
                        )}
                        {pair.omOrder && (
                          <span className="text-base">
                            <span
                              className={
                                pair.omOrder.side === 'sell' ? 'text-red-500' : 'text-green-500'
                              }
                            >
                              {pair.omOrder.side === 'sell' ? '-' : '+'}
                            </span>
                            <span className="font-bold">OM</span>
                            <span className="ml-1 text-muted-foreground">
                              ({parseFloat(pair.omOrder.price).toFixed(2)}u)
                            </span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {pair.lgOrder
                        ? parseFloat(pair.lgOrder.qty).toFixed(4)
                        : pair.omOrder
                          ? parseFloat(pair.omOrder.qty).toFixed(4)
                          : '-'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={pair.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {formatPnl(pair.pnl)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      <div className="text-xs">{formatTime(pair.time)}</div>
                      {pair.timeGap && (
                        <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-xs text-yellow-600">
                          ⏱ {formatDuration(pair.timeGap)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function calculateOrderPnl(order: TradeOrder): number {
  const qty = parseFloat(order.qty)
  const price = parseFloat(order.price)
  const value = qty * price
  return order.side === 'sell' ? value : -value
}

function buildArbCycles(lgOrders: TradeOrder[], omOrders: TradeOrder[]): ArbCycle[] {
  const allOrders: (TradeOrder & { source: 'lg' | 'om' })[] = [
    ...lgOrders.map((o) => ({ ...o, source: 'lg' as const })),
    ...omOrders.map((o) => ({ ...o, source: 'om' as const })),
  ].sort((a, b) => a.createdAt - b.createdAt)

  const cycles: ArbCycle[] = []
  const positionBySymbol: Record<string, { lg: number; om: number }> = {}
  const cycleDataBySymbol: Record<
    string,
    {
      lgOrders: TradeOrder[]
      omOrders: TradeOrder[]
      startTime: number
      pnl: number
      totalQty: number
      peakLgPos: number
      peakOmPos: number
    }
  > = {}

  for (const order of allOrders) {
    const { symbol, source } = order

    if (!positionBySymbol[symbol]) {
      positionBySymbol[symbol] = { lg: 0, om: 0 }
    }
    if (!cycleDataBySymbol[symbol]) {
      cycleDataBySymbol[symbol] = {
        lgOrders: [],
        omOrders: [],
        startTime: 0,
        pnl: 0,
        totalQty: 0,
        peakLgPos: 0,
        peakOmPos: 0,
      }
    }

    const pos = positionBySymbol[symbol]
    const cycleData = cycleDataBySymbol[symbol]

    const wasEmpty = pos.lg === 0 && pos.om === 0

    if (wasEmpty) {
      cycleData.startTime = order.createdAt
      cycleData.lgOrders = []
      cycleData.omOrders = []
      cycleData.pnl = 0
      cycleData.totalQty = 0
      cycleData.peakLgPos = 0
      cycleData.peakOmPos = 0
    }

    const qty = parseFloat(order.qty)
    const positionDelta = order.side === 'buy' ? qty : -qty

    if (source === 'lg') {
      pos.lg += positionDelta
      cycleData.lgOrders.push(order)
    } else {
      pos.om += positionDelta
      cycleData.omOrders.push(order)
    }

    cycleData.pnl += calculateOrderPnl(order)
    cycleData.totalQty += qty / 2

    if (Math.abs(pos.lg) > Math.abs(cycleData.peakLgPos)) {
      cycleData.peakLgPos = pos.lg
    }
    if (Math.abs(pos.om) > Math.abs(cycleData.peakOmPos)) {
      cycleData.peakOmPos = pos.om
    }

    const threshold = 0.0001
    const isNowEmpty = Math.abs(pos.lg) < threshold && Math.abs(pos.om) < threshold

    if (isNowEmpty && cycleData.lgOrders.length > 0 && cycleData.omOrders.length > 0) {
      cycles.push({
        id: `${symbol}-${cycleData.startTime}`,
        symbol,
        startTime: cycleData.startTime,
        endTime: order.createdAt,
        duration: order.createdAt - cycleData.startTime,
        pnl: cycleData.pnl,
        lgOrders: [...cycleData.lgOrders],
        omOrders: [...cycleData.omOrders],
        totalQty: cycleData.totalQty,
        peakLgPosition: cycleData.peakLgPos,
        peakOmPosition: cycleData.peakOmPos,
        orderCount: cycleData.lgOrders.length + cycleData.omOrders.length,
        isComplete: true,
      })

      pos.lg = 0
      pos.om = 0
    }
  }

  for (const symbol of Object.keys(cycleDataBySymbol)) {
    const pos = positionBySymbol[symbol]
    const cycleData = cycleDataBySymbol[symbol]

    if (cycleData.lgOrders.length > 0 || cycleData.omOrders.length > 0) {
      const threshold = 0.0001
      const isComplete = Math.abs(pos.lg) < threshold && Math.abs(pos.om) < threshold

      if (!isComplete) {
        const lastOrderTime = Math.max(
          ...cycleData.lgOrders.map((o) => o.createdAt),
          ...cycleData.omOrders.map((o) => o.createdAt),
        )

        cycles.push({
          id: `${symbol}-${cycleData.startTime}-incomplete`,
          symbol,
          startTime: cycleData.startTime,
          endTime: lastOrderTime,
          duration: lastOrderTime - cycleData.startTime,
          pnl: cycleData.pnl,
          lgOrders: [...cycleData.lgOrders],
          omOrders: [...cycleData.omOrders],
          totalQty: cycleData.totalQty,
          peakLgPosition: cycleData.peakLgPos,
          peakOmPosition: cycleData.peakOmPos,
          orderCount: cycleData.lgOrders.length + cycleData.omOrders.length,
          isComplete: false,
        })
      }
    }
  }

  cycles.sort((a, b) => b.startTime - a.startTime)

  return cycles
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

const cycleColumns: ColumnDef<ArbCycle>[] = [
  {
    accessorKey: 'symbol',
    header: 'Symbol',
    cell: ({ row }) => {
      const icon = SYMBOL_ICON_MAP[row.original.symbol]
      return (
        <span className="flex items-center gap-2 font-medium">
          {icon && <img src={icon} alt={row.original.symbol} className="h-5 w-5 rounded-full" />}
          {row.original.symbol}
          {!row.original.isComplete && (
            <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-xs text-yellow-600">
              未完成
            </span>
          )}
        </span>
      )
    },
  },
  {
    accessorKey: 'orders',
    header: 'Orders',
    cell: ({ row }) => (
      <OrdersBreakdown lgOrders={row.original.lgOrders} omOrders={row.original.omOrders} />
    ),
  },
  {
    accessorKey: 'peaks',
    header: 'Peak Position',
    cell: ({ row }) => (
      <PositionPeaks lgPeak={row.original.peakLgPosition} omPeak={row.original.peakOmPosition} />
    ),
  },
  {
    accessorKey: 'totalQty',
    header: 'Total Qty',
    cell: ({ row }) => row.original.totalQty.toFixed(2),
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
    cell: ({ row }) => <PnlDisplay pnl={row.original.pnl} totalQty={row.original.totalQty} />,
  },
  {
    accessorKey: 'duration',
    header: 'Duration',
    cell: ({ row }) => (
      <span className="text-muted-foreground">{formatDuration(row.original.duration)}</span>
    ),
  },
  {
    accessorKey: 'startTime',
    header: 'Start Time',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">{formatTime(row.original.startTime)}</span>
    ),
  },
]

export const Portfoliov2 = () => {
  const [arbCycles, setArbCycles] = useState<ArbCycle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedSymbol, setSelectedSymbol] = useState<string>('')
  const [dateRange, setDateRange] = useState<DateRange>('1d')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showIncomplete, setShowIncomplete] = useState(true)

  const [selectedCycle, setSelectedCycle] = useState<ArbCycle | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const columns = useMemo(() => cycleColumns, [])

  const filteredCycles = useMemo(() => {
    if (showIncomplete) return arbCycles
    return arbCycles.filter((c) => c.isComplete)
  }, [arbCycles, showIncomplete])

  const stats = useMemo(() => {
    const completeCycles = filteredCycles.filter((c) => c.isComplete)
    const incompleteCycles = filteredCycles.filter((c) => !c.isComplete)

    const totalPnl = filteredCycles.reduce((sum, c) => sum + c.pnl, 0)
    const completePnl = completeCycles.reduce((sum, c) => sum + c.pnl, 0)
    const incompletePnl = incompleteCycles.reduce((sum, c) => sum + c.pnl, 0)

    const winCycles = completeCycles.filter((c) => c.pnl > 0)
    const winRate = completeCycles.length > 0 ? (winCycles.length / completeCycles.length) * 100 : 0

    const avgPnl = completeCycles.length > 0 ? completePnl / completeCycles.length : 0

    return {
      totalCycles: filteredCycles.length,
      completeCycles: completeCycles.length,
      incompleteCycles: incompleteCycles.length,
      totalPnl,
      completePnl,
      incompletePnl,
      winRate,
      avgPnl,
    }
  }, [filteredCycles])

  const handleCalculate = useCallback(async () => {
    setLoading(true)
    setError(null)
    setArbCycles([])

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

      console.log('[Portfoliov2] LG orders:', lgOrders.length, 'OM orders:', omOrders.length)

      const cycles = buildArbCycles(lgOrders, omOrders)
      setArbCycles(cycles)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [dateRange, customStartDate, customEndDate, selectedSymbol])

  useEffect(() => {
    handleCalculate()
  }, [])

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Portfolio v2 - Arb Cycles</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Track complete arbitrage cycles from position open to close
      </p>

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

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showIncomplete"
              checked={showIncomplete}
              onChange={(e) => setShowIncomplete(e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            <label htmlFor="showIncomplete" className="text-sm text-muted-foreground">
              Show Incomplete
            </label>
          </div>

          <Button onClick={handleCalculate} disabled={loading}>
            {loading ? 'Calculating...' : 'Calculate'}
          </Button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {filteredCycles.length > 0 && (
        <div className="mt-6">
          <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg border bg-card p-4 md:grid-cols-4">
            <div>
              <div className="text-sm text-muted-foreground">Total Cycles</div>
              <div className="text-2xl font-semibold">
                {stats.totalCycles}
                {stats.incompleteCycles > 0 && (
                  <span className="ml-2 text-sm text-yellow-600">
                    ({stats.incompleteCycles} in progress)
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total PNL</div>
              <div
                className={`text-2xl font-semibold ${stats.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}
              >
                {formatPnl(stats.totalPnl)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Win Rate</div>
              <div className="text-2xl font-semibold">{stats.winRate.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Avg PNL / Cycle</div>
              <div
                className={`text-2xl font-semibold ${stats.avgPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}
              >
                {formatPnl(stats.avgPnl)}
              </div>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={filteredCycles}
            onRowClick={(cycle) => {
              setSelectedCycle(cycle)
              setDrawerOpen(true)
            }}
          />
        </div>
      )}

      {!loading && filteredCycles.length === 0 && !error && (
        <div className="mt-8 text-center text-muted-foreground">
          No arbitrage cycles found in the selected time range
        </div>
      )}

      <CycleDetailDrawer
        cycle={selectedCycle}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedCycle(null)
        }}
      />
    </main>
  )
}

export default Portfoliov2
