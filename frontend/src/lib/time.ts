const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const dateTimeFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

/** Timestamps without a zone are UTC. */
function parseIso(iso: string): number {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso)
  return new Date(hasZone ? iso : `${iso}Z`).getTime()
}

/** "Nov 17, 2026, 4:12 PM" in the viewer's locale-aware short form. */
export function formatDateTime(iso: string): string {
  const time = parseIso(iso)
  return Number.isNaN(time) ? '' : dateTimeFormatter.format(time)
}

/** "3 minutes ago" style label. Treats timestamps without a zone as UTC. */
export function formatRelative(iso: string, now = Date.now()): string {
  const then = parseIso(iso)
  if (Number.isNaN(then)) return ''
  const seconds = Math.round((then - now) / 1000)
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}
