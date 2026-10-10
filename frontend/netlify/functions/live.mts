// Netlify Function achter de knop "Data verversen": haalt de bronnen direct op en
// geeft verse waarden, scores en historie terug. Bereikbaar op /api/live.
import { handleLive } from '../../shared/live-handler.mjs'

export default async (req: Request) =>
  handleLive(req, {
    // Browsers vragen altijd opnieuw; het CDN bewaart het antwoord 5 minuten,
    // zodat veel bezoekers kort na elkaar de bronnen niet overbelasten.
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=300, stale-while-revalidate=60',
  })

export const config = { path: '/api/live', method: 'GET' }
