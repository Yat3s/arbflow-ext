import type { Position, TradeStep } from '../lib/types'
import { SITE_TYPE } from './constants'
import { handleGetElementStatus, handleWatchElements } from './observers'
import { getCurrentTradeState, getLighterOrderFormState } from './order-form'
import { updateOMPositionsOnLighter } from './positions'
import { executeDOMStep } from './trade-executor'

export function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.type === 'WATCH_ELEMENTS') {
            const result = handleWatchElements(message.selectors || [])
            sendResponse(result)
            return true
        }

        if (message.type === 'GET_ELEMENT_STATUS') {
            const result = handleGetElementStatus()
            sendResponse(result)
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
            executeDOMStep(message.step as TradeStep)
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

        if (message.type === 'UPDATE_OM_POSITIONS') {
            console.log('[Arbflow] Received OM positions to display:', message.positions)
            updateOMPositionsOnLighter(message.positions as Position[])
            sendResponse({ success: true })
            return true
        }

        return false
    })
}

export function setupWindowMessageListener() {
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
}

export function notifyContentScriptReady() {
    if (SITE_TYPE) {
        chrome.runtime
            .sendMessage({
                type: 'CONTENT_SCRIPT_READY',
                site: SITE_TYPE,
                url: window.location.href,
            })
            .catch(() => { })
    }
}

