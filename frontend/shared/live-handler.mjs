// Afhandeling van /api/live (Vercel Function api/live.js).
import { collectAll } from './collect.mjs'

export async function handleLive(req, cacheHeaders) {
  // Drempels en richting per indicator komen uit de gepubliceerde overview.json,
  // zodat Python (dagelijkse update) en de live-functie dezelfde instellingen gebruiken.
  const meta = {}
  try {
    const ov = await (await fetch(new URL('/data/overview.json', req.url))).json()
    for (const ind of ov.indicators) meta[ind.id] = ind
  } catch {
    return Response.json({ error: 'De instellingen van de indicatoren konden niet worden geladen.' }, { status: 502 })
  }

  const result = await collectAll(meta)
  if (!Object.keys(result.records).length) {
    return Response.json({ error: 'Geen enkele bron gaf antwoord. Probeer het later opnieuw.', errors: result.errors }, { status: 502 })
  }
  return Response.json(result, { headers: cacheHeaders })
}
