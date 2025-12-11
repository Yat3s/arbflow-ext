import { useEffect, useRef, useState } from 'react'
import type { ExchangeMarketStats, Position, PriceDiff, SymbolState } from '../../lib/types'
import { SpreadRow } from './SpreadRow'

interface MonitorState {
  condition: '>' | '<'
  threshold: string
  isMonitoring: boolean
}

interface TradeLog {
  id: number
  timestamp: Date
  message: string
}

interface SimulatedPositions {
  [exchangeId: string]: number
}

const DEFAULT_TRADE_INTERVAL = 500

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
  exchanges: { id: string; name: string; color: string }[],
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
        <span className="rounded px-1.5 py-0.5 text-white" style={{ backgroundColor: color }}>
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
          入场 {pos.avgEntryPrice.toFixed(2)} / 现价 {pos.markPrice.toFixed(2)} / fnd {fundingSign}
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
  const [positionMin, setPositionMin] = useState('-0.1')
  const [positionMax, setPositionMax] = useState('0.1')
  const [monitor2to1, setMonitor2to1] = useState<MonitorState>({
    condition: '>',
    threshold: '0.01',
    isMonitoring: false,
  })
  const [monitor1to2, setMonitor1to2] = useState<MonitorState>({
    condition: '>',
    threshold: '0.01',
    isMonitoring: false,
  })
  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>([])
  const [simulatedPositions, setSimulatedPositions] = useState<SimulatedPositions>({})
  const [simulatedProfit, setSimulatedProfit] = useState(0)
  const lastTradeTimeRef = useRef<{ '2to1': number; '1to2': number }>({ '2to1': 0, '1to2': 0 })
  const logIdRef = useRef(0)

  const positions = symbolState?.positions?.filter((p) => p.position !== 0) || []
  const stats = symbolState?.exchangeMarketStats || []
  const hasPositions = positions.length > 0

  const sortedStats = [...stats].sort((a, b) => a.exchangeId.localeCompare(b.exchangeId))
  const priceDiff = calculatePriceDiff(sortedStats, exchanges)

  const totalPnl = positions.reduce((sum, p) => sum + (p.unrealizedPnl || 0) + (p.funding || 0), 0)

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

  const addTradeLog = (message: string) => {
    logIdRef.current += 1
    setTradeLogs((prev) => [
      { id: logIdRef.current, timestamp: new Date(), message },
      ...prev.slice(0, 49),
    ])
  }

  useEffect(() => {
    if (!priceDiff) return

    const now = Date.now()
    const size = parseFloat(tradeSize) || 0
    const minPos = parseFloat(positionMin) || 0
    const maxPos = parseFloat(positionMax) || 0
    const currentPlatform1Pos = simulatedPositions[priceDiff.platform1Id] || 0

    if (monitor2to1.isMonitoring && size > 0) {
      const percentage = (priceDiff.spread2to1 / priceDiff.platform2Ask) * 100
      const threshold = parseFloat(monitor2to1.threshold) || 0
      const conditionMet =
        monitor2to1.condition === '>' ? percentage > threshold : percentage < threshold

      const newPlatform1Pos = currentPlatform1Pos - size
      const withinLimits = newPlatform1Pos >= minPos && newPlatform1Pos <= maxPos

      if (conditionMet && now - lastTradeTimeRef.current['2to1'] >= DEFAULT_TRADE_INTERVAL) {
        lastTradeTimeRef.current['2to1'] = now
        if (withinLimits) {
          const sellPrice = priceDiff.platform1Bid
          const buyPrice = priceDiff.platform2Ask
          const profit = size * sellPrice - size * buyPrice
          setSimulatedProfit((prev) => prev + profit)
          setSimulatedPositions((prev) => ({
            ...prev,
            [priceDiff.platform1Id]: (prev[priceDiff.platform1Id] || 0) - size,
            [priceDiff.platform2Id]: (prev[priceDiff.platform2Id] || 0) + size,
          }))
          addTradeLog(
            `[模拟] 在 ${priceDiff.platform1Id} 卖出 ${size} ${symbol}(${sellPrice.toFixed(2)}), 在 ${priceDiff.platform2Id} 买入 ${size} ${symbol}(${buyPrice.toFixed(2)}), 收益 ${profit >= 0 ? '+' : ''}${profit.toFixed(2)}U`,
          )
        } else {
          addTradeLog(
            `[跳过] 超出持仓限制: ${priceDiff.platform1Id} 当前=${currentPlatform1Pos.toFixed(4)}, 交易后=${newPlatform1Pos.toFixed(4)}, 限制=[${minPos}, ${maxPos}]`,
          )
        }
      }
    }

    if (monitor1to2.isMonitoring && size > 0) {
      const percentage = (priceDiff.spread1to2 / priceDiff.platform1Ask) * 100
      const threshold = parseFloat(monitor1to2.threshold) || 0
      const conditionMet =
        monitor1to2.condition === '>' ? percentage > threshold : percentage < threshold

      const newPlatform1Pos = currentPlatform1Pos + size
      const withinLimits = newPlatform1Pos >= minPos && newPlatform1Pos <= maxPos

      if (conditionMet && now - lastTradeTimeRef.current['1to2'] >= DEFAULT_TRADE_INTERVAL) {
        lastTradeTimeRef.current['1to2'] = now
        if (withinLimits) {
          const sellPrice = priceDiff.platform2Bid
          const buyPrice = priceDiff.platform1Ask
          const profit = size * sellPrice - size * buyPrice
          setSimulatedProfit((prev) => prev + profit)
          setSimulatedPositions((prev) => ({
            ...prev,
            [priceDiff.platform2Id]: (prev[priceDiff.platform2Id] || 0) - size,
            [priceDiff.platform1Id]: (prev[priceDiff.platform1Id] || 0) + size,
          }))
          addTradeLog(
            `[模拟] 在 ${priceDiff.platform2Id} 卖出 ${size} ${symbol}(${sellPrice.toFixed(2)}), 在 ${priceDiff.platform1Id} 买入 ${size} ${symbol}(${buyPrice.toFixed(2)}), 收益 ${profit >= 0 ? '+' : ''}${profit.toFixed(2)}U`,
          )
        } else {
          addTradeLog(
            `[跳过] 超出持仓限制: ${priceDiff.platform1Id} 当前=${currentPlatform1Pos.toFixed(4)}, 交易后=${newPlatform1Pos.toFixed(4)}, 限制=[${minPos}, ${maxPos}]`,
          )
        }
      }
    }
  }, [
    priceDiff,
    monitor2to1,
    monitor1to2,
    tradeSize,
    symbol,
    positionMin,
    positionMax,
    simulatedPositions,
  ])

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
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground">执行数量:</label>
            <input
              type="number"
              value={tradeSize}
              onChange={(e) => setTradeSize(e.target.value)}
              step="0.01"
              min="0"
              className="w-20 rounded border bg-background px-2 py-1 text-xs"
            />
            <span className="text-xs text-muted-foreground">{priceDiff.platform1Id}持仓:</span>
            <input
              type="number"
              value={positionMin}
              onChange={(e) => setPositionMin(e.target.value)}
              step="0.01"
              className="w-20 rounded border bg-background px-2 py-1 text-xs"
              placeholder="最小"
            />
            <span className="text-xs text-muted-foreground">~</span>
            <input
              type="number"
              value={positionMax}
              onChange={(e) => setPositionMax(e.target.value)}
              step="0.01"
              className="w-20 rounded border bg-background px-2 py-1 text-xs"
              placeholder="最大"
            />
          </div>
          <SpreadRow
            label={`-${priceDiff.platform1Id}+${priceDiff.platform2Id}`}
            spread={priceDiff.spread2to1}
            refPrice={priceDiff.platform2Ask}
            onExecute={() => handleExecute('2to1')}
            monitorCondition={monitor2to1.condition}
            monitorThreshold={monitor2to1.threshold}
            isMonitoring={monitor2to1.isMonitoring}
            onMonitorConditionToggle={() =>
              setMonitor2to1((prev) => ({
                ...prev,
                condition: prev.condition === '>' ? '<' : '>',
              }))
            }
            onMonitorThresholdChange={(value) =>
              setMonitor2to1((prev) => ({ ...prev, threshold: value }))
            }
            onMonitorToggle={() =>
              setMonitor2to1((prev) => ({ ...prev, isMonitoring: !prev.isMonitoring }))
            }
          />
          <SpreadRow
            label={`-${priceDiff.platform2Id}+${priceDiff.platform1Id}`}
            spread={priceDiff.spread1to2}
            refPrice={priceDiff.platform1Ask}
            onExecute={() => handleExecute('1to2')}
            monitorCondition={monitor1to2.condition}
            monitorThreshold={monitor1to2.threshold}
            isMonitoring={monitor1to2.isMonitoring}
            onMonitorConditionToggle={() =>
              setMonitor1to2((prev) => ({
                ...prev,
                condition: prev.condition === '>' ? '<' : '>',
              }))
            }
            onMonitorThresholdChange={(value) =>
              setMonitor1to2((prev) => ({ ...prev, threshold: value }))
            }
            onMonitorToggle={() =>
              setMonitor1to2((prev) => ({ ...prev, isMonitoring: !prev.isMonitoring }))
            }
          />

          {(Object.keys(simulatedPositions).length > 0 || simulatedProfit !== 0) && (
            <div className="mt-2 flex items-center gap-3 rounded border border-border bg-muted/30 px-2 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">模拟持仓:</span>
              {Object.entries(simulatedPositions).map(([exchangeId, position]) => {
                const exchange = exchanges.find((e) => e.id === exchangeId)
                return (
                  <div key={exchangeId} className="flex items-center gap-1 text-xs">
                    <span
                      className="rounded px-1 py-0.5 text-white"
                      style={{ backgroundColor: exchange?.color || '#6366f1' }}
                    >
                      {exchangeId}
                    </span>
                    <span className={position >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {position >= 0 ? '+' : ''}
                      {position.toFixed(4)}
                    </span>
                  </div>
                )
              })}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">收益:</span>
                <span className={simulatedProfit >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {simulatedProfit >= 0 ? '+' : ''}
                  {simulatedProfit.toFixed(2)}U
                </span>
              </div>
              <button
                onClick={() => {
                  setSimulatedPositions({})
                  setSimulatedProfit(0)
                }}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                重置
              </button>
            </div>
          )}

          {tradeLogs.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto rounded border border-border bg-muted/30 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">模拟交易日志</span>
                <button
                  onClick={() => setTradeLogs([])}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  清空
                </button>
              </div>
              <div className="space-y-0.5">
                {tradeLogs.map((log) => (
                  <div key={log.id} className="text-xs text-muted-foreground">
                    <span className="text-foreground/60">
                      [{log.timestamp.toLocaleTimeString()}]
                    </span>{' '}
                    {log.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
