"""Withholding tax at source (services/withholding.py) and the calendar's after-tax figures."""
import pytest

from dividendcase.services import withholding as w


@pytest.mark.parametrize("source, residence, rate, basis", [
    # An Irish resident
    ("US", "IE", 15.0, "treaty"), ("CA", "IE", 15.0, "treaty"), ("GB", "IE", 0.0, "none"),
    ("IN", "IE", 10.0, "treaty"), ("AU", "IE", 0.0, "none"), ("IE", "IE", 25.0, "domestic"),
    # An Indian resident
    ("US", "IN", 25.0, "treaty"), ("CA", "IN", 25.0, "treaty"), ("IN", "IN", 10.0, "domestic"),
    # A US resident
    ("US", "US", 0.0, "domestic"), ("CA", "US", 15.0, "treaty"), ("IE", "US", 25.0, "statutory"),
    ("IN", "US", 20.8, "statutory"),
    # A UK resident
    ("US", "GB", 15.0, "treaty"), ("IN", "GB", 15.0, "treaty"), ("GB", "GB", 0.0, "none"),
    # Somewhere else, or not set yet: statutory rates
    ("US", "ZZ", 30.0, "statutory"), ("US", None, 30.0, "statutory"), ("CA", "ZZ", 25.0, "statutory"),
])
def test_rates(source, residence, rate, basis):
    rule = w.rule_for(source, residence)
    assert (rule.rate, rule.basis) == (rate, basis)
    assert rule.note


def test_overrides_win_and_unknown_countries_are_not_estimated():
    assert w.rule_for("US", "IE", {"US": 30}).rate == 30.0
    assert w.rule_for("US", "IE", {"US": 30}).basis == "override"
    assert w.rule_for("Spain", "IE") is None
    assert w.rule_for("Spain", "IE", {"Spain": 19}).rate == 19.0
    assert w.rule_for(None, "IE") is None


def test_source_country():
    assert w.source_country("United States", "NYSE") == "US"
    assert w.source_country("United Kingdom", "NYSE") == "GB"  # a UK company listed in New York
    assert w.source_country(None, "TSX") == "CA"  # screener stocks: the exchange's country
    assert w.source_country("Unknown", "NSE") == "IN"
    assert w.source_country("Spain", "NYSE") == "Spain"  # kept by name, not mistaken for the US
    assert w.source_country(None, None) is None


def test_india_tds_threshold_for_residents():
    rule = w.rule_for("IN", "IN")
    assert w.withheld_rate(rule, "IN", "IN", yearly_amount_in_inr=8_000) == 0.0
    assert w.withheld_rate(rule, "IN", "IN", yearly_amount_in_inr=12_000) == 10.0
    assert w.withheld_rate(w.rule_for("IN", "IE"), "IN", "IE", yearly_amount_in_inr=8_000) == 10.0


def _holding(client, ticker, quantity, currency="USD", price=40.0):
    r = client.post("/api/v1/portfolio", json={"ticker": ticker, "quantity": quantity, "purchase_price": price,
                                              "purchase_date": "2023-03-01", "purchase_currency": currency})
    assert r.status_code == 201, r.text


def test_calendar_after_withholding_for_an_irish_resident(client, market):
    market.add("TESTUS", amount=0.50, price=50.0)  # a US company, quarterly
    market.add("TESTUK", currency="GBp", exchange="LSE", amount=20.0, price=2000.0)
    market.add("TESTES", amount=0.50, price=50.0, country="Spain")  # an ADR v1 doesn't estimate
    _holding(client, "TESTUS", 10)
    _holding(client, "TESTUK", 5, currency="GBp", price=1800)
    _holding(client, "TESTES", 10)
    client.patch("/api/v1/user/preferences", json={"tax_residence": "IE"})

    cal = client.get("/api/v1/portfolio/calendar").json()
    assert cal["residence"] == "IE"
    us = [e for e in cal["entries"] if e["ticker_symbol"] == "TESTUS"]
    assert us and all(e["withholding_rate"] == 15.0 and e["net_amount"] == pytest.approx(4.25) for e in us)
    assert all("W-8BEN" in e["withholding_note"] for e in us)
    uk = [e for e in cal["entries"] if e["ticker_symbol"] == "TESTUK"]
    assert all(e["withholding_rate"] == 0.0 and e["net_amount"] == e["estimated_amount"] for e in uk)
    es = [e for e in cal["entries"] if e["ticker_symbol"] == "TESTES"]
    assert all(e["withholding_rate"] is None and e["net_amount"] == e["estimated_amount"] for e in es)
    assert cal["unestimated_sources"] == ["Spain"]
    assert cal["net_currency_totals"]["USD"] == pytest.approx(4 * 4.25 + 4 * 5.0)  # US net + Spain gross
    assert cal["net_currency_totals"]["GBp"] == pytest.approx(cal["currency_totals"]["GBp"])

    # The rate the broker actually takes, set in Settings, wins
    client.patch("/api/v1/user/preferences", json={"withholding_overrides": {"US": 30, "Spain": 19}})
    cal = client.get("/api/v1/portfolio/calendar").json()
    assert all(e["net_amount"] == pytest.approx(3.5) for e in cal["entries"] if e["ticker_symbol"] == "TESTUS")
    assert all(e["withholding_rate"] == 19.0 for e in cal["entries"] if e["ticker_symbol"] == "TESTES")
    assert cal["unestimated_sources"] == []

    # null removes an override
    prefs = client.patch("/api/v1/user/preferences", json={"withholding_overrides": {"US": None}}).json()
    assert prefs["withholding_overrides"] == {"Spain": 19.0}


def test_withholding_table_lists_the_rates_and_your_countries(client, market):
    market.add("TESTUS")
    market.add("TESTES", country="Spain")
    _holding(client, "TESTUS", 1)
    _holding(client, "TESTES", 1)
    client.patch("/api/v1/user/preferences", json={"tax_residence": "IE", "withholding_overrides": {"CA": 20}})

    table = client.get("/api/v1/withholding").json()
    assert table["residence"] == "IE" and table["residence_name"] == "Ireland"
    rows = {r["source"]: r for r in table["rows"]}
    assert rows["US"]["rate"] == 15.0 and rows["US"]["your_stocks"] == ["TESTUS"]
    assert rows["CA"]["rate"] == 20.0 and rows["CA"]["basis"] == "override" and rows["CA"]["default_rate"] == 15.0
    assert rows["Spain"]["rate"] is None and rows["Spain"]["your_stocks"] == ["TESTES"]

    one = client.get("/api/v1/withholding", params={"ticker": "testus"}).json()["for_stock"]
    assert one == {"ticker": "TESTUS", "source": "US", "source_name": "United States", "rate": 15.0,
                   "basis": "treaty", "note": one["note"]}
    assert client.get("/api/v1/withholding", params={"ticker": "NOPE"}).json()["for_stock"] is None


def test_overrides_are_validated(client):
    assert client.patch("/api/v1/user/preferences", json={"withholding_overrides": {"US": 130}}).status_code == 422
    assert client.patch("/api/v1/user/preferences", json={"withholding_overrides": {"": 10}}).status_code == 422
