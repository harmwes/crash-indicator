"""Statische export voor hosting zonder backend (Netlify).

  python export_static.py <map>             schrijft overview.json + <id>.json per indicator
  python export_static.py --restore <map>   vult de lokale store vanuit een eerdere export,
                                            zodat een mislukte bron de laatste goede data behoudt
"""
import json
import sys
from pathlib import Path

from app import service, store
from app.indicators import ORDER

META_KEYS = set(service.PUBLIC_META) | {"history_text", "demo", "updated", "weights", "series"}


def export(out: Path):
    out.mkdir(parents=True, exist_ok=True)
    dump = lambda name, obj: (out / name).write_text(
        json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    dump("overview.json", service.overview())
    for ind_id in ORDER:
        dump(f"{ind_id}.json", service.detail(ind_id, "max"))
    print(f"{len(ORDER) + 1} bestanden geschreven naar {out}")


def restore(src: Path):
    try:
        ov = json.loads((src / "overview.json").read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        print("Geen eerdere export gevonden; store blijft leeg")
        return
    records = {}
    for ind in ov["indicators"]:
        if ind.get("value") is None:
            continue
        records[ind["id"]] = {k: v for k, v in ind.items() if k not in META_KEYS}
        try:
            detail = json.loads((src / f"{ind['id']}.json").read_text(encoding="utf-8"))
            store.save_history(ind["id"], detail["series"])
        except (FileNotFoundError, json.JSONDecodeError, KeyError):
            pass
    store.save_overview({"updated": ov.get("updated"), "demo": ov.get("demo", False),
                         "composite": ov.get("composite"), "indicators": records})
    print(f"Store hersteld met {len(records)} indicatoren")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--restore":
        restore(Path(sys.argv[2]))
    elif len(sys.argv) == 2:
        export(Path(sys.argv[1]))
    else:
        sys.exit(__doc__)
