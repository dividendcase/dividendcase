"""Zerodha tradebooks turned into purchase lots. Every trade here is invented."""
import io
from datetime import date

import pytest
from openpyxl import Workbook

from dividendcase.services.brokers import Trade, open_lots
from dividendcase.services.brokers import zerodha

HEADER = "symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time"


def tradebook(*rows: str) -> bytes:
    return ("\n".join([HEADER, *rows]) + "\n").encode()


def trade(side, day, qty, price, isin="INE000A01011", ticker="ALPHA.NS", trade_id=None):
    return Trade(isin=isin, symbol=ticker.split(".")[0], ticker=ticker, side=side, trade_date=date.fromisoformat(day),
                 quantity=qty, price=price, currency="INR", trade_id=trade_id or f"{side}{day}{qty}")


# ── matching sells against buys ───────────────────────────────────────────────
def test_sells_use_up_the_earliest_buys_first():
    positions = open_lots([
        trade("buy", "2021-01-10", 10, 100.0),
        trade("buy", "2022-03-05", 20, 150.0),
        trade("sell", "2023-06-01", 15, 200.0),
    ])
    [holding] = positions.holdings
    assert [(lot.purchase_date, lot.quantity, lot.price) for lot in holding.lots] == [(date(2022, 3, 5), 15, 150.0)]
    assert positions.closed == 0 and positions.oversold == []


def test_buys_on_the_same_day_become_one_lot_at_their_average_price():
    positions = open_lots([
        trade("buy", "2023-02-01", 10, 100.0, trade_id="a"),
        trade("buy", "2023-02-01", 30, 120.0, trade_id="b"),
    ])
    [lot] = positions.holdings[0].lots
    assert lot.quantity == 40 and lot.price == pytest.approx(115.0)


def test_a_stock_sold_off_completely_is_counted_not_held():
    positions = open_lots([trade("buy", "2021-01-10", 10, 100.0), trade("sell", "2021-05-10", 10, 120.0)])
    assert positions.holdings == [] and positions.closed == 1


def test_selling_more_than_the_files_show_bought_is_flagged():
    # Bonus shares or an earlier year's buys aren't in these files
    positions = open_lots([trade("buy", "2022-01-10", 10, 100.0), trade("sell", "2022-05-10", 25, 120.0)])
    assert positions.oversold == ["ALPHA.NS"] and positions.holdings == []


# ── reading the files ─────────────────────────────────────────────────────────
def test_reads_the_csv_tradebook_and_maps_exchanges_to_tickers():
    book = zerodha.parse(tradebook(
        "ALPHA,INE000A01011,2022-04-11,NSE,EQ,EQ,buy,false,10,101.5,T1,O1,2022-04-11T10:05:00",
        "BETA,INE000B01012,2022-05-02,BSE,EQ,A,buy,false,4,250.25,T2,O2,2022-05-02T11:00:00",
        "GAMMA-BE,INE000C01013,2022-06-01,NSE,EQ,BE,buy,false,3,80,T3,O3,2022-06-01T12:00:00",
        "ALPHA22JUNFUT,,2022-06-02,NFO,FO,,buy,false,50,1,T4,O4,2022-06-02T12:00:00",
    ), "tradebook-XX0000-EQ.csv")
    assert [t.ticker for t in book.trades] == ["ALPHA.NS", "BETA.BO", "GAMMA.NS"]
    assert book.trades[1].price == 250.25 and book.trades[0].currency == "INR"
    assert book.not_equity == 1
    assert (book.first, book.last) == (date(2022, 4, 11), date(2022, 6, 1))


def test_a_stock_traded_on_both_exchanges_uses_its_nse_ticker():
    book = zerodha.parse(tradebook(
        "ALPHA,INE000A01011,2022-04-11,BSE,EQ,A,buy,false,10,101,T1,O1,",
        "ALPHA,INE000A01011,2022-04-12,NSE,EQ,EQ,buy,false,5,102,T2,O2,",
    ), "t.csv")
    assert {t.ticker for t in book.trades} == {"ALPHA.NS"}


def test_reads_the_excel_tradebook_with_account_lines_above_the_table():
    wb = Workbook()
    ws = wb.active
    ws.append(["Client ID", "XX0000"])
    ws.append(["Tradebook for Equity from 2022-04-01 to 2023-03-31"])
    ws.append([])
    ws.append(["Symbol", "ISIN", "Trade Date", "Exchange", "Segment", "Series", "Trade Type", "Auction",
               "Quantity", "Price", "Trade ID", "Order ID", "Order Execution Time"])
    ws.append(["ALPHA", "INE000A01011", "2022-04-11", "NSE", "EQ", "EQ", "buy", "false", 10, 101.5, "T1", "O1", "2022-04-11T10:05:00"])
    buffer = io.BytesIO()
    wb.save(buffer)
    book = zerodha.parse(buffer.getvalue(), "tradebook.xlsx")
    assert [(t.ticker, t.quantity, t.trade_date) for t in book.trades] == [("ALPHA.NS", 10, date(2022, 4, 11))]


def test_a_file_that_isnt_a_tradebook_says_so():
    with pytest.raises(zerodha.TradebookError):
        zerodha.parse(b"date,amount\n2022-01-01,5\n", "statement.csv")


def test_rows_it_cant_read_are_listed_not_imported():
    book = zerodha.parse(tradebook(
        "ALPHA,INE000A01011,2022-04-11,NSE,EQ,EQ,buy,false,ten,101,T1,O1,",
        "ALPHA,INE000A01011,2022-04-12,NSE,EQ,EQ,buy,false,5,102,T2,O2,",
    ), "t.csv")
    assert len(book.trades) == 1 and len(book.unreadable) == 1


# ── the API ───────────────────────────────────────────────────────────────────
YEAR_1 = tradebook(
    "ALPHA,INE000A01011,2022-04-11,NSE,EQ,EQ,buy,false,10,100,T1,O1,2022-04-11T10:00:00",
    "ALPHA,INE000A01011,2022-09-01,NSE,EQ,EQ,buy,false,10,120,T2,O2,2022-09-01T10:00:00",
    "BETA,INE000B01012,2022-10-03,NSE,EQ,EQ,buy,false,5,400,T3,O3,2022-10-03T10:00:00",
)
YEAR_2 = tradebook(
    # The first trade repeats one already in YEAR_1 (overlapping downloads)
    "BETA,INE000B01012,2022-10-03,NSE,EQ,EQ,buy,false,5,400,T3,O3,2022-10-03T10:00:00",
    "ALPHA,INE000A01011,2023-05-15,NSE,EQ,EQ,sell,false,12,150,T4,O4,2023-05-15T10:00:00",
)


def files(*named):
    return [("files", (name, content, "text/csv")) for name, content in named]


def test_preview_shows_what_the_files_add_up_to(client):
    r = client.post("/api/v1/imports/zerodha/preview", files=files(("2022.csv", YEAR_1), ("2023.csv", YEAR_2)))
    assert r.status_code == 200, r.text
    preview = r.json()
    assert preview["duplicate_trades"] == 1
    held = {h["ticker"]: h for h in preview["holdings"]}
    # 20 ALPHA bought, 12 sold: the earliest 10 and 2 of the next lot go
    assert held["ALPHA.NS"]["quantity"] == 8 and held["ALPHA.NS"]["lots"][0]["purchase_date"] == "2022-09-01"
    assert held["BETA.NS"]["quantity"] == 5
    assert preview["new_lots"] == 2


def test_importing_adds_the_lots_once(client):
    r = client.post("/api/v1/imports/zerodha", files=files(("2022.csv", YEAR_1), ("2023.csv", YEAR_2)))
    assert r.status_code == 200, r.text
    assert r.json()["created"] == 2
    lots = {(i["ticker_symbol"], i["purchase_date"], i["quantity"]) for i in client.get("/api/v1/portfolio").json()}
    assert lots == {("ALPHA.NS", "2022-09-01", 8.0), ("BETA.NS", "2022-10-03", 5.0)}

    again = client.post("/api/v1/imports/zerodha", files=files(("2022.csv", YEAR_1), ("2023.csv", YEAR_2)))
    assert again.json()["created"] == 0 and again.json()["already_there"] == 2
    preview = client.post("/api/v1/imports/zerodha/preview", files=files(("2022.csv", YEAR_1), ("2023.csv", YEAR_2))).json()
    assert preview["new_lots"] == 0
    assert all(lot["already_there"] for h in preview["holdings"] for lot in h["lots"])


def test_import_into_a_portfolio_that_isnt_there_is_refused(client):
    r = client.post("/api/v1/imports/zerodha", files=files(("2022.csv", YEAR_1)), data={"portfolio_id": "999"})
    assert r.status_code == 404


def test_a_wrong_file_is_refused_with_a_reason(client):
    r = client.post("/api/v1/imports/zerodha/preview", files=[("files", ("photo.png", b"\x89PNG", "image/png"))])
    assert r.status_code == 400 and "tradebook" in r.json()["detail"]
