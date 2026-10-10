"""Leeslaag voor de API: combineert store + metadata. Vrij van FastAPI, dus los testbaar."""
from datetime import date, timedelta

from . import store
from .indicators import INDICATORS, ORDER
from .scoring import WEIGHTS

RANGES = {"week": 7, "month": 31, "year": 366}
PUBLIC_META = ("name", "metric", "unit", "decimals", "frequency", "tooltip", "meaning", "importance",
               "history", "source", "direction", "normal", "warn", "crash")


def _merge(ind_id, rec):
    meta = {k: INDICATORS[ind_id][k] for k in PUBLIC_META}
    meta["history_text"] = meta.pop("history")
    return {"id": ind_id, **meta, **(rec or {"status": "error", "error": "Nog geen data opgehaald", "value": None, "score": None})}


def overview():
    ov = store.load_overview()
    recs = ov.get("indicators", {})
    return {"updated": ov.get("updated"), "demo": ov.get("demo", False), "composite": ov.get("composite"),
            "weights": WEIGHTS, "indicators": [_merge(i, recs.get(i)) for i in ORDER]}


def detail(ind_id, rng="max"):
    if ind_id not in INDICATORS:
        return None
    ov = store.load_overview()
    series = store.load_history(ind_id)
    if rng in RANGES and series:
        cutoff = (date.fromisoformat(series[-1][0]) - timedelta(days=RANGES[rng])).isoformat()
        series = [p for p in series if p[0] >= cutoff]
    return {**_merge(ind_id, ov.get("indicators", {}).get(ind_id)), "demo": ov.get("demo", False),
            "updated": ov.get("updated"), "weights": WEIGHTS, "series": series}
