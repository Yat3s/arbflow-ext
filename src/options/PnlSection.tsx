import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import type { ColumnDef } from '@tanstack/react-table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchLighterOrders, LIGHTER_MARKETS } from '../lib/lighter-api'
import { fetchOmOrders } from '../lib/omni'
import { ALL_SYMBOLS, SYMBOL_ICON_MAP } from '../lib/symbols'
import type { ExchangeConfigs, TradeOrder } from '../lib/types'
import {
  ArbCycle,
  CycleDetailDrawer,
  OrdersBreakdown,
  PnlDisplay,
  PositionPeaks,
  StatsCard,
} from './_components'
import {
  DATE_RANGE_OPTIONS,
  DateRange,
  formatDuration,
  formatTime,
  getDateRangeValues,
  STORAGE_KEYS,
} from './utils'

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

export function PnlSection() {
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
    const incompleteCycles = filteredCycles.filter((c) => !c.isComplete)
    const totalPnl = filteredCycles.reduce((sum, c) => sum + c.pnl, 0)

    return {
      totalCycles: filteredCycles.length,
      incompleteCycles: incompleteCycles.length,
      totalPnl,
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

      console.log('[PnlSection] LG orders:', lgOrders.length, 'OM orders:', omOrders.length)

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
    <div>
      <div className="space-y-4">
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
          <StatsCard stats={stats} />

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
    </div>
  )
}
