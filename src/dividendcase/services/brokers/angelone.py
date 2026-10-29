"""Angel One's holdings file ("Your Holding Details"): Excel as downloaded, or saved as CSV or PDF.

Angel One protects its Excel download with a password; the user types it and the file is opened here,
in memory. The table ("Equity Holdings Details") lists each security by company name and ISIN, not by
ticker. Its columns, as Angel One names them:

    Client ID, Company Name, ISIN, MarketCap, Sector, Total Quantity, Free Quantity, Unsettled Quantity,
    Margin Pledged Quantity, PayLater(MTF) Quantity, Unpaid(CUSA) Qty, Blocked_qty, Avg Trading Price,
    LTP, Invested Value, Market Value, Overall Gain/Loss, LTCG Quantity, LTCG Value, STCG Quantity,
    STCG Value

There are no purchase dates. There is how much of each holding has been held for more than a year
(LTCG: long-term for Indian capital gains tax) and for less (STCG), each with its average price. So a
holding becomes at most two lots: the long-held part, dated the latest day it could have been bought
(a year and a day before the file's "Date of Download"), and the recent part, dated on that day. The
user can change those dates before importing.
"""
import io
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

from dividendcase.services.brokers.files import BrokerFileError, key, parse_date, parse_number, rows


class HoldingsFileError(BrokerFileError):
    """The file isn't an Angel One holdings file the app can read"""


class PasswordRequired(HoldingsFileError):
    pass


class WrongPassword(HoldingsFileError):
    pass


REQUIRED = {"isin", "total_quantity", "avg_trading_price"}
ISIN = re.compile(r"\b(IN[A-Z0-9]{9}[0-9])\b")
NUMBER = re.compile(r"^-?\d[\d,]*(?:\.\d+)?$")
OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"  # an encrypted .xlsx (or an old .xls)

# The number columns of the table in the order Angel One prints them, as squashed header text; a PDF
# has only the words, so these find where each column sits
PDF_NUMBER_COLUMNS = [
    ("totalquantity", "total_quantity"),
    ("freequantity", None),
    ("unsettledquantity", None),
    ("marginpledgedquantity", None),
    ("paylater(mtf)quantity", None),
    ("unpaid(cusa)qty", None),
    ("blocked_qty", None),
    ("avgtradingprice", "avg_trading_price"),
    ("ltp", None),
    ("investedvalue", None),
    ("marketvalue", None),
    ("overallgain/loss", None),
    ("ltcgquantity", "ltcg_quantity"),
    ("ltcgvalue", "ltcg_value"),
    ("stcgquantity", "stcg_quantity"),
    ("stcgvalue", "stcg_value"),
]


@dataclass
class Position:
    """One row of the table"""

    name: str
    isin: str
    quantity: float
    average_price: float
    long_quantity: float = 0.0  # held for more than a year
    long_value: float = 0.0
    short_quantity: float = 0.0  # held for a year or less
    short_value: float = 0.0


@dataclass
class HoldingsFile:
    as_of: Optional[date] = None  # "Date of Download"
    positions: list[Position] = field(default_factory=list)
    unreadable: list[str] = field(default_factory=list)


@dataclass
class Lot:
    held: str  # "long": more than a year before as_of; "short": within the year
    purchase_date: date
    quantity: float
    price: Optional[float]  # None when the file shows no cost (shares received free)


def _open_excel(content: bytes, password: Optional[str]) -> bytes:
    """The workbook's bytes, decrypted with the user's password if Angel One protected it"""
    if not content.startswith(OLE_MAGIC):
        return content
    import msoffcrypto

    try:
        office = msoffcrypto.OfficeFile(io.BytesIO(content))
        encrypted = office.is_encrypted()
    except Exception as e:
        raise HoldingsFileError("Couldn't open this Excel file.") from e
    if not encrypted:
        raise HoldingsFileError("This is an old-style .xls file: open it and save it as .xlsx, then choose that.")
    if not password:
        raise PasswordRequired("This file is protected with a password.")
    try:
        office.load_key(password=password, verify_password=True)
        out = io.BytesIO()
        office.decrypt(out)
    except Exception as e:
        raise WrongPassword("That password didn't open the file.") from e
    return out.getvalue()


def _per_share(value: float, quantity: float, average: float) -> float:
    """LTCG/STCG "Value" as a price per share: Angel One fills it with the average price of that part,
    though a total would also make sense, so take whichever reading is closer to the overall average"""
    if quantity <= 0:
        return 0.0
    candidates = [value, value / quantity]
    if average <= 0:
        return candidates[0]
    return min(candidates, key=lambda c: abs(c - average))


def _from_table(table: list[list]) -> HoldingsFile:
    header_at = next(
        (i for i, row in enumerate(table[:60]) if REQUIRED <= {key(c) for c in row if c is not None}),
        None,
    )
    if header_at is None:
        raise HoldingsFileError(
            "This doesn't look like an Angel One holdings file: it needs columns such as ISIN, "
            "Total Quantity and Avg Trading Price."
        )
    book = HoldingsFile()
    for row in table[:header_at]:
        cells = [c for c in row if c not in (None, "")]
        for i, cell in enumerate(cells[:-1]):
            if key(cell) == "date_of_download":
                try:
                    book.as_of = parse_date(cells[i + 1])
                except ValueError:
                    pass

    columns = {key(c): i for i, c in enumerate(table[header_at]) if c is not None}
    for number, row in enumerate(table[header_at + 1:], start=header_at + 2):
        def get(name: str):
            i = columns.get(name)
            return row[i] if i is not None and i < len(row) else None

        isin = str(get("isin") or "").strip().upper()
        if not ISIN.fullmatch(isin):
            continue  # blank lines and the "Total" row
        try:
            values = {
                name: parse_number(get(name) or 0)
                for name in ("total_quantity", "avg_trading_price", "ltcg_quantity", "ltcg_value",
                             "stcg_quantity", "stcg_value")
            }
        except (TypeError, ValueError) as e:
            book.unreadable.append(f"Row {number} ({isin}): {e}")
            continue
        book.positions.append(_position(str(get("company_name") or isin).strip(), isin, values))
    return book


def _position(name: str, isin: str, v: dict) -> Position:
    return Position(
        name=" ".join(name.split()),
        isin=isin,
        quantity=v["total_quantity"],
        average_price=v["avg_trading_price"],
        long_quantity=v.get("ltcg_quantity", 0.0),
        long_value=v.get("ltcg_value", 0.0),
        short_quantity=v.get("stcg_quantity", 0.0),
        short_value=v.get("stcg_value", 0.0),
    )


def _from_pdf(content: bytes) -> HoldingsFile:
    """The same table, printed to PDF: rows are found by their ISIN, then the run of numbers after it"""
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            raise HoldingsFileError("This PDF is protected with a password: save an unprotected copy and choose that.")
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except HoldingsFileError:
        raise
    except Exception as e:
        raise HoldingsFileError("Couldn't read this PDF.") from e

    squashed = re.sub(r"\s+", "", text.lower())
    start = squashed.find("equityholdingsdetails")
    if start < 0 or "isin" not in squashed[start:]:
        raise HoldingsFileError("This PDF doesn't look like Angel One's holdings: it has no Equity Holdings Details table.")
    # Which number columns the table has, in the order they appear in its header
    at = {label: squashed.find(label, start) for label, _ in PDF_NUMBER_COLUMNS}
    order = sorted((pos, name) for (label, name) in PDF_NUMBER_COLUMNS if (pos := at[label]) >= 0)
    names = [name for _, name in order]
    if "total_quantity" not in names or "avg_trading_price" not in names:
        raise HoldingsFileError("Couldn't find Total Quantity and Avg Trading Price in this PDF.")

    book = HoldingsFile()
    found = re.search(r"Date\s*of\s*Download\s*:?\s*(\S+)", text, re.IGNORECASE)
    if found:
        try:
            book.as_of = parse_date(found.group(1))
        except ValueError:
            pass

    body = text[re.search(r"Equity\s+Holdings\s+Details", text, re.IGNORECASE).end():]
    # PDF text can run neighbouring cells together ("Reliance IndsINE002A01018LargeCap")
    tokens = re.sub(r"(IN[A-Z0-9]{9}[0-9])", r" \1 ", body).split()
    # Each row starts with the client ID, the most common code-like word in the table
    codes = Counter(t for t in tokens if re.fullmatch(r"[A-Z0-9]{4,12}", t) and re.search(r"[A-Z]", t)
                    and re.search(r"\d", t) and not ISIN.fullmatch(t))
    client = codes.most_common(1)[0][0] if codes else None

    boundary = 0
    for i, token in enumerate(tokens):
        if i < boundary or not ISIN.fullmatch(token):
            continue
        # The name: the words since the last row (or the header) ended, after the client ID
        before = tokens[boundary:i]
        if client in before:
            before = before[len(before) - before[::-1].index(client):]
        # The values: the first run of as many numbers as the table has number columns
        run_start = None
        for j in range(i + 1, len(tokens)):
            if NUMBER.match(tokens[j]):
                run_start = j if run_start is None else run_start
                if j - run_start + 1 == len(names):
                    break
            else:
                run_start = None
                if ISIN.fullmatch(tokens[j]):
                    break
        else:
            j = len(tokens)
        if run_start is None or j - run_start + 1 != len(names):
            book.unreadable.append(f"{token}: couldn't read its numbers")
            boundary = i + 1
            continue
        values = {name: parse_number(tokens[run_start + k]) for k, name in enumerate(names) if name}
        book.positions.append(_position(" ".join(before) or token, token, values))
        boundary = j + 1
    return book


def parse(content: bytes, filename: str, password: Optional[str] = None) -> HoldingsFile:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        book = _from_pdf(content)
    elif lower.endswith((".xlsx", ".csv")):
        if lower.endswith(".xlsx"):
            content = _open_excel(content, password)
        try:
            book = _from_table(rows(content, filename))
        except HoldingsFileError:
            raise
        except BrokerFileError as e:
            raise HoldingsFileError(str(e)) from e
    else:
        raise HoldingsFileError("Choose the .xlsx file Angel One gave you, or a .csv or .pdf copy of it.")
    book.positions = [p for p in book.positions if p.quantity > 0]
    return book


def year_before(day: date) -> date:
    try:
        return day.replace(year=day.year - 1)
    except ValueError:  # 29 February
        return day.replace(year=day.year - 1, day=28)


def lots(position: Position, as_of: date) -> list[Lot]:
    """The long-held part and the recent part of a holding, dated as late as each could have been bought"""
    short = min(max(position.short_quantity, 0.0), position.quantity)
    long = position.quantity - short

    def price(value: float, quantity: float) -> Optional[float]:
        per_share = _per_share(value, quantity, position.average_price) if quantity > 0 and value > 0 else 0.0
        chosen = per_share or position.average_price
        return round(chosen, 4) if chosen > 0 else None

    found = []
    if long > 0:
        found.append(Lot("long", year_before(as_of) - timedelta(days=1), round(long, 6),
                         price(position.long_value, position.long_quantity)))
    if short > 0:
        found.append(Lot("short", as_of, round(short, 6), price(position.short_value, position.short_quantity)))
    return found
