import React from 'react'
import { useStore } from '../store.js'
import { fmt, fmtDate, fmtDelta, prevLabel } from '../format.js'
import LevelPill from './LevelPill.jsx'
import Sparkline from './Sparkline.jsx'

export default function IndicatorCard({ ind, onExplain }) {
  const favorite = useStore((s) => s.favorites.includes(ind.id))
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const hasData = ind.value != null
  const arrow = ind.delta > 0 ? '▲' : ind.delta < 0 ? '▼' : '■'

  return (
    <article className={`card level-${ind.level || 'none'}`}>
      <div className="card-top">
        <h2 className="card-title">
          {/* de link beslaat de hele kaart; knoppen liggen erboven */}
          <a className="card-link" href={`#${ind.id}`}>{ind.name}</a>
        </h2>
        <span className="tip">
          <button className="tip-btn" aria-label={`Korte uitleg: ${ind.tooltip}`}>i</button>
          <span className="tip-text" role="tooltip">{ind.tooltip}</span>
        </span>
        <button className={`star ${favorite ? 'is-on' : ''}`} onClick={() => toggleFavorite(ind.id)}
          aria-pressed={favorite} aria-label={favorite ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}
          title={favorite ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}>
          {favorite ? '★' : '☆'}
        </button>
      </div>

      {hasData ? (
        <>
          <div className="card-value-row">
            <div>
              <div className="card-value">
                {fmt(ind.value, ind.decimals)}
                {ind.unit && <span className="card-unit">{ind.unit}</span>}
              </div>
              <div className="card-delta">
                <span aria-hidden="true">{arrow}</span> {fmtDelta(ind.delta, ind.decimals)}
                <span className="muted"> t.o.v. {prevLabel(ind.frequency)}</span>
              </div>
            </div>
            <Sparkline values={ind.spark} />
          </div>
          <div className="card-bottom">
            <LevelPill level={ind.level} score={ind.score} />
            <button className="btn btn-small" onClick={() => onExplain(ind)}>Uitleg</button>
          </div>
          <div className="card-foot muted">
            Meting van {fmtDate(ind.as_of)}
            {ind.status === 'stale' && <span className="stale" title={ind.error}> · ophalen mislukt, oudere data</span>}
          </div>
        </>
      ) : (
        <>
          <p className="card-empty">Geen data beschikbaar. {ind.error}</p>
          <div className="card-bottom">
            <LevelPill level={null} />
            <button className="btn btn-small" onClick={() => onExplain(ind)}>Uitleg</button>
          </div>
        </>
      )}
    </article>
  )
}
