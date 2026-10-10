import React from 'react'
import { LEVELS, levelOf } from '../format.js'

const PARTS = [
  ['threshold', 'Afstand tot crash-drempel'],
  ['zscore', 'Afwijking van historisch gemiddelde (z-score)'],
  ['momentum', 'Momentum (verandering over 3 metingen)'],
]

// Risicometer 0–100 met de drie zones (groen < 30, oranje 30–60, rood > 60).
export default function RiskMeter({ score, parts, weights, compact = false }) {
  if (score == null) return <p className="muted">Nog geen score beschikbaar.</p>
  const level = levelOf(score)
  return (
    <div className={`meter ${compact ? 'meter-compact' : ''}`}>
      <div className="meter-head">
        <span className="meter-score">{Math.round(score)}</span>
        <span className="meter-of">/ 100</span>
        <span className={`pill pill-${level}`}>
          <span className="pill-icon" aria-hidden="true">{LEVELS[level].icon}</span>
          {LEVELS[level].label}
        </span>
      </div>
      <div className="meter-track" role="img" aria-label={`Risicoscore ${Math.round(score)} van 100`}>
        <span className="zone zone-green" />
        <span className="zone zone-orange" />
        <span className="zone zone-red" />
        <span className="meter-needle" style={{ left: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
      <div className="meter-scale" aria-hidden="true">
        <span style={{ left: '0%' }}>0</span>
        <span style={{ left: '30%' }}>30</span>
        <span style={{ left: '60%' }}>60</span>
        <span style={{ left: '100%' }}>100</span>
      </div>
      {!compact && parts && (
        <dl className="meter-parts">
          {PARTS.map(([key, label]) => (
            <div key={key} className="meter-part">
              <dt>{label}<span className="muted"> · weegt {Math.round((weights?.[key] ?? 0) * 100)}%</span></dt>
              <dd>
                <span className="bar"><span className="bar-fill" style={{ width: `${parts[key]}%` }} /></span>
                <span className="bar-num">{Math.round(parts[key])}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
