"""Which stocks beat their local index (the screener's filter)."""
from datetime import date, timedelta

import pandas as pd
import pytest

from dividendcase.services.benchmark import index_return, stock_return


def _monthly(start: str, months: int, price_from: float, price_to: float, dividends_to: float = 0.0) -> pd.DataFrame:
    index = pd.date_range(start, periods=months, freq="ME")
    steps = [i / (months - 1) for i in range(months)]
    return pd.DataFrame({
        "price": [price_from + (price_to - price_from) * s for s in steps],
        "cumulative_divs": [dividends_to * s for s in steps],
    }, index=index)


def test_index_return_counts_price_and_dividends_since_a_date():
    monthly = _monthly("2016-01-31", 121, 100.0, 200.0, dividends_to=20.0)
    assert index_return(monthly, date(2016, 1, 1)) == pytest.approx(2.2)  # (200 + 20) / 100
    # From the first month-end on or after 15 Jan 2021 (exactly halfway): 150 → 200, dividends 10 → 20
    assert index_return(monthly, date(2021, 1, 15)) == pytest.approx((200 + 20 - 10) / 150)
    assert index_return(pd.DataFrame(), date(2020, 1, 1)) is None


def test_stock_return_buys_at_the_first_price():
    rows = [(date(2020, 1, 1), 1.0, 50.0), (date(2021, 1, 1), 1.0, 55.0), (date(2022, 1, 1), 1.0, 60.0)]
    since, ratio = stock_return(rows)
    assert since == date(2020, 1, 1)
    assert ratio == pytest.approx((60 + 2) / 50)  # dividends after the first date only
    assert stock_return(rows[:1]) is None


@pytest.fixture
def flat_index(monkeypatch):
    """An index that goes nowhere for ten years and pays nothing: ratio 1.0."""
    from dividendcase.api.v1 import investment

    monthly = _monthly((date.today() - timedelta(days=3700)).isoformat(), 124, 100.0, 100.0)
    monkeypatch.setattr(investment, "_get_benchmark_data", lambda ticker, year: (100.0, monthly))


def test_screener_marks_stocks_that_beat_their_index(client, market, flat_index):
    from dividendcase.services.benchmark import compute_beats_benchmark

    market.add("TESTWIN", price_start=40.0, price=60.0, years=6)  # up 50%, plus dividends
    market.add("TESTLOSE", price_start=80.0, price=40.0, amount=0.2, years=6)  # halved
    market.add("TESTNEW", years=2)  # too short to judge
    for t in ("TESTWIN", "TESTLOSE", "TESTNEW"):
        client.post("/api/v1/watchlist", json={"ticker": t})
    from conftest import wait_until_idle
    wait_until_idle(client)

    beat, judged = client.portal.call(compute_beats_benchmark)
    assert judged == 2 and beat == 1

    stocks = {s["ticker_symbol"]: s for s in client.get("/api/v1/stocks/top-performers", params={"limit": 2000}).json()}
    assert stocks["TESTWIN"]["beats_benchmark"] is True
    assert stocks["TESTLOSE"]["beats_benchmark"] is False
    assert stocks["TESTNEW"]["beats_benchmark"] is None
    assert stocks["TESTWIN"]["benchmark_ticker"] == "SPY"

    only_winners = client.get("/api/v1/stocks/top-performers", params={"beatsBenchmark": "true", "limit": 2000}).json()
    assert [s["ticker_symbol"] for s in only_winners] == ["TESTWIN"]
