import React from 'react'

// De drie uitlegblokken; gebruikt in de modal én op de detailpagina.
export default function Explanation({ ind }) {
  return (
    <div className="explain">
      <p className="explain-metric">Wat we meten: {ind.metric}.</p>
      <h3>Wat betekent deze indicator?</h3>
      <p>{ind.meaning}</p>
      <h3>Waarom is hij belangrijk?</h3>
      <p>{ind.importance}</p>
      <h3>Hoe gaf hij eerder crashsignalen?</h3>
      <p>{ind.history_text}</p>
    </div>
  )
}
