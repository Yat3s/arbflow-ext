import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { ALL_SYMBOLS } from '../../lib/symbols'
import type { LighterConfig } from '../../lib/types'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  watchedSymbols: string[]
  onSaveSymbols: (symbols: string[]) => void
  lighterConfig: LighterConfig
  onSaveLighterConfig: (
    config: Partial<LighterConfig>,
  ) => Promise<{ success: boolean; accountIndex?: number; error?: string }>
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
  const [configStatus, setConfigStatus] = useState<{
    message: string
    isError: boolean
  } | null>(null)
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

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Settings</DrawerTitle>
        </DrawerHeader>

        <div className="max-h-[60vh] overflow-y-auto px-4">
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium">Watched Symbols ({selectedSymbols.size})</h3>
            <Input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2"
            />
            <div className="grid max-h-40 grid-cols-4 gap-1 overflow-y-auto">
              {filteredSymbols.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => toggleSymbol(symbol)}
                  className={cn(
                    'rounded px-2 py-1 text-xs transition-colors',
                    selectedSymbols.has(symbol)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80',
                  )}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-2 text-sm font-medium">Lighter API Config</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Wallet Address</label>
                <Input
                  type="text"
                  value={l1Address}
                  onChange={(e) => setL1Address(e.target.value)}
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">API Private Key</label>
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
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">API Key Index</label>
                  <Input
                    type="number"
                    value={apiKeyIndex}
                    onChange={(e) => setApiKeyIndex(parseInt(e.target.value) || 4)}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Account Type</label>
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
              {lighterConfig.accountIndex !== null && (
                <div className="text-xs text-muted-foreground">
                  Account Index: {lighterConfig.accountIndex}
                </div>
              )}
              {configStatus && (
                <div
                  className={cn(
                    'text-xs',
                    configStatus.isError ? 'text-red-500' : 'text-green-500',
                  )}
                >
                  {configStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>

        <DrawerFooter className="flex-row justify-end gap-2">
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
