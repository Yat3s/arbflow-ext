import { useCallback, useEffect, useRef, useState } from 'react'
import dingSound from '../../assets/ding.mp3'
import warnSound from '../../assets/warn.wav'
import { calculatePriceDiff } from '../../lib/price'
import { loadSymbolSettings, saveSymbolSettings, type SymbolSettings } from '../../lib/storage'
import { SYMBOL_ICON_MAP } from '../../lib/symbols'
import type { SymbolState } from '../../lib/types'
import { formatTime } from '../../lib/utils'
import { ActionPanel } from './ActionPanel'
import { PositionItem } from './PositionItem'

const playDing = () => new Audio(dingSound).play().catch(() => {})
const playWarn = () => new Audio(warnSound).play().catch(() => {})

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

interface SymbolCardProps {
  symbol: string
  symbolState: SymbolState | undefined
  exchanges: { id: string; name: string; color: string }[]
  onDoTrades: (
    trades: { symbol: string; direction: 'long' | 'short'; size: number; platform: string }[],
  ) => Promise<void>
  globalTradeInterval: number
  globalLastTradeTimeRef: React.MutableRefObject<number>
  globalLastRefreshTimeRef: React.MutableRefObject<number>
  consecutiveTriggerCount: number
  onRefreshAllExchanges: () => Promise<void>
  autoRestartOnUnbalanced: boolean
  autoRebalanceOnError: boolean
  soundEnabled: boolean
}

const DEFAULT_TRADE_INTERVAL = '1000'
const REFRESH_INTERVAL = 5 * 60 * 1000
const STOP_MONITOR_IF_UNBALANCED_TIME = 10000

const AUTO_REBALANCE_DELAY = 3000
const AUTO_REBALANCE_COOLDOWN = 5 * 60 * 1000

export function SymbolCard({
  symbol,
  symbolState,
  exchanges,
  onDoTrades,
  globalTradeInterval,
  globalLastTradeTimeRef,
  globalLastRefreshTimeRef,
  consecutiveTriggerCount,
  onRefreshAllExchanges,
  autoRestartOnUnbalanced,
  autoRebalanceOnError,
  soundEnabled,
}: SymbolCardProps) {
  // ========== State initialization from localStorage ==========
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

  // ========== Refs for tracking trade timing ==========
  const lastTradeTimeRef = useRef<{ '2to1': number; '1to2': number }>({ '2to1': 0, '1to2': 0 })
  const consecutiveTriggerRef = useRef<{ '2to1': number; '1to2': number }>({
    '2to1': 0,
    '1to2': 0,
  })
  const firstUnbalancedTimeRef = useRef<number | null>(null)
  const isRefreshingRef = useRef(false)
  const logIdRef = useRef(0)
  const lastAutoRebalanceTimeRef = useRef<number>(0)

  // ========== Derived data from symbolState ==========
  const positions = symbolState?.positions?.filter((p) => p.position !== 0) || []
  const stats = symbolState?.exchangeMarketStats || []
  const hasPositions = positions.length > 0
  const sortedStats = [...stats].sort((a, b) => a.exchangeId.localeCompare(b.exchangeId))
  const tradeSizeNum = parseFloat(tradeSize) || 0
  const priceDiff = calculatePriceDiff(sortedStats, exchanges, tradeSizeNum)

  const totalPnl = positions.reduce((sum, p) => sum + (p.unrealizedPnl || 0) + (p.funding || 0), 0)

  // Net position across all exchanges (positive = net long, negative = net short)
  const netPosition = positions.reduce((sum, p) => {
    const size = p.position || 0
    return sum + (p.side === 'long' ? size : -size)
  }, 0)
  const isUnbalanced = Math.abs(netPosition) > 0.0001

  // Position by exchange (signed: positive = long, negative = short)
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

  const isAnyMonitoring = monitor2to1.isMonitoring || monitor1to2.isMonitoring

  // ========== Helper functions ==========
  const addTradeLog = (message: string) => {
    logIdRef.current += 1
    setTradeLogs((prev) => [
      { id: logIdRef.current, timestamp: new Date(), message },
      ...prev.slice(0, 49),
    ])
  }

  /**
   * Attempt to refresh all exchange connections if not already refreshing
   * and enough time has passed since last refresh
   */
  const tryRefreshAllExchanges = useCallback(
    (reason: string) => {
      const now = Date.now()
      const timeSinceLastRefresh = now - globalLastRefreshTimeRef.current
      if (isRefreshingRef.current || timeSinceLastRefresh < REFRESH_INTERVAL) {
        return
      }
      isRefreshingRef.current = true
      globalLastRefreshTimeRef.current = now
      addTradeLog(`[刷新] ${reason}，正在刷新交易所连接...`)
      onRefreshAllExchanges()
        .then(() => addTradeLog(`[刷新] 交易所连接已刷新`))
        .catch((e: Error) => addTradeLog(`[错误] 刷新失败: ${e.message}`))
        .finally(() => {
          isRefreshingRef.current = false
        })
    },
    [onRefreshAllExchanges],
  )

  // ========== Trade handlers ==========

  /**
   * Calculate the position delta on platform1 from all trades.
   * For arbitrage trades (both platforms), we only count platform1's direct change.
   * For single platform trades, we also only count platform1's direct change.
   * The position limits are set for platform1, so we only track platform1's actual position.
   */
  const calculatePlatform1Delta = useCallback(
    (trades: { direction: 'long' | 'short'; size: number; platform: string }[]): number => {
      if (!priceDiff) return 0
      return trades.reduce((delta, trade) => {
        const sign = trade.direction === 'long' ? 1 : -1
        if (trade.platform === priceDiff.platform1Id) {
          return delta + sign * trade.size
        }
        return delta
      }, 0)
    },
    [priceDiff],
  )

  /**
   * Core trade execution with position limits check and cooldown management
   * @param trades - Array of trades to execute
   * @param options - Optional config for the trade
   *   - direction: used for tracking local cooldown per direction
   *   - skipPositionCheck: bypass position limits check (for rebalance trades)
   *   - skipCooldown: bypass cooldown checks (for manual trades)
   *   - logPrefix: prefix for trade logs
   *   - onError: callback for handling errors (used for auto-rebalance)
   */
  type Trade = { symbol: string; direction: 'long' | 'short'; size: number; platform: string }

  const handleTrades = useCallback(
    (
      trades: Trade[],
      options?: {
        direction?: '2to1' | '1to2'
        skipPositionCheck?: boolean
        skipCooldown?: boolean
        logPrefix?: string
        onError?: (errorMessage: string, trades: Trade[]) => void
      },
    ): boolean => {
      if (!priceDiff || trades.length === 0) return false

      const now = Date.now()
      const interval = parseInt(tradeInterval) || 500
      const minPos = parseFloat(positionMin) || 0
      const maxPos = parseFloat(positionMax) || 0
      const currentPlatform1Pos = positionByExchange[priceDiff.platform1Id] || 0
      const direction = options?.direction
      const skipPositionCheck = options?.skipPositionCheck ?? false
      const skipCooldown = options?.skipCooldown ?? false
      const logPrefix = options?.logPrefix ?? '[交易]'

      // Calculate platform1 position delta from trades
      const positionDelta = calculatePlatform1Delta(trades)

      // Check position limits (only for platform1's direct position change)
      if (!skipPositionCheck && positionDelta !== 0) {
        const newPlatform1Pos = currentPlatform1Pos + positionDelta
        const isWithinLimits = newPlatform1Pos >= minPos && newPlatform1Pos <= maxPos
        // Allow trading if it moves position back towards limits
        const isMovingTowardsLimits =
          (currentPlatform1Pos > maxPos && positionDelta < 0) ||
          (currentPlatform1Pos < minPos && positionDelta > 0)
        const canTrade = isWithinLimits || isMovingTowardsLimits

        if (!canTrade) {
          return false
        }
      }

      // Check cooldown (skip for manual trades)
      if (!skipCooldown && direction) {
        const timeSinceLastLocalTrade = now - lastTradeTimeRef.current[direction]
        const timeSinceLastGlobalTrade = now - globalLastTradeTimeRef.current

        if (timeSinceLastLocalTrade < interval || timeSinceLastGlobalTrade < globalTradeInterval) {
          return false
        }

        // Update cooldown timestamps
        lastTradeTimeRef.current[direction] = now
        globalLastTradeTimeRef.current = now
      }

      // Build log message
      const tradeDesc = trades
        .map((t) => `${t.direction === 'long' ? '+' : '-'}${t.platform}`)
        .join('')

      addTradeLog(`${logPrefix} 执行中: ${tradeDesc} ${trades[0].size} ${symbol}`)

      onDoTrades(trades)
        .then(() => {
          addTradeLog(`${logPrefix} 完成: ${tradeDesc}`)
          if (soundEnabled) playDing()
        })
        .catch((e: Error) => {
          addTradeLog(`[错误] ${tradeDesc} 交易失败: ${e.message}`)
          if (soundEnabled) playWarn()
          options?.onError?.(e.message, trades)
        })

      return true
    },
    [
      priceDiff,
      tradeInterval,
      positionMin,
      positionMax,
      positionByExchange,
      globalTradeInterval,
      symbol,
      onDoTrades,
      soundEnabled,
      calculatePlatform1Delta,
    ],
  )

  const handleRebalance = (platformId: string, size: number, direction: 'long' | 'short') => {
    handleTrades([{ symbol, direction, size, platform: platformId }], {
      skipCooldown: true,
      logPrefix: '[补齐]',
    })
  }

  /**
   * Attempt to auto-rebalance after a trade error.
   * Calculates rebalance size based on actual net position, not the failed trade size.
   * This handles accumulated imbalance from multiple failures during cooldown.
   *
   * Safety checks:
   * 1. Wait 3 seconds before executing (API rate limit)
   * 2. Position limits are checked by handleTrades
   * 3. 5-minute cooldown between auto-rebalances
   * 4. Rebalance size based on actual net position
   */
  const tryAutoRebalance = useCallback(
    (
      errorMessage: string,
      trades: { symbol: string; direction: 'long' | 'short'; size: number; platform: string }[],
    ) => {
      if (!autoRebalanceOnError || !priceDiff) return

      // Check cooldown (5 minutes)
      const now = Date.now()
      if (now - lastAutoRebalanceTimeRef.current < AUTO_REBALANCE_COOLDOWN) {
        addTradeLog(`[自动补齐] 已记录，将在冷却结束后根据实际仓位补齐`)
        return
      }

      // Only handle arbitrage trades (2 platforms)
      if (trades.length !== 2) return

      // Parse failed platform from error message: "[PLATFORM] error message"
      const match = errorMessage.match(/^\[([^\]]+)\]/)
      if (!match) return
      const failedPlatform = match[1]

      addTradeLog(
        `[自动补齐] ${failedPlatform} 失败，将在 ${AUTO_REBALANCE_DELAY / 1000} 秒后根据实际仓位补齐`,
      )

      // Wait before executing (API rate limit)
      setTimeout(() => {
        // Check cooldown again in case another rebalance happened
        if (Date.now() - lastAutoRebalanceTimeRef.current < AUTO_REBALANCE_COOLDOWN) {
          addTradeLog(`[自动补齐] 跳过: 冷却时间内已有其他补齐操作`)
          return
        }

        // Calculate actual net position at execution time
        const currentPositions = symbolState?.positions?.filter((p) => p.position !== 0) || []
        const currentNetPosition = currentPositions.reduce((sum, p) => {
          const size = p.position || 0
          return sum + (p.side === 'long' ? size : -size)
        }, 0)

        // Check if still unbalanced
        if (Math.abs(currentNetPosition) <= 0.0001) {
          addTradeLog(`[自动补齐] 跳过: 仓位已平衡 (净仓位: ${currentNetPosition.toFixed(4)})`)
          return
        }

        const rebalanceSize = Math.round(Math.abs(currentNetPosition) * 10000) / 10000
        // netPosition < 0 means we need to long, netPosition > 0 means we need to short
        const rebalanceDirection: 'long' | 'short' = currentNetPosition < 0 ? 'long' : 'short'

        // Determine which platform to rebalance on (the one that didn't fail)
        const successfulTrade = trades.find((t) => t.platform !== failedPlatform)
        if (!successfulTrade) {
          addTradeLog(`[自动补齐] 跳过: 无法确定补齐平台`)
          return
        }

        const rebalanceTrade = {
          symbol,
          direction: rebalanceDirection,
          size: rebalanceSize,
          platform: successfulTrade.platform,
        }

        // Use handleTrades to ensure position limits are checked
        const executed = handleTrades([rebalanceTrade], {
          skipCooldown: true,
          logPrefix: '[自动补齐]',
        })

        if (executed) {
          lastAutoRebalanceTimeRef.current = Date.now()
        } else {
          addTradeLog(`[自动补齐] 跳过: 仓位限制 (净仓位: ${currentNetPosition.toFixed(4)})`)
        }
      }, AUTO_REBALANCE_DELAY)
    },
    [autoRebalanceOnError, priceDiff, symbol, symbolState, handleTrades],
  )

  const handleExecute = (direction: '1to2' | '2to1') => {
    const size = parseFloat(tradeSize) || 0
    if (size <= 0 || !priceDiff) {
      alert('请输入有效的交易数量')
      return
    }
    const { platform1Id, platform2Id } = priceDiff
    const trades =
      direction === '2to1'
        ? [
            { symbol, direction: 'short' as const, size, platform: platform1Id },
            { symbol, direction: 'long' as const, size, platform: platform2Id },
          ]
        : [
            { symbol, direction: 'long' as const, size, platform: platform1Id },
            { symbol, direction: 'short' as const, size, platform: platform2Id },
          ]
    handleTrades(trades, { skipCooldown: true, skipPositionCheck: true })
  }

  // ========== Settings persistence ==========
  const persistSettings = useCallback(() => {
    const settings: SymbolSettings = {
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
    }
    saveSymbolSettings(symbol, settings)
  }, [symbol, tradeSize, positionMin, positionMax, tradeInterval, monitor2to1, monitor1to2])

  useEffect(() => {
    persistSettings()
  }, [persistSettings])

  // ========== Auto-trading monitor logic ==========
  useEffect(() => {
    if (!priceDiff) return

    const now = Date.now()

    // Check if monitoring is active
    if (monitor2to1.isMonitoring || monitor1to2.isMonitoring) {
      // Handle unbalanced positions - stop monitoring or trigger refresh
      if (isUnbalanced) {
        if (firstUnbalancedTimeRef.current === null) {
          firstUnbalancedTimeRef.current = now
        } else if (now - firstUnbalancedTimeRef.current >= STOP_MONITOR_IF_UNBALANCED_TIME) {
          if (autoRestartOnUnbalanced) {
            tryRefreshAllExchanges(
              `仓位不对齐持续超过 ${STOP_MONITOR_IF_UNBALANCED_TIME}ms (净仓位: ${netPosition.toFixed(4)})`,
            )
          } else {
            // Stop all monitoring when positions stay unbalanced too long
            if (monitor2to1.isMonitoring) {
              setMonitor2to1((prev) => ({ ...prev, isMonitoring: false }))
            }
            if (monitor1to2.isMonitoring) {
              setMonitor1to2((prev) => ({ ...prev, isMonitoring: false }))
            }
            addTradeLog(
              `[停止] 仓位不对齐持续超过 ${STOP_MONITOR_IF_UNBALANCED_TIME}ms (净仓位: ${netPosition.toFixed(4)})，自动交易已停止`,
            )
          }
          firstUnbalancedTimeRef.current = null
        }
        return
      } else {
        firstUnbalancedTimeRef.current = null
      }

      // Check for stale price data and trigger refresh if needed
      const t1 = formatTime(priceDiff.platform1LastUpdated)
      const t2 = formatTime(priceDiff.platform2LastUpdated)
      const hasSkew = t1.skew || t2.skew

      if (hasSkew) {
        const skewPlatforms = `${t1.skew ? priceDiff.platform1Id : ''}${t1.skew && t2.skew ? '/' : ''}${t2.skew ? priceDiff.platform2Id : ''}`
        tryRefreshAllExchanges(`价格数据延迟 (${skewPlatforms})`)
        return
      }
    }

    const size = parseFloat(tradeSize) || 0

    /**
     * Process a single arbitrage direction:
     * - Check if spread condition is met
     * - Track consecutive triggers to avoid noise
     * - Execute trade via handleTrades (which handles position limits and cooldown)
     */
    const processTradePair = (
      direction: '2to1' | '1to2',
      monitor: MonitorState,
      spread: number,
      refPrice: number,
      sellPlatformId: string,
      buyPlatformId: string,
    ) => {
      if (!monitor.isMonitoring || size <= 0) {
        consecutiveTriggerRef.current[direction] = 0
        return
      }

      // Check spread threshold condition
      const threshold = parseFloat(monitor.threshold) || 0
      const compareValue = monitor.unit === 'percent' ? (spread / refPrice) * 100 : spread
      const conditionMet =
        monitor.condition === '>' ? compareValue > threshold : compareValue < threshold

      // Track consecutive triggers to filter out noise
      if (conditionMet) {
        consecutiveTriggerRef.current[direction] += 1
      } else {
        consecutiveTriggerRef.current[direction] = 0
      }

      // Execute trade if consecutive trigger count is met
      if (consecutiveTriggerRef.current[direction] >= consecutiveTriggerCount) {
        const trades = [
          { symbol, direction: 'short' as const, size, platform: sellPlatformId },
          { symbol, direction: 'long' as const, size, platform: buyPlatformId },
        ]
        const executed = handleTrades(trades, {
          direction,
          onError: (errMsg) => tryAutoRebalance(errMsg, trades),
        })
        if (executed) {
          consecutiveTriggerRef.current[direction] = 0
        }
      }
    }

    // Process both arbitrage directions
    processTradePair(
      '2to1',
      monitor2to1,
      priceDiff.spread2to1,
      priceDiff.platform2Ask,
      priceDiff.platform1Id, // sell
      priceDiff.platform2Id, // buy
    )

    processTradePair(
      '1to2',
      monitor1to2,
      priceDiff.spread1to2,
      priceDiff.platform1Ask,
      priceDiff.platform2Id, // sell
      priceDiff.platform1Id, // buy
    )
  }, [
    priceDiff,
    monitor2to1,
    monitor1to2,
    tradeSize,
    symbol,
    isUnbalanced,
    netPosition,
    consecutiveTriggerCount,
    tryRefreshAllExchanges,
    autoRestartOnUnbalanced,
    handleTrades,
    tryAutoRebalance,
  ])

  // ========== UI helpers ==========
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

  // ========== Render ==========
  return (
    <div
      className={`rounded-md border p-3 border-dashed ${hasPositions ? 'border-muted-foreground/70' : 'border-muted-foreground/30'}`}
    >
      {/* Header */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
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
            <span>
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

      {/* Expanded content */}
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
