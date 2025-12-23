const API_BASE = 'https://arbflow.io'
const BRIDGE_URL = `${API_BASE}/extension/bridge`

export interface AuthState {
    accessToken: string | null
    expiresAt: number | null
    user: UserInfo | null
}

export interface UserInfo {
    id: string
    email: string
    name?: string
    image?: string
    level?: number
    isActive?: boolean
}

export async function getAuthState(): Promise<AuthState> {
    const result = await chrome.storage.local.get(['accessToken', 'expiresAt', 'user'])
    return {
        accessToken: result.accessToken || null,
        expiresAt: result.expiresAt || null,
        user: result.user || null,
    }
}

export async function saveAuthState(state: Partial<AuthState>): Promise<void> {
    await chrome.storage.local.set(state)
}

export async function clearAuthState(): Promise<void> {
    await chrome.storage.local.remove(['accessToken', 'expiresAt', 'user'])
}

export async function isAuthenticated(): Promise<boolean> {
    const state = await getAuthState()
    if (!state.accessToken || !state.expiresAt) return false
    return Date.now() < state.expiresAt
}

export async function exchangeCodeForToken(code: string): Promise<{ accessToken: string; expiresAt: number }> {
    const res = await fetch(`${API_BASE}/api/extension/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
    })

    if (!res.ok) {
        const error = await res.text()
        throw new Error(`Failed to exchange code: ${error}`)
    }

    const data = await res.json()
    return {
        accessToken: data.access_token,
        expiresAt: data.expires_at,
    }
}

export async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
    const res = await fetch(`${API_BASE}/api/extension/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
        throw new Error('Failed to fetch user info')
    }

    const data = await res.json()
    return data.user
}

export function openLoginPage(): Promise<chrome.tabs.Tab> {
    return chrome.tabs.create({ url: BRIDGE_URL })
}

export function getBridgeUrl(): string {
    return BRIDGE_URL
}

export async function handleAuthCode(code: string): Promise<void> {
    const { accessToken, expiresAt } = await exchangeCodeForToken(code)
    const user = await fetchUserInfo(accessToken)
    await saveAuthState({ accessToken, expiresAt, user })
}

export async function logout(): Promise<void> {
    await clearAuthState()
}

export async function refreshUserInfo(): Promise<UserInfo | null> {
    const state = await getAuthState()
    if (!state.accessToken) return null

    try {
        const user = await fetchUserInfo(state.accessToken)
        await saveAuthState({ user })
        return user
    } catch (e) {
        console.error('Failed to refresh user info:', e)
        return null
    }
}

