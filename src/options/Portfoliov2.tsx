import { useCallback, useEffect, useState } from 'react'
import { fetchLighterPositions } from '../lib/lighter-api'
import { fetchOmPositions } from '../lib/omni'
import type { ExchangeConfigs, Position } from '../lib/types'
import { PnlSection } from './PnlSection'
import { PositionsSummary, type AggregatedPosition } from './PositionsSummary'
import { STORAGE_KEYS } from './utils'

function aggregatePositions(
  lgPositions: Position[],
  omPositions: Position[],
): AggregatedPosition[] {
  const symbolMap = new Map<string, AggregatedPosition>()

  for (const pos of lgPositions) {
    if (!symbolMap.has(pos.symbol)) {
      symbolMap.set(pos.symbol, { symbol: pos.symbol, lg: null, om: null })
    }
    symbolMap.get(pos.symbol)!.lg = pos
  }

  for (const pos of omPositions) {
    if (!symbolMap.has(pos.symbol)) {
      symbolMap.set(pos.symbol, { symbol: pos.symbol, lg: null, om: null })
    }
    symbolMap.get(pos.symbol)!.om = pos
  }

  return Array.from(symbolMap.values()).sort((a, b) => a.symbol.localeCompare(b.symbol))
}

export const Portfoliov2 = () => {
  const [aggregatedPositions, setAggregatedPositions] = useState<AggregatedPosition[]>([])
  const [positionsLoading, setPositionsLoading] = useState(false)

  const fetchPositions = useCallback(async () => {
    setPositionsLoading(true)
    try {
      const savedConfigs = localStorage.getItem(STORAGE_KEYS.EXCHANGE_CONFIGS)
      if (!savedConfigs) return

      const configs: ExchangeConfigs = JSON.parse(savedConfigs)
      const { accountIndex, l1Address } = configs.lighter || {}
      if (!accountIndex || !l1Address) return

      const tabs = await chrome.tabs.query({ url: 'https://omni.variational.io/*' })
      const tabId = tabs[0]?.id

      const [lgPositions, omPositions] = await Promise.all([
        fetchLighterPositions(l1Address, accountIndex).catch(() => [] as Position[]),
        tabId
          ? fetchOmPositions(tabId).catch(() => [] as Position[])
          : Promise.resolve([] as Position[]),
      ])

      const aggregated = aggregatePositions(lgPositions, omPositions)
      setAggregatedPositions(aggregated)
    } catch (e) {
      console.error('[Portfoliov2] Failed to fetch positions:', e)
    } finally {
      setPositionsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPositions()
  }, [])

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Portfolio</h1>

      <div className="mt-6 font-bold">Positions</div>
      <div className="mt-2">
        <PositionsSummary positions={aggregatedPositions} loading={positionsLoading} />
      </div>

      <div className="mt-12 font-bold">PNL</div>
      <div className="mt-2">
        <PnlSection />
      </div>
    </main>
  )
}

export default Portfoliov2
