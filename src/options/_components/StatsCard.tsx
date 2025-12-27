import { formatPnl } from '../utils'

interface CycleStats {
  totalCycles: number
  incompleteCycles: number
  totalPnl: number
}

export function StatsCard({ stats }: { stats: CycleStats }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg border bg-card p-4">
      <div>
        <div className="text-sm text-muted-foreground">Total Cycles</div>
        <div className="text-2xl font-semibold">
          {stats.totalCycles}
          {stats.incompleteCycles > 0 && (
            <span className="ml-2 text-sm text-yellow-600">
              ({stats.incompleteCycles} in progress)
            </span>
          )}
        </div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">Total PNL</div>
        <div
          className={`text-2xl font-semibold ${stats.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}
        >
          {formatPnl(stats.totalPnl)}
        </div>
      </div>
    </div>
  )
}
