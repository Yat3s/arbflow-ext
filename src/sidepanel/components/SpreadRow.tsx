function formatPrice(price: number, referencePrice?: number): string {
  if (!price || price === 0) return '--'
  const ref = referencePrice ?? price
  if (Math.abs(ref) >= 1000) return price.toFixed(2)
  if (Math.abs(ref) >= 1) return price.toFixed(4)
  return price.toFixed(6)
}

interface SpreadRowProps {
  label: string
  spread: number
  refPrice: number
  onExecute: () => void
  monitorCondition: '>' | '<'
  monitorThreshold: string
  isMonitoring: boolean
  onMonitorConditionToggle: () => void
  onMonitorThresholdChange: (value: string) => void
  onMonitorToggle: () => void
}

export function SpreadRow({
  label,
  spread,
  refPrice,
  onExecute,
  monitorCondition,
  monitorThreshold,
  isMonitoring,
  onMonitorConditionToggle,
  onMonitorThresholdChange,
  onMonitorToggle,
}: SpreadRowProps) {
  const percentage = (spread / refPrice) * 100
  const sign = spread >= 0 ? '+' : ''
  const isPositive = spread > 0

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs ${
        isPositive ? 'bg-green-500/10' : 'bg-red-500/10'
      }`}
    >
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono">{label}</span>
      <span className={`shrink-0 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
        {sign}
        {formatPrice(spread, refPrice)}U({sign}
        {percentage.toFixed(3)}%)
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={onMonitorConditionToggle}
          className="rounded bg-muted px-1.5 py-0.5 font-mono hover:bg-muted/80"
        >
          {monitorCondition}
        </button>
        <input
          type="text"
          value={monitorThreshold}
          onChange={(e) => onMonitorThresholdChange(e.target.value)}
          className="w-12 rounded border border-border bg-background px-1 py-0.5 text-center"
          placeholder="%"
        />
        <button
          onClick={onMonitorToggle}
          className={`rounded px-1.5 py-0.5 ${
            isMonitoring
              ? 'bg-yellow-500 text-black'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {isMonitoring ? '⏸' : '▶'}
        </button>
      </div>
      <button
        onClick={onExecute}
        className="shrink-0 rounded bg-primary px-2 py-0.5 text-primary-foreground hover:bg-primary/90"
      >
        执行
      </button>
    </div>
  )
}
