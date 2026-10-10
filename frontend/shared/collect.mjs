// Live-versie van de Python-collector (backend/app/collector.py), voor de knop "Data verversen".
// Gebruikt door de Vercel Function api/live.js.
// Zelfde bronnen, berekeningen en risicoscore. Margin debt (FINRA, Excel-bestand)
// wordt hier niet opgehaald; die komt uit de dagelijkse update.


const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; crash-indicator-dashboard)' }
const TIMEOUT_MS = 20000

async function get(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`${new URL(url).hostname} gaf status ${res.status}`)
  return res
}

// ---------- parsers (gelijk aan backend/app/sources.py) ----------
export function parseFredCsv(text) {
  const out = []
  for (const line of text.trim().split('\n').slice(1)) {
    const [d, v] = line.trim().split(',')
    if (!v || v === '.' || Number.isNaN(Number(v))) continue
    out.push([d, Number(v)])
  }
  return out
}

export function parseYahooChart(payload) {
  const res = payload.chart.result[0]
  const closes = res.indicators.quote[0].close
  const byDate = new Map()
  ;(res.timestamp || []).forEach((ts, i) => {
    if (closes[i] == null) return
    byDate.set(new Date(ts * 1000).toISOString().slice(0, 10), Number(closes[i]))
  })
  return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
}

const MONTHS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}

export function parseMultpl(html) {
  const row = /<td[^>]*>\s*([A-Z][a-z]{2}) (\d{1,2}), (\d{4})\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g
  const out = new Map()
  for (const m of html.matchAll(row)) {
    const cell = m[4].replace(/<[^>]+>|&[#\w]+;/g, ' ')
    const num = cell.match(/-?\d[\d,]*\.?\d*/)
    if (!num || !MONTHS[m[1]]) continue
    const key = `${m[3]}-${MONTHS[m[1]]}-01`
    if (!out.has(key)) out.set(key, Number(num[0].replace(/,/g, ''))) // nieuwste staat bovenaan
  }
  return [...out.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
}

// ---------- bronnen ----------
const fred = async (id, start = '1990-01-01') => {
  const s = parseFredCsv(await (await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`)).text())
  if (!s.length) throw new Error(`FRED gaf geen data voor ${id}`)
  return s
}

const yahoo = async (symbol, start = '1990-01-01') => {
  const p1 = Math.floor(Date.parse(start + 'T00:00:00Z') / 1000)
  const p2 = Math.floor(Date.now() / 1000)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`
  const s = parseYahooChart(await (await get(url)).json())
  if (!s.length) throw new Error(`Yahoo gaf geen data voor ${symbol}`)
  return s
}

const multpl = async (path, start = '1990-01-01') => {
  const s = parseMultpl(await (await get(`https://www.multpl.com/${path}/table/by-month`)).text()).filter((p) => p[0] >= start)
  if (!s.length) throw new Error(`multpl gaf geen data voor ${path}`)
  return s
}

// ---------- reeks-hulpfuncties (gelijk aan collector.py) ----------
export function sma(s, n) {
  const out = []
  let run = 0
  for (let i = 0; i < s.length; i++) {
    run += s[i][1]
    if (i >= n) run -= s[i - n][1]
    if (i >= n - 1) out.push([s[i][0], run / n])
  }
  return out
}

export function yoy(s, n = 12) {
  const out = []
  for (let i = n; i < s.length; i++) if (s[i - n][1]) out.push([s[i][0], (s[i][1] / s[i - n][1] - 1) * 100])
  return out
}

export function combine(a, b, fn) {
  const m = new Map(b)
  return a.filter((p) => m.has(p[0])).map((p) => [p[0], fn(p[1], m.get(p[0]))])
}

export function sahm(un) {
  const a3 = sma(un, 3)
  const out = []
  for (let i = 12; i < a3.length; i++) out.push([a3[i][0], a3[i][1] - Math.min(...a3.slice(i - 12, i).map((p) => p[1]))])
  return out
}

const comp = (label, value, unit = '') => ({
  label,
  value: typeof value === 'number' ? round(value, Math.abs(value) < 1 ? 3 : 2) : value,
  unit,
})

// ---------- risicoscore (gelijk aan scoring.py) ----------
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d
const clamp = (x) => Math.max(0, Math.min(100, x))
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length
const pstdev = (v) => {
  const m = mean(v)
  return Math.sqrt(mean(v.map((x) => (x - m) ** 2)))
}

export function thresholdScore(value, m) {
  const [x, n, w, c] = [value, m.normal, m.warn, m.crash].map((v) => m.direction * v)
  if (x <= n) return 0
  if (x <= w) return (50 * (x - n)) / (w - n)
  if (x <= c) return 50 + (50 * (x - w)) / (c - w)
  return 100
}

export function risk(values, m) {
  const d = m.direction
  let z = 0
  if (values.length >= 10) {
    const sd = pstdev(values)
    z = sd === 0 ? 0 : (d * (values[values.length - 1] - mean(values))) / sd
  }
  let mo = 0
  if (values.length >= 13) {
    const diffs = values.slice(3).map((v, i) => v - values[i])
    const sd = pstdev(diffs)
    mo = sd === 0 ? 0 : (d * diffs[diffs.length - 1]) / sd
  }
  const parts = {
    threshold: thresholdScore(values[values.length - 1], m),
    zscore: clamp((z / 3) * 100),
    momentum: clamp((mo / 3) * 100),
  }
  const score = 0.5 * parts.threshold + 0.3 * parts.zscore + 0.2 * parts.momentum
  return {
    score: round(score, 1),
    parts: { threshold: round(parts.threshold, 1), zscore: round(parts.zscore, 1), momentum: round(parts.momentum, 1) },
  }
}

export const level = (score) => (score < 30 ? 'green' : score <= 60 ? 'orange' : 'red')

export function buildRecord(series, components, meta) {
  const s = series.map(([d, v]) => [d, round(v, 4)])
  if (s.length < 2) throw new Error('te weinig datapunten')
  const values = s.map((p) => p[1])
  const { score, parts } = risk(values, meta)
  const last = values[values.length - 1]
  const prev = values[values.length - 2]
  const delta = last - prev
  return {
    record: {
      status: 'ok', error: null, value: last, previous: prev, delta: round(delta, 4),
      delta_pct: prev ? round((delta / Math.abs(prev)) * 100, 2) : null,
      as_of: s[s.length - 1][0], previous_date: s[s.length - 2][0],
      score, score_parts: parts, level: level(score), components,
      spark: values.slice(-30), points: s.length,
      fetched: new Date().toISOString().slice(0, 19) + '+00:00',
    },
    series: s,
  }
}

// ---------- de indicatoren ----------
const BUILDERS = {
  yield_curve: async () => [await fred('T10Y2Y'), []],
  valuation: async () => [await multpl('shiller-pe', '1950-01-01'), []],
  credit_spread: async () => {
    const [baa, aaa] = await Promise.all([fred('DBAA'), fred('DAAA')])
    return [combine(baa, aaa, (b, a) => b - a), []]
  },
  vix: async () => {
    try {
      return [await yahoo('^VIX'), []]
    } catch {
      return [await fred('VIXCLS'), []] // reserve: FRED loopt één dag achter
    }
  },
  breadth: async () => {
    const [rsp, spy] = await Promise.all([yahoo('RSP', '2003-05-01'), yahoo('SPY', '2003-05-01')])
    const ratio = combine(rsp, spy, (r, s) => r / s)
    return [combine(ratio, sma(ratio, 200), (r, m) => (r / m - 1) * 100), [comp('RSP/SPY-ratio', ratio[ratio.length - 1][1])]]
  },
  macro: async () => {
    const un = await fred('UNRATE', '1960-01-01')
    const comps = [comp('Werkloosheid', un[un.length - 1][1], '%')]
    const [ip, gdp] = await Promise.allSettled([fred('INDPRO'), fred('A191RL1Q225SBEA')])
    if (ip.status === 'fulfilled') { const y = yoy(ip.value); comps.push(comp('Industriële productie (j-o-j)', y[y.length - 1][1], '%')) }
    if (gdp.status === 'fulfilled') comps.push(comp('Bbp-groei (kwartaal, jaarbasis)', gdp.value[gdp.value.length - 1][1], '%'))
    return [sahm(un), comps]
  },
  technical: async () => {
    const spx = await yahoo('^GSPC')
    const ma50 = sma(spx, 50)
    const ma200 = sma(spx, 200)
    const s = combine(spx, ma200, (p, m) => (p / m - 1) * 100)
    const last = (x) => x[x.length - 1][1]
    return [s, [comp('S&P 500', last(spx)), comp('50-daags gemiddelde', last(ma50)),
      comp('200-daags gemiddelde', last(ma200)), comp('Death cross', last(ma50) < last(ma200) ? 'ja' : 'nee')]]
  },
  earnings: async () => {
    const eps = await multpl('s-p-500-earnings', '1950-01-01')
    return [yoy(eps), [comp('Winst per aandeel (12 mnd)', eps[eps.length - 1][1], '$')]]
  },
  liquidity: async () => {
    const comps = []
    const [nfci, sofr, iorb] = await Promise.allSettled([fred('NFCI'), fred('SOFR', '2021-07-01'), fred('IORB', '2021-07-01')])
    if (nfci.status === 'rejected') throw nfci.reason
    if (sofr.status === 'fulfilled' && iorb.status === 'fulfilled') {
      const d = combine(sofr.value, iorb.value, (s, i) => (s - i) * 100)
      if (d.length) comps.push(comp('SOFR minus rente op reserves', d[d.length - 1][1], 'bp'))
    }
    return [nfci.value, comps]
  },
}

export const LIVE_IDS = Object.keys(BUILDERS)

/** Haalt alle live indicatoren tegelijk op. Een mislukte bron levert een foutmelding op, geen crash. */
export async function collectAll(metaById) {
  const ids = LIVE_IDS.filter((id) => metaById[id])
  const results = await Promise.allSettled(ids.map((id) => BUILDERS[id]()))
  const records = {}
  const series = {}
  const errors = {}
  results.forEach((r, i) => {
    const id = ids[i]
    try {
      if (r.status === 'rejected') throw r.reason
      const built = buildRecord(r.value[0], r.value[1], metaById[id])
      records[id] = built.record
      series[id] = built.series
    } catch (e) {
      errors[id] = String(e?.message || e)
    }
  })
  return { updated: new Date().toISOString().slice(0, 19) + '+00:00', records, series, errors }
}
