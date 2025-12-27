export function PositionPeaks({ lgPeak, omPeak }: { lgPeak: number; omPeak: number }) {
  return (
    <div className="flex gap-3 text-xs">
      <span>
        <span className="font-bold">LG:</span>{' '}
        <span className={lgPeak >= 0 ? 'text-green-500' : 'text-red-500'}>
          {lgPeak >= 0 ? '+' : ''}
          {lgPeak.toFixed(2)}
        </span>
      </span>
      <span>
        <span className="font-bold">OM:</span>{' '}
        <span className={omPeak >= 0 ? 'text-green-500' : 'text-red-500'}>
          {omPeak >= 0 ? '+' : ''}
          {omPeak.toFixed(2)}
        </span>
      </span>
    </div>
  )
}

