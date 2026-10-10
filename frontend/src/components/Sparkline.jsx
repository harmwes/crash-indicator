import React from 'react'

// Minigrafiek van de laatste 30 metingen (eigen SVG, geen bibliotheek nodig).
export default function Sparkline({ values, width = 120, height = 36 }) {
  if (!values || values.length < 2) return null
  const pad = 4
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i) => pad + (i * (width - 2 * pad)) / (values.length - 1)
  const y = (v) => height - pad - ((v - min) * (height - 2 * pad)) / span
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const lastX = x(values.length - 1)
  const lastY = y(values[values.length - 1])
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height}
      role="img" aria-label="Verloop van de laatste 30 metingen">
      <polygon className="spark-area" points={`${pad},${height - pad} ${line} ${lastX},${height - pad}`} />
      <polyline className="spark-line" points={line} fill="none" />
      <circle className="spark-dot" cx={lastX} cy={lastY} r="3" />
    </svg>
  )
}
