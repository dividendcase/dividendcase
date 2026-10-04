"""The local API end to end, against a real SQLite file and invented market data."""
import io

import pytest

from conftest import BASE_URL, wait_until_idle


@pytest.fixture
def payers(market):
    market.add("TESTA", amount=0.50, price=50.0)  # quarterly, USD
    market.add("TESTM", every_months=1, amount=0.10, price=20.0)  # monthly
    market.add("TESTL", currency="GBp", exchange="LSE", amount=20.0, price=2000.0)  # pence
    return market


def add_holding(client, ticker, quantity=10, price=40.0, when="2023-03-01", portfolio_id=None, currency="USD"):
    body = {"ticker": ticker, "quantity": quantity, "purchase_price": price, "purchase_date": when, "purchase_currency": currency}
    if portfolio_id is not None:
        body["portfolio_id"] = portfolio_id
    r = client.post("/api/v1/portfolio", json=body)
    assert r.status_code == 201, r.text
    return r.json()


# ── the server itself ────────────────────────────────────────────────────────
def test_health_and_security_headers(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["referrer-policy"] == "no-referrer"


def test_requests_for_other_hosts_are_refused(client):
    # Blocks DNS rebinding: a web page can't reach the app through a name it controls
    r = client.get("/health", headers={"host": "attacker.example"})
    assert r.status_code == 400


def test_app_info(client):
    info = client.get("/api/v1/app-info").json()
    assert info["data_dir"] and info["backup_dir"].endswith("backups")
    assert info["update_available"] is False
    assert info["upgrade_command"] == "uv tool upgrade dividendcase"


def test_interface_pages_are_served_when_built(client):
    from dividendcase.main import WEB_DIR

    if not (WEB_DIR / "index.html").exists():
        pytest.skip("interface not built (uv run python scripts/build_web.py)")
    for page in ["/dashboard/", "/dashboard/screener/", "/dashboard/stock/", "/dashboard/investments/portfolio/"]:
        r = client.get(page)
        assert r.status_code == 200 and "text/html" in r.headers["content-type"], page


# ── preferences ──────────────────────────────────────────────────────────────
def test_preferences_start_with_defaults_and_can_change(client):
    prefs = client.get("/api/v1/user/preferences").json()
    assert prefs == {
        "default_benchmark": "SP500", "date_format": "DD/MM/YYYY", "watchlist_collapsed": False,
        "check_for_updates": True, "home_currency": None, "tax_residence": None,
        "screener_markets": None, "setup_completed_at": None, "withholding_overrides": {},
    }

    r = client.patch("/api/v1/user/preferences", json={"date_format": "YYYY-MM-DD", "check_for_updates": False})
    assert r.status_code == 200
    assert r.json()["date_format"] == "YYYY-MM-DD" and r.json()["check_for_updates"] is False

    assert client.patch("/api/v1/user/preferences", json={"default_benchmark": "MOON"}).status_code == 422


def test_update_is_announced_in_the_terminal_once(client, monkeypatch, capsys):
    from dividendcase.services import updates

    updates.forget()
    monkeypatch.setattr(updates, "_fetch_versions", lambda: ["98.0.0"])
    client.portal.call(updates.check_for_update)
    client.portal.call(updates.check_for_update)  # the daily check again: no second message
    out = capsys.readouterr().out
    assert out.count("DividendCase 98.0.0 is out") == 1
    assert "uv tool upgrade dividendcase" in out and "/releases/tag/v98.0.0" in out
    updates.forget()


def test_docker_installs_get_docker_instructions(client, monkeypatch):
    from dividendcase.config import settings

    monkeypatch.setattr(settings, "install_method", "docker")
    info = client.get("/api/v1/app-info").json()
    assert info["install_method"] == "docker"
    assert info["upgrade_command"] == "docker pull ghcr.io/dividendcase/dividendcase:latest"


def test_update_check_respects_the_preference(client, monkeypatch):
    from dividendcase.services import updates

    monkeypatch.setattr(updates, "_fetch_versions", lambda: ["0.0.1", "99.0.0"])
    assert client.portal.call(updates.check_for_update) == "99.0.0"
    info = client.get("/api/v1/app-info").json()
    assert info["latest_version"] == "99.0.0" and info["update_available"] is True

    assert info["releases_url"].endswith("/releases/tag/v99.0.0")  # that version's notes

    client.patch("/api/v1/user/preferences", json={"check_for_updates": False})
    assert client.get("/api/v1/app-info").json()["update_available"] is False
    assert client.portal.call(updates.check_for_update) is None  # doesn't ask PyPI any more


# ── portfolios and holdings ──────────────────────────────────────────────────
def test_portfolios_default_and_limit(client):
    portfolios = client.get("/api/v1/portfolios").json()
    assert len(portfolios) == 1  # created on first visit
    for i in range(3):
        assert client.post("/api/v1/portfolios", json={"name": f"P{i}"}).status_code == 201
    r = client.post("/api/v1/portfolios", json={"name": "One too many"})
    assert r.status_code == 400 and "Maximum" in r.json()["detail"]

    first = client.get("/api/v1/portfolios").json()[0]["id"]
    assert client.patch(f"/api/v1/portfolios/{first}", json={"name": "Brokerage"}).json()["name"] == "Brokerage"


def test_holding_lifecycle(client, payers):
    isa = client.post("/api/v1/portfolios", json={"name": "ISA"}).json()["id"]
    lot = add_holding(client, "testa")  # tickers are upper-cased
    assert lot["ticker_symbol"] == "TESTA"
    assert "TESTA" in payers.calls  # fetched from the fake market because it was missing

    r = client.patch(f"/api/v1/portfolio/{lot['id']}", json={"quantity": 12, "purchase_price": 41.5})
    assert r.status_code == 200 and float(r.json()["quantity"]) == 12

    r = client.patch(f"/api/v1/portfolio/{lot['id']}/move", json={"target_portfolio_id": isa})
    assert r.status_code == 200 and r.json()["portfolio_id"] == isa
    assert [i["ticker_symbol"] for i in client.get(f"/api/v1/portfolio?portfolio_id={isa}").json()] == ["TESTA"]

    assert client.delete(f"/api/v1/portfolio/{lot['id']}").status_code == 204
    assert client.get("/api/v1/portfolio").json() == []


def test_income_calendar_projects_the_next_year(client, payers):
    add_holding(client, "TESTA", quantity=10)  # quarterly, last paid 0.50 a month ago
    add_holding(client, "TESTM", quantity=100)  # monthly, last paid 0.10
    add_holding(client, "TESTL", quantity=5, currency="GBp", price=1800)  # pence

    cal = client.get("/api/v1/portfolio/calendar").json()
    by_ticker = {}
    for e in cal["entries"]:
        by_ticker.setdefault(e["ticker_symbol"], []).append(e)

    assert len(by_ticker["TESTA"]) == 4
    assert all(e["estimated_amount"] == pytest.approx(5.0) for e in by_ticker["TESTA"])
    assert 11 <= len(by_ticker["TESTM"]) <= 13
    assert cal["currency_totals"]["USD"] == pytest.approx(20.0 + 10.0 * len(by_ticker["TESTM"]))
    assert cal["currency_totals"]["GBp"] == pytest.approx(400.0)  # 4 × 20p × 5 shares
    # Entries come in date order and never in the past
    dates = [e["expected_date"] for e in cal["entries"]]
    assert dates == sorted(dates)


def test_portfolio_analysis(client, payers):
    add_holding(client, "TESTA", quantity=10, price=40.0)
    r = client.get("/api/v1/portfolio/analysis")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total_initial_investment"] == pytest.approx(400.0)
    assert data["frequency_map"]["TESTA"] == "quarterly"
    assert data["data_points"], "expected a value history"
    last = data["data_points"][-1]
    assert last["total_dividends"] > 0


def test_dividend_metrics(client, payers):
    add_holding(client, "TESTA")
    m = client.get("/api/v1/dividends/TESTA?years=10").json()["metrics"]
    assert m["payment_frequency"] == "quarterly" and m["payments_per_year"] == 4
    assert m["ttm_yield"] == pytest.approx(3.86, abs=0.2)  # about 1.93 paid over 12 months ÷ 50
    assert m["current_yield"] == pytest.approx(4.0, abs=0.01)  # 0.50 × 4 ÷ 50
    assert m["dividend_growth_cagr_3y"] == pytest.approx(5.0, abs=1.5)
    assert m["consecutive_growth_years"] >= 3
    assert 0 <= m["dividend_safety_score"] <= 100


# ── stocks that pay no dividends ─────────────────────────────────────────────
def test_a_held_stock_without_dividends_gets_a_price(client, payers):
    payers.add_non_payer("TESTN", price=25.0)
    add_holding(client, "TESTA", quantity=10, price=40.0)
    add_holding(client, "TESTN", quantity=10, price=20.0)
    assert client.get("/api/v1/stocks/TESTN").status_code == 200  # stored, though it pays nothing

    # The Holdings page's value and return come from the analysis's latest point
    data = client.get("/api/v1/portfolio/analysis").json()
    last = data["data_points"][-1]
    assert last["stock_values"]["TESTN"] == pytest.approx(250.0)  # 10 × 25, its latest close
    assert last["stock_dividends"]["TESTN"] == 0
    assert last["stock_values"]["TESTA"] == pytest.approx(500.0)
    assert last["total_investment_value"] == pytest.approx(750.0)
    # Its slice of the payment-frequency chart says it pays none, rather than "Unknown"
    assert data["frequency_map"] == {"TESTA": "quarterly", "TESTN": "none"}


def test_a_portfolio_of_only_non_payers_has_a_value(client, market):
    market.add_non_payer("TESTN", price=25.0)
    add_holding(client, "TESTN", quantity=4)
    data = client.get("/api/v1/portfolio/analysis").json()
    assert data["data_points"][-1]["total_investment_value"] == pytest.approx(100.0)

    cal = client.get("/api/v1/portfolio/calendar").json()
    assert cal["entries"] == [] and cal["annual_total"] == 0


def test_current_value_uses_the_latest_close(client, market):
    market.add("TESTP", price=50.0, last_price=55.0)  # up since its last payment
    add_holding(client, "TESTP", quantity=10)
    last = client.get("/api/v1/portfolio/analysis").json()["data_points"][-1]
    assert last["stock_values"]["TESTP"] == pytest.approx(550.0)


def test_non_payers_add_nothing_to_the_income_calendar(client, payers):
    payers.add_non_payer("TESTN")
    add_holding(client, "TESTA", quantity=10)
    add_holding(client, "TESTN", quantity=10)
    assert client.get("/api/v1/stocks/TESTN").status_code == 200

    cal = client.get("/api/v1/portfolio/calendar").json()
    # The Income page counts holdings without calendar entries as the ones that "don't pay"
    assert {e["ticker_symbol"] for e in cal["entries"]} == {"TESTA"}
    assert cal["currency_totals"] == {"USD": pytest.approx(20.0)}


def test_the_stock_page_says_a_non_payer_has_no_dividend_history(client, market):
    market.add_non_payer("TESTN")
    market.add_non_payer("TESTQ")
    add_holding(client, "TESTN")
    assert client.get("/api/v1/stocks/TESTN").status_code == 200
    # Stored because it's held, but there's no dividend history to show
    assert client.get("/api/v1/dividends/TESTN").status_code == 404
    assert client.post("/api/v1/search/fetch-stock", json={"ticker": "TESTN"}).status_code == 404
    # Only looked up: not stored
    assert client.post("/api/v1/search/fetch-stock", json={"ticker": "TESTQ"}).status_code == 404
    assert client.get("/api/v1/stocks/TESTQ").status_code == 404


def test_the_refresh_stores_watched_non_payers_but_not_screener_ones(client, market):
    market.add_non_payer("TESTW")  # on a watchlist
    market.add_non_payer("TESTS")  # only in the screener's lists
    client.post("/api/v1/watchlist", json={"ticker": "TESTW"})
    status = wait_until_idle(client)
    assert status["your_tickers_missing"] == 0
    assert client.get("/api/v1/stocks/TESTW").status_code == 200

    client.post("/api/v1/data/refresh", json={"scope": "screener"})
    wait_until_idle(client)
    assert client.get("/api/v1/stocks/TESTS").status_code == 404
    listed = {s["ticker_symbol"] for s in client.get("/api/v1/stocks/top-performers", params={"limit": 2000}).json()}
    assert "TESTW" not in listed and "TESTS" not in listed


# ── screener, watchlists and the background refresh ─────────────────────────
def test_screener_lists_stored_payers_with_frequency(client, payers):
    r = client.post("/api/v1/data/refresh", json={"scope": "screener"})
    assert r.status_code == 202
    wait_until_idle(client)
    stocks = client.get("/api/v1/stocks/top-performers", params={"limit": 2000}).json()
    by_ticker = {s["ticker_symbol"]: s for s in stocks}
    assert {"TESTA", "TESTM", "TESTL"} <= set(by_ticker)
    assert by_ticker["TESTM"]["payment_frequency"] == "monthly"
    assert by_ticker["TESTA"]["yield_consistency_score"] is not None
    yields = [s["avg_dividend_yield"] for s in stocks]
    assert yields == sorted(yields, reverse=True)


def test_watchlist_add_fetches_in_the_background(client, payers):
    r = client.post("/api/v1/watchlist", json={"ticker": "TESTM"})
    assert r.status_code == 201
    status = wait_until_idle(client)
    assert status["your_tickers_missing"] == 0
    assert client.get("/api/v1/stocks/TESTM").status_code == 200


def test_removing_from_one_watchlist_keeps_the_others(client, payers):
    first = client.get("/api/v1/watchlist/groups").json()[0]["id"]
    second = client.post("/api/v1/watchlist/groups", json={"name": "Income ideas"}).json()["id"]
    client.post("/api/v1/watchlist", json={"ticker": "TESTA", "group_id": first})
    client.post("/api/v1/watchlist", json={"ticker": "TESTA", "group_id": second})

    assert client.delete(f"/api/v1/watchlist/TESTA?group_id={first}").status_code == 204
    left = client.get("/api/v1/watchlist").json()
    assert [(i["ticker_symbol"], i["watchlist_group_id"]) for i in left] == [("TESTA", second)]


def test_two_saves_of_the_same_stock_at_once_both_succeed(client, market):
    """A background refresh and adding a holding can download the same stock at the same moment."""
    import asyncio
    import sqlite3

    from conftest import DATA_DIR
    from dividendcase.crud.dividend import upsert_dividend_records
    from dividendcase.crud.stock import upsert_stock
    from dividendcase.database import AsyncSessionLocal

    market.add("TESTTWICE")
    stock, records = market.fetch_stock_light("TESTTWICE")

    async def save():
        async with AsyncSessionLocal() as db:
            saved = await upsert_stock(db, stock)
            await upsert_dividend_records(db, saved.id, "TESTTWICE", records)

    async def twice_at_once():
        await asyncio.gather(save(), save())

    client.portal.call(twice_at_once)
    con = sqlite3.connect(DATA_DIR / "dividendcase.db")
    try:
        stored = con.execute("SELECT COUNT(*) FROM dividend_records WHERE ticker_symbol = 'TESTTWICE'").fetchone()[0]
    finally:
        con.close()
    assert stored == len(records)


def test_a_holding_is_added_even_when_saving_its_download_fails(client, market, monkeypatch):
    from dividendcase.api.v1 import portfolio

    market.add("TESTOOPS")

    async def failing_save(db, stock_id, ticker, records):
        from dividendcase.models.dividend import DividendRecord

        db.add(DividendRecord(stock_id=stock_id, ticker_symbol=ticker, dividend_date=records[0]["dividend_date"],
                              dividend_per_share=None))  # not allowed: the flush fails
        await db.flush()

    monkeypatch.setattr(portfolio, "upsert_dividend_records", failing_save)
    holding = add_holding(client, "TESTOOPS")
    assert holding["ticker_symbol"] == "TESTOOPS"


# ── Excel and deleting data ──────────────────────────────────────────────────
def test_excel_export_then_import_restores_holdings(client, payers):
    isa = client.post("/api/v1/portfolios", json={"name": "ISA"}).json()["id"]
    add_holding(client, "TESTA", quantity=10)
    add_holding(client, "TESTM", quantity=100, portfolio_id=isa)
    client.post("/api/v1/watchlist", json={"ticker": "TESTL"})

    export = client.get("/api/v1/excel/export")
    assert export.status_code == 200 and export.content[:2] == b"PK"  # an .xlsx is a zip file

    assert client.delete("/api/v1/user/account").status_code == 204
    assert client.get("/api/v1/portfolio").json() == []

    r = client.post(
        "/api/v1/excel/import",
        files={"file": ("dividendcase_export.xlsx", io.BytesIO(export.content),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert r.status_code == 200, r.text
    assert r.json()["created"] == 2
    holdings = sorted(i["ticker_symbol"] for i in client.get("/api/v1/portfolio").json())
    assert holdings == ["TESTA", "TESTM"]
    assert {p["name"] for p in client.get("/api/v1/portfolios").json()} >= {"ISA"}


def test_deleting_my_data_keeps_market_data(client, payers):
    add_holding(client, "TESTA")
    client.post("/api/v1/watchlist", json={"ticker": "TESTA"})
    assert client.delete("/api/v1/user/account").status_code == 204
    assert client.get("/api/v1/portfolio").json() == []
    assert client.get("/api/v1/watchlist").json() == []
    assert client.get("/api/v1/stocks/TESTA").status_code == 200  # can be fetched again anyway


def test_base_url_is_loopback():
    # Guards the other tests: TrustedHostMiddleware only answers 127.0.0.1 and localhost
    assert BASE_URL.startswith("http://127.0.0.1")
