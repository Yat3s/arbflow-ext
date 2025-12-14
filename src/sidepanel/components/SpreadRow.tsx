function formatPrice(price: number, referencePrice?: number): string {
  if (!price || price === 0) return '--'
  const ref = referencePrice ?? price
  if (Math.abs(ref) >= 1000) return price.toFixed(2)
  if (Math.abs(ref) >= 1) return price.toFixed(4)
  return price.toFixed(6)
}

import { formatTime } from '../../lib/utils'

interface SpreadRowProps {
  label: string
  spread: number
  refPrice: number
  platform1LastUpdated?: number
  platform2LastUpdated?: number
  onExecute: () => void
  monitorCondition: '>' | '<'
  monitorUnit: 'percent' | 'usdt'
  monitorThreshold: string
  isMonitoring: boolean
  isAnyMonitoring: boolean
  canStartMonitor: boolean
  onMonitorConditionToggle: () => void
  onMonitorUnitToggle: () => void
  onMonitorThresholdChange: (value: string) => void
  onMonitorToggle: () => void
  rebalanceInfo?: {
    platformId: string
    size: number
    action: '+' | '-'
    onRebalance: () => void
  }
}

export function SpreadRow({
  label,
  spread,
  refPrice,
  platform1LastUpdated,
  platform2LastUpdated,
  onExecute,
  monitorCondition,
  monitorUnit,
  monitorThreshold,
  isMonitoring,
  isAnyMonitoring,
  canStartMonitor,
  onMonitorConditionToggle,
  onMonitorUnitToggle,
  onMonitorThresholdChange,
  onMonitorToggle,
  rebalanceInfo,
}: SpreadRowProps) {
  const percentage = (spread / refPrice) * 100
  const sign = spread >= 0 ? '+' : ''
  const isPositive = spread > 0

  return (
    <div className={`flex flex-col gap-2 rounded px-3 py-2 bg-muted-foreground/10 text-xs `}>
      <div className="flex items-center gap-2">
        <span className="font-bold shrink-0 font-mono text-muted-foreground">{label}</span>
        <span className={`w-40 font-bold shrink-0 ${isPositive ? 'text-white' : 'text-white'}`}>
          {sign}
          {formatPrice(spread, refPrice)}U({sign}
          {percentage.toFixed(3)}%)
        </span>
        <span className="shrink-0 text-muted-foreground text-xs">
          {(() => {
            const t1 = formatTime(platform1LastUpdated)
            const t2 = formatTime(platform2LastUpdated)
            return `${t1.skew ? '⚠️' : ''}${t1.timeStr}/${t2.skew ? '⚠️' : ''}${t2.timeStr}`
          })()}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          当价差
          <button
            onClick={onMonitorUnitToggle}
            disabled={isMonitoring}
            className={`rounded bg-muted px-1.5 py-0.5 font-mono ${isMonitoring ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted/80'}`}
          >
            {monitorUnit === 'percent' ? '%' : 'U'}
          </button>
          <button
            onClick={onMonitorConditionToggle}
            disabled={isMonitoring}
            className={`rounded bg-muted px-1.5 py-0.5 font-mono ${isMonitoring ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted/80'}`}
          >
            {monitorCondition}
          </button>
          <input
            type="text"
            value={monitorThreshold}
            onChange={(e) => onMonitorThresholdChange(e.target.value)}
            disabled={isMonitoring}
            className={`w-12 rounded border border-border bg-background px-1 py-0.5 text-center ${isMonitoring ? 'cursor-not-allowed opacity-50' : ''}`}
            placeholder={monitorUnit === 'percent' ? '%' : 'U'}
          />
          <button
            onClick={onMonitorToggle}
            disabled={!isMonitoring && !canStartMonitor}
            className={`rounded px-1.5 py-0.5 ${
              isMonitoring
                ? 'cursor-pointer bg-yellow-500 text-black'
                : canStartMonitor
                  ? 'cursor-pointer bg-muted text-muted-foreground hover:bg-muted/80'
                  : 'cursor-not-allowed bg-muted/50 text-muted-foreground/50'
            }`}
          >
            {isMonitoring ? '停止' : '开启监控交易'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {rebalanceInfo && (
            <button
              onClick={rebalanceInfo.onRebalance}
              className="cursor-pointer shrink-0 rounded bg-yellow-500/20 px-1.5 py-0.5 text-yellow-500 hover:bg-yellow-500/30"
            >
              {rebalanceInfo.action}
              {rebalanceInfo.platformId}补齐({rebalanceInfo.size.toFixed(4)})
            </button>
          )}
          <button
            onClick={onExecute}
            className="cursor-pointer shrink-0 text-muted-foreground hover:text-white"
          >
            立即执行1次
          </button>
        </div>
      </div>
    </div>
  )
}
