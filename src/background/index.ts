console.log('🚀 Background Service Worker started')

interface NetworkRequest {
  requestId: string
  url: string
  method: string
  type: string
  timeStamp: number
  requestBody?: chrome.webRequest.WebRequestBody
}

const networkMonitor = {
  watchingTabIds: new Set<number>(),
  requests: new Map<number, NetworkRequest[]>(),
}

function startMonitoringTab(tabId: number) {
  networkMonitor.watchingTabIds.add(tabId)
  console.log(`📡 Started monitoring Tab ${tabId}`)
}

function stopMonitoringTab(tabId: number) {
  networkMonitor.watchingTabIds.delete(tabId)
  networkMonitor.requests.delete(tabId)
  console.log(`🔴 Stopped monitoring Tab ${tabId}`)
}

function clearMonitoringRequests(tabId: number) {
  networkMonitor.requests.delete(tabId)
  console.log(`🧹 Cleared requests for Tab ${tabId}`)
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!networkMonitor.watchingTabIds.has(details.tabId)) return

    const requestInfo: NetworkRequest = {
      requestId: details.requestId,
      url: details.url,
      method: details.method,
      type: details.type,
      timeStamp: details.timeStamp,
      requestBody: details.requestBody ?? undefined,
    }

    if (!networkMonitor.requests.has(details.tabId)) {
      networkMonitor.requests.set(details.tabId, [])
    }
    networkMonitor.requests.get(details.tabId)!.push(requestInfo)

    console.log(`🌐 [Tab ${details.tabId}] ${details.method} ${details.url}`)

    chrome.runtime
      .sendMessage({
        type: 'NETWORK_REQUEST',
        target: 'sidepanel',
        tabId: details.tabId,
        request: requestInfo,
      })
      .catch(() => { })
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
)

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!networkMonitor.watchingTabIds.has(details.tabId)) return

    console.log(`✅ [Tab ${details.tabId}] Completed ${details.statusCode} ${details.url}`)

    chrome.runtime
      .sendMessage({
        type: 'NETWORK_COMPLETED',
        target: 'sidepanel',
        tabId: details.tabId,
        requestId: details.requestId,
        statusCode: details.statusCode,
        url: details.url,
      })
      .catch(() => { })
  },
  { urls: ['<all_urls>'] }
)

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (!networkMonitor.watchingTabIds.has(details.tabId)) return

    console.log(`❌ [Tab ${details.tabId}] Error ${details.error} ${details.url}`)

    chrome.runtime
      .sendMessage({
        type: 'NETWORK_ERROR',
        target: 'sidepanel',
        tabId: details.tabId,
        requestId: details.requestId,
        error: details.error,
        url: details.url,
      })
      .catch(() => { })
  },
  { urls: ['<all_urls>'] }
)

chrome.action.onClicked.addListener((tab) => {
  console.log('🖱️ Extension icon clicked', tab)
  if (tab.windowId) {
    ; (chrome.sidePanel as unknown as { open: (opts: { windowId: number }) => void }).open({ windowId: tab.windowId })
  }
})

chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ Extension installed/updated')
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ELEMENT_UPDATE' || message.type === 'CONTENT_SCRIPT_READY') {
    const enhancedMessage = {
      ...message,
      tabId: sender.tab?.id,
      target: 'sidepanel',
    }
    broadcastToSidePanel(enhancedMessage)
  }

  if (message.type === 'START_NETWORK_MONITOR') {
    startMonitoringTab(message.tabId)
    sendResponse({ success: true })
  }

  if (message.type === 'STOP_NETWORK_MONITOR') {
    stopMonitoringTab(message.tabId)
    sendResponse({ success: true })
  }

  if (message.type === 'CLEAR_NETWORK_REQUESTS') {
    clearMonitoringRequests(message.tabId)
    sendResponse({ success: true })
  }

  return false
})

async function broadcastToSidePanel(message: Record<string, unknown>) {
  try {
    const windows = await chrome.windows.getAll()
    for (const _ of windows) {
      chrome.runtime.sendMessage({ ...message, target: 'sidepanel' }).catch(() => { })
    }
  } catch (_) { }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    chrome.runtime
      .sendMessage({
        type: 'TAB_UPDATED',
        target: 'sidepanel',
        tabId,
        changeInfo,
        tab,
      })
      .catch(() => { })
  }
})

chrome.tabs.onCreated.addListener((tab) => {
  console.log('Tab created', tab)
  chrome.runtime
    .sendMessage({
      type: 'TAB_CREATED',
      target: 'sidepanel',
      tab,
    })
    .catch(() => { })
})

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log('Tab removed', tabId, removeInfo)
  chrome.runtime
    .sendMessage({
      type: 'TAB_REMOVED',
      target: 'sidepanel',
      tabId,
      removeInfo,
    })
    .catch(() => { })
})
