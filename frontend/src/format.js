export const LEVELS = {
  green: { label: 'Normaal', icon: '●' },
  orange: { label: 'Verhoogd risico', icon: '▲' },
  red: { label: 'Crash-signaal', icon: '■' },
}

export const levelOf = (score) => (score == null ? null : score < 30 ? 'green' : score <= 60 ? 'orange' : 'red')

export function fmt(value, decimals = 2) {
  if (value == null || Number.isNaN(value)) return '–'
  if (typeof value !== 'number') return String(value)
  return value.toLocaleString('nl-NL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export const withUnit = (value, ind) => {
  const s = fmt(value, ind.decimals)
  if (!ind.unit) return s
  return ind.unit === '%' || ind.unit === 'x' ? s + ind.unit : `${s} ${ind.unit}`
}

export function fmtDelta(delta, decimals = 2) {
  if (delta == null) return '–'
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±'
  return sign + fmt(Math.abs(delta), decimals)
}

const PREV = { daily: 'vorige dag', weekly: 'vorige week', monthly: 'vorige maand' }
export const prevLabel = (freq) => PREV[freq] || 'vorige meting'

export function fmtDate(iso, withTime = false) {
  if (!iso) return '–'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  const opts = { day: 'numeric', month: 'short', year: 'numeric' }
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleString('nl-NL', opts)
}
