import type { Position } from '../../lib/types'
import { formatPrice, formatTime } from '../../lib/utils'

interface PositionItemProps {
  pos: Position
  exchange?: { color: string }
}

export function PositionItem({ pos, exchange }: PositionItemProps) {
  const color = exchange?.color || '#6366f1'
  const funding = pos.funding || 0
  const totalPnl = pos.unrealizedPnl + funding
  const pnlSign = totalPnl >= 0 ? '+' : '-'
  const fundingSign = funding >= 0 ? '+' : '-'
  const isStale = pos.lastUpdated && Date.now() - pos.lastUpdated > 60000

  return (
    <div className="grid grid-cols-[auto_40px_120px_1fr_60px] items-center gap-2 text-[10px]">
      <span
        className="w-10 text-center px-1.5 py-0.5 text-black font-bold"
        style={{ backgroundColor: color }}
      >
        {pos.exchangeId}
      </span>
      <span className={`text-muted-foreground ${isStale ? 'opacity-50' : ''}`}>
        {(() => {
          const t = formatTime(pos.lastUpdated)
          return `${t.timeStr}`
        })()}
      </span>
      <span className="text-right">
        {pos.side === 'long' ? '' : '-'}
        {pos.position}({pos.positionValue?.toFixed(2)}u)
      </span>
      <span className="text-muted-foreground">
        入 {formatPrice(pos.avgEntryPrice)} / fnd {fundingSign}
        {Math.abs(funding).toFixed(2)}
      </span>
      <span className={`text-right ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
        {pnlSign}
        {Math.abs(totalPnl).toFixed(2)}u
      </span>
    </div>
  )
}
