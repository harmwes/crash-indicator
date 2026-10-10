import React, { useState } from 'react'
import { ALERT_SCORE, useStore } from '../store.js'
import IndicatorCard from '../components/IndicatorCard.jsx'
import Modal from '../components/Modal.jsx'
import Explanation from '../components/Explanation.jsx'
import RiskMeter from '../components/RiskMeter.jsx'

export default function Dashboard() {
  const { overview, loading, error, favorites, onlyFavorites, toggleOnlyFavorites, notifyMessage, liveMessage } = useStore()
  const [explain, setExplain] = useState(null)

  if (loading && !overview) return <p className="state">Indicatoren laden…</p>
  if (error && !overview) return <p className="state state-error">{error}</p>
  if (!overview) return null

  const all = overview.indicators
  const shown = onlyFavorites ? all.filter((i) => favorites.includes(i.id)) : all
  const alerts = all.filter((i) => i.score > ALERT_SCORE)
  const counts = { green: 0, orange: 0, red: 0 }
  all.forEach((i) => i.level && counts[i.level]++)

  return (
    <>
      {overview.demo && (
        <p className="banner banner-demo">
          <strong>Voorbeelddata.</strong> Deze cijfers zijn gesimuleerd en geen echte marktdata. Start de backend
          zonder demomodus om de actuele cijfers op te halen.
        </p>
      )}
      {error && <p className="banner banner-alert">{error}</p>}
      {notifyMessage && <p className="banner">{notifyMessage}</p>}
      {liveMessage && <p className="banner" role="status">{liveMessage}</p>}
      {alerts.length > 0 && (
        <p className="banner banner-alert" role="alert">
          <strong>Risicoscore boven {ALERT_SCORE}:</strong>{' '}
          {alerts.map((i, n) => (
            <span key={i.id}>
              {n > 0 && ', '}
              <a href={`#${i.id}`}>{i.name} ({Math.round(i.score)})</a>
            </span>
          ))}
        </p>
      )}

      <section className="summary">
        <div className="summary-meter">
          <h1>Totaalbeeld</h1>
          <p className="muted">Gemiddelde risicoscore van alle indicatoren</p>
          <RiskMeter score={overview.composite} compact />
        </div>
        <ul className="summary-counts">
          <li><span className="count">{counts.green}</span><span className="pill pill-green"><span className="pill-icon">●</span>Normaal</span></li>
          <li><span className="count">{counts.orange}</span><span className="pill pill-orange"><span className="pill-icon">▲</span>Verhoogd risico</span></li>
          <li><span className="count">{counts.red}</span><span className="pill pill-red"><span className="pill-icon">■</span>Crash-signaal</span></li>
        </ul>
      </section>

      <div className="toolbar">
        <h2 className="toolbar-title">Indicatoren</h2>
        <button id="btn-favorites" className="btn" onClick={toggleOnlyFavorites} aria-pressed={onlyFavorites}
          disabled={favorites.length === 0 && !onlyFavorites}
          title={favorites.length === 0 ? 'Markeer eerst een indicator met de ster' : ''}>
          {onlyFavorites ? 'Toon alle indicatoren' : `Alleen favorieten (${favorites.length})`}
        </button>
      </div>

      <div className="grid">
        {shown.map((ind) => (
          <IndicatorCard key={ind.id} ind={ind} onExplain={setExplain} />
        ))}
      </div>

      {explain && (
        <Modal title={explain.name} onClose={() => setExplain(null)}>
          <Explanation ind={explain} />
          <p className="modal-actions">
            <a className="btn btn-primary" href={`#${explain.id}`} onClick={() => setExplain(null)}>
              Bekijk historie en risicometer
            </a>
          </p>
        </Modal>
      )}
    </>
  )
}
