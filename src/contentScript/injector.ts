function injectScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = chrome.runtime.getURL(src)
        script.onload = () => {
            script.remove()
            resolve()
        }
        script.onerror = reject
            ; (document.head || document.documentElement).appendChild(script)
    })
}

export async function injectInterceptor() {
    console.log('[Arbflow] Injecting interceptor scripts...')
    try {
        await injectScript('injected/index.js')
        console.log('[Arbflow] ✅ Interceptor scripts loaded')
    } catch (e) {
        console.log('[Arbflow] ❌ Failed to load interceptor:', e)
    }
}

