import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { isSnapshot } from '../api.js'
import { fmt, fmtDate, fmtDelta, prevLabel, withUnit } from '../format.js'
import HistoryChart from '../components/HistoryChart.jsx'
import RiskMeter from '../components/RiskMeter.jsx'
import Explanation from '../components/Explanation.jsx'
import LevelPill from '../components/LevelPill.jsx'
import Modal from '../components/Modal.jsx'

const RANGES = [
  ['week', 'Week', 7],
  ['month', 'Maand', 31],
  ['year', 'Jaar', 366],
  ['max', 'Max', null],
]
const MIN_POINTS = 6

// Knipt de reeks op de gekozen periode. Reeksen die maandelijks of wekelijks
// verschijnen hebben in een week te weinig punten; dan tonen we de laatste zes.
function sliceRange(series, days) {
  if (!days || !series.length) return { points: series, widened: false }
  const end = new Date(series[series.length - 1][0] + 'T12:00:00')
  const cutoff = new Date(end.getTime() - days * 86400000).toISOString().slice(0, 10)
  const points = series.filter((p) => p[0] >= cutoff)
  if (points.length >= MIN_POINTS) return { points, widened: false }
  return { points: series.slice(-MIN_POINTS), widened: true }
}

export default function Detail({ id }) {
  const ind = useStore((s) => s.details[id])
  const { fetchDetail, detailError, theme, favorites, toggleFavorite } = useStore()
  const [range, setRange] = useState('year')
  const [png, setPng] = useState(null)
  const chartRef = useRef(null)

  useEffect(() => {
    fetchDetail(id)
  }, [id, fetchDetail])

  const days = RANGES.find((r) => r[0] === range)[2]
  const { points, widened } = useMemo(() => sliceRange(ind?.series || [], days), [ind, days])

  if (detailError && !ind) {
    return (
      <p className="state state-error">
        {detailError} <a href="#">Terug naar het dashboard</a>
      </p>
    )
  }
  if (!ind) return <p className="state">Historie laden…</p>

  const favorite = favorites.includes(id)
  const arrow = ind.delta > 0 ? '▲' : ind.delta < 0 ? '▼' : '■'

  function exportPng() {
    const url = chartRef.current?.toPng()
    if (!url) return
    if (isSnapshot()) return setPng(url) // in de gehoste preview zijn downloads geblokkeerd
    const a = document.createElement('a')
    a.href = url
    a.download = `${id}-${range}-${ind.as_of}.png`
    a.click()
  }

  return (
    <article className="detail">
      <a className="back" href="#">← Alle indicatoren</a>

      <div className="detail-head">
        <div>
          <h1>{ind.name}</h1>
          <p className="muted">{ind.metric}</p>
        </div>
        <button className={`btn star-btn ${favorite ? 'is-on' : ''}`} onClick={() => toggleFavorite(id)} aria-pressed={favorite}>
          {favorite ? '★ Favoriet' : '☆ Markeer als favoriet'}
        </button>
      </div>

      {ind.demo && <p className="banner banner-demo"><strong>Voorbeelddata.</strong> Gesimuleerde cijfers, geen echte marktdata.</p>}

      {ind.value == null ? (
        <p className="state state-error">Voor deze indicator is nog geen data opgehaald. {ind.error}</p>
      ) : (
        <>
          <div className="detail-stats">
            <div>
              <div className="stat-label">Huidige waarde</div>
              <div className="stat-value">{withUnit(ind.value, ind)}</div>
            </div>
            <div>
              <div className="stat-label">Verandering t.o.v. {prevLabel(ind.frequency)}</div>
              <div className="stat-value stat-small"><span aria-hidden="true">{arrow}</span> {fmtDelta(ind.delta, ind.decimals)}</div>
            </div>
            <div>
              <div className="stat-label">Meting van</div>
              <div className="stat-value stat-small">{fmtDate(ind.as_of)}</div>
            </div>
            <div>
              <div className="stat-label">Risiconiveau</div>
              <LevelPill level={ind.level} score={ind.score} />
            </div>
          </div>

          <section className="panel">
            <div className="chart-bar">
              <div className="tabs" role="tablist" aria-label="Periode">
                {RANGES.map(([key, label]) => (
                  <button key={key} id={`tab-${key}`} role="tab" aria-selected={range === key}
                    className={`tab ${range === key ? 'is-active' : ''}`} onClick={() => setRange(key)}>
                    {label}
                  </button>
                ))}
              </div>
              <button id="btn-export" className="btn btn-small" onClick={exportPng}>Exporteer als PNG</button>
            </div>
            <HistoryChart ref={chartRef} series={points} ind={ind} themeKey={theme} />
            <p className="chart-note muted">
              {points.length} metingen, {fmtDate(points[0]?.[0])} t/m {fmtDate(points[points.length - 1]?.[0])}.
              {widened && ' Deze indicator verschijnt niet dagelijks; daarom zie je de laatste zes metingen.'}
              {' '}Stippellijnen: drempel voor verhoogd risico ({fmt(ind.warn, ind.decimals)}) en crash-signaal ({fmt(ind.crash, ind.decimals)}), als ze binnen beeld vallen.
            </p>
          </section>

          <div className="detail-cols">
            <section className="panel">
              <h2>Risicometer</h2>
              <RiskMeter score={ind.score} parts={ind.score_parts} weights={ind.weights} />
            </section>
            {ind.components?.length > 0 && (
              <section className="panel">
                <h2>Onderliggende cijfers</h2>
                <dl className="components">
                  {ind.components.map((c) => (
                    <div key={c.label}>
                      <dt>{c.label}</dt>
                      <dd>{typeof c.value === 'number' ? fmt(c.value, Math.abs(c.value) < 1 ? 3 : 2) : c.value}{c.unit ? ` ${c.unit}` : ''}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        </>
      )}

      <details className="panel collapsible" open>
        <summary>Uitleg</summary>
        <Explanation ind={ind} />
      </details>

      <p className="source">
        Bron: <a href={ind.source.url} target="_blank" rel="noreferrer">{ind.source.name}</a>
        {ind.fetched && <span className="muted"> · opgehaald {fmtDate(ind.fetched, true)}</span>}
      </p>

      {png && (
        <Modal title="Grafiek als PNG" onClose={() => setPng(null)}>
          <p className="muted">Klik met de rechtermuisknop op de afbeelding (of houd hem ingedrukt) en kies ‘Afbeelding opslaan’.</p>
          <img src={png} alt={`Grafiek van ${ind.name}`} />
        </Modal>
      )}
    </article>
  )
}
