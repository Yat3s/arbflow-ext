import { useState } from 'react'
import type { SymbolState, Position, ExchangeMarketStats, PriceDiff } from '../../lib/types'
import { SpreadRow } from './SpreadRow'

interface PositionGroupProps {
  symbol: string
  symbolState: SymbolState | undefined
  exchanges: { id: string; name: string; color: string }[]
  onExecuteArbitrage: (symbol: string, direction: '1to2' | '2to1', size: number) => void
}

function formatUpdateTime(timestamp?: number): string {
  if (!timestamp) return '--:--:--'
  const d = new Date(timestamp)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function calculatePriceDiff(
  stats: ExchangeMarketStats[],
  exchanges: { id: string; name: string; color: string }[]
): PriceDiff | null {
  if (stats.length < 2) return null

  const stat1 = stats[0]
  const stat2 = stats[1]

  const platform1Ask = stat1?.orderBook?.asks?.[0]?.price
  const platform1Bid = stat1?.orderBook?.bids?.[0]?.price
  const platform2Ask = stat2?.orderBook?.asks?.[0]?.price
  const platform2Bid = stat2?.orderBook?.bids?.[0]?.price

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
    spread1to2: platform2Bid - platform1Ask,
    spread2to1: platform1Bid - platform2Ask,
    platform1Ask,
    platform2Ask,
    platform1Bid,
    platform2Bid,
  }
}

function PositionItem({ pos, exchange }: { pos: Position; exchange?: { color: string } }) {
  const color = exchange?.color || '#6366f1'
  const funding = pos.funding || 0
  const totalPnl = pos.unrealizedPnl + funding
  const pnlSign = totalPnl >= 0 ? '+' : '-'
  const fundingSign = funding >= 0 ? '+' : '-'
  const isStale = pos.lastUpdated && Date.now() - pos.lastUpdated > 60000

  return (
    <div className="flex items-center justify-between rounded bg-muted/50 p-2 text-xs">
      <div className="flex items-center gap-2">
        <span
          className="rounded px-1.5 py-0.5 text-white"
          style={{ backgroundColor: color }}
        >
          {pos.exchangeId}
        </span>
        <span className={`text-muted-foreground ${isStale ? 'opacity-50' : ''}`}>
          {formatUpdateTime(pos.lastUpdated)}
        </span>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-1 py-0.5 text-white ${
              pos.side === 'long' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {pos.side === 'long' ? '多' : '空'}
          </span>
          <span>
            {pos.position}({pos.positionValue?.toFixed(2)}u)
          </span>
        </div>
        <div className="text-muted-foreground">
          入场 {pos.avgEntryPrice.toFixed(2)} / 现价 {pos.markPrice.toFixed(2)} / fnd{' '}
          {fundingSign}
          {Math.abs(funding).toFixed(2)}
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className={totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}>
          {pnlSign}
          {Math.abs(totalPnl).toFixed(2)}u
        </span>
        {pos.unrealizedPnlPercent !== 0 && (
          <span className="text-muted-foreground">
            ({pos.unrealizedPnlPercent >= 0 ? '+' : ''}
            {pos.unrealizedPnlPercent.toFixed(1)}%)
          </span>
        )}
      </div>
    </div>
  )
}

export function PositionGroup({
  symbol,
  symbolState,
  exchanges,
  onExecuteArbitrage,
}: PositionGroupProps) {
  const [tradeSize, setTradeSize] = useState('0.01')
  const positions = symbolState?.positions?.filter((p) => p.position !== 0) || []
  const stats = symbolState?.exchangeMarketStats || []
  const hasPositions = positions.length > 0

  const sortedStats = [...stats].sort((a, b) => a.exchangeId.localeCompare(b.exchangeId))
  const priceDiff = calculatePriceDiff(sortedStats, exchanges)

  const totalPnl = positions.reduce(
    (sum, p) => sum + (p.unrealizedPnl || 0) + (p.funding || 0),
    0
  )

  const netPosition = positions.reduce((sum, p) => {
    const size = p.position || 0
    return sum + (p.side === 'long' ? size : -size)
  }, 0)
  const isUnbalanced = Math.abs(netPosition) > 0.0001

  const handleExecute = (direction: '1to2' | '2to1') => {
    const size = parseFloat(tradeSize) || 0
    if (size <= 0) {
      alert('请输入有效的交易数量')
      return
    }
    onExecuteArbitrage(symbol, direction, size)
  }

  return (
    <div className={`rounded-lg border p-3 ${hasPositions ? 'border-border' : 'border-muted'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{symbol}</span>
          {isUnbalanced && (
            <span className="text-xs text-yellow-500" title={`净仓位: ${netPosition.toFixed(4)}`}>
              ⚠ 仓位未对齐
            </span>
          )}
        </div>
        {hasPositions ? (
          <span className={totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}>
            {totalPnl >= 0 ? '+' : '-'}
            {Math.abs(totalPnl).toFixed(2)}u
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">无仓位</span>
        )}
      </div>

      {hasPositions && (
        <div className="mt-2 space-y-1">
          {positions
            .sort((a, b) => (a.exchangeId || '').localeCompare(b.exchangeId || ''))
            .map((pos, idx) => (
              <PositionItem
                key={idx}
                pos={pos}
                exchange={exchanges.find((e) => e.id === pos.exchangeId)}
              />
            ))}
        </div>
      )}

      {priceDiff && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">执行数量:</label>
            <input
              type="number"
              value={tradeSize}
              onChange={(e) => setTradeSize(e.target.value)}
              step="0.01"
              min="0"
              className="w-24 rounded border bg-background px-2 py-1 text-xs"
            />
          </div>
          <SpreadRow
            label={`-${priceDiff.platform1Id}+${priceDiff.platform2Id}`}
            spread={priceDiff.spread2to1}
            refPrice={priceDiff.platform2Ask}
            onExecute={() => handleExecute('2to1')}
          />
          <SpreadRow
            label={`-${priceDiff.platform2Id}+${priceDiff.platform1Id}`}
            spread={priceDiff.spread1to2}
            refPrice={priceDiff.platform1Ask}
            onExecute={() => handleExecute('1to2')}
          />
        </div>
      )}
    </div>
  )
}
