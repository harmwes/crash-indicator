import React from 'react'
import { LEVELS } from '../format.js'

// Risiconiveau: kleur + vorm + tekst, zodat kleur nooit de enige drager is.
export default function LevelPill({ level, score }) {
  if (!level) return <span className="pill pill-none">Geen data</span>
  return (
    <span className={`pill pill-${level}`}>
      <span className="pill-icon" aria-hidden="true">{LEVELS[level].icon}</span>
      {LEVELS[level].label}
      {score != null && <span className="pill-score">{Math.round(score)}</span>}
    </span>
  )
}
