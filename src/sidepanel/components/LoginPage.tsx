import { useState } from 'react'
import { openLoginPage } from '../../lib/auth'

interface LoginPageProps {
  onLoginStart?: () => void
  accountDisabled?: boolean
}

export function LoginPage({ onLoginStart, accountDisabled }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    setIsLoading(true)
    onLoginStart?.()
    try {
      await openLoginPage()
    } catch (e) {
      console.error('Failed to open login page:', e)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl ${accountDisabled ? 'bg-destructive/10' : 'bg-primary/10'}`}
          >
            {accountDisabled ? (
              <svg
                className="h-8 w-8 text-destructive"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            ) : (
              <svg
                className="h-8 w-8 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">Arbflow</h1>
          {accountDisabled ? (
            <p className="text-center text-sm text-destructive">你的账号无法使用，请联系管理员</p>
          ) : (
            <p className="text-center text-sm text-muted-foreground">登录以使用插件功能</p>
          )}
        </div>

        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="flex w-full max-w-xs cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              等待登录...
            </>
          ) : accountDisabled ? (
            '重新登录'
          ) : (
            '登录'
          )}
        </button>

        <p className="text-center text-xs text-muted-foreground/70">
          点击登录将跳转到 arbflow.io 完成授权
        </p>
      </div>
    </div>
  )
}
