"""Exchange rates, so totals across currencies can be shown in one home currency.

Rates are the European Central Bank's euro reference rates (about 30 currencies, published on
working days around 16:00 CET). The ECB allows reuse of its statistics free of charge with
the source acknowledged. The full history since 1999 is fetched once (about 640 KB) and the
last 90 days after that, so a purchase in 2019 converts at the 2019 rate.

Yahoo quotes some markets in minor units: GBp (pence), ZAc (South African cents) and ILA
(agorot). They convert through GBP, ZAR and ILS divided by 100.
"""
import asyncio
import bisect
import csv
import io
import logging
import xml.etree.ElementTree as ET
import zipfile
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import requests
from sqlalchemy import func, select

from dividendcase.database import AsyncSessionLocal
from dividendcase.models import FxRate

logger = logging.getLogger(__name__)

ECB_HISTORY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip"
ECB_90_DAYS_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml"
SOURCE = "European Central Bank euro reference rates"
USER_AGENT = "DividendCase (+https://github.com/dividendcase/dividendcase)"

# Minor units Yahoo uses → (major currency, units per major unit)
MINOR_UNITS = {"GBp": ("GBP", 100), "GBX": ("GBP", 100), "ZAc": ("ZAR", 100), "ILA": ("ILS", 100)}


# ── parsing the ECB files ────────────────────────────────────────────────────
def parse_history_csv(text: str) -> dict[date, dict[str, float]]:
    """eurofxref-hist.csv: a Date column, one column per currency, 'N/A' where there's no rate."""
    days: dict[date, dict[str, float]] = {}
    for row in csv.DictReader(io.StringIO(text)):
        when = row.pop("Date", None)
        if not when:
            continue
        rates = {}
        for currency, value in row.items():
            currency = (currency or "").strip()
            value = (value or "").strip()
            if currency and value and value != "N/A":
                try:
                    rates[currency] = float(value)
                except ValueError:
                    continue
        if rates:
            days[date.fromisoformat(when.strip())] = rates
    return days


def parse_ecb_xml(text: str) -> dict[date, dict[str, float]]:
    """eurofxref-daily.xml / -hist-90d.xml: <Cube time='…'><Cube currency='USD' rate='…'/>…"""
    days: dict[date, dict[str, float]] = {}
    for cube in ET.fromstring(text).iter():
        when = cube.attrib.get("time")
        if not when:
            continue
        rates = {c.attrib["currency"]: float(c.attrib["rate"]) for c in cube if "currency" in c.attrib}
        if rates:
            days[date.fromisoformat(when)] = rates
    return days


def _download(url: str) -> bytes:
    resp = requests.get(url, timeout=30, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    return resp.content


def _history() -> dict[date, dict[str, float]]:
    with zipfile.ZipFile(io.BytesIO(_download(ECB_HISTORY_URL))) as zf:
        name = next(n for n in zf.namelist() if n.endswith(".csv"))
        return parse_history_csv(zf.read(name).decode("utf-8"))


def _last_90_days() -> dict[date, dict[str, float]]:
    return parse_ecb_xml(_download(ECB_90_DAYS_URL).decode("utf-8"))


# ── the rates on this computer ───────────────────────────────────────────────
class RateTable:
    """All stored days in memory (a few thousand rows), for converting many amounts at once."""

    def __init__(self, days: dict[date, dict[str, float]]):
        self.dates = sorted(days)
        self._rates = [days[d] for d in self.dates]

    def __bool__(self) -> bool:
        return bool(self.dates)

    @property
    def latest_date(self) -> Optional[date]:
        return self.dates[-1] if self.dates else None

    def _index(self, when: Optional[date]) -> int:
        if when is None:
            return len(self.dates) - 1
        # The last working day on or before `when`; the first stored day for anything earlier
        return max(bisect.bisect_right(self.dates, when) - 1, 0)

    def day_for(self, when: Optional[date] = None) -> Optional[date]:
        """The stored day whose rates apply on `when`."""
        return self.dates[self._index(when)] if self.dates else None

    def on(self, when: Optional[date] = None) -> dict[str, float]:
        """Rates published on `when` or the last working day before it (the latest if None)."""
        return self._rates[self._index(when)] if self.dates else {}

    def currencies(self) -> list[str]:
        return sorted({"EUR", *self.on().keys()})


def _per_euro(rates: dict[str, float], currency: str) -> Optional[float]:
    """How much of `currency` one euro buys, allowing for minor units like GBp."""
    if currency in MINOR_UNITS:
        major, units = MINOR_UNITS[currency]
        rate = _per_euro(rates, major)
        return rate * units if rate else None
    if currency == "EUR":
        return 1.0
    return rates.get(currency)


def convert(amount: float, from_currency: str, to_currency: str, table: RateTable, when: Optional[date] = None) -> Optional[float]:
    """`amount` in from_currency expressed in to_currency, or None if either has no rate."""
    if from_currency == to_currency:
        return amount
    rates = table.on(when)
    src, dst = _per_euro(rates, from_currency), _per_euro(rates, to_currency)
    if not src or not dst:
        return None
    return amount / src * dst


def can_convert(currency: str, table: RateTable) -> bool:
    return _per_euro(table.on(), currency) is not None


_table: Optional[RateTable] = None


async def get_table() -> RateTable:
    """The stored rates, loaded once and reloaded after each refresh."""
    global _table
    if _table is None:
        async with AsyncSessionLocal() as db:
            rows = (await db.execute(select(FxRate.date, FxRate.rates))).all()
        _table = RateTable({d: r for d, r in rows})
    return _table


async def latest_date() -> Optional[date]:
    async with AsyncSessionLocal() as db:
        return await db.scalar(select(func.max(FxRate.date)))


async def refresh_rates(force_history: bool = False) -> int:
    """Store any ECB days this computer doesn't have yet. Returns how many were added."""
    global _table
    latest = await latest_date()
    today = datetime.now(timezone.utc).date()
    if latest is not None and not force_history and latest >= today - timedelta(days=1):
        return 0  # up to date (the ECB publishes on working days, late afternoon)
    try:
        if latest is None or force_history or (today - latest).days > 80:
            days = await asyncio.to_thread(_history)
        else:
            days = await asyncio.to_thread(_last_90_days)
    except Exception as e:  # offline, ECB down: keep the rates we have, try again later
        logger.info("Couldn't update exchange rates: %s", e)
        return 0

    new = {d: r for d, r in days.items() if latest is None or force_history or d > latest}
    if not new:
        return 0
    async with AsyncSessionLocal() as db:
        existing = set() if latest is None else {
            row[0] for row in (await db.execute(select(FxRate.date).where(FxRate.date.in_(list(new))))).all()
        }
        for when, rates in new.items():
            if when not in existing:
                db.add(FxRate(date=when, rates=rates, source="ECB"))
        await db.commit()
    _table = None  # reload on next use
    logger.info("Stored %d days of exchange rates (latest %s)", len(new), max(new))
    return len(new)


async def rates_summary() -> dict:
    table = await get_table()
    return {
        "fx_latest_date": table.latest_date.isoformat() if table.latest_date else None,
        "fx_days": len(table.dates),
        "fx_source": SOURCE,
    }
