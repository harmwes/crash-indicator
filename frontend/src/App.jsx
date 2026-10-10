import React, { useEffect, useState } from 'react'
import { useStore } from './store.js'
import { isStaticSite } from './api.js'
import Header from './components/Header.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Detail from './pages/Detail.jsx'

// Kleine hash-router: '' = dashboard, '#vix' = detailpagina van de VIX.
const readRoute = () => window.location.hash.replace(/^#\/?/, '')

export default function App() {
  const [route, setRoute] = useState(readRoute)
  const fetchOverview = useStore((s) => s.fetchOverview)

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    // Op Netlify/Vercel: eerst de gepubliceerde cijfers tonen, daarna meteen verse cijfers ophalen.
    fetchOverview().then(() => isStaticSite() && useStore.getState().refreshLive(true))
    const timer = setInterval(fetchOverview, 5 * 60 * 1000) // elke 5 minuten verversen
    return () => clearInterval(timer)
  }, [fetchOverview])

  return (
    <div className="app">
      <Header />
      <main>{route ? <Detail id={route} /> : <Dashboard />}</main>
      <footer className="footer">
        Deze informatie is informatief en geen medisch advies. Het is ook geen beleggingsadvies: geen enkele
        indicator voorspelt een crash met zekerheid. Alle cijfers komen uit openbare bronnen.
      </footer>
    </div>
  )
}
