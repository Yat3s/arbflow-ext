import type { ElementInfo, Position, SiteType, TradeStep } from '../lib/types'

const SITE_TYPE: SiteType = window.location.hostname.includes('lighter.xyz')
    ? 'lighter'
    : window.location.hostname.includes('variational.io')
        ? 'omni'
        : null

console.log('[Arbflow] Content script loaded, SITE_TYPE:', SITE_TYPE)

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

if (SITE_TYPE) {
    chrome.runtime
        .sendMessage({
            type: 'CONTENT_SCRIPT_READY',
            site: SITE_TYPE,
            url: window.location.href,
        })
        .catch(() => { })
}

interface PositionsConfig {
    tableSelector: string
    rowSelector: string
    exchangeId: string
    parseRow: (row: Element) => Position | null
}

const parseNum = (text?: string | null): number =>
    parseFloat(text?.replace(/[$,<>]/g, '').trim() || '0') || 0

const POSITIONS_CONFIG: Record<string, PositionsConfig> = {
    lighter: {
        tableSelector: 'table[data-testid="positions-table"]',
        rowSelector: 'tbody tr[data-testid^="row-"]',
        exchangeId: 'LG',
        parseRow: (row: Element): Position | null => {
            const cells = row.querySelectorAll('td')
            if (cells.length < 9) return null

            const marketCell = cells[0]
            const directionEl = marketCell.querySelector("[data-testid^='direction-']")
            const side: 'long' | 'short' =
                directionEl?.getAttribute('data-testid') === 'direction-long' ? 'long' : 'short'
            const symbol = marketCell.querySelector('span')?.textContent?.trim() || ''
            const leverageEl = marketCell.querySelector('span[data-state]')
            const leverage = leverageEl?.textContent?.replace('x', '').trim() || ''

            const position = parseNum(cells[1]?.textContent)
            const positionValue = parseNum(cells[2]?.textContent)
            const avgEntryPrice = parseNum(cells[3]?.textContent)
            const markPrice = parseNum(cells[4]?.textContent)
            const liqPriceText = cells[5]?.textContent?.trim()
            const liquidationPrice = liqPriceText === 'N/A' ? null : parseNum(liqPriceText)

            const pnlText = cells[6]?.textContent?.trim() || ''
            const pnlMatch = pnlText.match(/([+-]?\$?[\d,.]+)/)
            let unrealizedPnl = pnlMatch ? parseFloat(pnlMatch[1].replace(/[$,]/g, '')) : 0
            if (pnlText.startsWith('-')) unrealizedPnl = -Math.abs(unrealizedPnl)
            const pnlPercentMatch = pnlText.match(/\(([+-]?[\d,.]+)%\)/)
            const unrealizedPnlPercent = pnlPercentMatch
                ? parseFloat(pnlPercentMatch[1].replace(',', ''))
                : 0

            const margin = parseNum(cells[7]?.textContent)
            const fundingText = cells[8]?.textContent?.trim() || ''
            const funding = parseNum(fundingText)

            return {
                symbol,
                position,
                side,
                leverage,
                avgEntryPrice,
                markPrice,
                positionValue,
                unrealizedPnl,
                unrealizedPnlPercent,
                margin,
                funding,
                liquidationPrice,
            }
        },
    },
    omni: {
        tableSelector: 'svelte-virtual-list-contents',
        rowSelector: 'div[data-testid="positions-table-row"]',
        exchangeId: 'OM',
        parseRow: (row: Element): Position | null => {
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
    },
}

let positionsObserver: MutationObserver | null = null
let lastPositionsHash = ''

function parsePositionsFromDOM(): Position[] | null {
    if (!SITE_TYPE) return null
    const config = POSITIONS_CONFIG[SITE_TYPE]
    if (!config) return null

    const table = document.querySelector(config.tableSelector)
    if (!table) return null

    const rows = table.querySelectorAll(config.rowSelector)
    const positions: Position[] = []

    rows.forEach((row) => {
        const pos = config.parseRow(row)
        if (pos && pos.symbol) {
            positions.push(pos)
        }
    })

    return positions
}

function sendPositionsUpdate() {
    if (!SITE_TYPE) return
    const config = POSITIONS_CONFIG[SITE_TYPE]
    if (!config) return

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
            exchange: config.exchangeId,
            positions: positions,
            isFullUpdate: true,
            timestamp: Date.now(),
        })
        .catch(() => { })
}

function startPositionsObserver() {
    if (!SITE_TYPE) return
    const config = POSITIONS_CONFIG[SITE_TYPE]
    if (!config) return

    const tryStart = () => {
        const table = document.querySelector(config.tableSelector)
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

if (SITE_TYPE === 'lighter' || SITE_TYPE === 'omni') {
    startPositionsObserver()
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
