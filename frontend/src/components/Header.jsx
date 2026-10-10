import React from 'react'
import { isDark, useStore } from '../store.js'
import { canRefresh } from '../api.js'
import { fmtDate } from '../format.js'

export default function Header() {
  const { overview, theme, toggleTheme, notify, toggleNotify, refresh, refreshing } = useStore()
  const dark = isDark(theme)

  return (
    <header className="header">
      <a className="brand" href="#">
        <span className="brand-mark" aria-hidden="true" />
        Crash-Indicator Dashboard
      </a>
      <div className="header-meta">
        {overview?.updated && <span className="muted">Bijgewerkt {fmtDate(overview.updated, true)}</span>}
        {canRefresh() && (
          <button id="btn-refresh" className="btn btn-primary" onClick={refresh} disabled={refreshing}>
            {refreshing ? 'Verse data ophalen…' : 'Data verversen'}
          </button>
        )}
        <button id="btn-notify" className="btn" onClick={toggleNotify} aria-pressed={notify}
          title="Krijg een melding zodra een risicoscore boven 70 komt">
          {notify ? 'Meldingen aan' : 'Meldingen uit'}
        </button>
        <button id="btn-theme" className="btn" onClick={toggleTheme} aria-pressed={dark}>
          {dark ? 'Lichte modus' : 'Donkere modus'}
        </button>
      </div>
    </header>
  )
}
