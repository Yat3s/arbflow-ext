import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExchangeMarketStats, Position, PriceDiff, SymbolState } from '../../lib/types'
import { ActionPanel, type TradeMode } from './ActionPanel'

interface SymbolSettings {
  tradeSize: string
  positionMin: string
  positionMax: string
  tradeInterval: string
  monitor2to1: { condition: '>' | '<'; unit: 'percent' | 'usdt'; threshold: string }
  monitor1to2: { condition: '>' | '<'; unit: 'percent' | 'usdt'; threshold: string }
}

function loadSymbolSettings(symbol: string): SymbolSettings | null {
  try {
    const stored = localStorage.getItem(`arbflow_symbol_${symbol}`)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function saveSymbolSettings(symbol: string, settings: SymbolSettings) {
  try {
    localStorage.setItem(`arbflow_symbol_${symbol}`, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

interface MonitorState {
  condition: '>' | '<'
  unit: 'percent' | 'usdt'
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

const DEFAULT_TRADE_INTERVAL = '500'
const STOP_UNBALANCED_INTERVAL = 3000

interface PositionGroupProps {
  symbol: string
  symbolState: SymbolState | undefined
  exchanges: { id: string; name: string; color: string }[]
  onExecuteArbitrage: (symbol: string, direction: '1to2' | '2to1', size: number) => Promise<void>
  onExecuteSingleTrade: (
    exchangeId: string,
    symbol: string,
    direction: 'long' | 'short',
    size: number,
  ) => Promise<void>
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
    platform1LastUpdated: stat1.lastUpdated,
    platform2LastUpdated: stat2.lastUpdated,
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
    <div className="grid grid-cols-[auto_40px_90px_1fr_40px] items-center gap-2 text-[10px]">
      <span
        className="w-10 text-center px-1.5 py-0.5 text-black font-bold"
        style={{ backgroundColor: color }}
      >
        {pos.exchangeId}
      </span>
      <span className={`text-muted-foreground ${isStale ? 'opacity-50' : ''}`}>
        {formatUpdateTime(pos.lastUpdated)}
      </span>
      <span className="text-right">
        {pos.side === 'long' ? '' : '-'}
        {pos.position}({pos.positionValue?.toFixed(2)}u)
      </span>
      <span className="text-muted-foreground">
        入 {pos.avgEntryPrice.toFixed(2)} / 现 {pos.markPrice.toFixed(2)} / fnd {fundingSign}
        {Math.abs(funding).toFixed(2)}
      </span>
      <span className={`text-right ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
        {pnlSign}
        {Math.abs(totalPnl).toFixed(2)}u
      </span>
    </div>
  )
}

export function PositionGroup({
  symbol,
  symbolState,
  exchanges,
  onExecuteArbitrage,
  onExecuteSingleTrade,
}: PositionGroupProps) {
  const savedSettings = loadSymbolSettings(symbol)
  const [tradeSize, setTradeSize] = useState(savedSettings?.tradeSize ?? '')
  const [positionMin, setPositionMin] = useState(savedSettings?.positionMin ?? '')
  const [positionMax, setPositionMax] = useState(savedSettings?.positionMax ?? '')
  const [tradeInterval, setTradeInterval] = useState(
    savedSettings?.tradeInterval ?? DEFAULT_TRADE_INTERVAL,
  )
  const [monitor2to1, setMonitor2to1] = useState<MonitorState>({
    condition: savedSettings?.monitor2to1?.condition ?? '>',
    unit: savedSettings?.monitor2to1?.unit ?? 'percent',
    threshold: savedSettings?.monitor2to1?.threshold ?? '',
    isMonitoring: false,
  })
  const [monitor1to2, setMonitor1to2] = useState<MonitorState>({
    condition: savedSettings?.monitor1to2?.condition ?? '>',
    unit: savedSettings?.monitor1to2?.unit ?? 'percent',
    threshold: savedSettings?.monitor1to2?.threshold ?? '',
    isMonitoring: false,
  })
  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>([])
  const [simulatedPositions, setSimulatedPositions] = useState<SimulatedPositions>({})
  const [simulatedProfit, setSimulatedProfit] = useState(0)
  const [tradeMode, setTradeMode] = useState<TradeMode>('simulated')
  const lastTradeTimeRef = useRef<{ '2to1': number; '1to2': number }>({ '2to1': 0, '1to2': 0 })
  const consecutiveTriggerRef = useRef<{ '2to1': number; '1to2': number }>({ '2to1': 0, '1to2': 0 })
  const firstUnbalancedTimeRef = useRef<number | null>(null)
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

  const positionByExchange = positions.reduce(
    (acc, p) => {
      if (!p.exchangeId) return acc
      const size = p.position || 0
      const signedSize = p.side === 'long' ? size : -size
      acc[p.exchangeId] = (acc[p.exchangeId] || 0) + signedSize
      return acc
    },
    {} as { [exchangeId: string]: number },
  )

  const handleRebalance = (platformId: string, size: number, direction: 'long' | 'short') => {
    addTradeLog(
      `[补齐] 执行中: 在 ${platformId} ${direction === 'long' ? '买入' : '卖出'} ${size} ${symbol}`,
    )
    onExecuteSingleTrade(platformId, symbol, direction, size)
      .then(() => {
        addTradeLog(`[补齐] 完成: ${platformId} ${direction === 'long' ? '+' : '-'}${size}`)
      })
      .catch((e: Error) => {
        addTradeLog(`[错误] 补齐失败: ${e.message}`)
      })
  }

  const handleExecute = (direction: '1to2' | '2to1') => {
    const size = parseFloat(tradeSize) || 0
    if (size <= 0) {
      alert('请输入有效的交易数量')
      return
    }
    onExecuteArbitrage(symbol, direction, size)
  }

  const saveSettings = useCallback(() => {
    saveSymbolSettings(symbol, {
      tradeSize,
      positionMin,
      positionMax,
      tradeInterval,
      monitor2to1: {
        condition: monitor2to1.condition,
        unit: monitor2to1.unit,
        threshold: monitor2to1.threshold,
      },
      monitor1to2: {
        condition: monitor1to2.condition,
        unit: monitor1to2.unit,
        threshold: monitor1to2.threshold,
      },
    })
  }, [symbol, tradeSize, positionMin, positionMax, tradeInterval, monitor2to1, monitor1to2])

  useEffect(() => {
    saveSettings()
  }, [saveSettings])

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
    const interval = parseInt(tradeInterval) || 500

    if (tradeMode === 'real' && (monitor2to1.isMonitoring || monitor1to2.isMonitoring)) {
      if (isUnbalanced) {
        if (firstUnbalancedTimeRef.current === null) {
          firstUnbalancedTimeRef.current = now
        } else if (now - firstUnbalancedTimeRef.current >= STOP_UNBALANCED_INTERVAL) {
          if (monitor2to1.isMonitoring) {
            setMonitor2to1((prev) => ({ ...prev, isMonitoring: false }))
          }
          if (monitor1to2.isMonitoring) {
            setMonitor1to2((prev) => ({ ...prev, isMonitoring: false }))
          }
          addTradeLog(
            `[停止] 仓位不对齐持续超过 ${STOP_UNBALANCED_INTERVAL}ms (净仓位: ${netPosition.toFixed(4)})，自动交易已停止`,
          )
          firstUnbalancedTimeRef.current = null
          return
        }
      } else {
        firstUnbalancedTimeRef.current = null
      }
    }

    const size = parseFloat(tradeSize) || 0
    const minPos = parseFloat(positionMin) || 0
    const maxPos = parseFloat(positionMax) || 0
    const currentPlatform1Pos = simulatedPositions[priceDiff.platform1Id] || 0

    if (monitor2to1.isMonitoring && size > 0) {
      const threshold = parseFloat(monitor2to1.threshold) || 0
      const compareValue =
        monitor2to1.unit === 'percent'
          ? (priceDiff.spread2to1 / priceDiff.platform2Ask) * 100
          : priceDiff.spread2to1
      const conditionMet =
        monitor2to1.condition === '>' ? compareValue > threshold : compareValue < threshold

      if (conditionMet) {
        consecutiveTriggerRef.current['2to1'] += 1
      } else {
        consecutiveTriggerRef.current['2to1'] = 0
      }

      const newPlatform1Pos = currentPlatform1Pos - size
      const withinLimits = newPlatform1Pos >= minPos && newPlatform1Pos <= maxPos

      if (
        consecutiveTriggerRef.current['2to1'] >= 2 &&
        now - lastTradeTimeRef.current['2to1'] >= interval
      ) {
        lastTradeTimeRef.current['2to1'] = now
        consecutiveTriggerRef.current['2to1'] = 0
        if (withinLimits) {
          if (tradeMode === 'simulated') {
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
            const sellPrice = priceDiff.platform1Bid
            const buyPrice = priceDiff.platform2Ask
            addTradeLog(
              `[真实] 执行中: 在 ${priceDiff.platform1Id} 卖出 ${size} ${symbol}(${sellPrice.toFixed(2)}), 在 ${priceDiff.platform2Id} 买入 ${size} ${symbol}(${buyPrice.toFixed(2)})`,
            )
            onExecuteArbitrage(symbol, '2to1', size)
              .then(() => {
                addTradeLog(`[真实] 交易完成: -${priceDiff.platform1Id}+${priceDiff.platform2Id}`)
              })
              .catch((e: Error) => {
                addTradeLog(`[错误] 交易失败: ${e.message}`)
              })
          }
        } else {
          addTradeLog(
            `[跳过] 超出持仓限制: ${priceDiff.platform1Id} 当前=${currentPlatform1Pos.toFixed(4)}, 交易后=${newPlatform1Pos.toFixed(4)}, 限制=[${minPos}, ${maxPos}]`,
          )
        }
      }
    } else {
      consecutiveTriggerRef.current['2to1'] = 0
    }

    if (monitor1to2.isMonitoring && size > 0) {
      const threshold = parseFloat(monitor1to2.threshold) || 0
      const compareValue =
        monitor1to2.unit === 'percent'
          ? (priceDiff.spread1to2 / priceDiff.platform1Ask) * 100
          : priceDiff.spread1to2
      const conditionMet =
        monitor1to2.condition === '>' ? compareValue > threshold : compareValue < threshold

      if (conditionMet) {
        consecutiveTriggerRef.current['1to2'] += 1
      } else {
        consecutiveTriggerRef.current['1to2'] = 0
      }

      const newPlatform1Pos = currentPlatform1Pos + size
      const withinLimits = newPlatform1Pos >= minPos && newPlatform1Pos <= maxPos

      if (
        consecutiveTriggerRef.current['1to2'] >= 2 &&
        now - lastTradeTimeRef.current['1to2'] >= interval
      ) {
        lastTradeTimeRef.current['1to2'] = now
        consecutiveTriggerRef.current['1to2'] = 0
        if (withinLimits) {
          if (tradeMode === 'simulated') {
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
            const sellPrice = priceDiff.platform2Bid
            const buyPrice = priceDiff.platform1Ask
            addTradeLog(
              `[真实] 执行中: 在 ${priceDiff.platform2Id} 卖出 ${size} ${symbol}(${sellPrice.toFixed(2)}), 在 ${priceDiff.platform1Id} 买入 ${size} ${symbol}(${buyPrice.toFixed(2)})`,
            )
            onExecuteArbitrage(symbol, '1to2', size)
              .then(() => {
                addTradeLog(`[真实] 交易完成: -${priceDiff.platform2Id}+${priceDiff.platform1Id}`)
              })
              .catch((e: Error) => {
                addTradeLog(`[错误] 交易失败: ${e.message}`)
              })
          }
        } else {
          addTradeLog(
            `[跳过] 超出持仓限制: ${priceDiff.platform1Id} 当前=${currentPlatform1Pos.toFixed(4)}, 交易后=${newPlatform1Pos.toFixed(4)}, 限制=[${minPos}, ${maxPos}]`,
          )
        }
      }
    } else {
      consecutiveTriggerRef.current['1to2'] = 0
    }
  }, [
    priceDiff,
    monitor2to1,
    monitor1to2,
    tradeSize,
    symbol,
    positionMin,
    positionMax,
    tradeInterval,
    simulatedPositions,
    tradeMode,
    isUnbalanced,
    netPosition,
    onExecuteArbitrage,
  ])

  return (
    <div
      className={`rounded-md border p-3 border-dashed  ${hasPositions ? 'border-muted-foreground/60' : 'border-muted-foreground/40'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-medium">{symbol}</span>
          {isUnbalanced && (
            <span className="text-xs text-yellow-600" title={`净仓位: ${netPosition.toFixed(4)}`}>
              ⚠ 仓位未对齐
            </span>
          )}
        </div>
        {hasPositions ? (
          <span className={totalPnl >= 0 ? '' : ''}>
            {totalPnl >= 0 ? '+' : '-'}
            {Math.abs(totalPnl).toFixed(2)}u
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">无仓位</span>
        )}
      </div>

      {hasPositions && (
        <>
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
        </>
      )}

      {priceDiff && (
        <ActionPanel
          priceDiff={priceDiff}
          exchanges={exchanges}
          tradeSize={tradeSize}
          setTradeSize={setTradeSize}
          positionMin={positionMin}
          setPositionMin={setPositionMin}
          positionMax={positionMax}
          setPositionMax={setPositionMax}
          tradeInterval={tradeInterval}
          setTradeInterval={setTradeInterval}
          tradeMode={tradeMode}
          setTradeMode={setTradeMode}
          monitor2to1={monitor2to1}
          setMonitor2to1={setMonitor2to1}
          monitor1to2={monitor1to2}
          setMonitor1to2={setMonitor1to2}
          simulatedPositions={simulatedPositions}
          setSimulatedPositions={setSimulatedPositions}
          simulatedProfit={simulatedProfit}
          setSimulatedProfit={setSimulatedProfit}
          tradeLogs={tradeLogs}
          setTradeLogs={setTradeLogs}
          onExecute={handleExecute}
          positionByExchange={positionByExchange}
          onRebalance={handleRebalance}
        />
      )}
    </div>
  )
}
