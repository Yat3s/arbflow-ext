import { useState, useEffect, useCallback } from 'react'
import type { LighterConfig, OmniConfig, ExchangeConfigs } from '../../lib/types'
import { DEFAULT_LIGHTER_CONFIG, DEFAULT_OMNI_CONFIG } from '../../lib/config'
import { DEFAULT_WATCHED_SYMBOLS } from '../../lib/symbols'

const STORAGE_KEYS = {
  WATCHED_SYMBOLS: 'arbflow_watched_symbols',
  EXCHANGE_CONFIGS: 'arbflow_exchange_configs',
}

export function useSettings() {
  const [watchedSymbols, setWatchedSymbols] = useState<string[]>(DEFAULT_WATCHED_SYMBOLS)
  const [lighterConfig, setLighterConfig] = useState<LighterConfig>(DEFAULT_LIGHTER_CONFIG)
  const [omniConfig, setOmniConfig] = useState<OmniConfig>(DEFAULT_OMNI_CONFIG)

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

  return {
    watchedSymbols,
    saveWatchedSymbols,
    lighterConfig,
    saveLighterConfig,
    omniConfig,
    saveOmniConfig,
  }
}

