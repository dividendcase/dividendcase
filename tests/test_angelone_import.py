"""Angel One holdings files turned into lots, and the ISIN lookup behind them. Every holding is invented."""
import csv
import io
from datetime import date, timedelta

import pytest
from msoffcrypto.format.ooxml import OOXMLFile
from openpyxl import Workbook

from dividendcase.services import isin
from dividendcase.services.brokers import angelone
from documents import pdf

AS_OF = date(2025, 3, 15)
HEADER = [
    "Client ID", "Company Name", "ISIN", "MarketCap", "Sector", "Total Quantity", "Free Quantity",
    "Unsettled \nQuantity", "Margin Pledged \nQuantity", "PayLater(MTF) \nQuantity", "Unpaid(CUSA) \nQty",
    "Blocked_qty", "Avg Trading \nPrice", "LTP", "Invested Value", "Market Value", "Overall Gain/ \nLoss",
    "LTCG Quantity", "LTCG Value", "STCG Quantity", "STCG Value",
]
# Alpha: 20 held over a year at 100 and 10 bought this year at 130 (30 at 110 on average)
# Beta: 5 units, of which the file places 4 as long-held and none as recent
# Gamma: shares received free, with no cost
ROWS = [
    ["X12345", "Alpha Industries", "INE000A01011", "LargeCap", "Metal - Non \nFerrous", 30, 30, 0, 0, 0, 0, 0,
     110.00, 150.00, 3300.00, 4500.00, 1200.00, 20, 100.00, 10, 130.00],
    ["X12345", "Beta 100 ETF", "INF000B01012", None, None, 5, 5, 0, 0, 0, 0, 0,
     1000.08, 999.99, 5000.41, 4999.95, -0.46, 4, 1000.08, 0, 0.00],
    ["X12345", "GAMMA SPECIAL \nKIN-EQ", "INE000C01013", "SmallCap", None, 50, 50, 0, 0, 0, 0, 0,
     0.00, 0.00, 0.00, 0.00, 0.00, 50, 0.00, 0, 0.00],
]


def table(as_of: date = AS_OF) -> list[list]:
    """The sheet as Angel One lays it out: account lines and a summary above the holdings table"""
    return [
        ["Date of \nDownload", as_of.isoformat()],
        [],
        ["Client Name", "Client Id", "Relationship"],
        ["TEST USER", "X12345", "Self"],
        [],
        ["Summary of Equity Holdings"],
        ["Client ID", "Total Equity \nScrips", "Invested Value", "Market Value", "Overall Gain/\nLoss"],
        ["X12345", 3, 8300.41, 9499.95, 1199.54],
        ["Total", None, 8300.41, 9499.95, 1199.54],
        [],
        ["Equity Holdings Details"],
        HEADER,
        *ROWS,
        ["Total", None, None, None, None, None, None, None, None, None, None, None, None, None, 8300.41, 9499.95, 1199.54],
    ]


def xlsx(as_of: date = AS_OF, password: str | None = None) -> bytes:
    wb = Workbook()
    for row in table(as_of):
        wb.active.append(row)
    plain = io.BytesIO()
    wb.save(plain)
    if password is None:
        return plain.getvalue()
    plain.seek(0)
    protected = io.BytesIO()
    OOXMLFile(plain).encrypt(password, protected)
    return protected.getvalue()


def as_csv() -> bytes:
    out = io.StringIO()
    csv.writer(out).writerows(table())
    return out.getvalue().encode()


# How PDF text extraction returns the printed sheet: wrapped cells, and cells run together
PDF_LINES = [
    "Date of",
    f"Download {AS_OF.isoformat()}",
    "Client Name Client Id Relationship",
    "TEST USER X12345 Self",
    "Summary of Equity Holdings",
    "Client ID Total Equity Scrips Invested ValueMarket Value Overall Gain/ Loss",
    "X12345 3 8300.41 9499.95 1199.54",
    "Equity Holdings Details",
    "Client ID Company NameISIN MarketCap Sector Total QuantityFree Quantity",
    "Unsettled", "Quantity", "Margin Pledged", "Quantity", "PayLater(MTF)", "Quantity", "Unpaid(CUSA)",
    "Qty Blocked_qty",
    "Avg Trading",
    "Price LTP Invested ValueMarket Value",
    "Overall Gain/",
    "Loss LTCG QuantityLTCG Value STCG QuantitySTCG Value",
    "X12345 Alpha IndustriesINE000A01011LargeCap",
    "Metal - Non",
    "Ferrous 30 30 0 0 0 0 0 110.00 150.00 3300.00 4500.00 1200.00 20 100.00 10 130.00",
    "X12345 Beta 100 ETFINF000B01012 5 5 0 0 0 0 0 1000.08 999.99 5000.41 4999.95 -0.46 4 1000.08 0 0.00",
    "X12345",
    "GAMMA SPECIAL",
    "KIN-EQ INE000C01013SmallCap 50 50 0 0 0 0 0 0.00 0.00 0.00 0.00 0.00 50 0.00 0 0.00",
    "Total 8300.41 9499.95 1199.54",
]


def summary(book: angelone.HoldingsFile) -> list[tuple]:
    return [(p.name, p.isin, p.quantity, p.average_price, p.long_quantity, p.short_quantity) for p in book.positions]


EXPECTED = [
    ("Alpha Industries", "INE000A01011", 30, 110.0, 20, 10),
    ("Beta 100 ETF", "INF000B01012", 5, 1000.08, 4, 0),
    ("GAMMA SPECIAL KIN-EQ", "INE000C01013", 50, 0.0, 50, 0),
]


# ── reading the file ──────────────────────────────────────────────────────────
def test_reads_the_excel_file_below_the_account_lines_and_summary():
    book = angelone.parse(xlsx(), "Your Holding Details - X12345.xlsx")
    assert book.as_of == AS_OF
    assert summary(book) == EXPECTED
    assert book.unreadable == []


def test_a_protected_file_asks_for_its_password_and_opens_with_it():
    content = xlsx(password="invented-pass")
    with pytest.raises(angelone.PasswordRequired):
        angelone.parse(content, "holdings.xlsx")
    with pytest.raises(angelone.WrongPassword):
        angelone.parse(content, "holdings.xlsx", password="not-it")
    assert summary(angelone.parse(content, "holdings.xlsx", password="invented-pass")) == EXPECTED


def test_reads_a_csv_copy():
    assert summary(angelone.parse(as_csv(), "holdings.csv")) == EXPECTED


def test_reads_a_pdf_copy_whose_cells_run_together():
    book = angelone.parse(pdf(PDF_LINES), "holdings.pdf")
    assert book.as_of == AS_OF
    assert summary(book) == EXPECTED


def test_a_file_that_isnt_a_holdings_file_says_so():
    with pytest.raises(angelone.HoldingsFileError):
        angelone.parse(b"date,amount\n2025-01-01,5\n", "statement.csv")
    with pytest.raises(angelone.HoldingsFileError):
        angelone.parse(pdf(["Ledger statement", "Funds added 2025-01-01 500"]), "ledger.pdf")


# ── lots ──────────────────────────────────────────────────────────────────────
def test_long_and_recent_parts_become_lots_at_their_own_prices():
    alpha = angelone.parse(xlsx(), "h.xlsx").positions[0]
    [long, short] = angelone.lots(alpha, AS_OF)
    # Held more than a year: bought on 14 March 2024 at the latest
    assert (long.held, long.purchase_date, long.quantity, long.price) == ("long", date(2024, 3, 14), 20, 100.0)
    assert (short.held, short.purchase_date, short.quantity, short.price) == ("short", AS_OF, 10, 130.0)


def test_units_the_file_doesnt_place_count_as_long_held():
    beta = angelone.parse(xlsx(), "h.xlsx").positions[1]
    assert [(lot.held, lot.quantity) for lot in angelone.lots(beta, AS_OF)] == [("long", 5)]


def test_shares_received_free_have_no_price():
    gamma = angelone.parse(xlsx(), "h.xlsx").positions[2]
    assert [lot.price for lot in angelone.lots(gamma, AS_OF)] == [None]


# ── finding tickers by ISIN ───────────────────────────────────────────────────
def test_nse_lists_are_read_by_column_name():
    equities = "SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE\n" \
               "ALPHA,Alpha Industries Limited,EQ,06-OCT-2008,5,1,INE000A01011,5\n"
    etfs = "Symbol,Underlying Asset,SecurityName,DateofListing,MarketLot,ISINNumber,FaceValue\n" \
           "BETABEES,Nifty 50,BETA ETF,08-Jan-02,1,INF000B01012,1\n"
    assert isin._parse_nse_list(equities) == {"INE000A01011": "ALPHA"}
    assert isin._parse_nse_list(etfs) == {"INF000B01012": "BETABEES"}


def test_isins_are_found_on_nse_first_then_yahoo_and_never_by_name():
    isin._cache = None
    found = isin.resolve(["INE000A01011", "INF000B01012", "INE000C01013", "INE999Z01019"])
    assert found["INE000A01011"] == isin.Found("ALPHA.NS", "nse")
    assert found["INF000B01012"] == isin.Found("BETABEES.NS", "nse")
    assert found["INE000C01013"] == isin.Found("GAMMA.BO", "yahoo")
    assert found["INE999Z01019"] is None


# ── the API ───────────────────────────────────────────────────────────────────
def upload(content: bytes, name: str = "Your Holding Details.xlsx"):
    return {"file": (name, content, "application/octet-stream")}


def test_preview_finds_tickers_and_dates_each_part(client):
    r = client.post("/api/v1/imports/angelone/preview", files=upload(xlsx()))
    assert r.status_code == 200, r.text
    preview = r.json()
    assert preview["as_of"] == AS_OF.isoformat()
    rows = {h["isin"]: h for h in preview["holdings"]}
    alpha = rows["INE000A01011"]
    assert (alpha["ticker"], alpha["found_by"], alpha["currency"]) == ("ALPHA.NS", "nse", "INR")
    assert [(lot["held"], lot["purchase_date"], lot["quantity"], lot["price"]) for lot in alpha["lots"]] == [
        ("long", "2024-03-14", 20, 100.0),
        ("short", "2025-03-15", 10, 130.0),
    ]
    assert rows["INE000C01013"]["ticker"] == "GAMMA.BO"
    assert rows["INE000C01013"]["average_price"] is None


def test_a_file_dated_ahead_gives_no_purchase_date_in_the_future(client):
    tomorrow = date.today() + timedelta(days=1)
    preview = client.post("/api/v1/imports/angelone/preview", files=upload(xlsx(as_of=tomorrow))).json()
    dates = {lot["held"]: lot["purchase_date"] for h in preview["holdings"] for lot in h["lots"]}
    assert dates["short"] == date.today().isoformat()
    # Held more than a year by the file's own date
    assert dates["long"] == (angelone.year_before(tomorrow) - timedelta(days=1)).isoformat()


def test_the_preview_says_when_a_password_is_needed_or_wrong(client):
    content = xlsx(password="invented-pass")
    r = client.post("/api/v1/imports/angelone/preview", files=upload(content))
    assert r.status_code == 400 and r.json()["detail"]["code"] == "password_required"
    r = client.post("/api/v1/imports/angelone/preview", files=upload(content), data={"password": "not-it"})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "wrong_password"
    r = client.post("/api/v1/imports/angelone/preview", files=upload(content), data={"password": "invented-pass"})
    assert r.status_code == 200 and len(r.json()["holdings"]) == 3


def test_confirmed_lots_are_added_once(client):
    lots = [
        {"ticker": "alpha.ns", "purchase_date": "2021-06-01", "quantity": 20, "price": 100.0, "currency": "INR"},
        {"ticker": "ALPHA.NS", "purchase_date": "2025-03-15", "quantity": 10, "price": 130.0, "currency": "INR"},
        {"ticker": "GAMMA.BO", "purchase_date": "2021-06-01", "quantity": 50, "price": None, "currency": "INR"},
    ]
    r = client.post("/api/v1/imports/lots", json={"lots": lots})
    assert r.status_code == 200, r.text
    assert (r.json()["created"], r.json()["holdings"]) == (3, 2)
    held = {(i["ticker_symbol"], i["purchase_date"], i["quantity"]) for i in client.get("/api/v1/portfolio").json()}
    assert held == {("ALPHA.NS", "2021-06-01", 20.0), ("ALPHA.NS", "2025-03-15", 10.0), ("GAMMA.BO", "2021-06-01", 50.0)}

    again = client.post("/api/v1/imports/lots", json={"lots": lots}).json()
    assert (again["created"], again["already_there"]) == (0, 3)
    preview = client.post("/api/v1/imports/angelone/preview", files=upload(xlsx())).json()
    short = next(lot for h in preview["holdings"] if h["ticker"] == "ALPHA.NS" for lot in h["lots"] if lot["held"] == "short")
    assert short["already_there"]


def test_lots_dated_in_the_future_or_for_another_portfolio_are_refused(client):
    future = (date.today() + timedelta(days=3)).isoformat()
    lot = {"ticker": "ALPHA.NS", "purchase_date": future, "quantity": 1, "price": 1.0, "currency": "INR"}
    assert client.post("/api/v1/imports/lots", json={"lots": [lot]}).status_code == 400
    lot["purchase_date"] = "2021-06-01"
    assert client.post("/api/v1/imports/lots", json={"lots": [lot], "portfolio_id": 999}).status_code == 404
