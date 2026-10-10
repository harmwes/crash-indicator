// Bouwt één zelfstandige HTML-pagina met een momentopname van de data.
//   node preview/build.mjs <snapshot.json> <uit.html> [--standalone]
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require(process.env.ESBUILD_PATH || 'esbuild')
const here = path.dirname(fileURLToPath(import.meta.url))
const [snapshotFile, outFile, flag] = process.argv.slice(2)
const tmp = fs.mkdtempSync(path.join(here, '.out-'))

await esbuild.build({
  entryPoints: [path.join(here, '../src/main.jsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  outfile: path.join(tmp, 'app.js'),
  alias: { zustand: path.join(here, 'zustand-shim.js'), echarts: path.join(here, 'echarts-shim.js') },
  nodePaths: (process.env.NODE_PATH || '').split(':').filter(Boolean),
  define: { 'import.meta.env.VITE_API_URL': '""', 'import.meta.env.VITE_STATIC_DATA': JSON.stringify(process.env.VITE_STATIC_DATA || ''), 'process.env.NODE_ENV': '"production"' },
  jsx: 'automatic',
  logLevel: 'warning',
})

const safe = (s) => s.replace(/<\/(script)/gi, '<\\/$1')
const js = safe(fs.readFileSync(path.join(tmp, 'app.js'), 'utf8'))
const css = fs.readFileSync(path.join(tmp, 'app.css'), 'utf8')
const snapshot = safe(JSON.stringify(JSON.parse(fs.readFileSync(snapshotFile, 'utf8'))))
fs.rmSync(tmp, { recursive: true })

const body = `<title>Crash-Indicator Dashboard</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@600&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/5.4.3/echarts.min.js"></script>
<script>window.__CRASH_SNAPSHOT__=${snapshot}</script>
<script>${js}</script>
`
const page = flag === '--standalone'
  ? `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${body}</body></html>`
  : body
fs.writeFileSync(outFile, page)
console.log(`${outFile}: ${(page.length / 1024).toFixed(0)} kB`)
