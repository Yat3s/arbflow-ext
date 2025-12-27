import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { SYMBOL_ICON_MAP } from '../../lib/symbols'
import type { TradeOrder } from '../../lib/types'
import { formatDuration, formatPnl, formatTime } from '../utils'

export interface ArbCycle {
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

export function CycleDetailDrawer({
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

