import { create } from 'zustand'
import { getDetail, getLive, getOverview, isStaticSite, postRefresh } from './api.js'

// localStorage kan ontbreken of weigeren (privévenster): altijd met try/catch.
const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key)
    return v == null ? fallback : JSON.parse(v)
  } catch {
    return fallback
  }
}
const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* niet erg: de keuze geldt dan alleen voor deze sessie */
  }
}

export const ALERT_SCORE = 70
const canNotify = () => typeof Notification !== 'undefined'

// Zonder eigen keuze volgt de pagina het systeem (of het thema dat de host al zette).
function applyTheme(theme) {
  if (theme) document.documentElement.setAttribute('data-theme', theme)
}

export function isDark(theme) {
  const current = theme || document.documentElement.getAttribute('data-theme')
  return current ? current === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Legt verse waarden uit /api/live over de gepubliceerde (dagelijkse) data heen.
function withLive(overview, live) {
  if (!overview || !live) return overview
  const indicators = overview.indicators.map((ind) => (live.records[ind.id] ? { ...ind, ...live.records[ind.id] } : ind))
  const scores = indicators.map((i) => i.score).filter((s) => s != null)
  const composite = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null
  return { ...overview, indicators, composite, updated: live.updated }
}

function detailWithLive(detail, live) {
  const rec = live?.records[detail.id]
  return rec ? { ...detail, ...rec, series: live.series[detail.id], updated: live.updated } : detail
}

export const useStore = create((set, get) => ({
  overview: null,
  loading: false,
  error: null,
  details: {},
  detailError: null,
  refreshing: false,
  theme: load('ci.theme', null), // null = volg het systeem
  favorites: load('ci.favorites', []),
  onlyFavorites: false,
  notify: load('ci.notify', false) && canNotify() && Notification.permission === 'granted',
  notifyMessage: null,
  live: null, // laatste antwoord van /api/live in deze sessie
  liveMessage: null,

  async fetchOverview() {
    set({ loading: !get().overview, error: null })
    try {
      const overview = withLive(await getOverview(), get().live)
      set({ overview, loading: false })
      get().sendAlerts()
    } catch (e) {
      set({ error: e.message, loading: false })
    }
  },

  async fetchDetail(id) {
    set({ detailError: null })
    try {
      const detail = detailWithLive(await getDetail(id), get().live)
      set((s) => ({ details: { ...s.details, [id]: detail } }))
    } catch (e) {
      set({ detailError: e.message })
    }
  },

  async refresh() {
    set({ refreshing: true, error: null, liveMessage: null })
    if (isStaticSite()) return get().refreshLive()
    try {
      await postRefresh()
      // de collector draait op de achtergrond; even wachten en dan opnieuw laden
      await new Promise((r) => setTimeout(r, 8000))
      set({ details: {} })
      await get().fetchOverview()
    } catch (e) {
      set({ error: e.message })
    } finally {
      set({ refreshing: false })
    }
  },

  // Vercel: alle bronnen direct ophalen en de getoonde cijfers vervangen.
  // quiet = automatisch bij het openen van de site: alleen melden als er iets misgaat.
  async refreshLive(quiet = false) {
    set({ refreshing: true })
    try {
      const live = await getLive()
      set((s) => ({
        live,
        overview: withLive(s.overview, live),
        details: Object.fromEntries(Object.entries(s.details).map(([id, d]) => [id, detailWithLive(d, live)])),
      }))
      const names = Object.fromEntries((get().overview?.indicators || []).map((i) => [i.id, i.name]))
      const failed = Object.keys(live.errors || {}).map((id) => names[id] || id)
      const time = new Date(live.updated).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
      const failedText = failed.length
        ? ` Niet gelukt voor ${failed.join(', ')}; daar staan de cijfers van de laatste dagelijkse update.`
        : ''
      set({
        liveMessage: quiet
          ? failedText.trim() || null
          : `Verse data opgehaald om ${time}.${failedText} Margin Debt wordt alleen bij de dagelijkse update vernieuwd.`,
      })
      get().sendAlerts()
    } catch (e) {
      if (quiet) set({ liveMessage: 'Live cijfers konden niet worden opgehaald; je ziet de cijfers van de laatste dagelijkse update.' })
      else set({ error: e.message })
    } finally {
      set({ refreshing: false })
    }
  },

  toggleTheme() {
    const theme = isDark(get().theme) ? 'light' : 'dark'
    applyTheme(theme)
    save('ci.theme', theme)
    set({ theme })
  },

  toggleFavorite(id) {
    const favorites = get().favorites.includes(id)
      ? get().favorites.filter((f) => f !== id)
      : [...get().favorites, id]
    save('ci.favorites', favorites)
    set({ favorites, onlyFavorites: get().onlyFavorites && favorites.length > 0 })
  },

  toggleOnlyFavorites() {
    set({ onlyFavorites: !get().onlyFavorites })
  },

  async toggleNotify() {
    if (get().notify) {
      save('ci.notify', false)
      return set({ notify: false, notifyMessage: null })
    }
    if (!canNotify()) return set({ notifyMessage: 'Deze browser ondersteunt geen meldingen.' })
    let permission = 'denied'
    try {
      permission = await Notification.requestPermission()
    } catch {
      /* geweigerd door de omgeving */
    }
    if (permission !== 'granted') {
      return set({ notifyMessage: 'Meldingen zijn geblokkeerd. Sta ze toe in de instellingen van je browser.' })
    }
    save('ci.notify', true)
    set({ notify: true, notifyMessage: null })
    get().sendAlerts()
  },

  // Eén melding per indicator per meetdatum, alleen boven de alarmgrens.
  sendAlerts() {
    const { notify, overview } = get()
    if (!notify || !overview || !canNotify() || Notification.permission !== 'granted') return
    const sent = load('ci.notified', {})
    for (const ind of overview.indicators) {
      if (ind.score > ALERT_SCORE && sent[ind.id] !== ind.as_of) {
        try {
          new Notification(`${ind.name}: risicoscore ${Math.round(ind.score)}`, {
            body: `De score is boven ${ALERT_SCORE} uitgekomen (meting van ${ind.as_of}).`,
            tag: `crash-${ind.id}`,
          })
          sent[ind.id] = ind.as_of
        } catch {
          return
        }
      }
    }
    save('ci.notified', sent)
  },
}))

applyTheme(useStore.getState().theme)
