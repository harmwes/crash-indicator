"""Schrijft de huidige store weg als één JSON-momentopname voor de statische preview.
   python export_snapshot.py snapshot.json
"""
import json
import sys

from app import service
from app.indicators import ORDER

snap = {"overview": service.overview(), "details": {i: service.detail(i, "max") for i in ORDER}}
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(snap, f, ensure_ascii=False, separators=(",", ":"))
print(sys.argv[1], "geschreven")
