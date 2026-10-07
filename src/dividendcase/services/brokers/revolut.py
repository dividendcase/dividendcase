"""Revolut's trading account statement: the PDF from the Revolut app, or the same statement as CSV/Excel.

The PDF has a section for each currency: an "Account summary" (positions at the start and end of the
period), a "Portfolio breakdown" (what's held at the end, with each stock's ISIN) and "Transactions":

    Date                      Symbol  Type            Quantity  Price      Side  Value    Fees  Commission
    02 Jan 2024 14:05:00 GMT  ALFA    Trade - Market  2.5       US$120.00  Buy   US$300   US$0  US$0
    02 Jan 2024 14:00:00 GMT          Cash top-up                                US$300   US$0  US$0

Buys and sells become trades; every other row (top-ups, dividends, fees) is counted and listed, not
imported. The breakdown is what Revolut says is held, so the holdings the trades add up to are checked
against it, and a statement that starts with holdings already in the account is flagged: the trades
before it are missing.

The CSV/Excel reader goes by column names (Date, Ticker or Symbol, Type, Quantity, Price per share or
Price, Side, Currency), with the side taken from the type ("BUY - MARKET") when there's no Side column.
"""
import io
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional

from dividendcase.services.brokers import Trade
from dividendcase.services.brokers.files import BrokerFileError, key, rows


class StatementError(BrokerFileError):
    """The file isn't a Revolut statement the app can read"""


SECTION = re.compile(r"^([A-Z]{3}) (Account summary|Portfolio breakdown|Transactions)\s*$")
PERIOD = re.compile(r"Period\s+(\d{1,2} [A-Za-z]{3} \d{4})\s*-\s*(\d{1,2} [A-Za-z]{3} \d{4})")
ROW = re.compile(r"^(\d{1,2} [A-Za-z]{3} \d{4}) (\d{1,2}:\d{2}:\d{2})(?: [A-Z]{2,5})? (.+)$")
POSITION = re.compile(
    r"^(?P<symbol>\S+) (?P<name>.+?) (?P<isin>[A-Z]{2}[A-Z0-9]{9}\d) (?P<quantity>[\d,]+(?:\.\d+)?) "
)
SYMBOL = re.compile(r"^[A-Z0-9][A-Z0-9.\-]{0,11}$")
AMOUNT = re.compile(r"-?\d[\d,]*(?:\.\d+)?")
CURRENCY_SIGNS = {"US$": "USD", "$": "USD", "€": "EUR", "£": "GBP", "CHF": "CHF", "₹": "INR"}


@dataclass
class Position:
    symbol: str
    name: str
    isin: str
    quantity: float
    currency: str


@dataclass
class Statement:
    trades: list[Trade] = field(default_factory=list)
    # What Revolut says is held at the end of the period (the PDF's "Portfolio breakdown"), by symbol
    positions: dict[str, Position] = field(default_factory=dict)
    other: Counter = field(default_factory=Counter)  # rows that aren't buys or sells, by type
    unreadable: list[str] = field(default_factory=list)
    period: Optional[tuple[date, date]] = None
    held_at_start: list[str] = field(default_factory=list)  # currencies with holdings when the period starts
    first: Optional[date] = None
    last: Optional[date] = None


def amount(text) -> float:
    """"US$1,234.50" → 1234.5, "-US$1.25" → -1.25, "USD 120.50" → 120.5"""
    if isinstance(text, (int, float)):
        return float(text)
    s = str(text).strip()
    found = AMOUNT.search(s.replace(" ", ""))
    if not found:
        raise ValueError(f"no amount in {s!r}")
    value = float(found.group(0).replace(",", ""))
    return -abs(value) if s.startswith("-") else value


def ticker_for(symbol: str, currency: str) -> str:
    """Revolut's symbol as Yahoo's ticker. US share classes use a dash on Yahoo: BRK.B → BRK-B"""
    symbol = symbol.strip().upper()
    return symbol.replace(".", "-") if currency == "USD" else symbol


def _day(text: str) -> date:
    return datetime.strptime(text.strip(), "%d %b %Y").date()


def _add_trade(book: Statement, *, symbol, side, when: datetime, quantity, price, currency, row_id: str):
    position = book.positions.get(symbol)
    book.trades.append(Trade(
        # Stocks sold off before the period ends aren't in the breakdown, so their symbol stands in
        isin=position.isin if position else f"{currency}:{symbol}",
        symbol=symbol,
        ticker=ticker_for(symbol, currency),
        side=side,
        trade_date=when.date(),
        quantity=quantity,
        price=price,
        currency=currency,
        trade_id=row_id,
        executed_at=when,
    ))
    book.first = min(book.first or when.date(), when.date())
    book.last = max(book.last or when.date(), when.date())


def _from_pdf(content: bytes) -> Statement:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            raise StatementError("This PDF is protected with a password: save an unprotected copy and choose that.")
        lines = [line.strip() for page in reader.pages for line in (page.extract_text() or "").splitlines()]
    except StatementError:
        raise
    except Exception as e:
        raise StatementError("Couldn't read this PDF.") from e
    if not any(SECTION.match(line) for line in lines):
        raise StatementError("This doesn't look like a Revolut account statement: it has no Transactions section.")

    book = Statement()
    found = next((PERIOD.search(line) for line in lines if PERIOD.search(line)), None)
    if found:
        book.period = (_day(found.group(1)), _day(found.group(2)))

    # First pass: what's held, so each trade can carry its stock's ISIN
    currency = section = None
    for line in lines:
        if m := SECTION.match(line):
            currency, section = m.group(1), m.group(2)
        elif section == "Account summary" and line.startswith("Positions Value"):
            values = [amount(t) for t in line.split()[2:4]]
            if values and values[0] != 0 and currency not in book.held_at_start:
                book.held_at_start.append(currency)
        elif section == "Portfolio breakdown" and (m := POSITION.match(line)):
            book.positions[m["symbol"]] = Position(
                m["symbol"], m["name"], m["isin"], float(m["quantity"].replace(",", "")), currency
            )

    currency = section = None
    for line in lines:
        if m := SECTION.match(line):
            currency, section = m.group(1), m.group(2)
            continue
        if section != "Transactions" or not (m := ROW.match(line)):
            continue
        when = datetime.strptime(f"{m.group(1)} {m.group(2)}", "%d %b %Y %H:%M:%S")
        tokens = m.group(3).split()
        try:
            if len(tokens) < 3:
                raise ValueError("too few columns")
            head = tokens[:-3]  # the last three are Value, Fees and Commission
            side = None
            if head and head[-1].lower() in ("buy", "sell"):
                side = head[-1].lower()
                price, quantity = amount(head[-2]), amount(head[-3])
                head = head[:-3]
            symbol = head[0] if len(head) > 1 and SYMBOL.match(head[0]) else None
            kind = " ".join(head[1:] if symbol else head) or "Other"
            if side and symbol and kind.lower().startswith("trade"):
                if quantity <= 0 or price <= 0:
                    raise ValueError("quantity and price must be above zero")
                _add_trade(book, symbol=symbol, side=side, when=when, quantity=quantity, price=price,
                           currency=currency, row_id=f"{when.isoformat()} {symbol} {side} {quantity} {price}")
            else:
                book.other[kind] += 1
        except (ValueError, IndexError) as e:
            book.unreadable.append(f"{m.group(1)}: {e}")
    return book


def _from_table(table: list[list]) -> Statement:
    """The statement as CSV or Excel: one row per transaction, columns found by name"""
    header_at = next(
        (i for i, row in enumerate(table[:40])
         if {"date", "type", "quantity"} <= (names := {key(c) for c in row if c is not None})
         and names & {"ticker", "symbol"}),
        None,
    )
    if header_at is None:
        raise StatementError(
            "This doesn't look like a Revolut statement: it needs columns such as Date, Ticker, Type and Quantity."
        )
    columns = {key(c): i for i, c in enumerate(table[header_at]) if c is not None}
    book = Statement()
    for number, row in enumerate(table[header_at + 1:], start=header_at + 2):
        if not row or all(c in (None, "") for c in row):
            continue

        def get(*names):
            for name in names:
                i = columns.get(name)
                if i is not None and i < len(row) and row[i] not in (None, ""):
                    return row[i]
            return None

        kind = str(get("type") or "").strip()
        side = str(get("side") or "").strip().lower()
        if not side:  # "BUY - MARKET", "SELL - LIMIT"
            side = next((s for s in ("buy", "sell") if kind.lower().startswith(s)), "")
        symbol = str(get("ticker", "symbol") or "").strip().upper()
        if side not in ("buy", "sell") or not symbol:
            book.other[kind.title() or "Other"] += 1
            continue
        try:
            raw = get("date")
            when = raw if isinstance(raw, datetime) else datetime.fromisoformat(str(raw).strip().replace("Z", "+00:00"))
            when = when.replace(tzinfo=None)
            quantity = amount(get("quantity"))
            price_cell = get("price_per_share", "price")
            price = amount(price_cell)
            currency = str(get("currency") or "").strip().upper() or next(
                (code for sign, code in CURRENCY_SIGNS.items() if str(price_cell).strip().startswith(sign)), "USD"
            )
            if quantity <= 0 or price <= 0:
                raise ValueError("quantity and price must be above zero")
        except (TypeError, ValueError) as e:
            book.unreadable.append(f"Row {number}: {e}")
            continue
        _add_trade(book, symbol=symbol, side=side, when=when, quantity=quantity, price=price,
                   currency=currency, row_id=f"{when.isoformat()} {symbol} {side} {quantity} {price}")
    return book


def parse(content: bytes, filename: str) -> Statement:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return _from_pdf(content)
    if lower.endswith((".csv", ".xlsx")):
        try:
            return _from_table(rows(content, filename))
        except StatementError:
            raise
        except BrokerFileError as e:
            raise StatementError(str(e)) from e
    raise StatementError("Choose Revolut's account statement as a .pdf, .csv or .xlsx file.")
