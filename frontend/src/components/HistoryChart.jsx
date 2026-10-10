import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import * as echarts from 'echarts'
import { fmt, fmtDate } from '../format.js'

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function buildOption(series, ind) {
  const values = series.map((p) => p[1])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min || Math.abs(max) || 1) * 0.08
  const lo = min - pad
  const hi = max + pad
  const ink = css('--muted')
  const grid = css('--grid')
  const line = css('--series')
  // drempellijnen alleen tonen als ze binnen het zichtbare bereik vallen
  const marks = [
    ['Verhoogd', ind.warn, css('--orange')],
    ['Crash-signaal', ind.crash, css('--red')],
  ].filter(([, v]) => v > lo && v < hi)

  return {
    animation: false,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: css('--font-body') },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: css('--surface'),
      borderColor: css('--border'),
      textStyle: { color: css('--fg'), fontSize: 13 },
      axisPointer: { type: 'line', lineStyle: { color: ink, width: 1 } },
      formatter: (items) => {
        const [date, value] = items[0].data
        return `<span style="color:${ink}">${fmtDate(date)}</span><br><strong>${fmt(value, ind.decimals)}${ind.unit ? ' ' + ind.unit : ''}</strong>`
      },
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: css('--axis') } },
      axisTick: { show: false },
      axisLabel: { color: ink, hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: lo,
      max: hi,
      axisLabel: { color: ink, formatter: (v) => fmt(v, Math.min(ind.decimals, hi - lo < 2 ? 2 : 1)) },
      splitLine: { lineStyle: { color: grid } },
    },
    series: [
      {
        type: 'line',
        name: ind.name,
        data: series,
        showSymbol: series.length <= 40,
        symbolSize: 6,
        sampling: 'lttb',
        lineStyle: { width: 2, color: line },
        itemStyle: { color: line },
        areaStyle: { color: line, opacity: 0.08 },
        markLine: marks.length
          ? {
              silent: true,
              symbol: 'none',
              data: marks.map(([name, yAxis, color]) => ({
                name,
                yAxis,
                lineStyle: { color, type: 'dashed', width: 1.5 },
                label: { formatter: name, position: 'insideEndTop', color: css('--fg-2'), fontSize: 11 },
              })),
            }
          : undefined,
      },
    ],
  }
}

// Grote historische grafiek (ECharts). `themeKey` laat de grafiek opnieuw kleuren bij een themawissel.
const HistoryChart = forwardRef(function HistoryChart({ series, ind, themeKey }, ref) {
  const el = useRef(null)
  const chart = useRef(null)

  useImperativeHandle(ref, () => ({
    toPng: () =>
      chart.current?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: css('--surface') }),
  }))

  useEffect(() => {
    chart.current = echarts.init(el.current)
    const onResize = () => chart.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.current?.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    if (chart.current && series.length) chart.current.setOption(buildOption(series, ind), true)
  }, [series, ind, themeKey])

  return <div className="chart" ref={el} role="img" aria-label={`Historische grafiek van ${ind.name}`} />
})

export default HistoryChart
