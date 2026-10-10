// Afhandeling van /api/live (Vercel Function api/live.js).
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectAll } from './collect.mjs'

// Drempels en richting per indicator komen uit overview.json, zodat Python (dagelijkse update)
// en de live-functie dezelfde instellingen gebruiken. Het bestand wordt met de functie meegeleverd
// (zie includeFiles in vercel.json). Ophalen via het eigen adres is alleen een reserve: dat mislukt
// op adressen die Vercel met een login afschermt.
async function loadOverview(req) {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.join(here, '..', 'public', 'data', 'overview.json'),
    path.join(process.cwd(), 'public', 'data', 'overview.json'),
  ]
  for (const file of candidates) {
    try {
      return JSON.parse(await readFile(file, 'utf8'))
    } catch {
      /* volgende plek proberen */
    }
  }
  const res = await fetch(new URL('/data/overview.json', req.url))
  if (!res.ok) throw new Error(`overview.json gaf status ${res.status}`)
  return res.json()
}

export async function handleLive(req, cacheHeaders) {
  const meta = {}
  try {
    const ov = await loadOverview(req)
    for (const ind of ov.indicators) meta[ind.id] = ind
  } catch (e) {
    console.error('overview.json laden mislukt:', e)
    return Response.json({ error: 'De instellingen van de indicatoren konden niet worden geladen.' }, { status: 502 })
  }

  const result = await collectAll(meta)
  if (!Object.keys(result.records).length) {
    console.error('Geen bron gaf antwoord:', result.errors)
    return Response.json({ error: 'Geen enkele bron gaf antwoord. Probeer het later opnieuw.', errors: result.errors }, { status: 502 })
  }
  return Response.json(result, { headers: cacheHeaders })
}
