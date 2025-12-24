import { EXCHANGES } from '../lib/config'
import type { Position } from '../lib/types'
import { SITE_TYPE, type ExtendedSiteType } from './constants'

type PositionRowParser = (row: Element) => Position | null

const parseNum = (text?: string | null): number =>
    parseFloat(text?.replace(/[$,<>]/g, '').trim() || '0') || 0

function getExchangeConfigBySiteType(siteType: ExtendedSiteType) {
    if (!siteType || siteType === 'arbflow') return null
    return EXCHANGES.find((e) => e.id === siteType) || null
}

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

export function startPositionsObserver() {
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

let cachedOMPositions: Position[] = []

export function updateOMPositionsOnLighter(positions: Position[]) {
    if (SITE_TYPE !== 'lighter') return

    cachedOMPositions = positions
    injectGroupedPositions()
}

function formatPrice(price: number): string {
    if (price >= 1000) return price.toFixed(1)
    if (price >= 100) return price.toFixed(2)
    if (price >= 1) return price.toFixed(4)
    return price.toFixed(6)
}

function createOMPositionRow(
    pos: Position,
    _lgIndex: number,
    _omIndex: number,
    isOrphan = false
): HTMLElement {
    const isShort = pos.side === 'short'
    const directionClass = isShort ? 'bg-red-gradient' : 'bg-green-gradient'
    const directionBarColor = isShort ? 'bg-red-7 shadow-red-horizontal' : 'bg-green-7 shadow-green-horizontal'
    const pnlColor = pos.unrealizedPnl >= 0 ? 'text-green-7' : 'text-red-7'
    const fundingColor = pos.funding >= 0 ? 'text-green-7' : 'text-red-7'

    const row = document.createElement('tr')
    row.className = `arbflow-om-row absolute flex w-full items-center max-mobile:px-1 h-8 px-2 text-xs pr-0 pl-2`
    row.style.background = 'linear-gradient(90deg, rgba(249,115,22,0.08) 0%, transparent 30%)'
    row.setAttribute('data-symbol', pos.symbol)

    const symbolDisplay = isOrphan ? pos.symbol : ''

    row.innerHTML = `
    <td class="flex grow" style="width: 100px;">
        <div class="-ml-2 flex h-full items-center gap-1 font-medium max-mobile:ml-0 max-mobile:h-8 ${directionClass}">
            <div class="h-5 w-0.5 max-mobile:h-full ${directionBarColor}"></div>
            <span>${symbolDisplay}</span>
            <span style="color: #f97316; font-weight: 600; font-size: 10px; ${isOrphan ? '' : 'margin-left: 8px;'}">OM</span>
        </div>
    </td>
    <td class="flex grow" style="width: 120px;">${pos.position.toFixed(4)}</td>
    <td class="flex grow" style="width: 100px;">$${pos.positionValue.toFixed(2)}</td>
    <td class="flex grow" style="width: 80px;">${formatPrice(pos.avgEntryPrice)}</td>
    <td class="flex grow" style="width: 80px;">${formatPrice(pos.markPrice)}</td>
    <td class="flex grow" style="width: 80px;">${pos.liquidationPrice ? formatPrice(pos.liquidationPrice) : '-'}</td>
    <td class="flex grow" style="width: 160px;">
        <div class="flex items-center gap-0.5 whitespace-nowrap ${pnlColor}">
            ${pos.unrealizedPnl >= 0 ? '' : '-'}$${Math.abs(pos.unrealizedPnl).toFixed(2)} (${pos.unrealizedPnlPercent.toFixed(2)}%)
        </div>
    </td>
    <td class="flex grow" style="width: 80px;">
        <div class="flex items-center gap-1">
            <span>$${(pos.margin || 0).toFixed(2)}</span>
        </div>
    </td>
    <td class="flex grow" style="width: 70px;">
        <div class="whitespace-nowrap ${fundingColor}">${pos.funding >= 0 ? '' : '-'}$${Math.abs(pos.funding).toFixed(2)}</div>
    </td>
    <td class="flex grow" style="width: 75px;">
        <div class="flex items-center justify-end gap-1">
            <p class="text-right tracking-compact">__ / __</p>
        </div>
    </td>
    <td class="grow sticky right-0 z-50 flex h-full items-center justify-end pr-2 max-mobile:bg-none max-mobile:pr-0" style="width: 80px; background: linear-gradient(90deg, transparent 0%, rgba(17,17,17,0.95) 30%);"></td>
  `

    return row
}

function injectGroupedPositions() {
    if (SITE_TYPE !== 'lighter') return

    const positionsTable = document.querySelector('[data-testid="positions-table"]')
    if (!positionsTable) {
        console.log('[Arbflow] Positions table not found, retrying...')
        setTimeout(() => injectGroupedPositions(), 1000)
        return
    }

    const tbody = positionsTable.querySelector('tbody')
    if (!tbody) return

    document.querySelectorAll('.arbflow-om-row').forEach((el) => el.remove())

    const omPositionsBySymbol = new Map<string, Position>()
    cachedOMPositions.forEach((pos) => {
        omPositionsBySymbol.set(pos.symbol, pos)
    })

    const lgRows = tbody.querySelectorAll('tr[data-testid^="row-"]')
    const rowHeight = 32
    let insertedCount = 0

    lgRows.forEach((lgRow, lgIndex) => {
        const symbolSpan = lgRow.querySelector('[data-testid$="_marketSymbol"] span:not([data-state])')
        const symbol = symbolSpan?.textContent?.trim()

        if (!symbol) return

        const omPos = omPositionsBySymbol.get(symbol)
        if (!omPos) return

        omPositionsBySymbol.delete(symbol)

        const omRow = createOMPositionRow(omPos, lgIndex, insertedCount)
        insertedCount++

        const currentTransform = (lgRow as HTMLElement).style.transform
        const currentY = parseFloat(currentTransform.replace(/[^0-9.-]/g, '')) || lgIndex * rowHeight
        omRow.style.transform = `translateY(${currentY + rowHeight}px)`

        tbody.appendChild(omRow)
    })

    omPositionsBySymbol.forEach((omPos, _symbol) => {
        const omRow = createOMPositionRow(omPos, lgRows.length + insertedCount, insertedCount, true)
        insertedCount++

        const yPos = (lgRows.length + insertedCount - 1) * rowHeight
        omRow.style.transform = `translateY(${yPos}px)`

        tbody.appendChild(omRow)
    })

    const totalRows = lgRows.length + insertedCount
    tbody.setAttribute('style', `height: ${totalRows * rowHeight}px`)

    lgRows.forEach((lgRow, lgIndex) => {
        let omRowsBefore = 0
        for (let i = 0; i < lgIndex; i++) {
            const prevRow = lgRows[i]
            const prevSymbolSpan = prevRow.querySelector('[data-testid$="_marketSymbol"] span:not([data-state])')
            const prevSymbol = prevSymbolSpan?.textContent?.trim()
            if (prevSymbol && cachedOMPositions.some((p) => p.symbol === prevSymbol)) {
                omRowsBefore++
            }
        }
        const newY = (lgIndex + omRowsBefore) * rowHeight
            ; (lgRow as HTMLElement).style.transform = `translateY(${newY}px)`
    })

    document.querySelectorAll('.arbflow-om-row').forEach((omRow, idx) => {
        const symbol = omRow.getAttribute('data-symbol')
        if (!symbol) return

        let lgRowIndex = -1
        lgRows.forEach((lgRow, i) => {
            const lgSymbolSpan = lgRow.querySelector('[data-testid$="_marketSymbol"] span:not([data-state])')
            if (lgSymbolSpan?.textContent?.trim() === symbol) {
                lgRowIndex = i
            }
        })

        if (lgRowIndex >= 0) {
            let omRowsBefore = 0
            for (let i = 0; i <= lgRowIndex; i++) {
                const prevRow = lgRows[i]
                const prevSymbolSpan = prevRow.querySelector('[data-testid$="_marketSymbol"] span:not([data-state])')
                const prevSymbol = prevSymbolSpan?.textContent?.trim()
                if (prevSymbol && cachedOMPositions.some((p) => p.symbol === prevSymbol)) {
                    omRowsBefore++
                }
            }
            const newY = (lgRowIndex + omRowsBefore) * rowHeight
                ; (omRow as HTMLElement).style.transform = `translateY(${newY}px)`
        } else {
            const newY = (lgRows.length + idx) * rowHeight
                ; (omRow as HTMLElement).style.transform = `translateY(${newY}px)`
        }
    })

    console.log(`[Arbflow] Injected ${insertedCount} OM position rows grouped with LG`)
}

let lgPositionsObserver: MutationObserver | null = null
let lgPositionsObserverDebounce: ReturnType<typeof setTimeout> | null = null

export function startLGPositionsObserver() {
    if (SITE_TYPE !== 'lighter') return

    const tryStart = () => {
        const positionsTable = document.querySelector('[data-testid="positions-table"]')
        if (!positionsTable) {
            setTimeout(tryStart, 1000)
            return
        }

        const tbody = positionsTable.querySelector('tbody')
        if (!tbody) {
            setTimeout(tryStart, 1000)
            return
        }

        console.log('[Arbflow] Starting LG positions observer for OM injection')

        lgPositionsObserver = new MutationObserver(() => {
            if (lgPositionsObserverDebounce) {
                clearTimeout(lgPositionsObserverDebounce)
            }
            lgPositionsObserverDebounce = setTimeout(() => {
                if (cachedOMPositions.length > 0) {
                    injectGroupedPositions()
                }
            }, 100)
        })

        lgPositionsObserver.observe(tbody, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style'],
        })
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryStart)
    } else {
        tryStart()
    }
}

