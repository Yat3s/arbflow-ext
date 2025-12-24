export async function fetchOmWalletAddress(tabId: number): Promise<string | null> {
    try {
        const result = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                return fetch('https://omni.variational.io/api/settlement_pools/existing')
                    .then((response) => {
                        if (!response.ok) return null
                        return response.json()
                    })
                    .then((data) => data?.address_other || null)
                    .catch(() => null)
            },
        })
        return result?.[0]?.result || null
    } catch (e) {
        console.error('[Arbflow] Failed to fetch OM wallet address:', e)
        return null
    }
}

