import { EXCHANGES } from '../lib/config'
import { startAccountInfoObserver } from './account-info'
import { setupBridgeListener } from './bridge'
import { SITE_TYPE, type ExtendedSiteType } from './constants'
import { injectInterceptor } from './injector'
import {
    notifyContentScriptReady,
    setupMessageListener,
    setupWindowMessageListener,
} from './message-handler'
import { startOrderFormObserver } from './order-form'
import { startLGPositionsObserver, startPositionsObserver } from './positions'

function getExchangeConfigBySiteType(siteType: ExtendedSiteType) {
    if (!siteType || siteType === 'arbflow') return null
    return EXCHANGES.find((e) => e.id === siteType) || null
}

if (SITE_TYPE === 'arbflow') {
    console.log('[Arbflow] Arbflow.io detected, setting up bridge listener...')
    setupBridgeListener()
}

if (!SITE_TYPE) {
    console.log('[Arbflow] Unknown site, content script disabled')
}

if (SITE_TYPE === 'omni' || SITE_TYPE === 'lighter') {
    injectInterceptor()
}

setupWindowMessageListener()
setupMessageListener()
notifyContentScriptReady()

if (SITE_TYPE) {
    const config = getExchangeConfigBySiteType(SITE_TYPE)
    if (config?.positionUpdater.source === 'ui') {
        startPositionsObserver()
    }
}

if (SITE_TYPE === 'lighter') {
    chrome.storage.local.get('arbflow_lg_injection_enabled').then((result) => {
        const enabled = result['arbflow_lg_injection_enabled'] !== false
        if (enabled) {
            startOrderFormObserver()
            startLGPositionsObserver()
        } else {
            console.log('[Arbflow] LG injection disabled by user')
        }
    })
}

if (SITE_TYPE === 'omni') {
    startAccountInfoObserver()
}
