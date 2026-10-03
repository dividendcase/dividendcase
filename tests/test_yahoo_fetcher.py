"""How the light Yahoo fetch reads a chart response (invented responses, no network)."""
from datetime import datetime, timedelta

import pytest

from conftest import REAL


class _Response:
    status_code = 200

    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload

    def raise_for_status(self):
        pass


def _chart(closes, dividends=None):
    """A chart response with one close a day up to today, and dividends by day index."""
    start = datetime.now() - timedelta(days=len(closes))
    stamps = [int((start + timedelta(days=i)).timestamp()) for i in range(len(closes))]
    result = {
        "meta": {"currency": "USD", "exchangeName": "NYQ", "longName": "Invented Holdings"},
        "timestamp": stamps,
        "indicators": {"quote": [{"close": closes}]},
    }
    if dividends:
        result["events"] = {"dividends": {str(stamps[i]): {"amount": a, "date": stamps[i]} for i, a in dividends.items()}}
    return {"chart": {"result": [result]}}


@pytest.fixture
def chart_api(monkeypatch):
    """Serve one chart response to the real light fetch."""
    from dividendcase.services import yahoo_fetcher

    monkeypatch.setattr(yahoo_fetcher, "_CURL_AVAILABLE", False)

    def serve(payload):
        monkeypatch.setattr(yahoo_fetcher.requests, "get", lambda url, **kw: _Response(payload))

    return serve


def light_fetch(symbol):
    from dividendcase.services.yahoo_fetcher import YahooFetcher

    return REAL["fetch_stock_light"](YahooFetcher(), symbol, 10, False)


def test_a_stock_without_dividends_comes_back_with_its_price(chart_api):
    chart_api(_chart([10.0, 11.0, None, 12.5]))
    stock, records = light_fetch("TESTN")
    assert records == []
    assert stock["last_price"] == 12.5
    assert stock["avg_dividend_yield"] is None
    assert stock["company_name"] == "Invented Holdings"


def test_a_payer_comes_back_with_its_latest_close(chart_api):
    chart_api(_chart([20.0, 20.0, 21.0, 22.0], dividends={1: 0.25}))
    stock, records = light_fetch("TESTA")
    assert len(records) == 1 and records[0]["share_price_on_dividend_date"] == 20.0
    assert stock["last_price"] == 22.0


def test_a_ticker_without_prices_or_dividends_is_not_stored(chart_api):
    chart_api({"chart": {"result": [{"meta": {}, "timestamp": [], "indicators": {"quote": [{"close": []}]}}]}})
    assert light_fetch("NOPE") == (None, [])
