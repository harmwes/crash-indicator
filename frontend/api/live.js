// Vercel Function achter de knop "Data verversen" (zelfde werking als de Netlify-versie).
// Bereikbaar op /api/live. Maximale looptijd staat in vercel.json.
import { handleLive } from '../shared/live-handler.mjs'

export async function GET(request) {
  return handleLive(request, {
    // Browsers vragen altijd opnieuw; Vercel's CDN bewaart het antwoord 5 minuten.
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Vercel-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
  })
}
