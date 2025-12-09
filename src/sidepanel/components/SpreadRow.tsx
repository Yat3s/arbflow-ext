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
}

export function SpreadRow({ label, spread, refPrice, onExecute }: SpreadRowProps) {
  const percentage = (spread / refPrice) * 100
  const sign = spread >= 0 ? '+' : ''
  const isPositive = spread > 0

  return (
    <div
      className={`flex items-center justify-between rounded px-2 py-1.5 text-xs ${
        isPositive ? 'bg-green-500/10' : 'bg-red-500/10'
      }`}
    >
      <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{label}</span>
      <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
        {sign}
        {formatPrice(spread, refPrice)}U({sign}
        {percentage.toFixed(3)}%)
      </span>
      <button
        onClick={onExecute}
        className="rounded bg-primary px-2 py-0.5 text-primary-foreground hover:bg-primary/90"
      >
        执行
      </button>
    </div>
  )
}

