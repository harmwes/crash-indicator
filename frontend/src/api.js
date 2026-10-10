// API-laag. Normaal praat de frontend met de FastAPI-gateway; als de pagina een
// ingebakken momentopname bevat (window.__CRASH_SNAPSHOT__) wordt die gebruikt.
// Met VITE_STATIC_DATA=1 (Netlify) leest de app vooraf gegenereerde JSON-bestanden uit /data.
const BASE = import.meta.env.VITE_API_URL || ''
const STATIC = import.meta.env.VITE_STATIC_DATA === '1'
const snap = () => (typeof window !== 'undefined' ? window.__CRASH_SNAPSHOT__ : null)

export const isSnapshot = () => !!snap()
export const canRefresh = () => !snap()
export const isStaticSite = () => STATIC

async function request(path, options) {
  const res = await fetch(BASE + path, options)
  if (!res.ok) throw new Error(`De data kon niet worden geladen (fout ${res.status}).${STATIC ? '' : ' Draait de backend op poort 8000?'}`)
  return res.json()
}

export async function getOverview() {
  if (snap()) return snap().overview
  return STATIC ? request('/data/overview.json', { cache: 'no-cache' }) : request('/api/indicators')
}

export async function getDetail(id) {
  if (snap()) {
    const d = snap().details[id]
    if (!d) throw new Error('Onbekende indicator')
    return d
  }
  if (STATIC) return request(`/data/${encodeURIComponent(id)}.json`, { cache: 'no-cache' })
  return request(`/api/indicators/${id}?range=max`)
}

// Netlify: haalt alle bronnen direct op via de functie op /api/live (zie frontend/netlify/functions).
export async function getLive() {
  const res = await fetch(BASE + '/api/live', { cache: 'no-store' })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Verse data ophalen is mislukt (fout ${res.status}).`)
  return body
}

export async function postRefresh() {
  return request('/api/refresh', { method: 'POST' })
}
