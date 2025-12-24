import { SITE_TYPE } from './constants';

let portfolioObserver: MutationObserver | null = null
let lastAccountInfo: { portfolioValue: number | null; leverage: number | null } = {
    portfolioValue: null,
    leverage: null,
}

function parseAccountInfo(): { portfolioValue: number | null; leverage: number | null } {
    let portfolioValue: number | null = null
    let leverage: number | null = null

    const accountDetails = document.querySelector('.account-details')
    if (accountDetails) {
        const rows = accountDetails.querySelectorAll('.flex.justify-between')
        for (const row of rows) {
            const label = row.querySelector('span')?.textContent?.trim()
            if (label === 'Portfolio Value') {
                const valueSpan = row.querySelector(
                    'span.text-blackwhite, span.text-green, span.text-red'
                )
                if (valueSpan?.textContent) {
                    const match = valueSpan.textContent.match(/\$?([\d,]+\.?\d*)/)
                    if (match) {
                        portfolioValue = parseFloat(match[1].replace(/,/g, ''))
                    }
                }
            } else if (label === 'Portfolio Leverage') {
                const valueSpan = row.querySelector('span.text-blackwhite')
                if (valueSpan?.textContent) {
                    const match = valueSpan.textContent.match(/([\d.]+)x/)
                    if (match) {
                        leverage = parseFloat(match[1])
                    }
                }
            }
        }
    }

    if (portfolioValue === null) {
        const portfolioSpans = document.querySelectorAll('span')
        for (const span of portfolioSpans) {
            if (span.textContent?.trim() === 'Portfolio') {
                const container = span.closest('.flex.flex-col')
                if (container) {
                    const valueSpan = container.querySelector('.tabular-nums')
                    if (valueSpan?.textContent) {
                        const match = valueSpan.textContent.match(/\$?([\d,]+\.?\d*)/)
                        if (match) {
                            portfolioValue = parseFloat(match[1].replace(/,/g, ''))
                            break
                        }
                    }
                }
            }
        }
    }

    return { portfolioValue, leverage }
}

function sendAccountInfoUpdate() {
    if (SITE_TYPE !== 'omni') return

    const info = parseAccountInfo()
    if (
        info.portfolioValue === lastAccountInfo.portfolioValue &&
        info.leverage === lastAccountInfo.leverage
    ) {
        return
    }
    lastAccountInfo = info

    console.log('[Arbflow] 💰 Account info:', info)

    chrome.runtime
        .sendMessage({
            type: 'ACCOUNT_INFO',
            target: 'sidepanel',
            site: SITE_TYPE,
            exchange: 'OM',
            portfolioValue: info.portfolioValue,
            leverage: info.leverage,
            timestamp: Date.now(),
        })
        .catch(() => { })
}

export function startAccountInfoObserver() {
    if (SITE_TYPE !== 'omni') return

    const tryStart = () => {
        const info = parseAccountInfo()
        if (info.portfolioValue === null) {
            setTimeout(tryStart, 1000)
            return
        }

        console.log('[Arbflow] 💰 Found account info, starting observer')
        sendAccountInfoUpdate()

        portfolioObserver = new MutationObserver(() => {
            sendAccountInfoUpdate()
        })

        portfolioObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
        })
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryStart)
    } else {
        tryStart()
    }
}

