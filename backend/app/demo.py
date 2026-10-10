"""Synthetische voorbeelddata (GEEN echte marktcijfers) om de app zonder internet te tonen."""
import random
from datetime import date, timedelta

# id: (gemiddelde, spreiding, terugkeer naar gemiddelde per stap, startwaarde)
PARAMS = {
    "yield_curve": (0.6, 0.6, 0.004, 1.1),
    "valuation": (31.0, 4.0, 0.03, 26.0),
    "credit_spread": (1.0, 0.25, 0.006, 0.9),
    "vix": (18.0, 6.0, 0.02, 14.0),
    "breadth": (-0.5, 2.5, 0.01, 0.5),
    "margin_debt": (12.0, 18.0, 0.08, 5.0),
    "macro": (0.12, 0.15, 0.10, 0.05),
    "technical": (4.0, 5.5, 0.012, 6.0),
    "earnings": (9.0, 10.0, 0.08, 12.0),
    "liquidity": (-0.45, 0.2, 0.03, -0.5),
}
# eindwaarden waar de reeks de laatste weken naartoe trekt, zodat alle drie de kleuren te zien zijn
END = {"margin_debt": 78.0, "vix": 27.5, "credit_spread": 1.62}
COMPONENTS = {
    "breadth": [("RSP/SPY-ratio", 0.284, "")],
    "margin_debt": [("Effectenkrediet", 1453.8, "mld $")],
    "macro": [("Werkloosheid", 4.3, "%"), ("Industriële productie (j-o-j)", 1.1, "%"), ("Bbp-groei (kwartaal, jaarbasis)", 2.4, "%")],
    "technical": [("S&P 500", 6890.4, ""), ("50-daags gemiddelde", 6795.2, ""), ("200-daags gemiddelde", 6480.7, ""), ("Death cross", "nee", "")],
    "earnings": [("Winst per aandeel (12 mnd)", 248.6, "$")],
    "liquidity": [("SOFR minus rente op reserves", -4.0, "bp")],
}


def _dates(freq, end):
    if freq == "daily":
        d, out = end - timedelta(days=3653), []
        while d <= end:
            if d.weekday() < 5:
                out.append(d)
            d += timedelta(days=1)
        return out
    if freq == "weekly":
        d = end - timedelta(days=(end.weekday() - 4) % 7)
        return [d - timedelta(weeks=i) for i in range(52 * 20, -1, -1)]
    out, y, m = [], end.year - 30, end.month
    while (y, m) <= (end.year, end.month):
        out.append(date(y, m, 1))
        y, m = (y, m + 1) if m < 12 else (y + 1, 1)
    return out


def series(ind_id, freq, end=None):
    mu, sd, kappa, x = PARAMS[ind_id]
    rnd = random.Random(ind_id)  # vaste seed: elke run dezelfde reeks
    step = sd * (2 * kappa) ** 0.5
    out, dates = [], _dates(freq, end or date.today())
    for i, d in enumerate(dates):
        x += kappa * (mu - x) + rnd.gauss(0, step)
        if ind_id in END and i >= len(dates) - 25:
            x += (END[ind_id] - x) * 0.2
        if ind_id == "vix":
            x = max(x, 9.5)
        if ind_id == "macro":
            x = max(x, 0.0)
        out.append((d.isoformat(), round(x, 3)))
    return out


def components(ind_id):
    return [{"label": l, "value": v, "unit": u} for l, v, u in COMPONENTS.get(ind_id, [])]
