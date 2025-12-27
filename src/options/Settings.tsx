import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { DEFAULT_LIGHTER_CONFIG, DEFAULT_OMNI_CONFIG } from '../lib/config'
import { fetchLighterAccountIndex } from '../lib/lighter-api'
import { ALL_SYMBOLS, DEFAULT_WATCHED_SYMBOLS } from '../lib/symbols'
import type { ExchangeConfigs, LighterConfig, OmniConfig } from '../lib/types'

const STORAGE_KEYS = {
  WATCHED_SYMBOLS: 'arbflow_watched_symbols',
  EXCHANGE_CONFIGS: 'arbflow_exchange_configs',
}

export const SettingsPage = () => {
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [l1Address, setL1Address] = useState('')
  const [apiPrivateKey, setApiPrivateKey] = useState('')
  const [apiKeyIndex, setApiKeyIndex] = useState(4)
  const [accountType, setAccountType] = useState<'main' | 'sub'>('main')
  const [accountIndex, setAccountIndex] = useState<number | null>(null)
  const [omniConfig, setOmniConfig] = useState<OmniConfig>(DEFAULT_OMNI_CONFIG)
  const [showApiKey, setShowApiKey] = useState(false)
  const [configStatus, setConfigStatus] = useState<{
    message: string
    isError: boolean
  } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const savedSymbols = localStorage.getItem(STORAGE_KEYS.WATCHED_SYMBOLS)
    if (savedSymbols) {
      try {
        setSelectedSymbols(new Set(JSON.parse(savedSymbols)))
      } catch {
        setSelectedSymbols(new Set(DEFAULT_WATCHED_SYMBOLS))
      }
    } else {
      setSelectedSymbols(new Set(DEFAULT_WATCHED_SYMBOLS))
    }

    const savedConfigs = localStorage.getItem(STORAGE_KEYS.EXCHANGE_CONFIGS)
    if (savedConfigs) {
      try {
        const parsed: ExchangeConfigs = JSON.parse(savedConfigs)
        if (parsed.lighter) {
          const config = { ...DEFAULT_LIGHTER_CONFIG, ...parsed.lighter }
          setL1Address(config.l1Address)
          setApiPrivateKey(config.apiPrivateKey)
          setApiKeyIndex(config.apiKeyIndex)
          setAccountType(config.accountType)
          setAccountIndex(config.accountIndex)
        }
        if (parsed.omni) {
          setOmniConfig({ ...DEFAULT_OMNI_CONFIG, ...parsed.omni })
        }
      } catch (e) {
        console.error('[Options] Failed to load configs:', e)
      }
    }
    setIsLoaded(true)
  }, [])

  const filteredSymbols = ALL_SYMBOLS.filter((s) =>
    s.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const toggleSymbol = (symbol: string) => {
    const newSet = new Set(selectedSymbols)
    if (newSet.has(symbol)) {
      newSet.delete(symbol)
    } else {
      newSet.add(symbol)
    }
    setSelectedSymbols(newSet)
  }

  const handleSave = async () => {
    localStorage.setItem(STORAGE_KEYS.WATCHED_SYMBOLS, JSON.stringify(Array.from(selectedSymbols)))

    if (l1Address && apiPrivateKey) {
      setIsSaving(true)
      setConfigStatus({ message: 'Fetching account info...', isError: false })

      try {
        const fetchedAccountIndex = await fetchLighterAccountIndex(l1Address, accountType)
        const newConfig: LighterConfig = {
          l1Address,
          apiPrivateKey,
          apiKeyIndex,
          accountType,
          accountIndex: fetchedAccountIndex,
        }

        const existingConfigs = localStorage.getItem(STORAGE_KEYS.EXCHANGE_CONFIGS)
        const allConfigs: ExchangeConfigs = { lighter: newConfig, omni: omniConfig }
        localStorage.setItem(STORAGE_KEYS.EXCHANGE_CONFIGS, JSON.stringify(allConfigs))
        setAccountIndex(fetchedAccountIndex)

        const typeLabel = accountType === 'main' ? 'Main Account' : 'Sub Account'
        setConfigStatus({
          message: `✓ Saved, ${typeLabel}: ${fetchedAccountIndex}`,
          isError: false,
        })
      } catch (e) {
        const newConfig: LighterConfig = {
          l1Address,
          apiPrivateKey,
          apiKeyIndex,
          accountType,
          accountIndex: null,
        }
        const allConfigs: ExchangeConfigs = { lighter: newConfig, omni: omniConfig }
        localStorage.setItem(STORAGE_KEYS.EXCHANGE_CONFIGS, JSON.stringify(allConfigs))

        setConfigStatus({
          message: `✗ Failed: ${(e as Error).message}`,
          isError: true,
        })
      } finally {
        setIsSaving(false)
      }
    } else {
      setConfigStatus({
        message: '✓ Symbols saved',
        isError: false,
      })
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Arbflow Settings</h1>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-medium">Watched Symbols ({selectedSymbols.size})</h2>
        <Input
          type="text"
          placeholder="Search symbols..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-3"
        />
        <div className="grid max-h-60 grid-cols-5 gap-1.5 overflow-y-auto rounded-lg border p-3">
          {filteredSymbols.map((symbol) => (
            <button
              key={symbol}
              onClick={() => toggleSymbol(symbol)}
              className={cn(
                'rounded px-2 py-1.5 text-xs transition-colors',
                selectedSymbols.has(symbol)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80',
              )}
            >
              {symbol}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-medium">Lighter API Config</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-muted-foreground">Wallet Address</label>
            <Input
              type="text"
              value={l1Address}
              onChange={(e) => setL1Address(e.target.value)}
              placeholder="0x..."
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted-foreground">API Private Key</label>
            <div className="flex gap-2">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={apiPrivateKey}
                onChange={(e) => setApiPrivateKey(e.target.value)}
                placeholder="Private key..."
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                {showApiKey ? '🙈' : '👁'}
              </Button>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm text-muted-foreground">API Key Index</label>
              <Input
                type="number"
                value={apiKeyIndex}
                onChange={(e) => setApiKeyIndex(parseInt(e.target.value) || 4)}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-sm text-muted-foreground">Account Type</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as 'main' | 'sub')}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="main">Main</option>
                <option value="sub">Sub</option>
              </select>
            </div>
          </div>
          {accountIndex !== null && (
            <div className="text-sm text-muted-foreground">Account Index: {accountIndex}</div>
          )}
          {configStatus && (
            <div
              className={cn('text-sm', configStatus.isError ? 'text-red-500' : 'text-green-500')}
            >
              {configStatus.message}
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </main>
  )
}

export default SettingsPage
