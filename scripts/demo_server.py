"""Run the app on an example portfolio of invented numbers, for screenshots and demos.

    uv run python scripts/demo_server.py               # http://127.0.0.1:8770/dashboard/
    uv run python scripts/demo_server.py --port 8771

Nothing here is market data. Every price, dividend, index level and exchange rate is generated
below from round numbers and smooth curves (see "Never ship Yahoo data" in CLAUDE.md). Like the
tests, the server swaps the app's Yahoo, ECB and Wikipedia calls for these numbers and refuses
any other connection, so nothing real can reach a screenshot. Each run starts from a fresh,
temporary data folder and sets up the example portfolio through the app's own API.
"""
import argparse
import json
import math
import os
import socket
import sys
import tempfile
import threading
import time
import urllib.request
from datetime import date, datetime, timedelta, timezone

parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
parser.add_argument("--port", type=int, default=8770)
args = parser.parse_args()

# Settings are read when dividendcase is imported, so these come first
os.environ["DIVIDENDCASE_DATA_DIR"] = tempfile.mkdtemp(prefix="dividendcase-demo-")
os.environ["DIVIDENDCASE_AUTO_REFRESH"] = "true"
os.environ["DIVIDENDCASE_CHECK_UPDATES"] = "false"
os.environ.pop("DIVIDENDCASE_DATABASE_URL", None)

import pandas as pd  # noqa: E402
import uvicorn  # noqa: E402

TODAY = date.today()


# ── the example market ───────────────────────────────────────────────────────
# (symbol, name, exchange, country, currency, sector, price now, price ten years ago,
#  payments as (month, day, amount now), yearly dividend growth)
STOCKS = [
    ("KO", "The Coca-Cola Company", "NYSE", "United States", "USD", "Consumer Defensive", 63.4, 41.2, [(4, 1, 0.51), (7, 1, 0.51), (10, 1, 0.51), (12, 15, 0.51)], 0.045),
    ("O", "Realty Income", "NYSE", "United States", "USD", "Real Estate", 57.3, 52.8, [(m, 15, 0.2635) for m in range(1, 13)], 0.03),
    ("JNJ", "Johnson & Johnson", "NYSE", "United States", "USD", "Healthcare", 158.2, 104.5, [(3, 10, 1.24), (6, 10, 1.24), (9, 10, 1.24), (12, 10, 1.24)], 0.055),
    ("ENB.TO", "Enbridge", "TSX", "Canada", "CAD", "Energy", 61.8, 47.6, [(3, 1, 0.9425), (6, 1, 0.9425), (9, 1, 0.9425), (12, 1, 0.9425)], 0.03),
    ("ULVR.L", "Unilever", "LSE", "United Kingdom", "GBp", "Consumer Defensive", 4620.0, 3150.0, [(3, 20, 37.6), (6, 5, 37.6), (9, 4, 37.6), (12, 5, 37.6)], 0.03),
    ("KRZ.IR", "Kerry Group", "ISE", "Ireland", "EUR", "Consumer Defensive", 86.4, 66.0, [(5, 9, 0.89), (11, 15, 0.39)], 0.08),
    ("HDFCBANK.NS", "HDFC Bank", "NSE", "India", "INR", "Financial Services", 1720.0, 560.0, [(6, 28, 22.0)], 0.1),
    ("ITC.NS", "ITC Limited", "NSE", "India", "INR", "Consumer Defensive", 432.0, 220.0, [(2, 20, 6.5), (6, 30, 7.75)], 0.06),
    ("BHP.AX", "BHP Group", "ASX", "Australia", "AUD", "Basic Materials", 41.8, 22.4, [(3, 27, 0.72), (9, 25, 0.88)], 0.05),
    # The rest of the screener
    ("PEP", "PepsiCo", "NASDAQ", "United States", "USD", "Consumer Defensive", 151.2, 101.0, [(1, 6, 1.42), (3, 31, 1.42), (6, 30, 1.42), (9, 30, 1.42)], 0.07),
    ("PG", "Procter & Gamble", "NYSE", "United States", "USD", "Consumer Defensive", 162.5, 84.3, [(2, 15, 1.06), (5, 15, 1.06), (8, 15, 1.06), (11, 15, 1.06)], 0.05),
    ("MCD", "McDonald's", "NYSE", "United States", "USD", "Consumer Cyclical", 289.4, 119.0, [(3, 17, 1.77), (6, 16, 1.77), (9, 16, 1.77), (12, 16, 1.77)], 0.08),
    ("VZ", "Verizon", "NYSE", "United States", "USD", "Communication Services", 41.6, 52.2, [(2, 1, 0.68), (5, 1, 0.68), (8, 1, 0.68), (11, 1, 0.68)], 0.02),
    ("XOM", "Exxon Mobil", "NYSE", "United States", "USD", "Energy", 112.9, 87.5, [(3, 10, 0.99), (6, 10, 0.99), (9, 10, 0.99), (12, 10, 0.99)], 0.03),
    ("ABBV", "AbbVie", "NYSE", "United States", "USD", "Healthcare", 182.3, 61.0, [(2, 14, 1.64), (5, 15, 1.64), (8, 15, 1.64), (11, 14, 1.64)], 0.09),
    ("RY.TO", "Royal Bank of Canada", "TSX", "Canada", "CAD", "Financial Services", 168.4, 78.5, [(2, 24, 1.48), (5, 24, 1.48), (8, 24, 1.48), (11, 24, 1.48)], 0.07),
    ("FTS.TO", "Fortis", "TSX", "Canada", "CAD", "Utilities", 62.1, 42.0, [(3, 1, 0.615), (6, 1, 0.615), (9, 1, 0.615), (12, 1, 0.615)], 0.05),
    ("BNS.TO", "Bank of Nova Scotia", "TSX", "Canada", "CAD", "Financial Services", 71.3, 64.0, [(1, 28, 1.06), (4, 28, 1.06), (7, 28, 1.06), (10, 28, 1.06)], 0.04),
    ("LGEN.L", "Legal & General", "LSE", "United Kingdom", "GBp", "Financial Services", 241.0, 228.0, [(6, 5, 15.36), (9, 26, 6.12)], 0.05),
    ("NG.L", "National Grid", "LSE", "United Kingdom", "GBp", "Utilities", 1012.0, 945.0, [(1, 9, 15.84), (8, 1, 30.88)], 0.03),
    ("BATS.L", "British American Tobacco", "LSE", "United Kingdom", "GBp", "Consumer Defensive", 3120.0, 4480.0, [(2, 7, 60.06), (5, 9, 60.06), (8, 9, 60.06), (11, 14, 60.06)], 0.03),
    ("GSK.L", "GSK", "LSE", "United Kingdom", "GBp", "Healthcare", 1489.0, 1520.0, [(1, 9, 15.0), (4, 10, 15.0), (7, 10, 15.0), (10, 9, 15.0)], 0.0),
    ("GL9.IR", "Glanbia", "ISE", "Ireland", "EUR", "Consumer Defensive", 14.9, 16.1, [(4, 26, 0.24), (10, 4, 0.18)], 0.06),
    ("BIRG.IR", "Bank of Ireland Group", "ISE", "Ireland", "EUR", "Financial Services", 10.6, 5.2, [(6, 21, 0.63)], 0.12),
    ("INFY.NS", "Infosys", "NSE", "India", "INR", "Technology", 1840.0, 560.0, [(6, 28, 21.0), (10, 30, 21.0)], 0.12),
    ("POWERGRID.NS", "Power Grid Corporation of India", "NSE", "India", "INR", "Utilities", 322.0, 118.0, [(2, 22, 4.5), (8, 30, 4.75), (11, 25, 3.75)], 0.07),
    ("COALINDIA.NS", "Coal India", "NSE", "India", "INR", "Energy", 402.0, 290.0, [(2, 5, 5.25), (8, 22, 5.15), (11, 18, 15.75)], 0.04),
    ("CBA.AX", "Commonwealth Bank of Australia", "ASX", "Australia", "AUD", "Financial Services", 141.2, 78.6, [(3, 27, 2.25), (9, 26, 2.40)], 0.04),
    ("TLS.AX", "Telstra Group", "ASX", "Australia", "AUD", "Communication Services", 4.04, 5.31, [(3, 28, 0.09), (9, 26, 0.09)], 0.0),
    ("WES.AX", "Wesfarmers", "ASX", "Australia", "AUD", "Consumer Cyclical", 72.8, 39.4, [(3, 31, 0.95), (10, 7, 1.06)], 0.05),
]

# Your holdings: (symbol, shares, purchase date, price paid, currency paid in)
HOLDINGS = [
    ("KO", 80, "2021-03-15", 50.20, "USD"),
    ("KO", 40, "2023-09-12", 58.90, "USD"),
    ("O", 85, "2022-06-01", 61.10, "USD"),
    ("JNJ", 40, "2020-09-10", 148.00, "USD"),
    ("ENB.TO", 150, "2021-11-02", 49.50, "CAD"),
    ("ULVR.L", 60, "2022-02-14", 3850.0, "GBp"),
    ("KRZ.IR", 30, "2023-01-20", 79.60, "EUR"),
    ("HDFCBANK.NS", 75, "2021-05-04", 1450.0, "INR"),
    ("ITC.NS", 400, "2022-08-12", 305.0, "INR"),
    ("BHP.AX", 110, "2021-07-20", 46.10, "AUD"),
]
WATCHLIST = ["PEP", "PG", "CBA.AX", "FTS.TO"]


def _months_ago(day: date, years: float) -> float:
    return (TODAY - day).days / 365.25


def _price(row, when: date) -> float:
    """A smooth path from the price ten years ago to today's, with a gentle wobble"""
    _, _, _, _, _, _, now, then, _, _ = row
    back = _months_ago(when, 0)
    trend = then * (now / then) ** (1 - back / 10.5)
    wobble = 1 + 0.05 * math.sin(back * 2.3 + len(row[0])) + 0.025 * math.sin(back * 7.1)
    return round(trend * wobble, 2 if now < 1000 else 1)


def _records(row) -> list[dict]:
    symbol, *_, payments, growth = row
    out = []
    for year in range(TODAY.year - 11, TODAY.year + 1):
        for month, day, amount in payments:
            when = date(year, month, min(day, 28))
            back = _months_ago(when, 0)
            if when > TODAY or back > 10.5:
                continue
            dps = round(amount / (1 + growth) ** back, 4)
            price = _price(row, when)
            out.append({
                "dividend_date": when,
                "dividend_per_share": dps,
                "share_price_on_dividend_date": price,
                "dividend_yield_pct": round(dps / price * 100, 4),
            })
    return sorted(out, key=lambda r: r["dividend_date"])


class DemoMarket:
    """Stands in for Yahoo Finance, as tests/conftest.py's FakeMarket does"""

    def __init__(self):
        self.rows = {r[0]: r for r in STOCKS}

    def fetch_stock_light(self, symbol, years=10, with_profile=True):
        from dividendcase.services.derived import payment_frequency, yield_consistency

        row = self.rows.get(symbol)
        if row is None:
            return None, []
        symbol, name, exchange, country, currency, sector, now, *_ = row
        records = _records(row)
        last_year = [r["dividend_per_share"] for r in records if (TODAY - r["dividend_date"]).days <= 365]
        stock = {
            "ticker_symbol": symbol,
            "company_name": name,
            "exchange": exchange,
            "country": country,
            "currency": currency,
            "sector": sector,
            "industry": sector,
            "description": f"{name}: an example company with invented numbers.",
            "market_cap": 50_000_000_000,
            "avg_dividend_yield": round(sum(last_year) / now * 100, 3),
            "payment_frequency": payment_frequency(r["dividend_date"] for r in records),
            "yield_consistency_score": yield_consistency(r["dividend_yield_pct"] for r in records),
            "last_fetched_at": datetime.now(timezone.utc).replace(tzinfo=None),
        }
        return stock, [dict(r) for r in records]

    def universe(self, selected=None):
        return [(r[0], "demo") for r in STOCKS]


def benchmark(ticker: str, start_year: int):
    """An index that rises about 7% a year and pays about 2%, with some wobble"""
    months = pd.date_range(date(start_year, 1, 31), TODAY, freq="ME")
    seed = sum(map(ord, ticker))
    prices, divs, total = [], [], 0.0
    for i, _ in enumerate(months):
        t = i / 12
        price = 100 * 1.07 ** t * (1 + 0.06 * math.sin(t * 1.7 + seed) + 0.03 * math.sin(t * 5.3))
        total += price * 0.02 / 12
        prices.append(round(price, 2))
        divs.append(round(total, 4))
    frame = pd.DataFrame({"price": prices, "cumulative_divs": divs}, index=months)
    return (prices[0] if prices else None), frame


def rates(start: date) -> dict:
    """Euro reference rates: smooth, invented curves around plausible levels"""
    days, day = {}, start
    while day <= TODAY:
        if day.weekday() < 5:
            t = (day - date(2015, 1, 1)).days
            days[day] = {
                "USD": round(1.10 + 0.07 * math.sin(t / 410), 4),
                "GBP": round(0.86 + 0.03 * math.sin(t / 290), 4),
                "CAD": round(1.47 + 0.06 * math.sin(t / 350), 4),
                "INR": round(80 + t / 380 + 3 * math.sin(t / 500), 3),
                "AUD": round(1.62 + 0.07 * math.sin(t / 320), 4),
            }
        day += timedelta(days=1)
    return days


def go_offline(market: DemoMarket) -> None:
    """Swap every outside call for the example market, and refuse any other connection"""
    real_connect = socket.socket.connect

    def local_only(self, address):
        host = address[0] if isinstance(address, tuple) else address
        if host not in ("127.0.0.1", "localhost", "::1"):
            raise OSError(f"The demo doesn't use the network (tried {address})")
        return real_connect(self, address)

    socket.socket.connect = local_only
    from dividendcase.api.v1 import investment, portfolio, stocks
    from dividendcase.services import benchmark as beats, fx, refresh, yahoo_fetcher

    yahoo_fetcher.YahooFetcher.fetch_stock_light = market.fetch_stock_light
    stocks._fetch_asset_profile = lambda ticker: {}
    investment._get_benchmark_data = benchmark
    portfolio._get_benchmark_data = benchmark
    refresh.screener_universe = market.universe
    refresh.PACE_SECONDS = (0, 0)
    beats.INDEX_PAUSE_SECONDS = 0
    fx._history = lambda: rates(date(2015, 1, 1))
    fx._last_90_days = lambda: rates(TODAY - timedelta(days=90))


# ── setting it up through the app's own API ──────────────────────────────────
BASE = f"http://127.0.0.1:{args.port}"


def call(method: str, path: str, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        text = resp.read().decode()
        return json.loads(text) if text else None


def wait_for(check, what: str, timeout: float = 120):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if check():
                return
        except Exception:
            pass
        time.sleep(0.5)
    sys.exit(f"Timed out waiting for {what}")


def set_up():
    wait_for(lambda: call("GET", "/health"), "the server")
    wait_for(lambda: "EUR" in json.dumps(call("GET", "/api/v1/fx/currencies")), "exchange rates")
    call("PATCH", "/api/v1/user/preferences", {
        "home_currency": "EUR", "tax_residence": "IE", "check_for_updates": False, "complete_setup": True,
    })
    for symbol, shares, bought, price, currency in HOLDINGS:
        call("POST", "/api/v1/portfolio", {
            "ticker": symbol, "quantity": shares, "purchase_price": price,
            "purchase_date": bought, "purchase_currency": currency,
        })
    for symbol in WATCHLIST:
        call("POST", "/api/v1/watchlist", {"ticker": symbol})
    call("POST", "/api/v1/data/refresh", {"scope": "screener"})
    wait_for(lambda: call("GET", "/api/v1/data/status")["state"] == "idle"
             and call("GET", "/api/v1/data/status")["queued"] == 0, "the screener")
    wait_for(lambda: any(s.get("beats_benchmark") is not None
                         for s in call("GET", "/api/v1/stocks/top-performers?limit=2000")), "the index comparison")
    print(f"\nDemo ready: {BASE}/dashboard/  (invented numbers; data in {os.environ['DIVIDENDCASE_DATA_DIR']})\n", flush=True)


if __name__ == "__main__":
    go_offline(DemoMarket())
    from dividendcase.main import app

    threading.Thread(target=set_up, daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")
