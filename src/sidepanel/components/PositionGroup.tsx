import { useCallback, useEffect, useRef, useState } from 'react'
import dingSound from '../../assets/ding.mp3'
import warnSound from '../../assets/warn.wav'
import { SYMBOL_ICON_MAP } from '../../lib/symbols'
import type { ExchangeMarketStats, PriceDiff, SymbolState } from '../../lib/types'
import { formatTime } from '../../lib/utils'
import { ActionPanel } from './ActionPanel'
import { PositionItem } from './PositionItem'

const playDing = () => new Audio(dingSound).play().catch(() => {})
const playWarn = () => new Audio(warnSound).play().catch(() => {})

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

const DEFAULT_TRADE_INTERVAL = '1000'
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
  globalTradeInterval: number
  globalLastTradeTimeRef: React.MutableRefObject<number>
  consecutiveTriggerCount: number
}

function calculateWeightedPrice(
  orders: { price: number; quantity: number }[],
  targetSize: number,
): number | null {
  if (!orders || orders.length === 0) return null
  if (targetSize <= 0) return orders[0]?.price ?? null

  let remainingSize = targetSize
  let totalValue = 0
  let totalQuantity = 0

  for (const order of orders) {
    const fillQuantity = Math.min(remainingSize, order.quantity)
    totalValue += fillQuantity * order.price
    totalQuantity += fillQuantity
    remainingSize -= fillQuantity

    if (remainingSize <= 0) break
  }

  if (totalQuantity === 0) return null
  return totalValue / totalQuantity
}

function calculatePriceDiff(
  stats: ExchangeMarketStats[],
  exchanges: { id: string; name: string; color: string }[],
  tradeSize: number,
): PriceDiff | null {
  if (stats.length < 2) return null

  const stat1 = stats[0]
  const stat2 = stats[1]

  const platform1Ask = calculateWeightedPrice(stat1?.orderBook?.asks || [], tradeSize)
  const platform1Bid = calculateWeightedPrice(stat1?.orderBook?.bids || [], tradeSize)
  const platform2Ask = calculateWeightedPrice(stat2?.orderBook?.asks || [], tradeSize)
  const platform2Bid = calculateWeightedPrice(stat2?.orderBook?.bids || [], tradeSize)

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

export function PositionGroup({
  symbol,
  symbolState,
  exchanges,
  onExecuteArbitrage,
  onExecuteSingleTrade,
  globalTradeInterval,
  globalLastTradeTimeRef,
  consecutiveTriggerCount,
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
  const [isCollapsed, setIsCollapsed] = useState(false)
  const lastTradeTimeRef = useRef<{ '2to1': number; '1to2': number }>({ '2to1': 0, '1to2': 0 })
  const consecutiveTriggerRef = useRef<{ '2to1': number; '1to2': number }>({ '2to1': 0, '1to2': 0 })
  const firstUnbalancedTimeRef = useRef<number | null>(null)
  const logIdRef = useRef(0)

  const positions = symbolState?.positions?.filter((p) => p.position !== 0) || []
  const stats = symbolState?.exchangeMarketStats || []
  const hasPositions = positions.length > 0

  const sortedStats = [...stats].sort((a, b) => a.exchangeId.localeCompare(b.exchangeId))
  const tradeSizeNum = parseFloat(tradeSize) || 0
  const priceDiff = calculatePriceDiff(sortedStats, exchanges, tradeSizeNum)

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
        addTradeLog(`[错误] ${platformId} 补齐失败: ${e.message}`)
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

    if (monitor2to1.isMonitoring || monitor1to2.isMonitoring) {
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

      const t1 = formatTime(priceDiff.platform1LastUpdated)
      const t2 = formatTime(priceDiff.platform2LastUpdated)
      const hasSkew = t1.skew || t2.skew

      if (hasSkew) {
        if (monitor2to1.isMonitoring) {
          setMonitor2to1((prev) => ({ ...prev, isMonitoring: false }))
        }
        if (monitor1to2.isMonitoring) {
          setMonitor1to2((prev) => ({ ...prev, isMonitoring: false }))
        }
        addTradeLog(
          `[停止] 价格数据延迟 (${t1.skew ? priceDiff.platform1Id : ''}${t1.skew && t2.skew ? '/' : ''}${t2.skew ? priceDiff.platform2Id : ''})，自动交易已停止`,
        )
        return
      }
    }

    const size = parseFloat(tradeSize) || 0
    const minPos = parseFloat(positionMin) || 0
    const maxPos = parseFloat(positionMax) || 0
    const currentPlatform1Pos = positionByExchange[priceDiff.platform1Id] || 0

    const processDirection = (
      direction: '2to1' | '1to2',
      monitor: MonitorState,
      spread: number,
      refPrice: number,
      sellPlatformId: string,
      buyPlatformId: string,
      sellPrice: number,
      buyPrice: number,
      positionDelta: number,
    ) => {
      if (!monitor.isMonitoring || size <= 0) {
        consecutiveTriggerRef.current[direction] = 0
        return
      }

      const threshold = parseFloat(monitor.threshold) || 0
      const compareValue = monitor.unit === 'percent' ? (spread / refPrice) * 100 : spread
      const conditionMet =
        monitor.condition === '>' ? compareValue > threshold : compareValue < threshold

      if (conditionMet) {
        consecutiveTriggerRef.current[direction] += 1
      } else {
        consecutiveTriggerRef.current[direction] = 0
      }

      const newPlatform1Pos = currentPlatform1Pos + positionDelta

      const isWithinLimits = newPlatform1Pos >= minPos && newPlatform1Pos <= maxPos
      const isMovingTowardsLimits =
        (currentPlatform1Pos > maxPos && positionDelta < 0) ||
        (currentPlatform1Pos < minPos && positionDelta > 0)
      const canTrade = isWithinLimits || isMovingTowardsLimits

      const timeSinceLastLocalTrade = now - lastTradeTimeRef.current[direction]
      const timeSinceLastGlobalTrade = now - globalLastTradeTimeRef.current

      if (
        consecutiveTriggerRef.current[direction] >= consecutiveTriggerCount &&
        timeSinceLastLocalTrade >= interval &&
        timeSinceLastGlobalTrade >= globalTradeInterval
      ) {
        lastTradeTimeRef.current[direction] = now
        globalLastTradeTimeRef.current = now
        consecutiveTriggerRef.current[direction] = 0

        if (canTrade) {
          addTradeLog(
            `[交易] 执行中: 在 ${sellPlatformId} 卖出 ${size} ${symbol}(${sellPrice.toFixed(2)}), 在 ${buyPlatformId} 买入 ${size} ${symbol}(${buyPrice.toFixed(2)})`,
          )
          onExecuteArbitrage(symbol, direction, size)
            .then(() => {
              addTradeLog(`[交易] 完成: -${sellPlatformId}+${buyPlatformId}`)
              playDing()
            })
            .catch((e: Error) => {
              addTradeLog(`[错误] -${sellPlatformId}+${buyPlatformId} 交易失败: ${e.message}`)
              playWarn()
            })
        } else {
          addTradeLog(
            `[跳过] 超出持仓限制: ${priceDiff.platform1Id} 当前=${currentPlatform1Pos.toFixed(4)}, 交易后=${newPlatform1Pos.toFixed(4)}, 限制=[${minPos}, ${maxPos}]`,
          )
        }
      }
    }

    processDirection(
      '2to1',
      monitor2to1,
      priceDiff.spread2to1,
      priceDiff.platform2Ask,
      priceDiff.platform1Id,
      priceDiff.platform2Id,
      priceDiff.platform1Bid,
      priceDiff.platform2Ask,
      -size,
    )

    processDirection(
      '1to2',
      monitor1to2,
      priceDiff.spread1to2,
      priceDiff.platform1Ask,
      priceDiff.platform2Id,
      priceDiff.platform1Id,
      priceDiff.platform2Bid,
      priceDiff.platform1Ask,
      size,
    )
  }, [
    priceDiff,
    monitor2to1,
    monitor1to2,
    tradeSize,
    symbol,
    positionMin,
    positionMax,
    tradeInterval,
    positionByExchange,
    isUnbalanced,
    netPosition,
    onExecuteArbitrage,
    globalTradeInterval,
    consecutiveTriggerCount,
  ])

  const isAnyMonitoring = monitor2to1.isMonitoring || monitor1to2.isMonitoring

  const getMonitoringSummary = () => {
    if (!isAnyMonitoring || !priceDiff) return null
    const parts: string[] = []
    if (monitor2to1.isMonitoring) {
      parts.push(
        `-${priceDiff.platform1Id}+${priceDiff.platform2Id} ${monitor2to1.condition} ${monitor2to1.threshold}${monitor2to1.unit === 'percent' ? '%' : 'u'}`,
      )
    }
    if (monitor1to2.isMonitoring) {
      parts.push(
        `-${priceDiff.platform2Id}+${priceDiff.platform1Id} ${monitor1to2.condition} ${monitor1to2.threshold}${monitor1to2.unit === 'percent' ? '%' : 'u'}`,
      )
    }
    return parts.join(' | ')
  }

  return (
    <div
      className={`rounded-md border p-3 border-dashed  ${hasPositions ? 'border-muted-foreground/70' : 'border-muted-foreground/30'}`}
    >
      <div
        onClick={() => {
          setIsCollapsed(!isCollapsed)
        }}
        className="flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {SYMBOL_ICON_MAP[symbol] && (
            <img src={SYMBOL_ICON_MAP[symbol]} alt={symbol} className="w-5 h-5 rounded-full" />
          )}
          <span className="text-xl font-medium">{symbol}</span>
          {isUnbalanced && (
            <span className="text-xs text-yellow-600" title={`净仓位: ${netPosition.toFixed(4)}`}>
              ⚠ 仓位未对齐
            </span>
          )}
          {isCollapsed && isAnyMonitoring && (
            <span className="text-xs text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">
              [监控中] {getMonitoringSummary()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasPositions ? (
            <span className={totalPnl >= 0 ? '' : ''}>
              {totalPnl >= 0 ? '+' : '-'}
              {Math.abs(totalPnl).toFixed(2)}u
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">无仓位</span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
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
            <ActionPanel
              priceDiff={priceDiff}
              tradeSize={tradeSize}
              setTradeSize={setTradeSize}
              positionMin={positionMin}
              setPositionMin={setPositionMin}
              positionMax={positionMax}
              setPositionMax={setPositionMax}
              tradeInterval={tradeInterval}
              setTradeInterval={setTradeInterval}
              monitor2to1={monitor2to1}
              setMonitor2to1={setMonitor2to1}
              monitor1to2={monitor1to2}
              setMonitor1to2={setMonitor1to2}
              tradeLogs={tradeLogs}
              setTradeLogs={setTradeLogs}
              onExecute={handleExecute}
              positionByExchange={positionByExchange}
              onRebalance={handleRebalance}
            />
          )}
        </>
      )}
    </div>
  )
}
