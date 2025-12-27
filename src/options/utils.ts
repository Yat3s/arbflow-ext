export type DateRange = '30m' | '1h' | '4h' | '1d' | '7d' | '30d' | 'custom'

export const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '30m', label: '30 Min' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'custom', label: 'Custom' },
]

export const STORAGE_KEYS = {
  EXCHANGE_CONFIGS: 'arbflow_exchange_configs',
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const ms = date.getMilliseconds().toString().padStart(3, '0')
  return `${date.toLocaleString()}.${ms}`
}

export function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? '+' : ''
  return `${sign}${pnl.toFixed(4)}u`
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    const remainingHours = hours % 24
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }
  if (seconds > 0) {
    return `${seconds}s`
  }
  return `${ms}ms`
}

export function getDateRangeValues(range: DateRange, customStart?: string, customEnd?: string) {
  const now = new Date()
  const end = new Date(now)
  let start = new Date(now)

  switch (range) {
    case '30m':
      start.setMinutes(start.getMinutes() - 30)
      break
    case '1h':
      start.setHours(start.getHours() - 1)
      break
    case '4h':
      start.setHours(start.getHours() - 4)
      break
    case '1d':
      start.setDate(start.getDate() - 1)
      break
    case '7d':
      start.setDate(start.getDate() - 7)
      break
    case '30d':
      start.setDate(start.getDate() - 30)
      break
    case 'custom':
      if (customStart) start = new Date(customStart)
      if (customEnd) {
        const endDate = new Date(customEnd)
        endDate.setHours(23, 59, 59, 999)
        return { start, end: endDate }
      }
      end.setHours(23, 59, 59, 999)
      break
  }

  return { start, end }
}

