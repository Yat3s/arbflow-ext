import { SITE_TYPE } from './constants'

export interface LighterOrderFormState {
    direction: 'long' | 'short' | null
    size: string
    leverage: string
    marginMode: string
    orderType: string
    symbol: string
}

let orderFormObserver: MutationObserver | null = null
let lastOrderFormHash = ''
let arbflowButton: HTMLButtonElement | null = null

export function getLighterOrderFormState(): LighterOrderFormState {
    const directionContainer = document.querySelector('.relative.flex.h-8.shrink-0.rounded-sm')
    const indicator = directionContainer?.querySelector('div.absolute')
    const indicatorClass = indicator?.className || ''

    const classArr = indicatorClass.split(/\s+/)
    const isLong = classArr.some((c) => c === 'left-0.5' || c.startsWith('border-green'))
    const isShort = classArr.some((c) => c === 'left-1/2' || c.startsWith('border-red'))

    const sizeInput = document.querySelector(
        '[data-testid="place-order-size-input"]'
    ) as HTMLInputElement | null
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

export function getCurrentTradeState(
    platform: string
): { direction: 'long' | 'short' | null; size: string } {
    if (platform === 'LG') {
        const directionContainer = document.querySelector('.relative.flex.h-8.shrink-0.rounded-sm')
        const indicator = directionContainer?.querySelector('div.absolute')
        const indicatorClass = indicator?.className || ''

        const classArr = indicatorClass.split(/\s+/)
        const isLong = classArr.some((c) => c === 'left-0.5' || c.startsWith('border-green'))
        const isShort = classArr.some((c) => c === 'left-1/2' || c.startsWith('border-red'))

        const sizeInput = document.querySelector(
            '[data-testid="place-order-size-input"]'
        ) as HTMLInputElement | null
        const size = sizeInput?.value || ''

        return {
            direction: isLong ? 'long' : isShort ? 'short' : null,
            size,
        }
    }

    if (platform === 'OM') {
        const switchContainer = document.querySelector('span[role="switch"]')
        const buyBtn = switchContainer?.querySelector('button:first-child') as HTMLButtonElement | null
        const sellBtn = switchContainer?.querySelector(
            'button:nth-child(2)'
        ) as HTMLButtonElement | null
        const isBuyActive = buyBtn?.hasAttribute('disabled')
        const isSellActive = sellBtn?.hasAttribute('disabled')

        const sizeInput = document.querySelector(
            '[data-testid="quantity-input"]'
        ) as HTMLInputElement | null
        const size = sizeInput?.value || ''

        return {
            direction: isBuyActive ? 'long' : isSellActive ? 'short' : null,
            size,
        }
    }

    return { direction: null, size: '' }
}

function updateArbflowButton(state: LighterOrderFormState) {
    if (!arbflowButton) return

    const { direction, size, symbol } = state
    const sizeNum = parseFloat(size) || 0

    arbflowButton.disabled = sizeNum === 0
    arbflowButton.style.setProperty('height', '60px', 'important')

    let mainText = '选择方向'
    let borderColor = '#6b7280'
    let background = '#374151'

    if (direction === 'long') {
        mainText = `+ LG - OM (${sizeNum} ${symbol})`
        borderColor = '#22c55e'
        background = 'linear-gradient(135deg, #166534 0%, #14532d 100%)'
    } else if (direction === 'short') {
        mainText = `- LG + OM (${sizeNum} ${symbol})`
        borderColor = '#ef4444'
        background = 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)'
    }

    arbflowButton.style.borderColor = borderColor
    arbflowButton.style.background = background
    arbflowButton.style.display = 'flex'
    arbflowButton.style.flexDirection = 'column'
    arbflowButton.style.alignItems = 'center'
    arbflowButton.style.justifyContent = 'center'
    arbflowButton.innerHTML = `
        <span style="font-size: 16px; font-weight: bold;">${mainText}</span>
        <span style="font-size: 8px; opacity: 0.6; margin-top: 4px;">按回车点击</span>
    `
}

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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && arbflowButton && !arbflowButton.disabled) {
            const activeEl = document.activeElement
            const isInputFocused =
                activeEl?.tagName === 'INPUT' ||
                activeEl?.tagName === 'TEXTAREA' ||
                activeEl?.getAttribute('contenteditable') === 'true'
            if (!isInputFocused) {
                e.preventDefault()
                arbflowButton.click()
            }
        }
    })

    console.log('[Arbflow] ✅ Injected Arbflow trade button')
}

export function startOrderFormObserver() {
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

