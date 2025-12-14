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

