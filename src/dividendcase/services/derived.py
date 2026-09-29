"""Figures worked out from a stock's own dividend history, stored with the stock so the
screener can filter on them without loading every payment."""
import statistics
from datetime import date
from typing import Iterable, Optional


def payment_frequency(dates: Iterable[date]) -> Optional[str]:
    """monthly, quarterly, semi-annual or annual, from the average gap between payments."""
    ordered = sorted(dates)
    if len(ordered) < 2:
        return None
    gaps = [(later - earlier).days for earlier, later in zip(ordered, ordered[1:])]
    avg_gap = sum(gaps) / len(gaps)
    if avg_gap < 45:
        return "monthly"
    if avg_gap < 120:
        return "quarterly"
    if avg_gap < 270:
        return "semi-annual"
    return "annual"


def yield_consistency(yields: Iterable[Optional[float]]) -> Optional[float]:
    """100 = a perfectly steady yield per payment, 0 = erratic (1 − coefficient of variation)."""
    values = [float(y) for y in yields if y]
    if len(values) < 2:
        return None
    mean = statistics.mean(values)
    if not mean:
        return None
    cv = statistics.stdev(values) / mean
    return round(max(0.0, min(100.0, (1 - cv) * 100)), 1)
