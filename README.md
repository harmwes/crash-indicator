# Crash-Indicator Dashboard

Dashboard met 10 indicatoren die vaak aan beurscrashes voorafgaan. Per indicator: huidige waarde,
dagelijkse verandering, risicoscore (0–100) met kleurcode, uitleg en een detailpagina met historie.

## Starten

Je hebt Python 3.10+ en Node 18+ nodig. Er zijn geen API-sleutels nodig.

```bash
# 1. Backend (terminal 1)
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.sources          # optioneel: test of de bronnen bereikbaar zijn
uvicorn app.main:app --port 8000

# 2. Frontend (terminal 2)
cd frontend
npm install
npm run dev                    # open http://localhost:5173
```

Bij de eerste start haalt de backend direct alle data op (duurt ongeveer een halve minuut). Daarna
draait de cronjob elke dag om 23:30 Amsterdamse tijd. Met de knop "Data verversen" forceer je een ronde.

Zonder internet of om alleen de interface te bekijken: `DEMO_MODE=1 uvicorn app.main:app --port 8000`
vult de store met gesimuleerde data (duidelijk gemarkeerd in de app).

Met Docker: `docker compose up --build` en open http://localhost:8080.

## Online zetten met Vercel

Vercel host de statische frontend plus één functie; de FastAPI-backend draait daar niet. In plaats daarvan:

- `frontend/vercel.json` bouwt de frontend met `npm run build:static`. Die leest `frontend/.env.static`
  (`VITE_STATIC_DATA=1`), waardoor de app JSON uit `frontend/public/data/` leest.
- `.github/workflows/update-data.yml` draait elke dag de Python-collector op GitHub, schrijft die JSON-bestanden
  opnieuw en commit ze. Vercel bouwt bij elke commit vanzelf opnieuw.

Stappen:

1. Ga naar vercel.com, log in met GitHub en kies **Add New → Project**.
2. Importeer de repository en zet **Root Directory** op `frontend`. De rest komt uit `vercel.json`.
3. Klik op **Deploy**. Elke commit op GitHub, ook die van de dagelijkse update, zet Vercel vanzelf online.
4. GitHub: **Settings → Actions → General → Workflow permissions → Read and write permissions**.
5. GitHub: **Actions → Data bijwerken → Run workflow** om de eerste ronde te testen.

Zonder GitHub-koppeling, vanaf je eigen computer (Node.js nodig):

```bash
cd frontend
npx vercel login
npx vercel --prod
```

### Knop "Data verversen"

Op de Vercel-site haalt de knop **Data verversen** de bronnen direct op via de Vercel Function
`frontend/api/live.js` (adres `/api/live`). Die functie is een JavaScript-versie van de
Python-collector met dezelfde berekeningen en drempels (`frontend/shared/collect.mjs`); de drempels
leest hij uit `/data/overview.json`, dus aanpassen doe je nog steeds alleen in `backend/app/indicators.py`.

- Vercel bewaart het antwoord 5 minuten, zodat vaak klikken de bronnen niet overbelast.
- Margin Debt (FINRA, Excel) wordt alleen door de dagelijkse update vernieuwd.
- Lukt een bron niet, dan blijft voor die indicator de waarde van de laatste dagelijkse update staan en
  meldt de app welke indicatoren niet zijn vernieuwd.
- Bij het openen van de site worden verse cijfers automatisch één keer opgehaald; de knop doet dat
  opnieuw op verzoek. De dagelijkse update blijft de basis als een bron niet antwoordt.

Mislukt een bron op GitHub (Yahoo en multpl weigeren soms verzoeken van datacenters), dan blijft voor die indicator
de laatst gepubliceerde waarde staan met de vermelding "ophalen mislukt, oudere data".

## Architectuur

```
frontend (React + Zustand + ECharts)
        │  /api
api-gateway (FastAPI, app/main.py)  ── leest ──┐
                                               ▼
collector (app/collector.py, dagelijkse cron) ─► JSON-store (backend/data/)
        │
        └─ sources.py: FRED · Yahoo Finance · multpl.com · FINRA
```

- `backend/app/indicators.py` – teksten, eenheden en drempels per indicator (hier pas je drempels aan)
- `backend/app/sources.py` – ophalen en parsen per bron
- `backend/app/collector.py` – berekeningen per indicator, score, opslag, cronjob
- `backend/app/scoring.py` – risicoscore
- `backend/app/service.py` + `main.py` – API: `GET /api/indicators`, `GET /api/indicators/{id}?range=week|month|year|max`, `POST /api/refresh`, `GET /api/health`
- `frontend/src` – `pages/` (Dashboard, Detail), `components/`, `store.js` (Zustand)

Lokaal draait de cronjob mee in het API-proces. In `docker-compose.yml` is de collector een aparte service
(`RUN_SCHEDULER=0` op de gateway).

## Indicatoren en bronnen

| Indicator | Wat we meten | Bron | Frequentie |
|---|---|---|---|
| Yield Curve Inversie | 10-jaars minus 2-jaars rente | FRED `T10Y2Y` | dag |
| Extreme Waarderingen | Shiller CAPE | multpl.com | maand |
| Kredietspreads | Baa minus Aaa | FRED `DBAA`, `DAAA` | dag |
| VIX-index | VIX slotkoers | Yahoo `^VIX` (reserve: FRED `VIXCLS`) | dag |
| Marktbreedte | RSP/SPY t.o.v. 200-daags gemiddelde | Yahoo `RSP`, `SPY` | dag |
| Margin Debt | Effectenkrediet, jaar-op-jaar | FINRA (xlsx) | maand |
| Macro-data | Sahm-regel + bbp + industriële productie | FRED `UNRATE`, `INDPRO`, `A191RL1Q225SBEA` | maand |
| Technische Breakdown | S&P 500 t.o.v. 200-daags gem., death cross | Yahoo `^GSPC` | dag |
| Earnings Deterioratie | Winst per aandeel S&P 500, jaar-op-jaar | multpl.com | maand |
| Liquiditeitsstress | Chicago Fed NFCI + SOFR−IORB | FRED `NFCI`, `SOFR`, `IORB` | week |

Afwijkingen van de oorspronkelijke bronnenlijst, en waarom:

- **FRED**: de officiële API vereist een sleutel; de CSV-download (`fredgraph.csv`) niet en bevat dezelfde reeksen.
- **Yield curve**: het genoemde Treasury-endpoint (`avg_interest_rates`) geeft gemiddelde rentes op de staatsschuld, geen curve.
- **Marktbreedte**: AlphaVantage heeft geen advance/decline-functie en vereist een sleutel. RSP/SPY is een gangbare, sleutelloze benadering.
- **Macro**: bbp en werkloosheid komen ook van FRED (World Bank is alleen jaarlijks; BLS zonder sleutel is sterk gelimiteerd).
- **Liquiditeit**: de TED-spread stopte in januari 2022 (einde LIBOR). De NFCI is de vervanger.
- **Earnings**: Yahoo's earnings-endpoints vereisen een sessie-cookie; multpl.com levert de S&P 500-winst per maand.

Yahoo Finance en multpl.com zijn geen officiële API's en kunnen van formaat veranderen of verzoeken weigeren.
Mislukt een bron, dan blijft de laatst opgehaalde waarde staan met de vermelding "ophalen mislukt, oudere data".

## Berekeningen

- **Verandering**: Δ = laatste waarde − vorige meting (vorige handelsdag, week of maand, afhankelijk van de reeks).
- **Risicoscore** = 50% drempel + 30% z-score + 20% momentum, elk op een schaal van 0–100:
  - *drempel*: 0 op het normale niveau, 50 op het waarschuwingsniveau, 100 op het crashniveau (lineair ertussen);
  - *z-score*: afwijking van het historisch gemiddelde in de riskante richting; z = 3 geeft 100;
  - *momentum*: verandering over 3 metingen, gedeeld door de gebruikelijke spreiding daarvan; 3 sigma geeft 100.
- **Kleur**: groen < 30, oranje 30–60, rood > 60. Melding (browsernotificatie + banner) bij een score boven 70.

De drempels in `indicators.py` zijn vuistregels op basis van eerdere crises, geen gekalibreerd model.

## Tests

```bash
cd backend && python tests/test_core.py     # of: python -m pytest
```

De tests draaien zonder netwerk: parsers op voorbeeldantwoorden, scoring, collector (demodata) en de leeslaag.

## Statische preview bouwen

```bash
cd backend && python export_snapshot.py ../snapshot.json
cd ../frontend && npm i -D esbuild && node preview/build.mjs ../snapshot.json ../preview.html --standalone
```

Dit is geen beleggingsadvies.
