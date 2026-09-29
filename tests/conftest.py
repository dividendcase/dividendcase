"""Shared test setup.

- Every test session gets its own data folder, so the user's real database is never touched.
- The network is off: Yahoo Finance, PyPI and Wikipedia calls are replaced with made-up data
  from `FakeMarket`. These are invented numbers, not market data (see "Never ship Yahoo data").
- Tests talk to the real app and a real SQLite file through FastAPI's TestClient.
"""
import asyncio
import os
import socket
import tempfile
import time
from datetime import date, timedelta
from pathlib import Path

# Settings are read when dividendcase is imported, so these come first
DATA_DIR = Path(tempfile.mkdtemp(prefix="dividendcase-tests-"))
os.environ["DIVIDENDCASE_DATA_DIR"] = str(DATA_DIR)
os.environ["DIVIDENDCASE_AUTO_REFRESH"] = "false"
os.environ["DIVIDENDCASE_CHECK_UPDATES"] = "false"
os.environ.pop("DIVIDENDCASE_DATABASE_URL", None)

import pandas as pd  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

BASE_URL = "http://127.0.0.1:8765"


# Where a fake company is based, by exchange (withholding depends on it)
HOME_COUNTRY = {"NYSE": "United States", "NASDAQ": "United States", "LSE": "United Kingdom", "TSX": "Canada",
                "NSE": "India", "ASX": "Australia", "ISE": "Ireland"}


class FakeMarket:
    """Invented stocks and dividends that stand in for Yahoo Finance."""

    def __init__(self):
        self.stocks: dict[str, tuple[dict, list[dict]]] = {}
        self.calls: list[str] = []

    def add(
        self,
        ticker: str,
        *,
        currency: str = "USD",
        exchange: str = "NYSE",
        every_months: int = 3,
        amount: float = 0.50,
        price: float = 50.0,
        years: int = 6,
        yearly_growth: float = 0.05,
        last_paid_days_ago: int = 30,
        sector: str = "Consumer Defensive",
        price_start: float | None = None,
        country: str | None = None,
    ) -> None:
        """A payer with a steadily growing dividend, paid every `every_months` months."""
        per_year = 12 // every_months
        payments = years * per_year
        last = date.today() - timedelta(days=last_paid_days_ago)
        records = []
        for i in range(payments):
            months_back = (payments - 1 - i) * every_months
            when = _months_before(last, months_back)
            dividend = round(amount / ((1 + yearly_growth) ** (months_back / 12)), 4)
            # The price moves in a straight line from price_start to price (flat by default)
            share_price = price if price_start is None else round(price_start + (price - price_start) * i / max(payments - 1, 1), 4)
            records.append({
                "dividend_date": when,
                "dividend_per_share": dividend,
                "share_price_on_dividend_date": share_price,
                "dividend_yield_pct": round(dividend / share_price * 100, 4),
            })
        from dividendcase.services.derived import payment_frequency, yield_consistency
        stock = {
            "ticker_symbol": ticker,
            "company_name": f"{ticker} Test Company",
            "exchange": exchange,
            "country": country or HOME_COUNTRY.get(exchange, "United States"),
            "currency": currency,
            "sector": sector,
            "industry": "Testing",
            "description": "An invented company used in tests.",
            "market_cap": 1_000_000,
            "avg_dividend_yield": round(amount * per_year / price * 100, 3),
            "payment_frequency": payment_frequency(r["dividend_date"] for r in records),
            "yield_consistency_score": yield_consistency(r["dividend_yield_pct"] for r in records),
        }
        self.stocks[ticker] = (stock, records)

    def fetch_stock_light(self, symbol, years=10, with_profile=True):
        # Patched onto YahooFetcher as a bound method, so it gets the fetcher's arguments only
        self.calls.append(symbol)
        from datetime import datetime, timezone
        stock, records = self.stocks.get(symbol, (None, []))
        if stock is None:
            return None, []
        return {**stock, "last_fetched_at": datetime.now(timezone.utc).replace(tzinfo=None)}, [dict(r) for r in records]


    def universe(self, selected=None):
        """Stands in for the screener list: every fake stock, tagged with a market by exchange."""
        market_of = {"NYSE": "SP500", "LSE": "FTSE100", "TSX": "TSX60", "NSE": "NIFTY50"}
        return [
            (t, "test") for t, (stock, _) in sorted(self.stocks.items())
            if selected is None or market_of.get(stock["exchange"], "SP500") in selected
        ]


# Invented exchange rates (per euro): the dollar is weaker before 2022 so tests can tell a
# purchase-date rate from today's
FAKE_RATES_BEFORE_2022 = {"USD": 1.25, "GBP": 0.90, "CAD": 1.50, "INR": 90.0, "AUD": 1.60}
FAKE_RATES_FROM_2022 = {"USD": 1.10, "GBP": 0.85, "CAD": 1.45, "INR": 95.0, "AUD": 1.65}


def fake_ecb_rates(start: date) -> dict[date, dict[str, float]]:
    days = {}
    day = start
    while day <= date.today():
        if day.weekday() < 5:  # the ECB publishes on working days
            days[day] = dict(FAKE_RATES_BEFORE_2022 if day.year < 2022 else FAKE_RATES_FROM_2022)
        day += timedelta(days=1)
    return days


def _months_before(day: date, months: int) -> date:
    year, month = divmod(day.year * 12 + (day.month - 1) - months, 12)
    return date(year, month + 1, min(day.day, 28))


@pytest.fixture(scope="session")
def market():
    return FakeMarket()


@pytest.fixture(scope="session", autouse=True)
def offline(market):
    """Replace every outside call with fakes, and refuse any other connection."""
    mp = pytest.MonkeyPatch()

    real_connect = socket.socket.connect

    def local_only(self, address):
        host = address[0] if isinstance(address, tuple) else address
        if host not in ("127.0.0.1", "localhost", "::1"):
            raise OSError(f"Tests must not use the network (tried {address})")
        return real_connect(self, address)

    mp.setattr(socket.socket, "connect", local_only)

    from dividendcase.services import benchmark, fx, refresh, yahoo_fetcher
    from dividendcase.api.v1 import investment, portfolio, stocks

    mp.setattr(yahoo_fetcher.YahooFetcher, "fetch_stock_light", market.fetch_stock_light)
    mp.setattr(stocks, "_fetch_asset_profile", lambda ticker: {})
    mp.setattr(investment, "_get_benchmark_data", lambda ticker, year: (None, pd.DataFrame()))
    mp.setattr(portfolio, "_get_benchmark_data", lambda ticker, year: (None, pd.DataFrame()))
    mp.setattr(refresh, "screener_universe", market.universe)
    mp.setattr(fx, "_history", lambda: fake_ecb_rates(date(2015, 1, 1)))
    mp.setattr(fx, "_last_90_days", lambda: fake_ecb_rates(date.today() - timedelta(days=90)))
    mp.setattr(refresh, "PACE_SECONDS", (0, 0))
    mp.setattr(benchmark, "INDEX_PAUSE_SECONDS", 0)
    yield
    mp.undo()


@pytest.fixture(scope="session")
def client(offline):
    from dividendcase.main import app

    with TestClient(app, base_url=BASE_URL) as c:
        yield c


@pytest.fixture(autouse=True)
def clean_database(request):
    """Every test starts from an empty database (the schema stays)."""
    yield
    if "client" not in request.fixturenames:
        return
    # Downloads the test queued and jobs it started in the background (the index comparison
    # after a screener refresh, say) must finish first, or they write into the next test's rows
    client = request.getfixturevalue("client")
    wait_until_idle(client)
    client.portal.call(_finish_background_jobs)
    import sqlite3

    con = sqlite3.connect(DATA_DIR / "dividendcase.db")
    try:
        tables = [r[0] for r in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('alembic_version', 'sqlite_sequence')"
        )]
        con.execute("PRAGMA foreign_keys=OFF")
        for table in tables:
            con.execute(f'DELETE FROM "{table}"')
        con.commit()
    finally:
        con.close()
    from dividendcase.services import fx

    fx._table = None  # the in-memory copy of the rates


async def _finish_background_jobs(timeout: float = 20.0) -> None:
    from dividendcase.services import refresh

    if refresh._background:
        _, pending = await asyncio.wait(set(refresh._background), timeout=timeout)
        if pending:
            raise AssertionError(f"Background jobs still running after {timeout}s: {pending}")


def wait_until_idle(client, timeout: float = 20.0) -> dict:
    """Wait for the background refresh worker to finish what is queued."""
    deadline = time.time() + timeout
    status = client.get("/api/v1/data/status").json()
    while time.time() < deadline:
        status = client.get("/api/v1/data/status").json()
        if status["state"] == "idle" and status["queued"] == 0:
            return status
        time.sleep(0.05)
    raise AssertionError(f"Refresh still busy after {timeout}s: {status}")
