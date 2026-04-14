// lib/utils/format.ts
// Shared formatters used across dashboard views, positions, history, and analytics.

export const dollarFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

/** Format cents as a dollar string. Returns '—' for null/undefined. */
export function fmtCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '\u2014'
  return dollarFmt.format(cents / 100)
}

/** Format a 0-1 fraction as a percentage string, e.g. 0.753 -> "75.3%". Returns '—' for null/undefined. */
export function fmtPct(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined) return '\u2014'
  return `${(fraction * 100).toFixed(1)}%`
}

/** Format an ISO timestamp as "Mar 5, 3:04 PM". */
export const longTimeFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/** Format an ISO timestamp as "Mar 5, 3:04 PM". */
export function fmtTime(ts: string): string {
  return longTimeFmt.format(new Date(ts))
}

export const shortTimeFmt = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

/** Format an ISO timestamp as short time, e.g. "3:04 PM". */
export function fmtShortTime(ts: string): string {
  return shortTimeFmt.format(new Date(ts))
}

/** Format a relative time string, e.g. "5s ago", "3m ago". */
export function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/** Format a raw dollar value (not cents), e.g. 70599.99 -> "$70,599.99". Returns '—' for null/undefined. */
export function fmtDollars(value: number | null | undefined): string {
  if (value === null || value === undefined) return '\u2014'
  return `$${value.toLocaleString()}`
}

/** Format cents as a signed dollar string with +/- prefix, e.g. "+$1.23". */
export function fmtCentsSigned(cents: number): string {
  const dollars = cents / 100
  const sign = dollars >= 0 ? '+' : ''
  return `${sign}${dollarFmt.format(dollars)}`
}
