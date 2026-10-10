"""Lokale JSON-store: data/indicators.json (overzicht) + data/history/<id>.json."""
import json
import os
import tempfile
from pathlib import Path

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))


def _write(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)  # atomair: de API leest nooit een half bestand


def _read(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def load_overview():
    return _read(DATA_DIR / "indicators.json", {"updated": None, "demo": False, "indicators": {}})


def save_overview(obj):
    _write(DATA_DIR / "indicators.json", obj)


def load_history(ind_id):
    return _read(DATA_DIR / "history" / f"{ind_id}.json", [])


def save_history(ind_id, series):
    _write(DATA_DIR / "history" / f"{ind_id}.json", series)
