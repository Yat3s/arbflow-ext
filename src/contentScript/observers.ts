import type { ElementInfo } from '../lib/types'
import { SITE_TYPE } from './constants'

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
            (element as HTMLButtonElement).disabled || element.getAttribute('aria-disabled') === 'true',
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

export function handleWatchElements(selectors: string[]): { success: boolean; watching: number } {
    watchedSelectors.clear()
    for (const selector of selectors || []) {
        watchedSelectors.set(selector, true)
    }

    if (watchedSelectors.size > 0) {
        startObserving()
        sendUpdate('watch_start')
    } else {
        stopObserving()
    }

    return { success: true, watching: watchedSelectors.size }
}

export function handleGetElementStatus() {
    return {
        site: SITE_TYPE,
        url: window.location.href,
        elements: collectAllWatchedElements(),
    }
}

