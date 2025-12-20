import type { ExchangeState, SymbolState } from '../../lib/types'

interface ExchangeCardProps {
  exchange: ExchangeState
  symbolStates: SymbolState[]
  onOpen: () => void
  onFocus: () => void
  onRefresh: () => void
}

export function ExchangeCard({
  exchange,
  symbolStates,
  onOpen,
  onFocus,
  onRefresh,
}: ExchangeCardProps) {
  const isOpen = !!exchange.currentUrl
  const posCount = symbolStates.reduce((count, s) => {
    return (
      count + s.positions.filter((p) => p.exchangeId === exchange.id && p.position !== 0).length
    )
  }, 0)

  return (
    <div
      className={`rounded-lg border p-3 ${
        isOpen ? 'border-border bg-card' : 'border-muted bg-muted/30'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: exchange.color }}
          >
            {exchange.id}
          </span>
          <span className="font-medium">{exchange.name}</span>
          {exchange.currentSymbol && (
            <span className="text-xs text-muted-foreground">{exchange.currentSymbol}</span>
          )}
          {posCount > 0 && <span className="text-xs text-primary">{posCount} 仓</span>}
        </div>
        <div className="flex items-center gap-1">
          {isOpen && (
            <>
              <button
                onClick={onFocus}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Focus"
              >
                ⎋
              </button>
              <button
                onClick={onRefresh}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Refresh"
              >
                ↻
              </button>
            </>
          )}
          <span
            className={`h-2 w-2 rounded-full ${
              exchange.wsConnected ? 'bg-green-500' : 'bg-muted-foreground'
            }`}
            title={`WebSocket: ${exchange.wsConnected ? 'Connected' : 'Disconnected'}`}
          />
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {isOpen ? (
          <div className="truncate text-xs text-muted-foreground" title={exchange.currentUrl!}>
            {exchange.currentUrl}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Page not open</span>
            <button
              onClick={onOpen}
              className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
            >
              Open
            </button>
          </div>
        )}
        {exchange.accountInfo && (
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            {exchange.accountInfo.walletAddress && (
              <span className="truncate" title={exchange.accountInfo.walletAddress}>
                {exchange.accountInfo.walletAddress.slice(0, 6)}...
                {exchange.accountInfo.walletAddress.slice(-4)}
              </span>
            )}
            {exchange.accountInfo.portfolioValue != null && (
              <span className="text-green-500">
                ${exchange.accountInfo.portfolioValue.toFixed(2)}
                {exchange.accountInfo.leverage != null && (
                  <span className="text-xs text-muted-foreground">
                    ({exchange.accountInfo.leverage.toFixed(2)}x)
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
