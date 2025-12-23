import { EXCHANGES } from '../lib/config'
import type { ElementInfo, Position, SiteType, TradeStep } from '../lib/types'

type ExtendedSiteType = SiteType | 'arbflow'

const SITE_TYPE: ExtendedSiteType = window.location.hostname.includes('lighter.xyz')
    ? 'lighter'
    : window.location.hostname.includes('variational.io')
        ? 'omni'
        : window.location.hostname.includes('arbflow.io')
            ? 'arbflow'
            : null

function getExchangeConfigBySiteType(siteType: ExtendedSiteType) {
    if (!siteType || siteType === 'arbflow') return null
    return EXCHANGES.find((e) => e.id === siteType) || null
}

console.log('[Arbflow] Content script loaded, SITE_TYPE:', SITE_TYPE)

if (SITE_TYPE === 'arbflow') {
    console.log('[Arbflow] Arbflow.io detected, setting up bridge listener...')
    setupBridgeListener()
}

function setupBridgeListener() {
    let authCodeSent = false

    const checkForCode = () => {
        if (authCodeSent) return true
        if (!window.location.pathname.includes('/extension/bridge')) return false

        const meta = document.querySelector('meta[name="ext-one-time-code"]')
        const code = meta?.getAttribute('content')
        if (code) {
            console.log('[Arbflow] Found auth code, sending to background')
            authCodeSent = true
            chrome.runtime.sendMessage({
                type: 'AUTH_CODE_RECEIVED',
                code,
            }).catch(() => { })
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
            attributeFilter: ['content']
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

if (!SITE_TYPE) {
    console.log('[Arbflow] Unknown site, content script disabled')
}

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

async function injectInterceptor() {
    console.log('[Arbflow] Injecting interceptor scripts...')
    try {
        await injectScript('injected/index.js')
        console.log('[Arbflow] ✅ Interceptor scripts loaded')
    } catch (e) {
        console.log('[Arbflow] ❌ Failed to load interceptor:', e)
    }
}

if (SITE_TYPE === 'omni' || SITE_TYPE === 'lighter') {
    injectInterceptor()
}

window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (!event.data?.type?.startsWith('ARBFLOW_')) return

    const { type, ...payload } = event.data
    const msgType = type.replace('ARBFLOW_', '')

    chrome.runtime
        .sendMessage({
            type: msgType,
            target: 'sidepanel',
            site: SITE_TYPE,
            ...payload,
        })
        .catch(() => { })
})

const watchedSelectors = new Map<string, boolean>()
let observer: MutationObserver | null = null

function getElementInfo(selector: string): ElementInfo {
    const element = document.querySelector(selector) as HTMLElement | null
    if (!element) {
        return { exists: false, selector }
    }

    return {
        exists: true,
        selector,
        tagName: element.tagName.toLowerCase(),
        text: element.textContent?.trim().slice(0, 100),
        disabled:
            (element as HTMLButtonElement).disabled ||
            element.getAttribute('aria-disabled') === 'true',
        visible: element.offsetParent !== null,
        className: element.className,
    }
}

function collectAllWatchedElements(): Record<string, ElementInfo> {
    const elements: Record<string, ElementInfo> = {}
    for (const [selector] of watchedSelectors) {
        elements[selector] = getElementInfo(selector)
    }
    return elements
}

function sendUpdate(reason = 'update') {
    const data = {
        type: 'ELEMENT_UPDATE',
        site: SITE_TYPE,
        url: window.location.href,
        reason,
        elements: collectAllWatchedElements(),
        timestamp: Date.now(),
    }
    chrome.runtime.sendMessage(data).catch(() => { })
}

function startObserving() {
    if (observer) return
    if (!document.body) {
        document.addEventListener('DOMContentLoaded', startObserving)
        return
    }

    observer = new MutationObserver((mutations) => {
        let shouldUpdate = false

        for (const mutation of mutations) {
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
                for (const [selector] of watchedSelectors) {
                    const element = document.querySelector(selector)
                    if (element) {
                        if (
                            mutation.target === element ||
                            mutation.target.contains(element) ||
                            element.contains(mutation.target)
                        ) {
                            shouldUpdate = true
                            break
                        }
                    }
                }
            }
            if (shouldUpdate) break
        }

        if (shouldUpdate) {
            sendUpdate('mutation')
        }
    })

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled', 'aria-disabled', 'class', 'style'],
    })
}

function stopObserving() {
    if (observer) {
        observer.disconnect()
        observer = null
    }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'WATCH_ELEMENTS') {
        watchedSelectors.clear()
        for (const selector of message.selectors || []) {
            watchedSelectors.set(selector, true)
        }

        if (watchedSelectors.size > 0) {
            startObserving()
            sendUpdate('watch_start')
        } else {
            stopObserving()
        }

        sendResponse({ success: true, watching: watchedSelectors.size })
        return true
    }

    if (message.type === 'GET_ELEMENT_STATUS') {
        const elements = collectAllWatchedElements()
        sendResponse({
            site: SITE_TYPE,
            url: window.location.href,
            elements,
        })
        return true
    }

    if (message.type === 'PING') {
        sendResponse({ site: SITE_TYPE, url: window.location.href })
        return true
    }

    if (message.type === 'WS_COMMAND') {
        console.log('[Arbflow] Content received WS_COMMAND:', message)
        window.postMessage(
            {
                type: 'ARBFLOW_WS_COMMAND',
                command: message.command,
                url: message.url,
                id: message.id,
                options: message.options,
                data: message.data,
            },
            '*'
        )
        sendResponse({ success: true })
        return true
    }

    if (message.type === 'HTTP_COMMAND') {
        console.log('[Arbflow] Content received HTTP_COMMAND:', message)
        window.postMessage(
            {
                type: 'ARBFLOW_HTTP_COMMAND',
                command: message.command,
                url: message.url,
                id: message.id,
                options: message.options,
            },
            '*'
        )
        sendResponse({ success: true })
        return true
    }

    if (message.type === 'EXECUTE_TRADE_STEP') {
        console.log('[Arbflow] Content received EXECUTE_TRADE_STEP:', message)
        executeDOMStep(message.step)
            .then((result) => {
                sendResponse({ success: true, result })
            })
            .catch((error) => {
                console.error('[Arbflow] Step execution error:', error)
                sendResponse({ success: false, error: error.message })
            })
        return true
    }

    if (message.type === 'CHECK_ELEMENT') {
        const element = document.querySelector(message.selector) as HTMLElement | null
        sendResponse({
            exists: !!element,
            visible: element ? element.offsetParent !== null : false,
            text: element?.textContent?.trim().slice(0, 100),
        })
        return true
    }

    if (message.type === 'GET_TRADE_STATE') {
        const state = getCurrentTradeState(message.platform)
        sendResponse(state)
        return true
    }

    if (message.type === 'GET_LG_ORDER_FORM_STATE') {
        const state = getLighterOrderFormState()
        sendResponse(state)
        return true
    }

    if (message.type === 'TRADE') {
        console.log('[Arbflow] Content received TRADE:', message)
        window.postMessage(
            {
                type: 'ARBFLOW_TRADE',
                exchangeId: message.exchangeId,
                params: message.params,
            },
            '*'
        )
        sendResponse({ success: true })
        return true
    }

    return false
})

function getCurrentTradeState(platform: string): { direction: 'long' | 'short' | null; size: string } {
    if (platform === 'LG') {
        const directionContainer = document.querySelector('.relative.flex.h-8.shrink-0.rounded-sm')
        const indicator = directionContainer?.querySelector('div.absolute')
        const indicatorClass = indicator?.className || ''

        const classArr = indicatorClass.split(/\s+/)
        const isLong = classArr.some((c) => c === 'left-0.5' || c.startsWith('border-green'))
        const isShort = classArr.some((c) => c === 'left-1/2' || c.startsWith('border-red'))

        const sizeInput = document.querySelector('[data-testid="place-order-size-input"]') as HTMLInputElement | null
        const size = sizeInput?.value || ''

        return {
            direction: isLong ? 'long' : isShort ? 'short' : null,
            size,
        }
    }

    if (platform === 'OM') {
        const switchContainer = document.querySelector('span[role="switch"]')
        const buyBtn = switchContainer?.querySelector('button:first-child') as HTMLButtonElement | null
        const sellBtn = switchContainer?.querySelector('button:nth-child(2)') as HTMLButtonElement | null
        const isBuyActive = buyBtn?.hasAttribute('disabled')
        const isSellActive = sellBtn?.hasAttribute('disabled')

        const sizeInput = document.querySelector('[data-testid="quantity-input"]') as HTMLInputElement | null
        const size = sizeInput?.value || ''

        return {
            direction: isBuyActive ? 'long' : isSellActive ? 'short' : null,
            size,
        }
    }

    return { direction: null, size: '' }
}

function getLighterOrderFormState(): {
    direction: 'long' | 'short' | null
    size: string
    leverage: string
    marginMode: string
    orderType: string
    symbol: string
} {
    const directionContainer = document.querySelector('.relative.flex.h-8.shrink-0.rounded-sm')
    const indicator = directionContainer?.querySelector('div.absolute')
    const indicatorClass = indicator?.className || ''

    const classArr = indicatorClass.split(/\s+/)
    const isLong = classArr.some((c) => c === 'left-0.5' || c.startsWith('border-green'))
    const isShort = classArr.some((c) => c === 'left-1/2' || c.startsWith('border-red'))

    const sizeInput = document.querySelector('[data-testid="place-order-size-input"]') as HTMLInputElement | null
    const size = sizeInput?.value || ''

    const leverageBtn = document.querySelector('[data-testid="adjust-leverage"]')
    const leverage = leverageBtn?.textContent?.trim() || ''

    const marginModeBtn = document.querySelector('[data-tourid="marginModeSetting"]')
    const marginMode = marginModeBtn?.textContent?.trim() || ''

    const activeOrderTypeBtn = document.querySelector('#orderTypeSelector button[class*="bg-gray-9"]')
    const orderType = activeOrderTypeBtn?.textContent?.trim()?.split('\n')[0] || ''

    const pathParts = window.location.pathname.split('/').filter(Boolean)
    const symbol = pathParts.length > 0 ? pathParts[pathParts.length - 1].toUpperCase() : ''

    return {
        direction: isLong ? 'long' : isShort ? 'short' : null,
        size,
        leverage,
        marginMode,
        orderType,
        symbol,
    }
}

if (SITE_TYPE) {
    chrome.runtime
        .sendMessage({
            type: 'CONTENT_SCRIPT_READY',
            site: SITE_TYPE,
            url: window.location.href,
        })
        .catch(() => { })
}

type PositionRowParser = (row: Element) => Position | null

const parseNum = (text?: string | null): number =>
    parseFloat(text?.replace(/[$,<>]/g, '').trim() || '0') || 0

const ROW_PARSERS: Record<string, PositionRowParser> = {
    omni: (row: Element): Position | null => {
        const cells = row.querySelectorAll(':scope > div')
        if (cells.length < 8) return null

        const symbolEl = cells[0]?.querySelector('.link-instrument span')
        const symbol = symbolEl?.textContent?.trim().replace('-PERP', '') || ''

        const sizeText = cells[1]?.textContent?.trim() || '0'
        const size = parseNum(sizeText)
        const side: 'long' | 'short' = size >= 0 ? 'long' : 'short'

        const markPrice = parseNum(cells[2]?.textContent)
        const positionValue = parseNum(cells[3]?.textContent)
        const avgEntryPrice = parseNum(cells[4]?.textContent)

        const liqText = cells[5]?.textContent?.trim()
        const liquidationPrice = liqText === '-' ? null : parseNum(liqText)

        const fundingText = cells[6]?.textContent?.trim() || ''
        const funding = parseNum(fundingText)

        const pnlText = cells[7]?.textContent?.trim() || ''
        const pnlMatch = pnlText.match(/([+-]?\$?[\d.,]+)\s*\(([^)]+)\)/)
        let unrealizedPnl = 0
        let unrealizedPnlPercent = 0
        if (pnlMatch) {
            unrealizedPnl = parseNum(pnlMatch[1])
            if (pnlText.startsWith('-')) unrealizedPnl = -Math.abs(unrealizedPnl)
            unrealizedPnlPercent = parseFloat(pnlMatch[2].replace(/[%,]/g, '')) || 0
        }

        return {
            symbol,
            position: Math.abs(size),
            side,
            avgEntryPrice,
            markPrice,
            positionValue,
            unrealizedPnl,
            unrealizedPnlPercent,
            funding,
            liquidationPrice,
        }
    },
}

let positionsObserver: MutationObserver | null = null
let lastPositionsHash = ''

function parsePositionsFromDOM(): Position[] | null {
    if (!SITE_TYPE) return null
    const exchangeConfig = getExchangeConfigBySiteType(SITE_TYPE)
    if (!exchangeConfig || exchangeConfig.positionUpdater.source !== 'ui') return null

    const { uiParser } = exchangeConfig.positionUpdater
    const rowParser = ROW_PARSERS[SITE_TYPE]
    if (!rowParser) return null

    const table = document.querySelector(uiParser.tableSelector)
    if (!table) return null

    const rows = table.querySelectorAll(uiParser.rowSelector)
    const positions: Position[] = []

    rows.forEach((row) => {
        const pos = rowParser(row)
        if (pos && pos.symbol) {
            positions.push(pos)
        }
    })

    return positions
}

function sendPositionsUpdate() {
    if (!SITE_TYPE) return
    const exchangeConfig = getExchangeConfigBySiteType(SITE_TYPE)
    if (!exchangeConfig || exchangeConfig.positionUpdater.source !== 'ui') return

    const positions = parsePositionsFromDOM()
    if (!positions) return

    const hash = JSON.stringify(positions)
    if (hash === lastPositionsHash) return
    lastPositionsHash = hash

    console.log('[Arbflow] 📊 DOM Positions:', positions)

    chrome.runtime
        .sendMessage({
            type: 'POSITIONS',
            target: 'sidepanel',
            site: SITE_TYPE,
            exchange: exchangeConfig.abbreviation,
            positions: positions,
            isFullUpdate: true,
            timestamp: Date.now(),
        })
        .catch(() => { })
}

function startPositionsObserver() {
    if (!SITE_TYPE) return
    const exchangeConfig = getExchangeConfigBySiteType(SITE_TYPE)
    if (!exchangeConfig || exchangeConfig.positionUpdater.source !== 'ui') return

    const { uiParser } = exchangeConfig.positionUpdater

    const tryStart = () => {
        const table = document.querySelector(uiParser.tableSelector)
        if (!table) {
            setTimeout(tryStart, 1000)
            return
        }

        console.log('[Arbflow] 📊 Found positions table, starting observer')
        sendPositionsUpdate()

        positionsObserver = new MutationObserver(() => {
            sendPositionsUpdate()
        })

        positionsObserver.observe(table, {
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

if (SITE_TYPE) {
    const config = getExchangeConfigBySiteType(SITE_TYPE)
    if (config?.positionUpdater.source === 'ui') {
        startPositionsObserver()
    }
}

// ========== Order Form Observer (Lighter only) ==========
let orderFormObserver: MutationObserver | null = null
let lastOrderFormHash = ''
let arbflowButton: HTMLButtonElement | null = null

function sendOrderFormUpdate() {
    if (SITE_TYPE !== 'lighter') return

    const state = getLighterOrderFormState()
    const hash = JSON.stringify(state)
    if (hash === lastOrderFormHash) return
    lastOrderFormHash = hash

    console.log('[Arbflow] 📝 Order Form:', state)

    updateArbflowButton(state)

    chrome.runtime
        .sendMessage({
            type: 'LG_ORDER_FORM_UPDATE',
            target: 'sidepanel',
            site: SITE_TYPE,
            state,
            timestamp: Date.now(),
        })
        .catch(() => { })
}

function updateArbflowButton(state: ReturnType<typeof getLighterOrderFormState>) {
    if (!arbflowButton) return

    const { direction, size, symbol } = state
    const sizeNum = parseFloat(size) || 0

    arbflowButton.disabled = sizeNum === 0

    if (direction === 'long') {
        arbflowButton.textContent = `买 LG 卖 OM(${sizeNum} ${symbol})`
        arbflowButton.style.borderColor = '#22c55e'
        arbflowButton.style.background = 'linear-gradient(135deg, #166534 0%, #14532d 100%)'
    } else if (direction === 'short') {
        arbflowButton.textContent = `卖 LG 买 OM(${sizeNum} ${symbol})`
        arbflowButton.style.borderColor = '#ef4444'
        arbflowButton.style.background = 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)'
    } else {
        arbflowButton.textContent = '选择方向'
        arbflowButton.style.borderColor = '#6b7280'
        arbflowButton.style.background = '#374151'
    }
}

function injectArbflowButton() {
    if (SITE_TYPE !== 'lighter') return

    const placeOrderBtn = document.querySelector('#place-order-button') as HTMLButtonElement | null
    if (!placeOrderBtn) return
    if (document.querySelector('#arbflow-trade-button')) return

    arbflowButton = document.createElement('button')
    arbflowButton.id = 'arbflow-trade-button'
    arbflowButton.className = placeOrderBtn.className
    arbflowButton.style.cssText = `
        margin-bottom: 4px;
        border: 1px solid #6b7280;
        background: #374151;
        position: relative;
        overflow: hidden;
    `
    arbflowButton.textContent = '选择方向'

    arbflowButton.addEventListener('click', async (e) => {
        e.preventDefault()
        e.stopPropagation()

        const state = getLighterOrderFormState()
        console.log('[Arbflow] Trade button clicked:', state)

        if (!state.direction || !state.size || parseFloat(state.size) === 0) {
            console.log('[Arbflow] Invalid state, skipping')
            return
        }

        const placeOrderBtn = document.querySelector('#place-order-button') as HTMLButtonElement | null
        if (placeOrderBtn && !placeOrderBtn.disabled) {
            console.log('[Arbflow] Clicking Place Market Order button')
            placeOrderBtn.click()
        }

        const omDirection = state.direction === 'long' ? 'short' : 'long'

        chrome.runtime
            .sendMessage({
                type: 'ARBFLOW_TRADE_BUTTON_CLICK',
                target: 'sidepanel',
                site: SITE_TYPE,
                state,
                omTrade: {
                    symbol: state.symbol,
                    direction: omDirection,
                    size: parseFloat(state.size),
                },
                timestamp: Date.now(),
            })
            .catch(() => { })
    })

    placeOrderBtn.parentElement?.insertBefore(arbflowButton, placeOrderBtn)

    const state = getLighterOrderFormState()
    updateArbflowButton(state)

    console.log('[Arbflow] ✅ Injected Arbflow trade button')
}

function startOrderFormObserver() {
    if (SITE_TYPE !== 'lighter') return

    const tryStart = () => {
        const orderForm = document.querySelector('#place-order')
        if (!orderForm) {
            setTimeout(tryStart, 1000)
            return
        }

        console.log('[Arbflow] 📝 Found order form, starting observer')
        sendOrderFormUpdate()
        injectArbflowButton()

        orderFormObserver = new MutationObserver(() => {
            sendOrderFormUpdate()
            if (!document.querySelector('#arbflow-trade-button')) {
                injectArbflowButton()
            }
        })

        orderFormObserver.observe(orderForm, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
        })
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryStart)
    } else {
        tryStart()
    }
}

if (SITE_TYPE === 'lighter') {
    startOrderFormObserver()
}

// ========== Portfolio Value Observer (Omni only) ==========
let portfolioObserver: MutationObserver | null = null
let lastAccountInfo: { portfolioValue: number | null; leverage: number | null } = {
    portfolioValue: null,
    leverage: null,
}

function parseAccountInfo(): { portfolioValue: number | null; leverage: number | null } {
    let portfolioValue: number | null = null
    let leverage: number | null = null

    // Find account-details container
    const accountDetails = document.querySelector('.account-details')
    if (accountDetails) {
        const rows = accountDetails.querySelectorAll('.flex.justify-between')
        for (const row of rows) {
            const label = row.querySelector('span')?.textContent?.trim()
            if (label === 'Portfolio Value') {
                const valueSpan = row.querySelector('span.text-blackwhite, span.text-green, span.text-red')
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

    // Fallback: try old method for portfolio value
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

function startAccountInfoObserver() {
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

if (SITE_TYPE === 'omni') {
    startAccountInfoObserver()
}

async function executeDOMStep(step: TradeStep): Promise<{ success: boolean; selector: string; type: string }> {
    const { type, selector, value, waitAfter = 0 } = step

    const waitForElement = (sel: string, timeout = 3000): Promise<HTMLElement> => {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(sel) as HTMLElement | null
            if (element) {
                resolve(element)
                return
            }

            const obs = new MutationObserver(() => {
                const el = document.querySelector(sel) as HTMLElement | null
                if (el) {
                    obs.disconnect()
                    resolve(el)
                }
            })

            obs.observe(document.body, { childList: true, subtree: true })

            setTimeout(() => {
                obs.disconnect()
                reject(new Error(`Element not found: ${sel}`))
            }, timeout)
        })
    }

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    console.log(`[Arbflow] Executing step: ${type} on ${selector}`)

    const element = await waitForElement(selector)

    switch (type) {
        case 'click':
            element.click()
            break

        case 'clear_and_type':
            element.focus()
                ; (element as HTMLInputElement).value = ''
            element.dispatchEvent(new Event('input', { bubbles: true }))
            await sleep(50)
                ; (element as HTMLInputElement).value = value || ''
            element.dispatchEvent(new Event('input', { bubbles: true }))
            element.dispatchEvent(new Event('change', { bubbles: true }))
            break

        case 'type':
            element.focus()
                ; (element as HTMLInputElement).value = value || ''
            element.dispatchEvent(new Event('input', { bubbles: true }))
            element.dispatchEvent(new Event('change', { bubbles: true }))
            break

        default:
            throw new Error(`Unknown step type: ${type}`)
    }

    if (waitAfter > 0) {
        await sleep(waitAfter)
    }

    return { success: true, selector, type }
}
