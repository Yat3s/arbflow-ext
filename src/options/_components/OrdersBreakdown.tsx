import type { TradeOrder } from '../../lib/types'

export function OrdersBreakdown({
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

