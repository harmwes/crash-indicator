"""Risicoscore 0-100 = 50% drempel + 30% z-score + 20% momentum."""
from statistics import mean, pstdev

WEIGHTS = {"threshold": 0.5, "zscore": 0.3, "momentum": 0.2}


def _clamp(x, lo=0.0, hi=100.0):
    return max(lo, min(hi, x))


def threshold_score(value, direction, normal, warn, crash):
    """0 op 'normal', 50 op 'warn', 100 op 'crash'; lineair daartussen."""
    x, n, w, c = (direction * v for v in (value, normal, warn, crash))
    if x <= n:
        return 0.0
    if x <= w:
        return 50.0 * (x - n) / (w - n)
    if x <= c:
        return 50.0 + 50.0 * (x - w) / (c - w)
    return 100.0


def zscore(values, direction):
    """Z-score van de laatste waarde t.o.v. de hele historie, in de risicorichting."""
    if len(values) < 10:
        return 0.0
    sd = pstdev(values)
    return 0.0 if sd == 0 else direction * (values[-1] - mean(values)) / sd


def momentum_z(values, direction, n=3):
    """Verandering over n waarnemingen, gedeeld door de normale spreiding daarvan."""
    if len(values) < n + 10:
        return 0.0
    diffs = [values[i] - values[i - n] for i in range(n, len(values))]
    sd = pstdev(diffs)
    return 0.0 if sd == 0 else direction * diffs[-1] / sd


def level(score):
    if score < 30:
        return "green"
    if score <= 60:
        return "orange"
    return "red"


def risk(values, meta):
    d = meta["direction"]
    parts = {
        "threshold": threshold_score(values[-1], d, meta["normal"], meta["warn"], meta["crash"]),
        # z = 0 -> 0 punten, z = 3 -> 100 punten (alleen de riskante kant telt)
        "zscore": _clamp(zscore(values, d) / 3 * 100),
        "momentum": _clamp(momentum_z(values, d) / 3 * 100),
    }
    score = sum(WEIGHTS[k] * v for k, v in parts.items())
    return round(score, 1), {k: round(v, 1) for k, v in parts.items()}
