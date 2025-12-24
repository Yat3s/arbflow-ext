export interface SymbolSettings {
  tradeSize: string
  positionMin: string
  positionMax: string
  tradeInterval: string
  monitor2to1: { unit: 'bps' | 'usdt'; threshold: string }
  monitor1to2: { unit: 'bps' | 'usdt'; threshold: string }
}

const SYMBOL_SETTINGS_PREFIX = 'arbflow_symbol_'

export function loadSymbolSettings(symbol: string): SymbolSettings | null {
  try {
    const stored = localStorage.getItem(`${SYMBOL_SETTINGS_PREFIX}${symbol}`)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function saveSymbolSettings(symbol: string, settings: SymbolSettings): void {
  try {
    localStorage.setItem(`${SYMBOL_SETTINGS_PREFIX}${symbol}`, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

const LG_INJECTION_ENABLED_KEY = 'arbflow_lg_injection_enabled'

export async function getLgInjectionEnabled(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(LG_INJECTION_ENABLED_KEY)
    return result[LG_INJECTION_ENABLED_KEY] !== false
  } catch {
    return true
  }
}

export async function setLgInjectionEnabled(enabled: boolean): Promise<void> {
  try {
    await chrome.storage.local.set({ [LG_INJECTION_ENABLED_KEY]: enabled })
  } catch {
    // ignore
  }
}

