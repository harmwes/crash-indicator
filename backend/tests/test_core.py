"""Tests zonder netwerk: parsers (met voorbeeldantwoorden), scoring, collector en leeslaag.
Draaien met:  python -m pytest   of   python tests/test_core.py
"""
import io
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ["DATA_DIR"] = tempfile.mkdtemp()

from app import collector, scoring, service, sources  # noqa: E402
from app.indicators import INDICATORS, ORDER  # noqa: E402


def test_fred_csv():
    txt = "observation_date,T10Y2Y\n2026-09-29,0.52\n2026-09-30,.\n2026-10-01,0.55\n2026-10-02,\n"
    assert sources.parse_fred_csv(txt) == [("2026-09-29", 0.52), ("2026-10-01", 0.55)]


def test_yahoo():
    payload = {"chart": {"result": [{"timestamp": [1790947800, 1791034200, 1791120600],
                                     "indicators": {"quote": [{"close": [16.5, None, 17.25]}]}}]}}
    out = sources.parse_yahoo_chart(payload)
    assert [v for _, v in out] == [16.5, 17.25] and out[0][0] < out[1][0]


def test_multpl():
    html = """<table><tr><th>Date</th><th>Value</th></tr>
    <tr class="odd"><td>Oct 2, 2026</td><td>
    <abbr title="Estimate">&#x2020;</abbr>
    41.38
    </td></tr><tr><td>Sep 1, 2026</td><td>40.90</td></tr>
    <tr><td>Aug 1, 2026</td><td>1,240.13</td></tr></table>"""
    assert sources.parse_multpl(html) == [("2026-08-01", 1240.13), ("2026-09-01", 40.9), ("2026-10-01", 41.38)]


def test_finra_xlsx():
    from datetime import datetime
    from openpyxl import Workbook
    wb = Workbook(); ws = wb.active
    ws.append(["Year-Month", "Debit Balances in Customers' Securities Margin Accounts", "Free Credit"])
    ws.append(["Aug-26", 1453832, 1]); ws.append([datetime(2026, 7, 1), "1,417,225", 1]); ws.append(["2026-06", 1502072, 1])
    buf = io.BytesIO(); wb.save(buf)
    assert sources.parse_finra_xlsx(buf.getvalue()) == [("2026-06-01", 1502072.0), ("2026-07-01", 1417225.0), ("2026-08-01", 1453832.0)]


def test_threshold_and_levels():
    vix = INDICATORS["vix"]; yc = INDICATORS["yield_curve"]
    t = lambda v, m: scoring.threshold_score(v, m["direction"], m["normal"], m["warn"], m["crash"])
    assert t(12, vix) == 0 and t(25, vix) == 50 and t(40, vix) == 100 and t(90, vix) == 100
    assert t(20, vix) == 25
    assert t(1.5, yc) == 0 and t(0, yc) == 50 and t(-0.75, yc) == 100  # lager = riskanter
    assert [scoring.level(s) for s in (0, 29.9, 30, 60, 60.1, 100)] == ["green", "green", "orange", "orange", "red", "red"]


def test_risk_calm_vs_crash():
    calm = [15 + (i % 5) * 0.2 for i in range(300)]
    s_calm, _ = scoring.risk(calm, INDICATORS["vix"])
    s_crash, parts = scoring.risk(calm + [22, 31, 45, 60], INDICATORS["vix"])
    assert s_calm < 30 and s_crash > 90 and parts["threshold"] == 100


def test_helpers():
    s = [(f"d{i}", float(i)) for i in range(1, 6)]
    assert collector.sma(s, 3) == [("d3", 2.0), ("d4", 3.0), ("d5", 4.0)]
    m = [(f"{i:02d}", 100.0 + i) for i in range(13)]
    (d, v), = collector.yoy(m)
    assert d == "12" and abs(v - 12.0) < 1e-9
    # Sahm: werkloosheid 4.0 vlak, daarna 3 maanden 4.6 -> 3-mnd gem. 4.6 minus dieptepunt 4.0
    un = [(f"m{i:02d}", 4.0) for i in range(20)] + [("x1", 4.6), ("x2", 4.6), ("x3", 4.6)]
    assert abs(collector.sahm(un)[-1][1] - 0.6) < 1e-9


def test_demo_run_and_service():
    res = collector.run_all(demo=True)
    assert list(res) == ORDER and all(r["status"] == "ok" for r in res.values())
    ov = service.overview()
    assert ov["demo"] and len(ov["indicators"]) == 10 and 0 <= ov["composite"] <= 100
    for ind in ov["indicators"]:
        assert abs(ind["delta"] - (ind["value"] - ind["previous"])) < 1e-3
        assert 0 <= ind["score"] <= 100 and ind["level"] in ("green", "orange", "red")
    d = service.detail("vix", "week")
    assert 4 <= len(d["series"]) <= 6 and d["series"][-1][1] == d["value"]
    assert len(service.detail("vix", "max")["series"]) > 2000
    assert service.detail("bestaat_niet") is None


def test_failed_fetch_keeps_last_good_data(monkeypatch=None):
    collector.run_all(demo=True)
    orig = collector.demo_data.series
    collector.demo_data.series = lambda i, f: (_ for _ in ()).throw(RuntimeError("bron onbereikbaar")) if i == "vix" else orig(i, f)
    try:
        res = collector.run_all(demo=True)
    finally:
        collector.demo_data.series = orig
    assert res["vix"]["status"] == "stale" and res["vix"]["value"] is not None and "onbereikbaar" in res["vix"]["error"]


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok  ", name)
