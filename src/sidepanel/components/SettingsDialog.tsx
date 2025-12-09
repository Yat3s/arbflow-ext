import { useState, useEffect } from 'react'
import { ALL_SYMBOLS } from '../../lib/symbols'
import type { LighterConfig } from '../../lib/types'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  watchedSymbols: string[]
  onSaveSymbols: (symbols: string[]) => void
  lighterConfig: LighterConfig
  onSaveLighterConfig: (config: Partial<LighterConfig>) => Promise<{ success: boolean; accountIndex?: number; error?: string }>
}

export function SettingsDialog({
  open,
  onClose,
  watchedSymbols,
  onSaveSymbols,
  lighterConfig,
  onSaveLighterConfig,
}: SettingsDialogProps) {
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [l1Address, setL1Address] = useState('')
  const [apiPrivateKey, setApiPrivateKey] = useState('')
  const [apiKeyIndex, setApiKeyIndex] = useState(4)
  const [accountType, setAccountType] = useState<'main' | 'sub'>('main')
  const [showApiKey, setShowApiKey] = useState(false)
  const [configStatus, setConfigStatus] = useState<{ message: string; isError: boolean } | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedSymbols(new Set(watchedSymbols))
      setL1Address(lighterConfig.l1Address)
      setApiPrivateKey(lighterConfig.apiPrivateKey)
      setApiKeyIndex(lighterConfig.apiKeyIndex)
      setAccountType(lighterConfig.accountType)
      setSearchTerm('')
      setConfigStatus(null)
    }
  }, [open, watchedSymbols, lighterConfig])

  const filteredSymbols = ALL_SYMBOLS.filter((s) =>
    s.toLowerCase().includes(searchTerm.toLowerCase())
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
    onSaveSymbols(Array.from(selectedSymbols))

    const configChanged =
      l1Address !== lighterConfig.l1Address ||
      apiPrivateKey !== lighterConfig.apiPrivateKey ||
      apiKeyIndex !== lighterConfig.apiKeyIndex ||
      accountType !== lighterConfig.accountType

    if (configChanged && l1Address && apiPrivateKey) {
      setIsSaving(true)
      setConfigStatus({ message: 'Fetching account info...', isError: false })

      const result = await onSaveLighterConfig({
        l1Address,
        apiPrivateKey,
        apiKeyIndex,
        accountType,
      })

      setIsSaving(false)

      if (result.success) {
        const typeLabel = accountType === 'main' ? 'Main Account' : 'Sub Account'
        setConfigStatus({
          message: `✓ Saved, ${typeLabel}: ${result.accountIndex}`,
          isError: false,
        })
      } else {
        setConfigStatus({
          message: `✗ Failed: ${result.error}`,
          isError: true,
        })
      }
    } else {
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="max-h-[90vh] w-[90vw] max-w-md overflow-hidden rounded-lg bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Settings</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          <div className="mb-4">
            <h3 className="mb-2 font-medium">Watched Symbols ({selectedSymbols.size})</h3>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2 w-full rounded border bg-background px-3 py-2 text-sm"
            />
            <div className="grid max-h-40 grid-cols-4 gap-1 overflow-y-auto">
              {filteredSymbols.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => toggleSymbol(symbol)}
                  className={`rounded px-2 py-1 text-xs ${
                    selectedSymbols.has(symbol)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-2 font-medium">Lighter API Config</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Wallet Address</label>
                <input
                  type="text"
                  value={l1Address}
                  onChange={(e) => setL1Address(e.target.value)}
                  placeholder="0x..."
                  className="w-full rounded border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">API Private Key</label>
                <div className="flex gap-2">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiPrivateKey}
                    onChange={(e) => setApiPrivateKey(e.target.value)}
                    placeholder="Private key..."
                    className="flex-1 rounded border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="rounded border px-2 text-sm"
                  >
                    {showApiKey ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">API Key Index</label>
                  <input
                    type="number"
                    value={apiKeyIndex}
                    onChange={(e) => setApiKeyIndex(parseInt(e.target.value) || 4)}
                    className="w-full rounded border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Account Type</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as 'main' | 'sub')}
                    className="w-full rounded border bg-background px-3 py-2 text-sm"
                  >
                    <option value="main">Main</option>
                    <option value="sub">Sub</option>
                  </select>
                </div>
              </div>
              {lighterConfig.accountIndex !== null && (
                <div className="text-xs text-muted-foreground">
                  Account Index: {lighterConfig.accountIndex}
                </div>
              )}
              {configStatus && (
                <div className={`text-xs ${configStatus.isError ? 'text-red-500' : 'text-green-500'}`}>
                  {configStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            onClick={onClose}
            className="rounded border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

