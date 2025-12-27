import { SYMBOL_ICON_MAP } from '../lib/symbols'
import type { Position } from '../lib/types'

export interface AggregatedPosition {
  symbol: string
  lg: Position | null
  om: Position | null
}

interface PositionsSummaryProps {
  positions: AggregatedPosition[]
  loading?: boolean
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(2)
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(5)
}

function formatQty(qty: number): string {
  if (qty >= 100) return qty.toFixed(2)
  if (qty >= 1) return qty.toFixed(3)
  return qty.toFixed(4)
}

function PositionBadge({
  position,
  exchange,
}: {
  position: Position | null
  exchange: 'LG' | 'OM'
}) {
  if (!position) {
    return (
      <div className="flex w-36 items-center gap-1 text-muted-foreground">
        <span className="w-7 font-semibold">{exchange}:</span>
        <span>—</span>
      </div>
    )
  }

  const isLong = position.side === 'long'
  const colorClass = isLong ? '' : ''
  const sign = isLong ? '+' : '-'

  return (
    <div className="flex w-36 items-center gap-1">
      <span className="w-7 font-semibold">{exchange}:</span>
      <span className={colorClass}>
        {sign}
        {formatQty(position.position)}
      </span>
      <span className="text-muted-foreground">({formatPrice(position.avgEntryPrice)})</span>
    </div>
  )
}

export function PositionsSummary({ positions, loading }: PositionsSummaryProps) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 font-medium">Current Positions</h3>
        <div className="text-muted-foreground text-sm">Loading positions...</div>
      </div>
    )
  }

  if (positions.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 font-medium">Current Positions</h3>
        <div className="text-muted-foreground text-sm">No open positions</div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
      {positions.map((pos) => {
        const icon = SYMBOL_ICON_MAP[pos.symbol]

        let entryPriceDiff: number | null = null
        let diffColorClass = 'text-muted-foreground'
        if (pos.lg && pos.om) {
          const lgPrice = pos.lg.avgEntryPrice
          const omPrice = pos.om.avgEntryPrice
          const lgIsShort = pos.lg.side === 'short'
          entryPriceDiff = lgIsShort ? lgPrice - omPrice : omPrice - lgPrice
          diffColorClass = entryPriceDiff >= 0 ? '' : ''
        }

        return (
          <div
            key={pos.symbol}
            className="flex items-center justify-between rounded-lg border bg-background/50 p-4"
          >
            <div className="flex items-center gap-2">
              {icon && <img src={icon} alt={pos.symbol} className="h-5 w-5 rounded-full" />}
              <span className="w-12 font-medium">{pos.symbol}</span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex flex-col gap-0.5">
                <PositionBadge position={pos.lg} exchange="LG" />
                <PositionBadge position={pos.om} exchange="OM" />
              </div>

              <div className="w-24 text-right">
                {entryPriceDiff !== null ? (
                  <span className={diffColorClass}>
                    <span className="text-muted-foreground">入场价差:</span>
                    <br />
                    {entryPriceDiff >= 0 ? '+' : ''}
                    {formatPrice(entryPriceDiff)}u
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
