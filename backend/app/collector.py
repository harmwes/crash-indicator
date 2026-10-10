"""Dataverzamel-service: haalt alle bronnen op, berekent scores en schrijft de JSON-store.

  python -m app.collector            eenmalig ophalen
  python -m app.collector --daemon   nu ophalen en daarna elke dag (cronjob)
  python -m app.collector --demo     store vullen met synthetische voorbeelddata
"""
import argparse
import logging
import os
from datetime import datetime, timezone

from . import demo as demo_data
from . import sources as src
from . import store
from .indicators import INDICATORS, ORDER
from .scoring import level, risk

log = logging.getLogger("collector")


# ---------- reeks-hulpfuncties ----------
def sma(series, n):
    vals, out, run = [v for _, v in series], [], 0.0
    for i, (d, v) in enumerate(series):
        run += v
        if i >= n:
            run -= vals[i - n]
        if i >= n - 1:
            out.append((d, run / n))
    return out


def yoy(series, n=12):
    return [(series[i][0], (series[i][1] / series[i - n][1] - 1) * 100)
            for i in range(n, len(series)) if series[i - n][1]]


def combine(a, b, fn):
    """Voegt twee reeksen samen op gedeelde datums."""
    bm = dict(b)
    return [(d, fn(v, bm[d])) for d, v in a if d in bm]


def comp(label, value, unit=""):
    return {"label": label, "value": round(value, 3 if abs(value) < 1 else 2) if isinstance(value, float) else value, "unit": unit}


# ---------- de 10 indicatoren ----------
def yield_curve():
    return src.fred("T10Y2Y"), []


def valuation():
    return src.multpl("shiller-pe", start="1950-01-01"), []


def credit_spread():
    return combine(src.fred("DBAA"), src.fred("DAAA"), lambda b, a: b - a), []


def vix():
    try:
        return src.yahoo("^VIX"), []
    except Exception as e:  # Yahoo blokkeert soms; FRED loopt één dag achter
        log.warning("Yahoo ^VIX mislukt (%s), val terug op FRED VIXCLS", e)
        return src.fred("VIXCLS"), []


def breadth():
    ratio = combine(src.yahoo("RSP", "2003-05-01"), src.yahoo("SPY", "2003-05-01"), lambda r, s: r / s)
    s = combine(ratio, sma(ratio, 200), lambda r, m: (r / m - 1) * 100)
    return s, [comp("RSP/SPY-ratio", ratio[-1][1])]


def margin_debt():
    debt = src.finra_margin_debt()
    return yoy(debt), [comp("Effectenkrediet", debt[-1][1] / 1000, "mld $")]


def sahm(unrate):
    avg3 = sma(unrate, 3)
    return [(avg3[i][0], avg3[i][1] - min(v for _, v in avg3[i - 12:i])) for i in range(12, len(avg3))]


def macro():
    un = src.fred("UNRATE", "1960-01-01")
    comps = [comp("Werkloosheid", un[-1][1], "%")]
    for label, sid, f in [("Industriële productie (j-o-j)", "INDPRO", lambda s: yoy(s)[-1][1]),
                          ("Bbp-groei (kwartaal, jaarbasis)", "A191RL1Q225SBEA", lambda s: s[-1][1])]:
        try:
            comps.append(comp(label, f(src.fred(sid)), "%"))
        except Exception as e:
            log.warning("%s niet beschikbaar: %s", sid, e)
    return sahm(un), comps


def technical():
    spx = src.yahoo("^GSPC")
    ma50, ma200 = sma(spx, 50), sma(spx, 200)
    s = combine(spx, ma200, lambda p, m: (p / m - 1) * 100)
    cross = "ja" if ma50[-1][1] < ma200[-1][1] else "nee"
    return s, [comp("S&P 500", spx[-1][1]), comp("50-daags gemiddelde", ma50[-1][1]),
               comp("200-daags gemiddelde", ma200[-1][1]), comp("Death cross", cross)]


def earnings():
    eps = src.multpl("s-p-500-earnings", start="1950-01-01")
    return yoy(eps), [comp("Winst per aandeel (12 mnd)", eps[-1][1], "$")]


def liquidity():
    comps = []
    try:
        d = combine(src.fred("SOFR", "2021-07-01"), src.fred("IORB", "2021-07-01"), lambda s, i: (s - i) * 100)
        comps.append(comp("SOFR minus rente op reserves", d[-1][1], "bp"))
    except Exception as e:
        log.warning("SOFR/IORB niet beschikbaar: %s", e)
    return src.fred("NFCI"), comps


BUILDERS = {f.__name__: f for f in
            [yield_curve, valuation, credit_spread, vix, breadth, margin_debt, macro, technical, earnings, liquidity]}


# ---------- record opbouwen ----------
def build_record(ind_id, series, components):
    meta = INDICATORS[ind_id]
    series = [(d, round(v, 4)) for d, v in series]
    if len(series) < 2:
        raise RuntimeError("te weinig datapunten")
    values = [v for _, v in series]
    score, parts = risk(values, meta)
    delta = values[-1] - values[-2]  # Δ = waarde vandaag − vorige waarneming
    return {
        "id": ind_id, "status": "ok", "error": None,
        "value": values[-1], "previous": values[-2], "delta": round(delta, 4),
        "delta_pct": round(delta / abs(values[-2]) * 100, 2) if values[-2] else None,
        "as_of": series[-1][0], "previous_date": series[-2][0],
        "score": score, "score_parts": parts, "level": level(score),
        "components": components, "spark": values[-30:], "points": len(series),
        "fetched": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def run_all(demo=False):
    ov = store.load_overview()
    old = ov.get("indicators", {}) if ov.get("demo") == demo else {}
    result = {}
    for ind_id in ORDER:
        try:
            if demo:
                series = demo_data.series(ind_id, INDICATORS[ind_id]["frequency"])
                comps = demo_data.components(ind_id)
            else:
                series, comps = BUILDERS[ind_id]()
            rec = build_record(ind_id, series, comps)
            store.save_history(ind_id, series)
            result[ind_id] = rec
            log.info("%-14s %10.3f  score %5.1f  (%s)", ind_id, rec["value"], rec["score"], rec["as_of"])
        except Exception as e:
            log.error("%s mislukt: %s", ind_id, e)
            if ind_id in old and old[ind_id].get("value") is not None:
                result[ind_id] = {**old[ind_id], "status": "stale", "error": str(e)}  # laatste goede data behouden
            else:
                result[ind_id] = {"id": ind_id, "status": "error", "error": str(e), "value": None, "score": None}
    scores = [r["score"] for r in result.values() if r.get("score") is not None]
    store.save_overview({
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "demo": demo,
        "composite": round(sum(scores) / len(scores), 1) if scores else None,
        "indicators": result,
    })
    return result


def schedule(scheduler, demo=False):
    """Dagelijkse cronjob, standaard 23:30 Amsterdamse tijd (na het slot in New York)."""
    hh, mm = os.environ.get("FETCH_TIME", "23:30").split(":")
    scheduler.add_job(run_all, "cron", hour=int(hh), minute=int(mm), kwargs={"demo": demo},
                      timezone=os.environ.get("TZ_NAME", "Europe/Amsterdam"), id="daily_fetch", replace_existing=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", action="store_true")
    ap.add_argument("--daemon", action="store_true")
    a = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    run_all(demo=a.demo)
    if a.daemon:
        from apscheduler.schedulers.blocking import BlockingScheduler
        s = BlockingScheduler()
        schedule(s, a.demo)
        s.start()


if __name__ == "__main__":
    main()
