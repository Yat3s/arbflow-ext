import type { PriceDiff } from '../../lib/types'
import { roundSize } from '../../lib/utils'
import { SpreadRow } from './SpreadRow'

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

interface ActionPanelProps {
  priceDiff: PriceDiff
  tradeSize: string
  setTradeSize: (value: string) => void
  positionMin: string
  setPositionMin: (value: string) => void
  positionMax: string
  setPositionMax: (value: string) => void
  tradeInterval: string
  setTradeInterval: (value: string) => void
  monitor2to1: MonitorState
  setMonitor2to1: React.Dispatch<React.SetStateAction<MonitorState>>
  monitor1to2: MonitorState
  setMonitor1to2: React.Dispatch<React.SetStateAction<MonitorState>>
  tradeLogs: TradeLog[]
  setTradeLogs: React.Dispatch<React.SetStateAction<TradeLog[]>>
  onExecute: (direction: '1to2' | '2to1') => void
  positionByExchange: { [exchangeId: string]: number }
  onRebalance: (platformId: string, size: number, direction: 'long' | 'short') => void
}

export function ActionPanel({
  priceDiff,
  tradeSize,
  setTradeSize,
  positionMin,
  setPositionMin,
  positionMax,
  setPositionMax,
  tradeInterval,
  setTradeInterval,
  monitor2to1,
  setMonitor2to1,
  monitor1to2,
  setMonitor1to2,
  tradeLogs,
  setTradeLogs,
  onExecute,
  positionByExchange,
  onRebalance,
}: ActionPanelProps) {
  const isValidNumber = (value: string) => value.trim() !== '' && !isNaN(Number(value))

  const baseFieldsValid =
    isValidNumber(tradeSize) && isValidNumber(positionMin) && isValidNumber(positionMax)

  const canStartMonitor2to1 = baseFieldsValid && isValidNumber(monitor2to1.threshold)
  const canStartMonitor1to2 = baseFieldsValid && isValidNumber(monitor1to2.threshold)

  const isMonitoring = monitor2to1.isMonitoring || monitor1to2.isMonitoring

  const platform1Pos = positionByExchange[priceDiff.platform1Id] || 0
  const platform2Pos = positionByExchange[priceDiff.platform2Id] || 0
  const netPosition = platform1Pos + platform2Pos
  const isUnbalanced = Math.abs(netPosition) > 0.0001

  const getRebalanceInfo2to1 = () => {
    if (!isUnbalanced) return undefined
    if (netPosition < 0) {
      const size = roundSize(Math.abs(netPosition))
      return {
        platformId: priceDiff.platform2Id,
        size,
        action: '+' as const,
        onRebalance: () => onRebalance(priceDiff.platform2Id, size, 'long'),
      }
    }
    return undefined
  }

  const getRebalanceInfo1to2 = () => {
    if (!isUnbalanced) return undefined
    if (netPosition > 0) {
      const size = roundSize(netPosition)
      return {
        platformId: priceDiff.platform2Id,
        size,
        action: '-' as const,
        onRebalance: () => onRebalance(priceDiff.platform2Id, size, 'short'),
      }
    }
    return undefined
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex-1 h-px bg-muted-foreground/40"></span>自动交易设置
        <span className="flex-1 h-px bg-muted-foreground/40"></span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground">每次执行数量:</label>
        <div className="relative">
          <input
            type="number"
            value={tradeSize}
            onChange={(e) => setTradeSize(e.target.value)}
            disabled={isMonitoring}
            step="0.01"
            min="0"
            className={`w-10 border-b border-muted-foreground/40 bg-transparent px-1 py-0.5 text-xs outline-none focus:border-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${isMonitoring ? 'cursor-not-allowed opacity-50' : ''}`}
          />
          {tradeSize && parseFloat(tradeSize) > 0 && (
            <span className="absolute -top-4 left-0 whitespace-nowrap rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
              ≈{(parseFloat(tradeSize) * priceDiff.platform1Ask).toFixed(2)}u
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{priceDiff.platform1Id} 最大持仓</span>
        <div className="relative">
          <input
            type="number"
            value={positionMin}
            onChange={(e) => setPositionMin(e.target.value)}
            disabled={isMonitoring}
            step="0.01"
            className={`w-20 border-b border-muted-foreground/40 bg-transparent px-1 py-0.5 text-xs outline-none focus:border-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${isMonitoring ? 'cursor-not-allowed opacity-50' : ''}`}
            placeholder="最小"
          />
          {positionMin && parseFloat(positionMin) !== 0 && (
            <span className="absolute -top-4 left-0 whitespace-nowrap rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
              ≈{(Math.abs(parseFloat(positionMin)) * priceDiff.platform1Ask).toFixed(2)}u
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">~</span>
        <div className="relative">
          <input
            type="number"
            value={positionMax}
            onChange={(e) => setPositionMax(e.target.value)}
            disabled={isMonitoring}
            step="0.01"
            className={`w-20 border-b border-muted-foreground/40 bg-transparent px-1 py-0.5 text-xs outline-none focus:border-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${isMonitoring ? 'cursor-not-allowed opacity-50' : ''}`}
            placeholder="最大"
          />
          {positionMax && parseFloat(positionMax) !== 0 && (
            <span className="absolute -top-4 left-0 whitespace-nowrap rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
              ≈{(Math.abs(parseFloat(positionMax)) * priceDiff.platform1Ask).toFixed(2)}u
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">交易间隔</span>
        <input
          type="number"
          value={tradeInterval}
          onChange={(e) => setTradeInterval(e.target.value)}
          disabled={isMonitoring}
          step="100"
          min="0"
          className={`w-10 border-b border-muted-foreground/40 bg-transparent px-1 py-0.5 text-xs outline-none focus:border-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${isMonitoring ? 'cursor-not-allowed opacity-50' : ''}`}
          placeholder="ms"
        />
        <span className="text-xs text-muted-foreground">ms</span>
      </div>
      <SpreadRow
        label={`-${priceDiff.platform1Id}+${priceDiff.platform2Id}`}
        spread={priceDiff.spread2to1}
        refPrice={priceDiff.platform2Ask}
        platform1LastUpdated={priceDiff.platform1LastUpdated}
        platform2LastUpdated={priceDiff.platform2LastUpdated}
        onExecute={() => onExecute('2to1')}
        monitorCondition={monitor2to1.condition}
        monitorUnit={monitor2to1.unit}
        monitorThreshold={monitor2to1.threshold}
        isMonitoring={monitor2to1.isMonitoring}
        isAnyMonitoring={isMonitoring}
        canStartMonitor={canStartMonitor2to1}
        onMonitorConditionToggle={() =>
          setMonitor2to1((prev) => ({
            ...prev,
            condition: prev.condition === '>' ? '<' : '>',
          }))
        }
        onMonitorUnitToggle={() =>
          setMonitor2to1((prev) => ({
            ...prev,
            unit: prev.unit === 'percent' ? 'usdt' : 'percent',
          }))
        }
        onMonitorThresholdChange={(value) =>
          setMonitor2to1((prev) => ({ ...prev, threshold: value }))
        }
        onMonitorToggle={() =>
          setMonitor2to1((prev) => ({ ...prev, isMonitoring: !prev.isMonitoring }))
        }
        rebalanceInfo={getRebalanceInfo2to1()}
      />
      <SpreadRow
        label={`-${priceDiff.platform2Id}+${priceDiff.platform1Id}`}
        spread={priceDiff.spread1to2}
        refPrice={priceDiff.platform1Ask}
        platform1LastUpdated={priceDiff.platform1LastUpdated}
        platform2LastUpdated={priceDiff.platform2LastUpdated}
        onExecute={() => onExecute('1to2')}
        monitorCondition={monitor1to2.condition}
        monitorUnit={monitor1to2.unit}
        monitorThreshold={monitor1to2.threshold}
        isMonitoring={monitor1to2.isMonitoring}
        isAnyMonitoring={isMonitoring}
        canStartMonitor={canStartMonitor1to2}
        onMonitorConditionToggle={() =>
          setMonitor1to2((prev) => ({
            ...prev,
            condition: prev.condition === '>' ? '<' : '>',
          }))
        }
        onMonitorUnitToggle={() =>
          setMonitor1to2((prev) => ({
            ...prev,
            unit: prev.unit === 'percent' ? 'usdt' : 'percent',
          }))
        }
        onMonitorThresholdChange={(value) =>
          setMonitor1to2((prev) => ({ ...prev, threshold: value }))
        }
        onMonitorToggle={() =>
          setMonitor1to2((prev) => ({ ...prev, isMonitoring: !prev.isMonitoring }))
        }
        rebalanceInfo={getRebalanceInfo1to2()}
      />

      {tradeLogs.length > 0 && (
        <div className="mt-2 max-h-32 overflow-y-auto rounded border border-border bg-muted/30 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">交易日志</span>
            <button
              onClick={() => setTradeLogs([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              清空
            </button>
          </div>
          <div className="space-y-0.5">
            {tradeLogs.map((log) => {
              const t = log.timestamp
              const timeStr = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}.${String(t.getMilliseconds()).padStart(3, '0')}`
              return (
                <div key={log.id} className="text-xs text-muted-foreground">
                  <span className="text-foreground/60">[{timeStr}]</span> {log.message}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
