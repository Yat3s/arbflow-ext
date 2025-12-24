export function setupBridgeListener() {
    let authCodeSent = false

    const checkForCode = () => {
        if (authCodeSent) return true
        if (!window.location.pathname.includes('/extension/bridge')) return false

        const meta = document.querySelector('meta[name="ext-one-time-code"]')
        const code = meta?.getAttribute('content')
        if (code) {
            console.log('[Arbflow] Found auth code, sending to background')
            authCodeSent = true
            chrome.runtime
                .sendMessage({
                    type: 'AUTH_CODE_RECEIVED',
                    code,
                })
                .catch(() => { })
            return true
        }
        return false
    }

    const startObserving = () => {
        if (checkForCode()) return

        const observer = new MutationObserver(() => {
            if (checkForCode()) {
                observer.disconnect()
            }
        })

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['content'],
        })

        setTimeout(() => {
            if (!authCodeSent) {
                observer.disconnect()
            }
        }, 60000)
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserving)
    } else {
        startObserving()
    }

    let lastUrl = window.location.href
    const urlCheckInterval = setInterval(() => {
        if (authCodeSent) {
            clearInterval(urlCheckInterval)
            return
        }
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href
            console.log('[Arbflow] URL changed to:', lastUrl)
            setTimeout(checkForCode, 500)
        }
    }, 500)

    setTimeout(() => clearInterval(urlCheckInterval), 120000)
}

