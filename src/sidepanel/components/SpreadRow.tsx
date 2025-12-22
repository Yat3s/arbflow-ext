import { useState } from 'react'
import { formatPrice, formatTime } from '../../lib/utils'

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
  entrySpread?: number
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
  entrySpread,
}: SpreadRowProps) {
  const [confirmingRebalance, setConfirmingRebalance] = useState(false)
  const percentage = (spread / refPrice) * 100
  const sign = spread >= 0 ? '+' : ''
  const isPositive = spread > 0

  return (
    <div className={`flex flex-col gap-2 rounded px-3 py-2 bg-muted-foreground/10 text-xs `}>
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold shrink-0 font-mono text-muted-foreground text-lg">
            {label}
          </span>
          <span
            className={`text-2xl font-semibold shrink-0 whitespace-nowrap ${isPositive ? 'text-white' : 'text-white'}`}
          >
            {sign}
            {formatPrice(spread, refPrice)}
            <span className="text-xs font-mono font-normal">
              ({sign}
              {percentage.toFixed(3)}%
              {entrySpread != null &&
                (() => {
                  const closeProfit = entrySpread + spread
                  const closeProfitSign = closeProfit >= 0 ? '+' : ''
                  return (
                    <span className={closeProfit >= 0 ? '' : ''}>
                      , 执行{closeProfitSign}
                      {closeProfit.toFixed(3)}u
                    </span>
                  )
                })()}
              )
            </span>
          </span>
        </div>
        {(() => {
          const t1 = formatTime(platform1LastUpdated)
          const t2 = formatTime(platform2LastUpdated)
          if (!t1.skew && !t2.skew) return null
          return (
            <span className="shrink-0 text-muted-foreground text-xs">
              {t1.skew ? `⚠️${t1.timeStr}` : ''}
              {t1.skew && t2.skew ? '/' : ''}
              {t2.skew ? `⚠️${t2.timeStr}` : ''}
            </span>
          )
        })()}
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
            <div className="relative">
              <button
                onClick={() => setConfirmingRebalance(true)}
                className="cursor-pointer shrink-0 rounded bg-yellow-500/20 px-1.5 py-0.5 text-yellow-500 hover:bg-yellow-500/30"
              >
                {rebalanceInfo.action}
                {rebalanceInfo.platformId}补齐({rebalanceInfo.size.toFixed(4)})
              </button>
              {confirmingRebalance && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setConfirmingRebalance(false)}
                  />
                  <div className="absolute bottom-full right-0 z-50 mb-2 rounded-lg border border-border bg-background p-3 shadow-lg">
                    <p className="mb-2 whitespace-nowrap text-sm">
                      确认在 {rebalanceInfo.platformId}{' '}
                      {rebalanceInfo.action === '+' ? '买入' : '卖出'}{' '}
                      {rebalanceInfo.size.toFixed(4)}?
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setConfirmingRebalance(false)}
                        className="cursor-pointer rounded bg-muted px-2 py-1 text-muted-foreground hover:bg-muted/80"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => {
                          rebalanceInfo.onRebalance()
                          setConfirmingRebalance(false)
                        }}
                        className="cursor-pointer rounded bg-yellow-500 px-2 py-1 text-black hover:bg-yellow-400"
                      >
                        确认补齐
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
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
