"""Daily price history for the price charts: downloaded once, kept, refreshed after 12 hours.

Through the real app and a real SQLite file; the bars are FakeMarket's invented numbers.
"""
import asyncio
import sqlite3
import time
from datetime import date, datetime, timedelta, timezone

import pytest

from conftest import DATA_DIR, REAL


def add_holding(client, ticker):
    r = client.post("/api/v1/portfolio", json={
        "ticker": ticker, "quantity": 10, "purchase_price": 40.0,
        "purchase_date": "2023-03-01", "purchase_currency": "USD",
    })
    assert r.status_code == 201, r.text


def price_downloads(market, ticker) -> int:
    return market.calls.count(f"prices:{ticker}")


def stored_bars(ticker) -> int:
    con = sqlite3.connect(DATA_DIR / "dividendcase.db")
    try:
        return con.execute("SELECT COUNT(*) FROM price_bars WHERE ticker_symbol = ?", (ticker,)).fetchone()[0]
    finally:
        con.close()


def downloaded_hours_ago(ticker, hours):
    """Make the stored bars look as if they were downloaded `hours` ago."""
    when = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=hours)
    con = sqlite3.connect(DATA_DIR / "dividendcase.db")
    try:
        con.execute("UPDATE stocks SET prices_fetched_at = ? WHERE ticker_symbol = ?",
                    (when.strftime("%Y-%m-%d %H:%M:%S.%f"), ticker))
        con.commit()
    finally:
        con.close()


@pytest.fixture
def yahoo_down(monkeypatch):
    """Make the price download fail with the given error (a plain network error by default)."""
    from dividendcase.services import yahoo_fetcher

    def fail_with(error=None):
        def fetch_price_history(self, symbol, years=10):
            raise error or ConnectionError("network is unreachable")
        monkeypatch.setattr(yahoo_fetcher.YahooFetcher, "fetch_price_history", fetch_price_history)

    return fail_with


# ── the endpoint ─────────────────────────────────────────────────────────────
def test_the_first_request_downloads_and_stores_ten_years(client, market):
    market.add("TESTPA", price=50.0)
    add_holding(client, "TESTPA")
    assert price_downloads(market, "TESTPA") == 0  # adding a holding doesn't download prices

    r = client.get("/api/v1/stocks/testpa/prices")  # tickers are upper-cased
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["ticker"] == "TESTPA" and data["currency"] == "USD" and data["stale"] is False
    assert data["fetched_at"].endswith("Z")
    assert price_downloads(market, "TESTPA") == 1

    bars = data["bars"]
    assert 2500 < len(bars) < 2700  # weekdays over ten years
    assert stored_bars("TESTPA") >= len(bars)
    assert set(bars[0]) == {"date", "open", "high", "low", "close", "adj_close", "volume"}
    assert all(isinstance(bars[-1][k], float) for k in ("open", "high", "low", "close", "adj_close"))
    assert isinstance(bars[-1]["volume"], int)
    dates = [b["date"] for b in bars]
    assert dates == sorted(dates) and len(set(dates)) == len(dates)
    assert date.fromisoformat(dates[-1]) > date.today() - timedelta(days=4)
    assert all(date.fromisoformat(d).weekday() < 5 for d in dates)
    assert all(b["low"] <= b["close"] <= b["high"] and b["adj_close"] < b["close"] for b in bars)


def test_the_next_request_comes_from_the_database(client, market):
    market.add("TESTPB")
    add_holding(client, "TESTPB")
    first = client.get("/api/v1/stocks/TESTPB/prices").json()
    second = client.get("/api/v1/stocks/TESTPB/prices").json()
    assert price_downloads(market, "TESTPB") == 1
    assert second == first


def test_prices_older_than_12_hours_are_downloaded_again(client, market):
    market.add("TESTPC")
    add_holding(client, "TESTPC")
    client.get("/api/v1/stocks/TESTPC/prices")
    stored = stored_bars("TESTPC")

    downloaded_hours_ago("TESTPC", 11)
    client.get("/api/v1/stocks/TESTPC/prices")
    assert price_downloads(market, "TESTPC") == 1  # still fresh

    downloaded_hours_ago("TESTPC", 13)
    data = client.get("/api/v1/stocks/TESTPC/prices").json()
    assert price_downloads(market, "TESTPC") == 2
    assert data["stale"] is False
    fetched = datetime.fromisoformat(data["fetched_at"].replace("Z", "+00:00"))
    assert datetime.now(timezone.utc) - fetched < timedelta(minutes=5)
    assert stored_bars("TESTPC") == stored  # replaced, not added to


def test_years_cuts_the_history(client, market):
    market.add("TESTPD")
    add_holding(client, "TESTPD")
    ten = client.get("/api/v1/stocks/TESTPD/prices").json()["bars"]
    one = client.get("/api/v1/stocks/TESTPD/prices", params={"years": 1}).json()["bars"]
    five = client.get("/api/v1/stocks/TESTPD/prices", params={"years": 5}).json()["bars"]
    assert price_downloads(market, "TESTPD") == 1  # always ten years downloaded, cut on the way out
    assert 250 < len(one) < 265 and 1290 < len(five) < 1315 and len(ten) > len(five)
    assert date.fromisoformat(one[0]["date"]) >= date.today() - timedelta(days=366)
    assert one == ten[-len(one):]

    for years in (0, 11):
        assert client.get("/api/v1/stocks/TESTPD/prices", params={"years": years}).status_code == 422


def test_a_stock_that_is_not_stored_is_404(client, market):
    r = client.get("/api/v1/stocks/NOPE/prices")
    assert r.status_code == 404
    assert r.json()["detail"] == "Stock NOPE not found in database"
    assert price_downloads(market, "NOPE") == 0


def test_a_failed_download_with_nothing_stored_is_503(client, market, yahoo_down):
    market.add("TESTPE")
    add_holding(client, "TESTPE")
    yahoo_down()
    r = client.get("/api/v1/stocks/TESTPE/prices")
    assert r.status_code == 503
    assert r.json()["detail"] == (
        "Couldn't download the price history for TESTPE from Yahoo Finance. "
        "Check your internet connection and try again."
    )
    assert stored_bars("TESTPE") == 0


def test_a_cooldown_says_how_long_to_wait(client, market, yahoo_down):
    from dividendcase.services.yahoo_fetcher import CooldownActiveError

    market.add("TESTPF")
    add_holding(client, "TESTPF")
    yahoo_down(CooldownActiveError(230))
    r = client.get("/api/v1/stocks/TESTPF/prices")
    assert r.status_code == 503
    assert r.json()["detail"] == (
        "Yahoo Finance asked this computer to slow down. Price history will load in about 4 minutes."
    )


def test_no_prices_from_yahoo_with_nothing_stored_is_503(client, market, monkeypatch):
    from dividendcase.services import yahoo_fetcher

    market.add("TESTPG")
    add_holding(client, "TESTPG")
    monkeypatch.setattr(yahoo_fetcher.YahooFetcher, "fetch_price_history", lambda self, symbol, years=10: [])
    r = client.get("/api/v1/stocks/TESTPG/prices")
    assert r.status_code == 503
    assert r.json()["detail"] == "Yahoo Finance has no price history for TESTPG."


def test_a_failed_download_serves_the_stored_bars_as_stale(client, market, yahoo_down):
    market.add("TESTPH")
    add_holding(client, "TESTPH")
    fresh = client.get("/api/v1/stocks/TESTPH/prices").json()
    downloaded_hours_ago("TESTPH", 30)

    yahoo_down()
    r = client.get("/api/v1/stocks/TESTPH/prices")
    assert r.status_code == 200
    data = r.json()
    assert data["stale"] is True
    assert data["bars"] == fresh["bars"]
    fetched = datetime.fromisoformat(data["fetched_at"].replace("Z", "+00:00"))
    assert datetime.now(timezone.utc) - fetched > timedelta(hours=29)  # when they were downloaded


def test_a_stock_without_dividends_has_prices(client, market):
    market.add_non_payer("TESTPN", price=25.0)
    add_holding(client, "TESTPN")
    assert client.get("/api/v1/dividends/TESTPN").status_code == 404  # no dividend history
    r = client.get("/api/v1/stocks/TESTPN/prices")
    assert r.status_code == 200
    closes = [b["close"] for b in r.json()["bars"]]
    assert closes and 20 < sum(closes) / len(closes) < 30


def test_two_requests_for_the_same_stock_download_once(client, market, monkeypatch):
    from dividendcase.crud.stock import get_stock
    from dividendcase.database import AsyncSessionLocal
    from dividendcase.services import yahoo_fetcher
    from dividendcase.services.prices import get_price_bars

    market.add("TESTPI")
    add_holding(client, "TESTPI")

    def slow_download(self, symbol, years=10):
        time.sleep(0.2)  # long enough for the second request to arrive while this one runs
        return market.fetch_price_history(symbol, years)

    monkeypatch.setattr(yahoo_fetcher.YahooFetcher, "fetch_price_history", slow_download)

    async def one_request():
        async with AsyncSessionLocal() as db:
            stock = await get_stock(db, "TESTPI")
            bars, stale = await get_price_bars(db, stock, 10)
            return len(bars), stale

    async def two_at_once():
        return await asyncio.gather(one_request(), one_request())

    first, second = client.portal.call(two_at_once)
    assert price_downloads(market, "TESTPI") == 1
    assert first == second and first[0] > 2500 and first[1] is False


# ── reading Yahoo's chart response ───────────────────────────────────────────
def _stamp(*args) -> int:
    return int(datetime(*args, tzinfo=timezone.utc).timestamp())


SYDNEY_CHART = {"chart": {"result": [{
    "meta": {"currency": "AUD", "gmtoffset": 36000},  # UTC+10
    "timestamp": [
        _stamp(2026, 3, 1, 23, 0),  # 09:00 on 2 March in Sydney
        _stamp(2026, 3, 2, 23, 0),  # 3 March: no close, so left out
        _stamp(2026, 3, 3, 23, 0),  # 4 March
        _stamp(2026, 3, 4, 5, 0),  # 4 March again, later in the day: replaces the one before
    ],
    "indicators": {
        "quote": [{
            "open": [10.0, 10.5, 10.8, None],
            "high": [10.4, 10.9, 11.1, 11.5],
            "low": [9.9, 10.1, 10.7, 11.0],
            "close": [10.123456, None, 11.0, 11.3],
            "volume": [1000, 2000, 3000, 4000],
        }],
        "adjclose": [{"adjclose": [None, 9.9, 10.4, 10.7]}],
    },
}]}}


def test_parse_chart_bars_dates_each_bar_by_the_exchange_day():
    from dividendcase.services.yahoo_fetcher import parse_chart_bars

    assert parse_chart_bars(SYDNEY_CHART) == [
        # adj_close falls back to close when Yahoo leaves it out
        {"bar_date": date(2026, 3, 2), "open": 10.0, "high": 10.4, "low": 9.9,
         "close": 10.1235, "adj_close": 10.1235, "volume": 1000},
        {"bar_date": date(2026, 3, 4), "open": None, "high": 11.5, "low": 11.0,
         "close": 11.3, "adj_close": 10.7, "volume": 4000},
    ]

    # Read in UTC, the first session would land on the day before
    import copy
    in_utc = copy.deepcopy(SYDNEY_CHART)
    del in_utc["chart"]["result"][0]["meta"]["gmtoffset"]
    assert parse_chart_bars(in_utc)[0]["bar_date"] == date(2026, 3, 1)


def test_parse_chart_bars_without_adjusted_closes_or_a_result():
    from dividendcase.services.yahoo_fetcher import parse_chart_bars

    no_adjclose = {"chart": {"result": [{
        "meta": {"gmtoffset": -14400},  # New York in summer
        "timestamp": [_stamp(2026, 6, 1, 13, 30), _stamp(2026, 6, 2, 13, 30)],
        "indicators": {"quote": [{"close": [41.3, 41.7], "volume": [None, 12_000_000]}]},
    }]}}
    bars = parse_chart_bars(no_adjclose)
    assert [b["bar_date"] for b in bars] == [date(2026, 6, 1), date(2026, 6, 2)]
    assert [b["adj_close"] for b in bars] == [41.3, 41.7]
    assert bars[0]["open"] is None and bars[0]["volume"] is None and bars[1]["volume"] == 12_000_000

    assert parse_chart_bars({"chart": {"result": None}}) == []
    assert parse_chart_bars({}) == []
    assert parse_chart_bars({"chart": {"result": [{"meta": {}, "indicators": {}}]}}) == []


def test_bars_yahoo_forgot_to_adjust_for_a_split_are_left_out():
    from dividendcase.services.yahoo_fetcher import drop_misadjusted_bars

    def bars(*closes):
        return [{"bar_date": date(2019, 12, 16 + i), "close": c} for i, c in enumerate(closes)]

    # Two days at a hundredth of the price either side, as GOLDBEES.NS has around its split
    kept = drop_misadjusted_bars(bars(33.44, 33.50, 0.3355, 0.3365, 33.65, 33.75))
    assert [b["close"] for b in kept] == [33.44, 33.50, 33.65, 33.75]
    # The same at a hundred times the price
    assert [b["close"] for b in drop_misadjusted_bars(bars(5.0, 500.0, 5.1))] == [5.0, 5.1]

    # Real moves stay: a crash that doesn't come back, a recovery that takes longer than the
    # run, a halving at the end of the history, and big but ordinary days
    for closes in [(10.0, 3.0, 3.1, 3.2), (10.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 10.0), (10.0, 10.2, 3.3), (10.0, 6.5, 9.8)]:
        assert drop_misadjusted_bars(bars(*closes)) == bars(*closes)
    assert drop_misadjusted_bars([]) == []


def test_the_download_asks_the_chart_api_for_daily_bars(monkeypatch):
    from dividendcase.services import yahoo_fetcher

    seen = {}

    class Response:
        status_code = 200

        def json(self):
            return SYDNEY_CHART

        def raise_for_status(self):
            pass

    def get(url, **kw):
        seen.update(url=url, params=kw["params"])
        return Response()

    monkeypatch.setattr(yahoo_fetcher, "_CURL_AVAILABLE", False)
    monkeypatch.setattr(yahoo_fetcher.requests, "get", get)
    bars = REAL["fetch_price_history"](yahoo_fetcher.YahooFetcher(), "TESTX.AX", 10)
    assert seen["url"] == "https://query2.finance.yahoo.com/v8/finance/chart/TESTX.AX"
    assert seen["params"] == {"interval": "1d", "range": "10y", "events": "div,splits"}
    assert [b["bar_date"] for b in bars] == [date(2026, 3, 2), date(2026, 3, 4)]


def test_the_download_waits_out_a_cooldown(monkeypatch):
    from dividendcase.services import yahoo_fetcher

    monkeypatch.setattr(yahoo_fetcher, "_cooldown_until", time.time() + 120)
    monkeypatch.setattr(yahoo_fetcher.requests, "get", lambda url, **kw: pytest.fail("asked Yahoo during a cooldown"))
    with pytest.raises(yahoo_fetcher.CooldownActiveError):
        REAL["fetch_price_history"](yahoo_fetcher.YahooFetcher(), "TESTX", 10)
