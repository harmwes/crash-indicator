"""API-gateway voor de frontend (FastAPI).

  uvicorn app.main:app --reload --port 8000

Standaard draait de dagelijkse cronjob in dit proces mee. Zet RUN_SCHEDULER=0 als de
collector als aparte service draait (zie docker-compose.yml).
"""
import logging
import os
import threading
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import collector, service, store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
DEMO = os.environ.get("DEMO_MODE", "0") == "1"
_lock = threading.Lock()


def _refresh():
    if _lock.acquire(blocking=False):  # nooit twee ophaalrondes tegelijk
        try:
            collector.run_all(demo=DEMO)
        finally:
            _lock.release()


def _is_stale(hours=12):
    ov = store.load_overview()
    if not ov.get("updated") or ov.get("demo") != DEMO:
        return True
    return datetime.now(timezone.utc) - datetime.fromisoformat(ov["updated"]) > timedelta(hours=hours)


@asynccontextmanager
async def lifespan(app):
    scheduler = None
    if os.environ.get("RUN_SCHEDULER", "1") == "1":
        from apscheduler.schedulers.background import BackgroundScheduler
        scheduler = BackgroundScheduler()
        hh, mm = os.environ.get("FETCH_TIME", "23:30").split(":")
        scheduler.add_job(_refresh, "cron", hour=int(hh), minute=int(mm), id="daily_fetch",
                          timezone=os.environ.get("TZ_NAME", "Europe/Amsterdam"))
        scheduler.start()
        if _is_stale():
            threading.Thread(target=_refresh, daemon=True).start()
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


app = FastAPI(title="Crash-Indicator API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    ov = store.load_overview()
    return {"ok": True, "updated": ov.get("updated"), "demo": ov.get("demo", False), "refreshing": _lock.locked()}


@app.get("/api/indicators")
def indicators():
    return service.overview()


@app.get("/api/indicators/{ind_id}")
def indicator(ind_id: str, range: str = Query("max", pattern="^(week|month|year|max)$")):
    d = service.detail(ind_id, range)
    if d is None:
        raise HTTPException(404, "Onbekende indicator")
    return d


@app.post("/api/refresh", status_code=202)
def refresh():
    if _lock.locked():
        return {"started": False, "reason": "Er loopt al een ophaalronde"}
    threading.Thread(target=_refresh, daemon=True).start()
    return {"started": True}
