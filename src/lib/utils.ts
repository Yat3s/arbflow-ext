const TIME_SKEW_THRESHOLD = 5000

export interface FormattedTime {
    skew: boolean
    timeStr: string
}

export function formatTime(timestamp?: number): FormattedTime {
    if (!timestamp) return { skew: false, timeStr: '--:--:--' }
    const d = new Date(timestamp)
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    const s = String(d.getSeconds()).padStart(2, '0')
    const timeStr = `${h}:${m}:${s}`
    const skew = Math.abs(Date.now() - timestamp) > TIME_SKEW_THRESHOLD
    return { skew, timeStr }
}

export function formatPrice(price: number, referencePrice?: number): string {
    if (!price || price === 0) return '--'
    const ref = referencePrice ?? price
    if (Math.abs(ref) >= 1000) return price.toFixed(2)
    if (Math.abs(ref) >= 10) return price.toFixed(3)
    if (Math.abs(ref) >= 1) return price.toFixed(4)
    return price.toFixed(6)
}

