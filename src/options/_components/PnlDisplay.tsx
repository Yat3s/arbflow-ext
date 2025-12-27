import { formatPnl } from '../utils'

export function PnlDisplay({ pnl, totalQty }: { pnl: number; totalQty: number }) {
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

