import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_LIGHTER_CONFIG, DEFAULT_OMNI_CONFIG } from '../../lib/config'
import { DEFAULT_WATCHED_SYMBOLS } from '../../lib/symbols'
import type { ExchangeConfigs, LighterConfig, OmniConfig } from '../../lib/types'

const STORAGE_KEYS = {
  WATCHED_SYMBOLS: 'arbflow_watched_symbols',
  EXCHANGE_CONFIGS: 'arbflow_exchange_configs',
  GLOBAL_TRADE_INTERVAL: 'arbflow_global_trade_interval',
  CONSECUTIVE_TRIGGER_COUNT: 'arbflow_consecutive_trigger_count',
  AUTO_REBALANCE_ON_ERROR: 'arbflow_auto_rebalance_on_error',
  SOUND_ENABLED: 'arbflow_sound_enabled',
  USE_PRO_MODE: 'arbflow_use_pro_mode',
}

const DEFAULT_GLOBAL_TRADE_INTERVAL = 1000
const DEFAULT_CONSECUTIVE_TRIGGER_COUNT = 2

export function useSettings() {
  const [watchedSymbols, setWatchedSymbols] = useState<string[]>(DEFAULT_WATCHED_SYMBOLS)
  const [lighterConfig, setLighterConfig] = useState<LighterConfig>(DEFAULT_LIGHTER_CONFIG)
  const [omniConfig, setOmniConfig] = useState<OmniConfig>(DEFAULT_OMNI_CONFIG)
  const [globalTradeInterval, setGlobalTradeInterval] = useState<number>(DEFAULT_GLOBAL_TRADE_INTERVAL)
  const [consecutiveTriggerCount, setConsecutiveTriggerCount] = useState<number>(DEFAULT_CONSECUTIVE_TRIGGER_COUNT)
  const [autoRebalanceEnabled, setAutoRebalanceOnError] = useState<boolean>(false)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true)
  const [useProMode, setUseProMode] = useState<boolean>(true)

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

    const savedTriggerCount = localStorage.getItem(STORAGE_KEYS.CONSECUTIVE_TRIGGER_COUNT)
    if (savedTriggerCount) {
      const parsed = parseInt(savedTriggerCount, 10)
      if (!isNaN(parsed) && parsed > 0) {
        setConsecutiveTriggerCount(parsed)
      }
    }

    const savedAutoRebalance = localStorage.getItem(STORAGE_KEYS.AUTO_REBALANCE_ON_ERROR)
    if (savedAutoRebalance) {
      setAutoRebalanceOnError(savedAutoRebalance === 'true')
    }

    const savedSoundEnabled = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED)
    if (savedSoundEnabled) {
      setSoundEnabled(savedSoundEnabled === 'true')
    }

    const savedUseProMode = localStorage.getItem(STORAGE_KEYS.USE_PRO_MODE)
    if (savedUseProMode) {
      setUseProMode(savedUseProMode === 'true')
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

  const saveConsecutiveTriggerCount = useCallback((count: number) => {
    setConsecutiveTriggerCount(count)
    localStorage.setItem(STORAGE_KEYS.CONSECUTIVE_TRIGGER_COUNT, String(count))
  }, [])

  const saveAutoRebalanceEnabled = useCallback((enabled: boolean) => {
    setAutoRebalanceOnError(enabled)
    localStorage.setItem(STORAGE_KEYS.AUTO_REBALANCE_ON_ERROR, String(enabled))
  }, [])

  const saveSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabled(enabled)
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(enabled))
  }, [])

  const saveUseProMode = useCallback((enabled: boolean) => {
    setUseProMode(enabled)
    localStorage.setItem(STORAGE_KEYS.USE_PRO_MODE, String(enabled))
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
    consecutiveTriggerCount,
    saveConsecutiveTriggerCount,
    autoRebalanceEnabled,
    saveAutoRebalanceEnabled,
    soundEnabled,
    saveSoundEnabled,
    useProMode,
    saveUseProMode,
  }
}

