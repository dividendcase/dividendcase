"""Revolut account statements turned into lots. Every trade, stock and ISIN here is invented."""
from datetime import date

import pytest

from dividendcase.services.brokers import open_lots, revolut
from documents import pdf

# As the app's PDF reads back: a section per currency, with the summary, holdings and transactions
STATEMENT = [
    "Account Statement",
    "Generated on the 07 Oct 2026",
    "TEST USER",
    "Period 01 Jan 2024 - 07 Oct 2026",
    "USD Account summary",
    "Starting Ending",
    "Positions Value US$0 US$1,100.00",
    "Cash value* US$0 US$5.00",
    "USD Portfolio breakdown",
    "Symbol Company ISIN Quantity Price Value % of Portfolio",
    "ALFA Alfa Corp US0000000011 7.5 US$120.00 US$900.00 81.82%",
    "BRK.B Berkshire Example Class B US0000000029 0.5 US$400.00 US$200.00 18.18%",
    "Positions Value US$1,100.00 100%",
    "USD Transactions",
    "Date Symbol Type Quantity Price Side Value Fees Commission",
    "02 Jan 2024 14:00:00 GMT Cash top-up US$2,000 US$0 US$0",
    "02 Jan 2024 14:05:00 GMT ALFA Trade - Market 10 US$100.00 Buy US$1,000 US$0 US$0",
    "02 Jan 2024 15:00:00 GMT ALFA Trade - Limit 2 US$101.00 Buy US$202 US$0 US$0",
    "15 Mar 2025 10:00:00 GMT ALFA Trade - Market 4.5 US$130.00 Sell US$585 US$0.01 US$0",
    "20 Mar 2025 10:00:00 GMT ALFA Dividend US$3.20 US$0 US$0",
    "01 Jun 2025 10:00:00 GMT BRK.B Trade - Market 0.5 US$400.00 Buy US$200 US$0 US$0",
    "EUR Account summary",
    "Starting Ending",
    "Positions Value €50.00 €60.00",
    "EUR Portfolio breakdown",
    "Symbol Company ISIN Quantity Price Value % of Portfolio",
    "BETA Beta SE DE0000000012 2 €30.00 €60.00 100%",
    "EUR Transactions",
    "Date Symbol Type Quantity Price Side Value Fees Commission",
]

# The older CSV export: the side is in the type, prices carry their currency
CSV = """Date,Ticker,Type,Quantity,Price per share,Total Amount,Currency,FX Rate
2024-01-02T14:00:00.000Z,,CASH TOP-UP,,,USD 2000,USD,1
2024-01-02T14:05:00.000Z,ALFA,BUY - MARKET,10,USD 100.00,USD 1000,USD,1
2025-03-15T10:00:00.000Z,ALFA,SELL - MARKET,4.5,USD 130.00,USD 585,USD,1
2025-03-20T10:00:00.000Z,ALFA,DIVIDEND,,,USD 3.20,USD,1
"""


def lots(statement: revolut.Statement) -> dict:
    return {
        h.ticker: [(lot.purchase_date, lot.quantity, round(lot.price, 4)) for lot in h.lots]
        for h in open_lots(statement.trades).holdings
    }


# ── reading the statement ─────────────────────────────────────────────────────
def test_reads_trades_holdings_and_period_from_the_pdf():
    s = revolut.parse(pdf(STATEMENT), "statement.pdf")
    assert s.period == (date(2024, 1, 1), date(2026, 10, 7))
    assert [(t.ticker, t.side, t.trade_date, t.quantity, t.price, t.currency) for t in s.trades] == [
        ("ALFA", "buy", date(2024, 1, 2), 10, 100.0, "USD"),
        ("ALFA", "buy", date(2024, 1, 2), 2, 101.0, "USD"),
        ("ALFA", "sell", date(2025, 3, 15), 4.5, 130.0, "USD"),
        ("BRK-B", "buy", date(2025, 6, 1), 0.5, 400.0, "USD"),
    ]
    assert {k: (p.isin, p.quantity, p.currency) for k, p in s.positions.items()} == {
        "ALFA": ("US0000000011", 7.5, "USD"),
        "BRK.B": ("US0000000029", 0.5, "USD"),
        "BETA": ("DE0000000012", 2, "EUR"),
    }
    assert dict(s.other) == {"Cash top-up": 1, "Dividend": 1}
    assert s.held_at_start == ["EUR"]
    assert s.unreadable == []


def test_sales_use_up_the_earliest_buys_and_same_day_buys_merge():
    # 4.5 of the first 10 sold; the 5.5 left and the 2 bought later that day are one lot
    assert lots(revolut.parse(pdf(STATEMENT), "statement.pdf")) == {
        "ALFA": [(date(2024, 1, 2), 7.5, round((5.5 * 100 + 2 * 101) / 7.5, 4))],
        "BRK-B": [(date(2025, 6, 1), 0.5, 400.0)],
    }


def test_reads_the_csv_export():
    s = revolut.parse(CSV.encode(), "trading-account-statement.csv")
    assert lots(s) == {"ALFA": [(date(2024, 1, 2), 5.5, 100.0)]}
    assert dict(s.other) == {"Cash Top-Up": 1, "Dividend": 1}


def test_us_share_classes_use_yahoos_dash():
    assert revolut.ticker_for("BRK.B", "USD") == "BRK-B"
    assert revolut.ticker_for("ASML", "EUR") == "ASML"


def test_amounts_with_currency_signs():
    assert revolut.amount("US$1,234.50") == 1234.5
    assert revolut.amount("-US$1.25") == -1.25
    assert revolut.amount("USD 120.50") == 120.5
    assert revolut.amount("€0") == 0


def test_a_file_that_isnt_a_statement_says_so():
    with pytest.raises(revolut.StatementError):
        revolut.parse(pdf(["Holdings report", "Nothing else here"]), "other.pdf")
    with pytest.raises(revolut.StatementError):
        revolut.parse(b"name,amount\nx,1\n", "other.csv")


# ── the API ───────────────────────────────────────────────────────────────────
def upload(content: bytes, name: str = "statement.pdf"):
    return [("files", (name, content, "application/pdf"))]


def test_preview_checks_the_trades_against_revoluts_holdings(client):
    r = client.post("/api/v1/imports/revolut/preview", files=upload(pdf(STATEMENT)))
    assert r.status_code == 200, r.text
    preview = r.json()
    assert {h["ticker"]: h["quantity"] for h in preview["holdings"]} == {"ALFA": 7.5, "BRK-B": 0.5}
    notes = " ".join(preview["notes"])
    # The EUR section starts with holdings, and BETA is held without a trade in the statement
    assert "starts on 01 Jan 2024 with EUR holdings" in notes
    assert "BETA: Revolut shows 2 shares held, but the trades in these statements add up to 0" in notes
    assert preview["left_out"] == {"Cash top-up": 1, "Dividend": 1}
    assert preview["new_lots"] == 2


def test_importing_adds_the_lots_once(client):
    r = client.post("/api/v1/imports/revolut", files=upload(pdf(STATEMENT)))
    assert r.status_code == 200, r.text
    assert r.json()["created"] == 2
    held = {(i["ticker_symbol"], i["purchase_date"], i["quantity"]) for i in client.get("/api/v1/portfolio").json()}
    assert held == {("ALFA", "2024-01-02", 7.5), ("BRK-B", "2025-06-01", 0.5)}
    again = client.post("/api/v1/imports/revolut", files=upload(pdf(STATEMENT))).json()
    assert (again["created"], again["already_there"]) == (0, 2)


def test_the_same_statement_twice_counts_each_trade_once(client):
    preview = client.post(
        "/api/v1/imports/revolut/preview", files=upload(pdf(STATEMENT)) + upload(pdf(STATEMENT), "copy.pdf")
    ).json()
    assert preview["duplicate_trades"] == 4
    assert {h["ticker"]: h["quantity"] for h in preview["holdings"]} == {"ALFA": 7.5, "BRK-B": 0.5}
