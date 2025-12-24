import { useEffect, useRef, useState } from 'react'
import { getAuthState, isAuthenticated, logout, refreshUserInfo, type AuthState } from '../lib/auth'
import { LoginPage, MainContentFree, MainContentPro } from './components'
import { useSettings } from './hooks'

const MIN_WIDTH = 400

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth)

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return width
}

function WidthOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-start bg-background/95 pl-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="animate-pulse text-3xl">👈</span>
        <span className="text-lg font-medium">向左拖动扩展视图</span>
      </div>
    </div>
  )
}

export function SidePanel() {
  const windowWidth = useWindowWidth()
  const isTooNarrow = windowWidth < MIN_WIDTH
  const [authState, setAuthState] = useState<AuthState | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [accountDisabled, setAccountDisabled] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const {
    watchedSymbols,
    saveWatchedSymbols,
    lighterConfig,
    saveLighterConfig,
    globalTradeInterval,
    saveGlobalTradeInterval,
    consecutiveTriggerCount,
    saveConsecutiveTriggerCount,
    autoRebalanceEnabled,
    saveAutoRebalanceEnabled,
    soundEnabled,
    saveSoundEnabled,
  } = useSettings()

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated()
      if (authenticated) {
        const state = await getAuthState()
        setAuthState(state)
        refreshUserInfo().then(async (user) => {
          if (user) {
            if (user.isActive === false) {
              await logout()
              setAuthState(null)
              setAccountDisabled(true)
            } else {
              setAuthState((prev) => (prev ? { ...prev, user } : null))
            }
          }
        })
      } else {
        setAuthState(null)
      }
      setAuthLoading(false)
    }
    checkAuth()

    const handleMessage = (message: { type: string }) => {
      if (message.type === 'AUTH_SUCCESS') {
        setAccountDisabled(false)
        checkAuth()
      }
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  const handleLogout = async () => {
    await logout()
    setAuthState(null)
  }

  const userLevel = authState?.user?.level ?? 1

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!authState) {
    return <LoginPage accountDisabled={accountDisabled} />
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Arbflow</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center gap-2" ref={userMenuRef}>
            {authState.user?.level != null && (
              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs text-primary">
                Lv.{authState.user.level}
              </span>
            )}
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary/20 text-sm font-medium text-primary transition-colors hover:bg-primary/30"
            >
              {authState.user?.image ? (
                <img src={authState.user.image} alt="" className="h-full w-full object-cover" />
              ) : (
                authState.user?.email?.charAt(0).toUpperCase() || '?'
              )}
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-10 z-50 min-w-48 rounded-lg border border-border bg-background p-3 shadow-lg">
                <div className="mb-3 space-y-1">
                  <p className="text-sm font-medium">{authState.user?.email}</p>
                  {authState.user?.level != null && (
                    <p className="text-xs text-muted-foreground">
                      等级:{' '}
                      <span className="rounded bg-primary/20 px-1.5 py-0.5 text-primary">
                        Lv.{authState.user.level}
                      </span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    handleLogout()
                    setUserMenuOpen(false)
                  }}
                  className="w-full cursor-pointer rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                >
                  登出
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {userLevel > 1 ? (
        <MainContentPro
          watchedSymbols={watchedSymbols}
          saveWatchedSymbols={saveWatchedSymbols}
          lighterConfig={lighterConfig}
          saveLighterConfig={saveLighterConfig}
          globalTradeInterval={globalTradeInterval}
          saveGlobalTradeInterval={saveGlobalTradeInterval}
          consecutiveTriggerCount={consecutiveTriggerCount}
          saveConsecutiveTriggerCount={saveConsecutiveTriggerCount}
          autoRebalanceEnabled={autoRebalanceEnabled}
          saveAutoRebalanceEnabled={saveAutoRebalanceEnabled}
          soundEnabled={soundEnabled}
          saveSoundEnabled={saveSoundEnabled}
        />
      ) : (
        <MainContentFree />
      )}

      {isTooNarrow && userLevel > 1 && <WidthOverlay />}
    </div>
  )
}

export default SidePanel
