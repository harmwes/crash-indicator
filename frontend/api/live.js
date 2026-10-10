// Vercel Function achter de knop "Data verversen": haalt de bronnen direct op en
// geeft verse waarden, scores en historie terug.
// Bereikbaar op /api/live. Maximale looptijd staat in vercel.json.
import { handleLive } from '../shared/live-handler.mjs'

export async function GET(request) {
  return handleLive(request, {
    // Browsers vragen altijd opnieuw; Vercel's CDN bewaart het antwoord 5 minuten.
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Vercel-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
  })
}
