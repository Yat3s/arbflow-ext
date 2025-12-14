import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_LIGHTER_CONFIG, DEFAULT_OMNI_CONFIG } from '../../lib/config'
import { DEFAULT_WATCHED_SYMBOLS } from '../../lib/symbols'
import type { ExchangeConfigs, LighterConfig, OmniConfig } from '../../lib/types'

const STORAGE_KEYS = {
  WATCHED_SYMBOLS: 'arbflow_watched_symbols',
  EXCHANGE_CONFIGS: 'arbflow_exchange_configs',
  GLOBAL_TRADE_INTERVAL: 'arbflow_global_trade_interval',
}

const DEFAULT_GLOBAL_TRADE_INTERVAL = 1000

export function useSettings() {
  const [watchedSymbols, setWatchedSymbols] = useState<string[]>(DEFAULT_WATCHED_SYMBOLS)
  const [lighterConfig, setLighterConfig] = useState<LighterConfig>(DEFAULT_LIGHTER_CONFIG)
  const [omniConfig, setOmniConfig] = useState<OmniConfig>(DEFAULT_OMNI_CONFIG)
  const [globalTradeInterval, setGlobalTradeInterval] = useState<number>(DEFAULT_GLOBAL_TRADE_INTERVAL)

  useEffect(() => {
    const savedSymbols = localStorage.getItem(STORAGE_KEYS.WATCHED_SYMBOLS)
    if (savedSymbols) {
      try {
        setWatchedSymbols(JSON.parse(savedSymbols))
      } catch {
        setWatchedSymbols(DEFAULT_WATCHED_SYMBOLS)
      }
    }

    const savedConfigs = localStorage.getItem(STORAGE_KEYS.EXCHANGE_CONFIGS)
    if (savedConfigs) {
      try {
        const parsed: ExchangeConfigs = JSON.parse(savedConfigs)
        if (parsed.lighter) {
          setLighterConfig({ ...DEFAULT_LIGHTER_CONFIG, ...parsed.lighter })
        }
        if (parsed.omni) {
          setOmniConfig({ ...DEFAULT_OMNI_CONFIG, ...parsed.omni })
        }
      } catch (e) {
        console.error('[Settings] Failed to load configs:', e)
      }
    }

    const savedInterval = localStorage.getItem(STORAGE_KEYS.GLOBAL_TRADE_INTERVAL)
    if (savedInterval) {
      const parsed = parseInt(savedInterval, 10)
      if (!isNaN(parsed) && parsed > 0) {
        setGlobalTradeInterval(parsed)
      }
    }
  }, [])

  const saveWatchedSymbols = useCallback((symbols: string[]) => {
    setWatchedSymbols(symbols)
    localStorage.setItem(STORAGE_KEYS.WATCHED_SYMBOLS, JSON.stringify(symbols))
  }, [])

  const saveLighterConfig = useCallback((config: Partial<LighterConfig>) => {
    setLighterConfig((prev) => {
      const newConfig = { ...prev, ...config }
      const allConfigs: ExchangeConfigs = {
        lighter: newConfig,
        omni: omniConfig,
      }
      localStorage.setItem(STORAGE_KEYS.EXCHANGE_CONFIGS, JSON.stringify(allConfigs))
      return newConfig
    })
  }, [omniConfig])

  const saveOmniConfig = useCallback((config: Partial<OmniConfig>) => {
    setOmniConfig((prev) => {
      const newConfig = { ...prev, ...config }
      const allConfigs: ExchangeConfigs = {
        lighter: lighterConfig,
        omni: newConfig,
      }
      localStorage.setItem(STORAGE_KEYS.EXCHANGE_CONFIGS, JSON.stringify(allConfigs))
      return newConfig
    })
  }, [lighterConfig])

  const saveGlobalTradeInterval = useCallback((interval: number) => {
    setGlobalTradeInterval(interval)
    localStorage.setItem(STORAGE_KEYS.GLOBAL_TRADE_INTERVAL, String(interval))
  }, [])

  return {
    watchedSymbols,
    saveWatchedSymbols,
    lighterConfig,
    saveLighterConfig,
    omniConfig,
    saveOmniConfig,
    globalTradeInterval,
    saveGlobalTradeInterval,
  }
}

